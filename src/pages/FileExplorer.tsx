import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Folder,
  File,
  HardDrive,
  ChevronRight,
  ArrowLeft,
  ArrowUp,
  RefreshCw,
  Search,
  Grid,
  List as ListIcon,
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  FolderPlus,
  Eye,
  Info,
  Edit2,
  Share2,
  ArrowUpDown,
  CheckSquare,
  Square,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Code,
  Archive,
  ExternalLink,
  FolderTree,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { FileThumbnail } from '../components/explorer/FileThumbnail'
import { FolderConsumptionTree } from '../components/analyzer/FolderConsumptionTree'
import {
  formatBytes,
  formatDate,
  formatRelativeDate,
  getFileTypeCategory,
  getFileTypeColor,
} from '../utils/formatters'
import { isValidFileName } from '../utils/validators'
import { useTheme } from '../hooks/useTheme'
import type { FileItem, DriveInfo, SortField, SortOrder, ViewMode } from '../types'

export function FileExplorer() {
  const { theme } = useTheme()
  const { encodedPath } = useParams<{ encodedPath?: string }>()
  const navigate = useNavigate()

  // Navigation State
  const [currentPath, setCurrentPath] = useState<string>('')
  const [items, setItems] = useState<FileItem[]>([])
  const [drives, setDrives] = useState<DriveInfo[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Selection & Clipboard State
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<{
    paths: string[]
    operation: 'copy' | 'cut'
  } | null>(null)

  // View & Filter State
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // Folder Sizes & Hierarchical Tree State
  const [folderSizes, setFolderSizes] = useState<Record<string, number>>({})
  const [treeData, setTreeData] = useState<any>(null)
  const [treeLoading, setTreeLoading] = useState<boolean>(false)

  // Modals & Panels
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null)
  const [previewContent, setPreviewContent] = useState<{ text?: string; mediaUrl?: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState<boolean>(false)

  const [propertiesItem, setPropertiesItem] = useState<FileItem | null>(null)

  // Ensure size is calculated when opening Properties on a folder
  useEffect(() => {
    if (propertiesItem && propertiesItem.type === 'directory' && folderSizes[propertiesItem.path] === undefined) {
      window.electronAPI?.fs.getFolderSize(propertiesItem.path).then((res) => {
        if (res?.success && res.size !== undefined) {
          setFolderSizes((prev) => ({ ...prev, [propertiesItem.path]: res.size! }))
        }
      })
    }
  }, [propertiesItem, folderSizes])
  const [isNewFolderOpen, setIsNewFolderOpen] = useState<boolean>(false)
  const [newFolderName, setNewFolderName] = useState<string>('')
  const [isRenameOpen, setIsRenameOpen] = useState<boolean>(false)
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null)
  const [renameValue, setRenameValue] = useState<string>('')
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false)
  const [deletePermanent, setDeletePermanent] = useState<boolean>(false)

  // Load drives
  useEffect(() => {
    window.electronAPI?.fs.getDrives().then((res) => {
      if (res?.success && res.data) {
        setDrives(res.data)
      }
    })
  }, [])

  // Resolve target directory path
  useEffect(() => {
    if (encodedPath) {
      try {
        const decoded = decodeURIComponent(encodedPath)
        setCurrentPath(decoded)
      } catch {
        // Fallback to C:\
        setCurrentPath('C:\\')
      }
    } else {
      // Default to Desktop or C:\
      window.electronAPI?.system.getInfo().then((res) => {
        if (res?.success && res.data?.quickPaths?.desktop) {
          setCurrentPath(res.data.quickPaths.desktop)
        } else {
          setCurrentPath('C:\\')
        }
      })
    }
  }, [encodedPath])

  // Load Directory Items
  const loadDirectory = useCallback(async (dirPath: string) => {
    if (!dirPath) return
    setLoading(true)
    setError(null)
    setSelectedPaths(new Set())

    try {
      const result = await window.electronAPI?.fs.readDir(dirPath)
      if (result?.success && result.data) {
        setItems(result.data)
      } else {
        setError(result?.error || 'Failed to read directory')
      }
    } catch (err: any) {
      setError(err.message || 'Error reading directory')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentPath) {
      loadDirectory(currentPath)
    }
  }, [currentPath, loadDirectory])

  // Automatically calculate real folder consumption sizes asynchronously
  useEffect(() => {
    let active = true
    const dirItems = items.filter((i) => i.type === 'directory')
    if (dirItems.length === 0) return

    dirItems.forEach(async (dir) => {
      try {
        const res = await window.electronAPI?.fs.getFolderSize(dir.path)
        if (active && res?.success && res.size !== undefined) {
          setFolderSizes((prev) => ({ ...prev, [dir.path]: res.size! }))
        }
      } catch {}
    })

    return () => {
      active = false
    }
  }, [items])

  // Automatically load tree breakdown when Tree View is selected
  useEffect(() => {
    if (viewMode === 'tree' && currentPath) {
      setTreeLoading(true)
      window.electronAPI?.analyzer.startScan(currentPath).then((res) => {
        if (res?.success && res.data?.rootTree) {
          setTreeData(res.data)
        }
      }).finally(() => {
        setTreeLoading(false)
      })
    }
  }, [viewMode, currentPath])

  // Navigate to folder
  const navigateTo = (targetPath: string) => {
    navigate(`/explorer/${encodeURIComponent(targetPath)}`)
  }

  // Navigate Up
  const navigateUp = () => {
    if (!currentPath) return
    const isDriveRoot = /^[A-Z]:\\?$/i.test(currentPath)
    if (isDriveRoot) {
      // Stay on drive
      return
    }
    const parts = currentPath.replace(/\\$/, '').split('\\')
    parts.pop()
    const parentPath = parts.join('\\') + (parts.length === 1 ? '\\' : '')
    navigateTo(parentPath)
  }

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return []
    const normalized = currentPath.replace(/\//g, '\\')
    const parts = normalized.split('\\').filter(Boolean)
    const crumbs: Array<{ label: string; path: string }> = []

    let accumulated = ''
    parts.forEach((part, idx) => {
      if (idx === 0) {
        accumulated = part.includes(':') ? `${part}\\` : part
        crumbs.push({ label: part, path: accumulated })
      } else {
        accumulated = `${accumulated.replace(/\\$/, '')}\\${part}`
        crumbs.push({ label: part, path: accumulated })
      }
    })
    return crumbs
  }, [currentPath])

  // Filtered and Sorted items
  const processedItems = useMemo(() => {
    let result = [...items]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }

    result.sort((a, b) => {
      // Directories always come first
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }

      let comparison = 0
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      } else if (sortField === 'size') {
        const sizeA = a.type === 'directory' ? (folderSizes[a.path] || 0) : (a.size || 0)
        const sizeB = b.type === 'directory' ? (folderSizes[b.path] || 0) : (b.size || 0)
        comparison = sizeA - sizeB
      } else if (sortField === 'modified') {
        comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime()
      } else if (sortField === 'type') {
        comparison = (a.extension || '').localeCompare(b.extension || '')
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [items, searchQuery, sortField, sortOrder, folderSizes])

  // Selection handlers
  const toggleSelect = (itemPath: string, multi = false) => {
    const next = new Set(multi ? selectedPaths : [])
    if (next.has(itemPath)) {
      next.delete(itemPath)
    } else {
      next.add(itemPath)
    }
    setSelectedPaths(next)
  }

  const selectAll = () => {
    if (selectedPaths.size === processedItems.length) {
      setSelectedPaths(new Set())
    } else {
      setSelectedPaths(new Set(processedItems.map((i) => i.path)))
    }
  }

  // Create Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !isValidFileName(newFolderName)) {
      alert('Please enter a valid folder name.')
      return
    }
    const newPath = `${currentPath.replace(/\\$/, '')}\\${newFolderName.trim()}`
    const res = await window.electronAPI?.fs.createDir(newPath)
    if (res?.success) {
      setIsNewFolderOpen(false)
      setNewFolderName('')
      loadDirectory(currentPath)
    } else {
      alert(`Error creating folder: ${res?.error}`)
    }
  }

  // Rename File / Folder
  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim() || !isValidFileName(renameValue)) {
      alert('Please enter a valid file/folder name.')
      return
    }
    const parentDir = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('\\'))
    const newPath = `${parentDir}\\${renameValue.trim()}`
    const res = await window.electronAPI?.fs.rename(renameTarget.path, newPath)
    if (res?.success) {
      setIsRenameOpen(false)
      setRenameTarget(null)
      loadDirectory(currentPath)
    } else {
      alert(`Rename error: ${res?.error}`)
    }
  }

  // Delete Action
  const handleDelete = async () => {
    const targets = Array.from(selectedPaths)
    if (targets.length === 0) return

    for (const p of targets) {
      if (deletePermanent) {
        await window.electronAPI?.fs.delete(p)
      } else {
        await window.electronAPI?.fs.moveToTrash(p)
      }
    }
    setIsDeleteOpen(false)
    setSelectedPaths(new Set())
    loadDirectory(currentPath)
  }

  // Copy / Cut / Paste
  const handleCopy = () => {
    if (selectedPaths.size === 0) return
    setClipboard({ paths: Array.from(selectedPaths), operation: 'copy' })
  }

  const handleCut = () => {
    if (selectedPaths.size === 0) return
    setClipboard({ paths: Array.from(selectedPaths), operation: 'cut' })
  }

  const handlePaste = async () => {
    if (!clipboard || clipboard.paths.length === 0) return
    for (const src of clipboard.paths) {
      const fileName = src.split('\\').pop()
      const dest = `${currentPath.replace(/\\$/, '')}\\${fileName}`
      if (clipboard.operation === 'copy') {
        await window.electronAPI?.fs.copy(src, dest)
      } else {
        await window.electronAPI?.fs.move(src, dest)
      }
    }
    if (clipboard.operation === 'cut') {
      setClipboard(null)
    }
    loadDirectory(currentPath)
  }

  // File Preview
  const handlePreview = async (item: FileItem) => {
    setPreviewItem(item)
    setPreviewLoading(true)
    setPreviewContent(null)

    if (item.type === 'directory') {
      setPreviewLoading(false)
      return
    }

    try {
      const res = await window.electronAPI?.fs.readFile(item.path)
      if (res?.success && res.data) {
        if (res.isMedia) {
          setPreviewContent({ mediaUrl: res.data })
        } else {
          setPreviewContent({ text: res.data })
        }
      } else {
        setPreviewContent({ text: res?.error || 'Unable to preview file contents.' })
      }
    } catch (e: any) {
      setPreviewContent({ text: e.message })
    } finally {
      setPreviewLoading(false)
    }
  }

  // Share via Wireless Transfer
  const handleShareWireless = async (item: FileItem) => {
    if (item.type === 'directory') {
      alert('Please select files for wireless transfer.')
      return
    }
    const res = await window.electronAPI?.transfer.addSharedFile(item.path)
    if (res?.success) {
      navigate('/transfer')
    } else {
      alert('Could not add file to wireless transfer queue.')
    }
  }

  const getFileIcon = (item: FileItem) => {
    if (item.type === 'directory') {
      return <Folder size={viewMode === 'grid' ? 36 : 18} className="text-amber-400" />
    }
    const category = getFileTypeCategory(item.extension)
    const color = getFileTypeColor(item.extension)
    const iconSize = viewMode === 'grid' ? 34 : 17

    switch (category) {
      case 'Images':
        return <ImageIcon size={iconSize} style={{ color }} />
      case 'Videos':
        return <Video size={iconSize} style={{ color }} />
      case 'Audio':
        return <Music size={iconSize} style={{ color }} />
      case 'Documents':
        return <FileText size={iconSize} style={{ color }} />
      case 'Code':
        return <Code size={iconSize} style={{ color }} />
      case 'Archives':
        return <Archive size={iconSize} style={{ color }} />
      default:
        return <File size={iconSize} style={{ color }} />
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Top Toolbar */}
      <div
        className="px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 transition-colors"
        style={{
          background: theme === 'light' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(15, 15, 24, 0.6)',
          borderColor: theme === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Navigation & Breadcrumbs */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <button
            onClick={navigateUp}
            title="Go to parent directory"
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowUp size={16} />
          </button>
          <button
            onClick={() => loadDirectory(currentPath)}
            title="Reload directory"
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Breadcrumb Path Bar */}
          <div className="flex-1 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 overflow-x-auto text-xs font-medium">
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.path} className="flex items-center gap-1 flex-shrink-0">
                {idx > 0 && <ChevronRight size={12} className="text-gray-500" />}
                <button
                  onClick={() => navigateTo(crumb.path)}
                  className={`px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors ${
                    idx === breadcrumbs.length - 1
                      ? 'text-white font-semibold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {crumb.label}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          {/* Instant Search Bar */}
          <div className="relative w-48 lg:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search in folder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500/80 transition-all"
            />
          </div>

          {/* New Folder */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsNewFolderOpen(true)}
            icon={<FolderPlus size={14} />}
            title="Create New Folder"
          >
            New Folder
          </Button>

          {/* Grid / List / Tree Switch */}
          <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ListIcon size={14} />
            </button>
            <button
              onClick={() => setViewMode('tree')}
              title="Tree Size Breakdown (Shows folder consumption tree)"
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'tree'
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/30'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <FolderTree size={14} className={viewMode === 'tree' ? 'text-black' : 'text-amber-400'} />
              <span className="text-[11px] font-semibold">Tree Size</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-toolbar: Selection & Clipboard Controls */}
      <div className="px-6 py-2 border-b border-white/5 bg-white/[0.02] flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            {selectedPaths.size > 0 && selectedPaths.size === processedItems.length ? (
              <CheckSquare size={13} className="text-blue-400" />
            ) : (
              <Square size={13} />
            )}
            <span>
              {selectedPaths.size > 0 ? `${selectedPaths.size} selected` : 'Select all'}
            </span>
          </button>

          {selectedPaths.size > 0 && (
            <div className="flex items-center gap-1 border-l border-white/10 pl-3">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 hover:text-white transition-colors"
              >
                <Copy size={12} /> Copy
              </button>
              <button
                onClick={handleCut}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 hover:text-white transition-colors"
              >
                <Scissors size={12} /> Cut
              </button>
              <button
                onClick={() => {
                  const firstPath = Array.from(selectedPaths)[0]
                  const target = items.find((i) => i.path === firstPath)
                  if (target) {
                    setRenameTarget(target)
                    setRenameValue(target.name)
                    setIsRenameOpen(true)
                  }
                }}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 hover:text-white transition-colors"
              >
                <Edit2 size={12} /> Rename
              </button>
              <button
                onClick={() => setIsDeleteOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}

          {clipboard && (
            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <Badge color="#3b82f6">
                {clipboard.paths.length} ready to {clipboard.operation}
              </Badge>
              <button
                onClick={handlePaste}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 transition-colors font-medium"
              >
                <Clipboard size={12} /> Paste Here
              </button>
            </div>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Sort by:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-transparent text-gray-300 font-medium outline-none cursor-pointer"
            >
              <option value="name" className="bg-[#12121c]">Name</option>
              <option value="size" className="bg-[#12121c]">Size</option>
              <option value="modified" className="bg-[#12121c]">Date Modified</option>
              <option value="type" className="bg-[#12121c]">File Type</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 hover:text-white"
            >
              <ArrowUpDown size={12} />
            </button>
          </div>
          <span>{processedItems.length} items</span>
        </div>
      </div>

      {/* Main Files View Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
            <RefreshCw size={24} className="animate-spin text-blue-400" />
            <p className="text-sm">Reading directory contents...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-400">
            <p className="text-sm font-semibold">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => loadDirectory(currentPath)}>
              Retry
            </Button>
          </div>
        ) : processedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-gray-500">
            <Folder size={36} className="text-gray-600" />
            <p className="text-sm font-medium">This folder is empty</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View Layout */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {processedItems.map((item) => {
              const isSelected = selectedPaths.has(item.path)
              return (
                <div
                  key={item.path}
                  onClick={(e) => toggleSelect(item.path, e.ctrlKey || e.metaKey)}
                  onDoubleClick={() => {
                    if (item.type === 'directory') {
                      navigateTo(item.path)
                    } else {
                      window.electronAPI?.shell.openFile(item.path)
                    }
                  }}
                  className={`group relative p-3 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500/60 shadow-lg shadow-blue-500/10'
                      : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/15'
                  }`}
                >
                  <div className="w-full mb-2 mt-1">
                    <FileThumbnail item={item} viewMode="grid" />
                  </div>

                  <p
                    className="text-xs font-semibold text-gray-200 line-clamp-2 w-full break-words group-hover:text-blue-400 transition-colors"
                    title={item.name}
                  >
                    {item.name}
                  </p>

                  <span className={`text-[10px] mt-1 font-medium ${item.type === 'directory' ? 'text-amber-400 font-semibold' : 'text-gray-400'}`}>
                    {item.type === 'directory'
                      ? folderSizes[item.path] !== undefined
                        ? formatBytes(folderSizes[item.path])
                        : 'Calculating...'
                      : formatBytes(item.size)}
                  </span>

                  {/* Hover Quick Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-lg p-1">
                    {item.type === 'file' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePreview(item)
                        }}
                        title="Preview"
                        className="p-1 hover:text-blue-400 transition-colors"
                      >
                        <Eye size={12} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPropertiesItem(item)
                      }}
                      title="Properties"
                      className="p-1 hover:text-white transition-colors"
                    >
                      <Info size={12} />
                    </button>
                    {item.type === 'file' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleShareWireless(item)
                        }}
                        title="Share wirelessly"
                        className="p-1 hover:text-emerald-400 transition-colors"
                      >
                        <Share2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : viewMode === 'list' ? (
          /* List View Layout */
          <div className="space-y-1">
            <div className="grid grid-cols-12 px-3 py-2 text-xs font-semibold text-gray-500 border-b border-white/5 uppercase tracking-wider">
              <span className="col-span-6">Name</span>
              <span className="col-span-2">Date Modified</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-2 text-right">Size</span>
            </div>

            {processedItems.map((item) => {
              const isSelected = selectedPaths.has(item.path)
              return (
                <div
                  key={item.path}
                  onClick={(e) => toggleSelect(item.path, e.ctrlKey || e.metaKey)}
                  onDoubleClick={() => {
                    if (item.type === 'directory') {
                      navigateTo(item.path)
                    } else {
                      window.electronAPI?.shell.openFile(item.path)
                    }
                  }}
                  className={`grid grid-cols-12 items-center px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-colors border ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500/50 text-white font-medium'
                      : 'border-transparent hover:bg-white/5 text-gray-300'
                  }`}
                >
                  <div className="col-span-6 flex items-center gap-3 min-w-0 pr-4">
                    <FileThumbnail item={item} viewMode="list" />
                    <span className="truncate font-medium">{item.name}</span>
                  </div>
                  <div className="col-span-2 text-gray-400 truncate">
                    {formatDate(item.modified)}
                  </div>
                  <div className="col-span-2 text-gray-400 truncate">
                    {item.type === 'directory'
                      ? 'File folder'
                      : `${getFileTypeCategory(item.extension)} (${item.extension || 'file'})`}
                  </div>
                  <div className={`col-span-2 text-right font-medium ${item.type === 'directory' ? 'text-amber-400 font-semibold' : 'text-gray-300'}`}>
                    {item.type === 'directory'
                      ? folderSizes[item.path] !== undefined
                        ? formatBytes(folderSizes[item.path])
                        : 'Calculating...'
                      : formatBytes(item.size)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Tree Size Hierarchical View for Current Folder (Matches Reference Image) */
          <div className="space-y-4">
            {treeLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
                <RefreshCw size={26} className="animate-spin text-amber-400" />
                <p className="text-sm font-semibold text-white">Scanning Folder Storage Consumption...</p>
                <p className="text-xs text-gray-500 font-mono">{currentPath}</p>
              </div>
            ) : treeData?.rootTree ? (
              <FolderConsumptionTree
                rootNode={treeData.rootTree}
                totalScanSize={treeData.totalSize}
              />
            ) : (
              <div className="text-center py-16 text-gray-500 text-sm">
                No tree data available. Click reload to scan folder consumption.
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Preview Drawer / Modal */}
      <Modal
        open={!!previewItem}
        onClose={() => setPreviewItem(null)}
        title={previewItem?.name || 'File Preview'}
        width="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-white/10">
            <span>Size: {formatBytes(previewItem?.size || 0)}</span>
            <span>Modified: {formatDate(previewItem?.modified || '')}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => previewItem && window.electronAPI?.shell.openFile(previewItem.path)}
              icon={<ExternalLink size={12} />}
            >
              Open with Default App
            </Button>
          </div>

          <div
            className="rounded-xl bg-black/40 border border-white/5 p-4 max-h-[480px] overflow-auto text-xs"
            style={{ fontFamily: 'Consolas, Monaco, monospace' }}
          >
            {previewLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <RefreshCw size={20} className="animate-spin mr-2" /> Loading preview...
              </div>
            ) : previewContent?.mediaUrl ? (
              <div className="flex items-center justify-center py-4">
                <img
                  src={previewContent.mediaUrl}
                  alt={previewItem?.name}
                  className="max-h-[400px] object-contain rounded-lg shadow-lg"
                />
              </div>
            ) : previewContent?.text ? (
              <pre className="text-gray-200 whitespace-pre-wrap break-all leading-relaxed">
                {previewContent.text}
              </pre>
            ) : (
              <p className="text-center py-12 text-gray-500">
                No preview available for this binary format.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Properties Modal */}
      <Modal
        open={!!propertiesItem}
        onClose={() => setPropertiesItem(null)}
        title="File Properties"
      >
        {propertiesItem && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="p-3 rounded-xl bg-white/5">{getFileIcon(propertiesItem)}</div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-white text-sm truncate">{propertiesItem.name}</h4>
                <p className="text-gray-400">
                  {propertiesItem.type === 'directory'
                    ? 'File Folder'
                    : `${propertiesItem.extension.toUpperCase()} File`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1">
              <span className="text-gray-500">Full Path:</span>
              <span className="col-span-2 text-gray-200 break-all select-all font-mono">
                {propertiesItem.path}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1">
              <span className="text-gray-500">Size:</span>
              <span className="col-span-2 text-gray-200 font-semibold">
                {propertiesItem.type === 'directory'
                  ? folderSizes[propertiesItem.path] !== undefined
                    ? `${formatBytes(folderSizes[propertiesItem.path])} (${folderSizes[propertiesItem.path].toLocaleString()} bytes)`
                    : 'Calculating size...'
                  : `${formatBytes(propertiesItem.size)} (${propertiesItem.size.toLocaleString()} bytes)`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1">
              <span className="text-gray-500">Modified:</span>
              <span className="col-span-2 text-gray-200">
                {formatDate(propertiesItem.modified)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1">
              <span className="text-gray-500">Created:</span>
              <span className="col-span-2 text-gray-200">
                {formatDate(propertiesItem.created)}
              </span>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-white/10">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.electronAPI?.shell.showInFolder(propertiesItem.path)}
              >
                Reveal in Explorer
              </Button>
              <Button variant="primary" size="sm" onClick={() => setPropertiesItem(null)}>
                OK
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Folder Modal */}
      <Modal
        open={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        title="Create New Folder"
      >
        <div className="space-y-4">
          <Input
            label="Folder Name"
            placeholder="New Folder"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateFolder}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal open={isRenameOpen} onClose={() => setIsRenameOpen(false)} title="Rename File">
        <div className="space-y-4">
          <Input
            label="New Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleRename}>
              Rename
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Confirmation"
      >
        <div className="space-y-4 text-xs text-gray-300">
          <p>
            Are you sure you want to delete{' '}
            <strong className="text-white">{selectedPaths.size} item(s)</strong>?
          </p>

          <label className="flex items-center gap-2 cursor-pointer bg-white/5 p-3 rounded-xl border border-white/10">
            <input
              type="checkbox"
              checked={deletePermanent}
              onChange={(e) => setDeletePermanent(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-200">
              Permanently delete (bypass Recycle Bin)
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

