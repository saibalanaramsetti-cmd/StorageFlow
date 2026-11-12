import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, RefreshCw, Files, ExternalLink, Folder } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { FileThumbnail } from '../components/explorer/FileThumbnail'
import { formatBytes, formatRelativeDate, formatDate, getFileTypeColor } from '../utils/formatters'
import type { FileItem } from '../types'

export function RecentFiles() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadRecent = async () => {
    setLoading(true)
    try {
      const sys = await window.electronAPI?.system.getInfo()
      const paths = [
        sys?.data?.quickPaths?.desktop,
        sys?.data?.quickPaths?.downloads,
        sys?.data?.quickPaths?.documents,
        sys?.data?.quickPaths?.pictures,
      ].filter(Boolean)

      const collected: FileItem[] = []
      for (const p of paths) {
        const res = await window.electronAPI?.fs.readDir(p)
        if (res?.success && res.data) {
          for (const item of res.data) {
            if (item.type === 'file') {
              collected.push(item)
            }
          }
        }
      }

      collected.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      setFiles(collected.slice(0, 50))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecent()
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Recent Files
            <Clock size={20} className="text-cyan-400" />
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Chronological access to recently modified files across your Windows system
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadRecent} icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}>
          Refresh
        </Button>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2" /> Scanning recent files...
          </div>
        ) : files.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-xs">No recent files discovered.</div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-12 px-3 py-2 text-xs font-semibold text-gray-500 border-b border-white/5 uppercase">
              <span className="col-span-6">File Name</span>
              <span className="col-span-3">Path</span>
              <span className="col-span-2">Modified</span>
              <span className="col-span-1 text-right">Size</span>
            </div>
            {files.map((file) => {
              const color = getFileTypeColor(file.extension)
              return (
                <div
                  key={file.path}
                  onClick={() => window.electronAPI?.shell.openFile(file.path)}
                  className="grid grid-cols-12 items-center px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer text-xs text-gray-300 transition-colors group"
                >
                  <div className="col-span-6 flex items-center gap-2.5 min-w-0 pr-4">
                    <FileThumbnail item={file} viewMode="list" />
                    <span className="truncate font-semibold text-gray-200 group-hover:text-blue-400 transition-colors">
                      {file.name}
                    </span>
                  </div>
                  <div className="col-span-3 text-gray-500 font-mono text-[11px] truncate pr-2">
                    {file.path}
                  </div>
                  <div className="col-span-2 text-gray-400">
                    {formatRelativeDate(file.modified)}
                  </div>
                  <div className="col-span-1 text-right text-gray-300 font-medium">
                    {formatBytes(file.size)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

