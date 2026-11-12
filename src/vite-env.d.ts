/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    window: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
    fs: {
      readDir: (path: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
      createDir: (path: string) => Promise<{ success: boolean; error?: string }>
      rename: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
      delete: (path: string) => Promise<{ success: boolean; error?: string }>
      moveToTrash: (path: string) => Promise<{ success: boolean; error?: string }>
      copy: (src: string, dest: string) => Promise<{ success: boolean; error?: string }>
      move: (src: string, dest: string) => Promise<{ success: boolean; error?: string }>
      stat: (path: string) => Promise<{ success: boolean; data?: any; error?: string }>
      exists: (path: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>
      readFile: (path: string) => Promise<{ success: boolean; data?: string; isMedia?: boolean; error?: string }>
      getThumbnail: (path: string) => Promise<{ success: boolean; data?: string }>
      getFolderSize: (path: string) => Promise<{ success: boolean; size?: number; error?: string }>
      getDrives: () => Promise<{ success: boolean; data?: any[]; error?: string }>
    }
    analyzer: {
      startScan: (path: string) => Promise<{ success: boolean; data?: any; error?: string; cancelled?: boolean }>
      cancelScan: () => Promise<{ success: boolean }>
      onProgress: (callback: (data: any) => void) => () => void
    }
    system: {
      getInfo: () => Promise<{ success: boolean; data?: any }>
    }
    shell: {
      openFile: (path: string) => Promise<{ success: boolean; error?: string }>
      showInFolder: (path: string) => Promise<{ success: boolean }>
      openExternal: (url: string) => void
    }
    dialog: {
      openDirectory: () => Promise<{ success: boolean; data?: any }>
      openFile: () => Promise<{ success: boolean; data?: any }>
    }
    transfer: {
      start: (port?: number, downloadDir?: string) => Promise<{
        success: boolean
        port: number
        url: string
        qrCodeDataUrl: string
        token: string
        ip: string
        error?: string
      }>
      stop: () => Promise<{ success: boolean }>
      getStatus: () => Promise<{ success: boolean; data?: any }>
      setDownloadDir: (dirPath: string) => Promise<{ success: boolean }>
      addSharedFile: (filePath: string) => Promise<{ success: boolean }>
      removeSharedFile: (fileId: string) => Promise<{ success: boolean }>
      getSharedFiles: () => Promise<{ success: boolean; data?: any[] }>
      onProgress: (callback: (data: any) => void) => () => void
      onDeviceConnected: (callback: (device: any) => void) => () => void
      onDeviceDisconnected: (callback: (deviceId: string) => void) => () => void
    }
  }
}

