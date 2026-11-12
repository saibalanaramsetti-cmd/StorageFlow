import { contextBridge, ipcRenderer } from 'electron'

const api = {
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  },
  fs: {
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    createDir: (dirPath: string) => ipcRenderer.invoke('fs:createDir', dirPath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    delete: (filePath: string) => ipcRenderer.invoke('fs:delete', filePath),
    moveToTrash: (filePath: string) => ipcRenderer.invoke('fs:moveToTrash', filePath),
    copy: (src: string, dest: string) => ipcRenderer.invoke('fs:copy', src, dest),
    move: (src: string, dest: string) => ipcRenderer.invoke('fs:move', src, dest),
    stat: (filePath: string) => ipcRenderer.invoke('fs:stat', filePath),
    exists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    getThumbnail: (filePath: string) => ipcRenderer.invoke('fs:getThumbnail', filePath),
    getFolderSize: (dirPath: string) => ipcRenderer.invoke('fs:getFolderSize', dirPath),
    getDrives: () => ipcRenderer.invoke('fs:getDrives'),
  },
  analyzer: {
    startScan: (scanPath: string) => ipcRenderer.invoke('analyzer:startScan', scanPath),
    cancelScan: () => ipcRenderer.invoke('analyzer:cancelScan'),
    onProgress: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('analyzer:progress', handler)
      return () => ipcRenderer.removeListener('analyzer:progress', handler)
    },
  },
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
  },
  shell: {
    openFile: (filePath: string) => ipcRenderer.invoke('shell:openFile', filePath),
    showInFolder: (filePath: string) => ipcRenderer.invoke('shell:showInFolder', filePath),
    openExternal: (url: string) => ipcRenderer.send('open-external', url),
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
  },
  transfer: {
    start: (port?: number, downloadDir?: string) => ipcRenderer.invoke('transfer:start', port, downloadDir),
    stop: () => ipcRenderer.invoke('transfer:stop'),
    getStatus: () => ipcRenderer.invoke('transfer:getStatus'),
    setDownloadDir: (dirPath: string) => ipcRenderer.invoke('transfer:setDownloadDir', dirPath),
    addSharedFile: (filePath: string) => ipcRenderer.invoke('transfer:addSharedFile', filePath),
    removeSharedFile: (fileId: string) => ipcRenderer.invoke('transfer:removeSharedFile', fileId),
    getSharedFiles: () => ipcRenderer.invoke('transfer:getSharedFiles'),
    onProgress: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('transfer:progress', handler)
      return () => ipcRenderer.removeListener('transfer:progress', handler)
    },
    onDeviceConnected: (callback: (device: any) => void) => {
      const handler = (_: any, device: any) => callback(device)
      ipcRenderer.on('transfer:deviceConnected', handler)
      return () => ipcRenderer.removeListener('transfer:deviceConnected', handler)
    },
    onDeviceDisconnected: (callback: (deviceId: string) => void) => {
      const handler = (_: any, deviceId: string) => callback(deviceId)
      ipcRenderer.on('transfer:deviceDisconnected', handler)
      return () => ipcRenderer.removeListener('transfer:deviceDisconnected', handler)
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
