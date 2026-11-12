import { app, BrowserWindow, ipcMain, shell, dialog, protocol, net } from 'electron'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs'
import os from 'os'
import { exec } from 'child_process'
import { storageScanner } from './ipc/storageScanner.js'
import { transferServer } from '../server/transferServer.js'

// Register privileged scheme for high-speed local thumbnail rendering
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
])

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.APP_ROOT = path.join(__dirname, '..')

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
    show: false,
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Hook transfer server events to notify window
  transferServer.setCallbacks({
    onProgress: (data) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('transfer:progress', data)
      }
    },
    onDeviceConnected: (device) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('transfer:deviceConnected', device)
      }
    },
    onDeviceDisconnected: (deviceId) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('transfer:deviceDisconnected', deviceId)
      }
    }
  })
}

app.on('window-all-closed', () => {
  transferServer.stop()
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(() => {
  // Handle local media streaming for crystal-clear fast thumbnails
  protocol.handle('media', async (request) => {
    try {
      const raw = request.url.replace(/^media:\/\/local\/?/, '')
      const decoded = decodeURIComponent(raw)
      const normalized = path.normalize(decoded)
      const buffer = await fs.promises.readFile(normalized)
      const ext = path.extname(normalized).toLowerCase()
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.gif'
                ? 'image/gif'
                : 'image/jpeg'
      return new Response(buffer, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400',
        },
      })
    } catch (err: any) {
      return new Response(err.message, { status: 404 })
    }
  })

  createWindow()
})

// Window controls
ipcMain.on('window-minimize', () => win?.minimize())
ipcMain.on('window-maximize', () => {
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
ipcMain.on('window-close', () => win?.close())
ipcMain.on('open-external', (_, url: string) => shell.openExternal(url))

// File system operations
ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return { success: false, error: 'Path does not exist' }
    }
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    const items = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name)
        try {
          const stats = await fs.promises.stat(fullPath)
          return {
            name: entry.name,
            path: fullPath,
            size: stats.size,
            type: entry.isDirectory() ? 'directory' : 'file',
            extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : '',
            modified: stats.mtime,
            created: stats.birthtime,
            isHidden: entry.name.startsWith('.'),
          }
        } catch {
          return {
            name: entry.name,
            path: fullPath,
            size: 0,
            type: entry.isDirectory() ? 'directory' : 'file',
            extension: '',
            modified: new Date(),
            created: new Date(),
            isHidden: entry.name.startsWith('.'),
          }
        }
      })
    )
    return { success: true, data: items.filter(Boolean) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// Accurate recursive directory size calculation with memory caching
const folderSizeCache = new Map<string, { size: number; fileCount: number; folderCount: number; timestamp: number }>()

// Queue to limit concurrent folder size calculations to prevent disk I/O thrashing
let activeCalculations = 0
const MAX_CONCURRENT_SIZE_CALCS = 3
const calculationQueue: Array<() => void> = []

function enqueueSizeCalc<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const execute = () => {
      activeCalculations++
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeCalculations--
          if (calculationQueue.length > 0) {
            const next = calculationQueue.shift()
            if (next) next()
          }
        })
    }

    if (activeCalculations < MAX_CONCURRENT_SIZE_CALCS) {
      execute()
    } else {
      calculationQueue.push(execute)
    }
  })
}

ipcMain.handle('fs:getFolderSize', async (_, dirPath: string) => {
  const cached = folderSizeCache.get(dirPath)
  if (cached && Date.now() - cached.timestamp < 300000) {
    return { success: true, size: cached.size, fileCount: cached.fileCount, folderCount: cached.folderCount }
  }

  return enqueueSizeCalc(async () => {
    // Check cache again after entering queue
    const cachedAgain = folderSizeCache.get(dirPath)
    if (cachedAgain && Date.now() - cachedAgain.timestamp < 300000) {
      return { success: true, size: cachedAgain.size, fileCount: cachedAgain.fileCount, folderCount: cachedAgain.folderCount }
    }

    let totalSize = 0
    let fileCount = 0
    let folderCount = 0
    let yieldCounter = 0

    const queue: string[] = [dirPath]

    try {
      while (queue.length > 0) {
        const current = queue.shift()!
        yieldCounter++

        // Yield to event loop every 60 directories so UI never freezes
        if (yieldCounter % 60 === 0) {
          await new Promise((r) => setImmediate(r))
        }

        try {
          const entries = await fs.promises.readdir(current, { withFileTypes: true })
          for (const item of entries) {
            // Crucial on Windows: skip symlinks & junction points (e.g. Application Data) to prevent infinite loops
            if (item.isSymbolicLink()) continue

            const itemPath = path.join(current, item.name)
            try {
              if (item.isDirectory()) {
                if (item.name === '$RECYCLE.BIN' || item.name === 'System Volume Information') {
                  continue
                }
                folderCount++
                queue.push(itemPath)
              } else if (item.isFile()) {
                fileCount++
                const st = await fs.promises.stat(itemPath)
                totalSize += st.size
              }
            } catch {
              // Permission error on individual item
            }
          }
        } catch {
          // Permission error on directory
        }
      }

      folderSizeCache.set(dirPath, {
        size: totalSize,
        fileCount,
        folderCount,
        timestamp: Date.now()
      })

      return { success: true, size: totalSize, fileCount, folderCount }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
})

ipcMain.handle('fs:createDir', async (_, dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  try {
    await fs.promises.rename(oldPath, newPath)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:delete', async (_, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath)
    if (stats.isDirectory()) {
      await fs.promises.rm(filePath, { recursive: true, force: true })
    } else {
      await fs.promises.unlink(filePath)
    }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:moveToTrash', async (_, filePath: string) => {
  try {
    await shell.trashItem(filePath)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:copy', async (_, src: string, dest: string) => {
  try {
    const stats = await fs.promises.stat(src)
    if (stats.isDirectory()) {
      await fs.promises.cp(src, dest, { recursive: true })
    } else {
      await fs.promises.copyFile(src, dest)
    }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:move', async (_, src: string, dest: string) => {
  try {
    await fs.promises.rename(src, dest)
    return { success: true }
  } catch (error: any) {
    // If cross-device move, copy and delete
    try {
      const stats = await fs.promises.stat(src)
      if (stats.isDirectory()) {
        await fs.promises.cp(src, dest, { recursive: true })
        await fs.promises.rm(src, { recursive: true, force: true })
      } else {
        await fs.promises.copyFile(src, dest)
        await fs.promises.unlink(src)
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
})

ipcMain.handle('fs:stat', async (_, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath)
    return {
      success: true,
      data: {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      },
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:exists', async (_, filePath: string) => {
  try {
    await fs.promises.access(filePath)
    return { success: true, exists: true }
  } catch {
    return { success: true, exists: false }
  }
})

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath)
    if (stats.size > 15 * 1024 * 1024) {
      return { success: false, error: 'File too large for preview (over 15MB)' }
    }
    const ext = path.extname(filePath).toLowerCase()
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext)

    if (isImage) {
      const buffer = await fs.promises.readFile(filePath)
      const base64 = buffer.toString('base64')
      const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : 'image/jpeg'
      return { success: true, data: `data:${mime};base64,${base64}`, isMedia: true }
    }

    const content = await fs.promises.readFile(filePath, 'utf-8')
    return { success: true, data: content, isMedia: false }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:getThumbnail', async (_, filePath: string) => {
  try {
    const ext = path.extname(filePath).toLowerCase()
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext)
    if (!isImage) return { success: false }
    const buf = await fs.promises.readFile(filePath)
    const base64 = buf.toString('base64')
    const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : 'image/jpeg'
    return { success: true, data: `data:${mime};base64,${base64}` }
  } catch {
    return { success: false }
  }
})

// Windows Drives Detection with PowerShell + WMIC + fallback scan
ipcMain.handle('fs:getDrives', async () => {
  if (process.platform !== 'win32') {
    return {
      success: true,
      data: [{ letter: '/', label: 'Root', free: 50000000000, total: 100000000000, used: 50000000000, fileSystem: 'ext4' }]
    }
  }

  // Try PowerShell Get-CimInstance (fastest & most modern on Win 10/11)
  const getViaPowerShell = (): Promise<any[]> => {
    return new Promise((resolve) => {
      exec(
        'powershell "Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace, FileSystem | ConvertTo-Json"',
        { timeout: 5000 },
        (error, stdout) => {
          if (error || !stdout) {
            resolve([])
            return
          }
          try {
            const parsed = JSON.parse(stdout)
            const list = Array.isArray(parsed) ? parsed : [parsed]
            const drives = list
              .filter((d) => d.DeviceID && d.Size)
              .map((d) => {
                const total = parseInt(d.Size) || 0
                const free = parseInt(d.FreeSpace) || 0
                return {
                  letter: d.DeviceID,
                  label: d.VolumeName || (d.DeviceID === 'C:' ? 'System' : 'Local Disk'),
                  total,
                  free,
                  used: total - free,
                  fileSystem: d.FileSystem || 'NTFS'
                }
              })
            resolve(drives)
          } catch {
            resolve([])
          }
        }
      )
    })
  }

  const psDrives = await getViaPowerShell()
  if (psDrives.length > 0) {
    return { success: true, data: psDrives }
  }

  // Fallback: Check letters C through Z
  const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const foundDrives = []
  for (const letter of letters) {
    const rootPath = `${letter}:\\`
    try {
      if (fs.existsSync(rootPath)) {
        foundDrives.push({
          letter: `${letter}:`,
          label: letter === 'C' ? 'System Disk' : `Disk (${letter}:)`,
          total: 256 * 1024 * 1024 * 1024,
          free: 128 * 1024 * 1024 * 1024,
          used: 128 * 1024 * 1024 * 1024,
          fileSystem: 'NTFS'
        })
      }
    } catch { }
  }

  return { success: true, data: foundDrives }
})

// Storage Analyzer
ipcMain.handle('analyzer:startScan', async (_, scanPath: string) => {
  return await storageScanner.scan(scanPath, win)
})

ipcMain.handle('analyzer:cancelScan', () => {
  storageScanner.cancel()
  return { success: true }
})

// Wireless Transfer Server
ipcMain.handle('transfer:start', async (_, port?: number, downloadDir?: string) => {
  return await transferServer.start(port || 52140, downloadDir)
})

ipcMain.handle('transfer:stop', async () => {
  const stopped = await transferServer.stop()
  return { success: stopped }
})

ipcMain.handle('transfer:getStatus', () => {
  return { success: true, data: transferServer.getStatus() }
})

ipcMain.handle('transfer:setDownloadDir', (_, dirPath: string) => {
  const success = transferServer.setDownloadDir(dirPath)
  return { success }
})

ipcMain.handle('transfer:addSharedFile', (_, filePath: string) => {
  const success = transferServer.addSharedFile(filePath)
  return { success }
})

ipcMain.handle('transfer:removeSharedFile', (_, fileId: string) => {
  const success = transferServer.removeSharedFile(fileId)
  return { success }
})

ipcMain.handle('transfer:getSharedFiles', () => {
  return { success: true, data: transferServer.getSharedFiles() }
})

// System info and Quick Access Paths
ipcMain.handle('system:getInfo', async () => {
  const home = os.homedir()
  return {
    success: true,
    data: {
      platform: process.platform,
      homeDir: home,
      tempDir: os.tmpdir(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      quickPaths: {
        desktop: path.join(home, 'Desktop'),
        documents: path.join(home, 'Documents'),
        downloads: path.join(home, 'Downloads'),
        pictures: path.join(home, 'Pictures'),
        music: path.join(home, 'Music'),
        videos: path.join(home, 'Videos'),
      }
    },
  }
})

// Shell & Dialog
ipcMain.handle('shell:openFile', async (_, filePath: string) => {
  try {
    await shell.openPath(filePath)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('shell:showInFolder', (_, filePath: string) => {
  shell.showItemInFolder(filePath)
  return { success: true }
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
  })
  return { success: true, data: result }
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile', 'multiSelections'],
  })
  return { success: true, data: result }
})
