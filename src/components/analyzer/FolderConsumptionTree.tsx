import React, { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Code,
  Archive,
  ExternalLink,
  FolderOpen,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatBytes, getFileTypeCategory, getFileTypeColor } from '../../utils/formatters'
import type { FolderTreeNode, FolderFileItem } from '../../../electron/ipc/storageScanner'

interface FolderConsumptionTreeProps {
  rootNode: FolderTreeNode
  totalScanSize: number
}

interface TreeRowProps {
  node: FolderTreeNode
  parentSize: number
  depth?: number
  isRoot?: boolean
}

function getFileIcon(extension: string) {
  const cat = getFileTypeCategory(extension)
  const color = getFileTypeColor(extension)
  switch (cat) {
    case 'Images':
      return <ImageIcon size={14} style={{ color }} />
    case 'Videos':
      return <Video size={14} style={{ color }} />
    case 'Audio':
      return <Music size={14} style={{ color }} />
    case 'Documents':
      return <FileText size={14} style={{ color }} />
    case 'Code':
      return <Code size={14} style={{ color }} />
    case 'Archives':
      return <Archive size={14} style={{ color }} />
    default:
      return <File size={14} style={{ color }} />
  }
}

export function TreeFolderRow({ node, parentSize, depth = 0, isRoot = false }: TreeRowProps) {
  const navigate = useNavigate()
  // Root and top-level folders expanded by default
  const [isOpen, setIsOpen] = useState(isRoot || depth === 0)
  const [isFilesOpen, setIsFilesOpen] = useState(false)

  const hasSubfolders = node.subfolders && node.subfolders.length > 0
  const hasFiles = node.files && node.files.length > 0
  const canExpand = hasSubfolders || hasFiles

  // Calculate percentage of space consumed relative to parent (or self if root)
  const percent = parentSize > 0 ? (node.size / parentSize) * 100 : 0
  const clampedPercent = Math.min(Math.max(percent, 0), 100)

  // Files group percentage
  const filesPercent = node.size > 0 ? (node.filesTotalSize / node.size) * 100 : 0

  const handleOpenExplorer = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/explorer/${encodeURIComponent(node.path)}`)
  }

  const handleRevealNative = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.electronAPI?.shell.showInFolder(node.path)
  }

  return (
    <div className="select-none text-xs font-mono">
      {/* Folder Row */}
      <div
        onClick={() => canExpand && setIsOpen(!isOpen)}
        style={{ paddingLeft: `${depth * 18 + 4}px` }}
        className={`group relative flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
          isRoot
            ? 'bg-amber-500/20 border border-amber-500/40 text-white font-bold my-1'
            : 'hover:bg-white/[0.06] text-gray-200'
        }`}
      >
        {/* Background Visual Consumption Bar (Matches Reference Image) */}
        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none rounded-lg opacity-25 transition-all"
          style={{
            width: `${clampedPercent}%`,
            background: isRoot
              ? 'linear-gradient(90deg, #f59e0b 0%, #eab308 100%)'
              : clampedPercent > 50
              ? 'linear-gradient(90deg, #f59e0b, #eab308)'
              : clampedPercent > 20
              ? 'linear-gradient(90deg, #eab308, #ca8a04)'
              : '#facc15',
          }}
        />

        {/* Expand / Collapse Icon */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-400 group-hover:text-white z-10">
          {canExpand ? (
            isOpen ? (
              <ChevronDown size={14} className="text-amber-400" />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="w-1 h-1 rounded-full bg-gray-600 inline-block" />
          )}
        </span>

        {/* Yellow Folder Icon */}
        <Folder
          size={16}
          className="text-amber-400 flex-shrink-0 z-10 drop-shadow-sm fill-amber-400/20"
        />

        {/* Size Display First (Matches Reference Image) */}
        <span
          className={`w-24 text-right flex-shrink-0 font-bold tracking-tight z-10 ${
            isRoot ? 'text-amber-300 font-extrabold text-sm' : 'text-amber-400 font-semibold'
          }`}
        >
          {formatBytes(node.size)}
        </span>

        {/* Folder Name */}
        <span
          className={`truncate flex-1 z-10 ${
            isRoot ? 'text-white font-bold' : 'text-gray-100 group-hover:text-amber-200'
          }`}
          title={node.path}
        >
          {node.name || node.path}
        </span>

        {/* Proportional % Badge */}
        {!isRoot && percent > 0 && (
          <span className="text-[10px] text-gray-500 group-hover:text-gray-400 flex-shrink-0 z-10">
            {percent >= 1 ? `${percent.toFixed(1)}%` : '<1%'}
          </span>
        )}

        {/* Quick action buttons on hover */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20 flex-shrink-0">
          <button
            onClick={handleOpenExplorer}
            title="Open in StorageFlow Explorer"
            className="p-1 hover:text-blue-400 text-gray-400 rounded transition-colors"
          >
            <FolderOpen size={13} />
          </button>
          <button
            onClick={handleRevealNative}
            title="Reveal in Windows File Explorer"
            className="p-1 hover:text-white text-gray-400 rounded transition-colors"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* Children: Subfolders & Direct Files */}
      {isOpen && (
        <div className="relative border-l border-white/5 ml-3 pl-1">
          {/* Subfolders */}
          {hasSubfolders &&
            node.subfolders.map((sub) => (
              <TreeFolderRow
                key={sub.path}
                node={sub}
                parentSize={node.size}
                depth={depth + 1}
              />
            ))}

          {/* Direct Files Group (Matches Reference Image: "10.0 MB [6 Files]") */}
          {hasFiles && (
            <div>
              <div
                onClick={() => setIsFilesOpen(!isFilesOpen)}
                style={{ paddingLeft: `${(depth + 1) * 18 + 4}px` }}
                className="group relative flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer hover:bg-white/[0.04] text-gray-300"
              >
                {/* Background visual consumption bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 pointer-events-none rounded-lg opacity-15"
                  style={{
                    width: `${filesPercent}%`,
                    background: '#94a3b8',
                  }}
                />

                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-400 z-10">
                  {isFilesOpen ? (
                    <ChevronDown size={13} className="text-gray-300" />
                  ) : (
                    <ChevronRight size={13} />
                  )}
                </span>

                <File size={15} className="text-gray-400 flex-shrink-0 z-10" />

                <span className="w-24 text-right flex-shrink-0 font-semibold text-gray-300 z-10">
                  {formatBytes(node.filesTotalSize)}
                </span>

                <span className="font-semibold text-gray-400 group-hover:text-gray-200 z-10">
                  [{node.files.length} Files]
                </span>

                <span className="text-[10px] text-gray-500 z-10">
                  {filesPercent.toFixed(1)}% of folder
                </span>
              </div>

              {/* Individual Files Expanded */}
              {isFilesOpen && (
                <div className="relative border-l border-white/5 ml-3 pl-1">
                  {node.files.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => window.electronAPI?.shell.openFile(file.path)}
                      style={{ paddingLeft: `${(depth + 2) * 18 + 4}px` }}
                      className="group flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer hover:bg-white/[0.06] text-gray-400 hover:text-white transition-colors"
                    >
                      <span className="w-4 h-4" />
                      <div className="flex-shrink-0">{getFileIcon(file.extension)}</div>
                      <span className="w-24 text-right flex-shrink-0 font-medium text-gray-300">
                        {formatBytes(file.size)}
                      </span>
                      <span className="truncate flex-1 font-mono text-gray-300 group-hover:text-blue-300">
                        {file.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function FolderConsumptionTree({ rootNode, totalScanSize }: FolderConsumptionTreeProps) {
  const [filterText, setFilterText] = useState('')

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            Folder Storage Consumption Tree
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Hierarchical folder & file breakdown showing exact disk consumption per directory
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-gray-400">Total Analyzed:</span>{' '}
          <span className="text-sm font-extrabold text-amber-400">
            {formatBytes(rootNode.size || totalScanSize)}
          </span>
        </div>
      </div>

      {/* Interactive Tree View */}
      <div
        className="rounded-xl bg-black/40 border border-white/5 p-3 max-h-[600px] overflow-auto divide-y divide-white/[0.02]"
        style={{ fontFamily: 'Consolas, "SF Mono", "Fira Code", Monaco, monospace' }}
      >
        <TreeFolderRow
          node={rootNode}
          parentSize={rootNode.size || totalScanSize}
          isRoot={true}
        />
      </div>
    </div>
  )
}

