import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'

export interface FolderFileItem {
  name: string
  path: string
  size: number
  extension: string
}

export interface FolderTreeNode {
  name: string
  path: string
  size: number
  fileCount: number
  filesTotalSize: number
  subfolders: FolderTreeNode[]
  files: FolderFileItem[]
}

export interface ScanResult {
  totalSize: number
  totalFiles: number
  totalFolders: number
  largestFolders: Array<{ path: string; name: string; size: number; fileCount: number }>
  largestFiles: Array<{ path: string; name: string; size: number; extension: string }>
  typeDistribution: Record<string, { size: number; count: number }>
  rootTree: FolderTreeNode
}

export class StorageScanner {
  private isCancelled = false
  private isScanning = false
  private scanCache = new Map<string, { timestamp: number; result: ScanResult }>()
  private CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache

  public cancel() {
    this.isCancelled = true
  }

  public getCached(scanPath: string): ScanResult | null {
    const cached = this.scanCache.get(scanPath)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result
    }
    return null
  }

  private async quickCalc(startPath: string): Promise<{ size: number; fileCount: number; folderCount: number }> {
    let size = 0
    let fileCount = 0
    let folderCount = 0
    const queue: string[] = [startPath]
    let yields = 0

    while (queue.length > 0 && !this.isCancelled) {
      const current = queue.shift()!
      yields++
      if (yields % 100 === 0) {
        await new Promise((r) => setImmediate(r))
      }

      try {
        const entries = await fs.promises.readdir(current, { withFileTypes: true })
        for (const item of entries) {
          if (item.isSymbolicLink()) continue
          const full = path.join(current, item.name)
          try {
            if (item.isDirectory()) {
              if (item.name === '$RECYCLE.BIN' || item.name === 'System Volume Information') continue
              folderCount++
              queue.push(full)
            } else if (item.isFile()) {
              fileCount++
              const st = await fs.promises.stat(full)
              size += st.size
            }
          } catch {}
        }
      } catch {}
    }

    return { size, fileCount, folderCount }
  }

  public async scan(
    rootPath: string,
    window: BrowserWindow | null,
    maxDepth = 15
  ): Promise<{ success: boolean; data?: ScanResult; error?: string; cancelled?: boolean }> {
    if (this.isScanning) {
      return { success: false, error: 'A scan is already in progress' }
    }

    this.isScanning = true
    this.isCancelled = false

    const cached = this.getCached(rootPath)
    if (cached) {
      this.isScanning = false
      return { success: true, data: cached }
    }

    try {
      const typeDistribution: Record<string, { size: number; count: number }> = {}
      const allFiles: Array<{ path: string; name: string; size: number; extension: string }> = []
      const folderSizes: Array<{ path: string; name: string; size: number; fileCount: number }> = []

      let totalSize = 0
      let totalFiles = 0
      let totalFolders = 0
      let lastProgressReport = Date.now()

      const getFileTypeCategory = (ext: string): string => {
        const clean = ext.toLowerCase().replace('.', '')
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(clean)) return 'Images'
        if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(clean)) return 'Videos'
        if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(clean)) return 'Audio'
        if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'].includes(clean)) return 'Documents'
        if (['zip', 'rar', 'gz', 'tar', '7z', 'bz2', 'iso'].includes(clean)) return 'Archives'
        if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json'].includes(clean)) return 'Code'
        return 'Other'
      }

      // Non-blocking recursive scan with setImmediate yields
      const scanDir = async (
        dirPath: string,
        depth: number
      ): Promise<FolderTreeNode> => {
        let dirTotalSize = 0
        let dirTotalFiles = 0
        let filesTotalSize = 0
        const subfolders: FolderTreeNode[] = []
        const directFiles: FolderFileItem[] = []

        if (this.isCancelled) {
          return {
            name: path.basename(dirPath) || dirPath,
            path: dirPath,
            size: 0,
            fileCount: 0,
            filesTotalSize: 0,
            subfolders: [],
            files: []
          }
        }

        // Yield to Node event loop every 40 files
        if (totalFiles % 40 === 0) {
          await new Promise((r) => setImmediate(r))
        }

        try {
          const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

          for (const entry of entries) {
            if (this.isCancelled) break
            const fullPath = path.join(dirPath, entry.name)

            try {
              if (entry.isSymbolicLink()) {
                continue
              }

              if (entry.isDirectory()) {
                // Avoid scanning system junctions
                if (
                  entry.name === '$RECYCLE.BIN' ||
                  entry.name === 'System Volume Information'
                ) {
                  continue
                }

                totalFolders++
                if (depth < maxDepth) {
                  const subNode = await scanDir(fullPath, depth + 1)
                  dirTotalSize += subNode.size
                  dirTotalFiles += subNode.fileCount
                  subfolders.push(subNode)
                  folderSizes.push({
                    name: entry.name,
                    path: fullPath,
                    size: subNode.size,
                    fileCount: subNode.fileCount
                  })
                } else {
                  // If beyond display depth, still compute full recursive size so totals are 100% accurate
                  const deep = await this.quickCalc(fullPath)
                  dirTotalSize += deep.size
                  dirTotalFiles += deep.fileCount
                  totalSize += deep.size
                  totalFiles += deep.fileCount
                  totalFolders += deep.folderCount
                }
              } else if (entry.isFile()) {
                const stats = await fs.promises.stat(fullPath)
                const fileSize = stats.size
                const ext = path.extname(entry.name).toLowerCase()
                const category = getFileTypeCategory(ext)

                filesTotalSize += fileSize
                dirTotalSize += fileSize
                dirTotalFiles++
                totalSize += fileSize
                totalFiles++

                if (!typeDistribution[category]) {
                  typeDistribution[category] = { size: 0, count: 0 }
                }
                typeDistribution[category].size += fileSize
                typeDistribution[category].count++

                const fileItem: FolderFileItem = {
                  path: fullPath,
                  name: entry.name,
                  size: fileSize,
                  extension: ext
                }

                directFiles.push(fileItem)
                allFiles.push(fileItem)
              }
            } catch {
              // Permission error or file disappeared
            }

            // Report progress every 200ms
            if (Date.now() - lastProgressReport > 200 && window && !window.isDestroyed()) {
              lastProgressReport = Date.now()
              window.webContents.send('analyzer:progress', {
                currentPath: fullPath,
                scannedFiles: totalFiles,
                scannedSize: totalSize,
                scannedFolders: totalFolders
              })
            }
          }
        } catch {
          // Directory permission error
        }

        // Sort descending by size
        subfolders.sort((a, b) => b.size - a.size)
        directFiles.sort((a, b) => b.size - a.size)

        return {
          name: path.basename(dirPath) || dirPath,
          path: dirPath,
          size: dirTotalSize,
          fileCount: dirTotalFiles,
          filesTotalSize,
          subfolders,
          files: directFiles
        }
      }

      const rootTree = await scanDir(rootPath, 0)

      if (this.isCancelled) {
        this.isScanning = false
        return { success: false, cancelled: true }
      }

      folderSizes.sort((a, b) => b.size - a.size)
      allFiles.sort((a, b) => b.size - a.size)

      const result: ScanResult = {
        totalSize,
        totalFiles,
        totalFolders,
        largestFolders: folderSizes.slice(0, 20),
        largestFiles: allFiles.slice(0, 30),
        typeDistribution,
        rootTree
      }

      this.scanCache.set(rootPath, { timestamp: Date.now(), result })
      this.isScanning = false
      return { success: true, data: result }
    } catch (err: any) {
      this.isScanning = false
      return { success: false, error: err.message }
    }
  }
}

export const storageScanner = new StorageScanner()
