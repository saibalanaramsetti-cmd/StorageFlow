export interface FileItem {
  name: string
  path: string
  size: number
  type: 'file' | 'directory'
  extension: string
  modified: Date | string
  created: Date | string
  isHidden: boolean
}

export interface DriveInfo {
  letter: string
  label: string
  total: number
  used: number
  free: number
  fileSystem: string
}

export interface FolderSize {
  path: string
  name: string
  size: number
  fileCount: number
  children?: FolderSize[]
}

export interface TransferDevice {
  id: string
  name: string
  ip: string
  connectedAt: Date | string
  userAgent?: string
}

export interface TransferFile {
  id: string
  fileName: string
  fileSize: number
  progress?: number
  speed?: number
  status: 'pending' | 'transferring' | 'completed' | 'failed'
  direction: 'upload' | 'download'
  device: string
  timestamp: Date | string
}

export interface AppSettings {
  theme: 'dark' | 'light'
  defaultDownloadPath: string
  showHiddenFiles: boolean
  filePreviewEnabled: boolean
  transferPort: number
  confirmDelete: boolean
  defaultViewMode: 'grid' | 'list'
}

export type ViewMode = 'grid' | 'list' | 'tree'
export type SortField = 'name' | 'size' | 'modified' | 'type'
export type SortOrder = 'asc' | 'desc'
