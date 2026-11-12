import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  HardDrive,
  Files,
  Zap,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Folder,
  Smartphone,
  FolderOpen,
  Image,
  FileText,
  Music,
  Video,
  Download,
  Clock,
  PieChart,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { FileThumbnail } from '../components/explorer/FileThumbnail'
import {
  formatBytes,
  formatRelativeDate,
  getFileTypeCategory,
  getFileTypeColor,
} from '../utils/formatters'
import type { DriveInfo, FileItem, TransferDevice } from '../types'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const itemVariant = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export function Dashboard() {
  const navigate = useNavigate()
  const [drives, setDrives] = useState<DriveInfo[]>([])
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([])
  const [fileTypeStats, setFileTypeStats] = useState<Record<string, number>>({})
  const [connectedDevices, setConnectedDevices] = useState<TransferDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [sysInfo, setSysInfo] = useState<any>(null)
  const [quickPaths, setQuickPaths] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Get real drives
      const drivesResult = await window.electronAPI?.fs.getDrives()
      if (drivesResult?.success && drivesResult.data) {
        setDrives(drivesResult.data)
      }

      // 2. Get real system info
      const sysResult = await window.electronAPI?.system.getInfo()
      if (sysResult?.success && sysResult.data) {
        setSysInfo(sysResult.data)
        if (sysResult.data.quickPaths) {
          setQuickPaths(sysResult.data.quickPaths)
        }
      }

      // 3. Scan recent files from real user folders
      const home = sysResult?.data?.homeDir || ''
      const foldersToScan = [
        sysResult?.data?.quickPaths?.desktop,
        sysResult?.data?.quickPaths?.downloads,
        sysResult?.data?.quickPaths?.documents,
      ].filter(Boolean)

      const foundFiles: FileItem[] = []
      const typeCounts: Record<string, number> = {}

      for (const dir of foldersToScan) {
        if (!dir) continue
        const res = await window.electronAPI?.fs.readDir(dir)
        if (res?.success && res.data) {
          for (const item of res.data) {
            if (item.type === 'file') {
              foundFiles.push(item)
              const cat = getFileTypeCategory(item.extension)
              typeCounts[cat] = (typeCounts[cat] || 0) + 1
            }
          }
        }
      }

      foundFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      setRecentFiles(foundFiles.slice(0, 8))
      setFileTypeStats(typeCounts)

      // 4. Get transfer status & connected devices
      const transferStatus = await window.electronAPI?.transfer.getStatus()
      if (transferStatus?.success && transferStatus.data) {
        setConnectedDevices(transferStatus.data.connectedDevices || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalStorage = drives.reduce((acc, d) => acc + (d.total || 0), 0)
  const usedStorage = drives.reduce((acc, d) => acc + (d.used || 0), 0)
  const freeStorage = drives.reduce((acc, d) => acc + (d.free || 0), 0)
  const percentUsed = totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0

  const quickAccess = [
    { label: 'Desktop', icon: Folder, path: quickPaths.desktop, color: '#3b82f6' },
    { label: 'Downloads', icon: Download, path: quickPaths.downloads, color: '#10b981' },
    { label: 'Documents', icon: FileText, path: quickPaths.documents, color: '#f59e0b' },
    { label: 'Pictures', icon: Image, path: quickPaths.pictures, color: '#ec4899' },
    { label: 'Music', icon: Music, path: quickPaths.music, color: '#8b5cf6' },
    { label: 'Videos', icon: Video, path: quickPaths.videos, color: '#ef4444' },
  ]

  const typeColors: Record<string, string> = {
    Images: '#f59e0b',
    Videos: '#8b5cf6',
    Audio: '#10b981',
    Documents: '#3b82f6',
    Archives: '#f97316',
    Code: '#06b6d4',
    Other: '#64748b',
  }

  const totalFilesFound = Object.values(fileTypeStats).reduce((a, b) => a + b, 0)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Welcome Header */}
        <motion.div variants={itemVariant} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Welcome back{sysInfo?.username ? `, ${sysInfo.username}` : ''}
              <span className="inline-block animate-pulse text-blue-400">👋</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              StorageFlow 1.1 system overview & storage health metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/transfer')}
              icon={<Smartphone size={13} />}
            >
              Wireless Connect
            </Button>
          </div>
        </motion.div>

        {/* Storage Capacity Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div variants={itemVariant} className="glass-card p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Total Capacity
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                <HardDrive size={16} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-white mt-2">
              {formatBytes(totalStorage)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Across {drives.length} detected drive(s)</p>
          </motion.div>

          <motion.div variants={itemVariant} className="glass-card p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Space Used
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
                <TrendingUp size={16} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-white mt-2">
              {formatBytes(usedStorage)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-purple-400 font-semibold">
                {percentUsed.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-400">of total capacity</span>
            </div>
          </motion.div>

          <motion.div variants={itemVariant} className="glass-card p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Available Free
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Zap size={16} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-white mt-2">
              {formatBytes(freeStorage)}
            </p>
            <p className="text-xs text-emerald-400 mt-1">Ready for storage</p>
          </motion.div>

          <motion.div variants={itemVariant} className="glass-card p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Wireless Devices
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Smartphone size={16} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-white mt-2">
              {connectedDevices.length}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {connectedDevices.length > 0 ? 'Active phone connected' : 'Ready to pair via QR'}
            </p>
          </motion.div>
        </div>

        {/* Drives Breakdown */}
        <motion.div variants={itemVariant} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
              Connected Storage Drives
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/analyzer')}
              icon={<PieChart size={13} />}
            >
              Analyze Space
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drives.map((d) => {
              const drivePercent = d.total > 0 ? (d.used / d.total) * 100 : 0
              const color =
                drivePercent > 90 ? '#ef4444' : drivePercent > 70 ? '#f59e0b' : '#3b82f6'

              return (
                <div
                  key={d.letter}
                  onClick={() =>
                    navigate(`/explorer/${encodeURIComponent(d.letter + '\\')}`)
                  }
                  className="glass-card p-4 hover:border-blue-500/40 cursor-pointer transition-all hover:-translate-y-0.5 group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${color}1a` }}
                      >
                        <HardDrive size={18} style={{ color }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                          {d.label} ({d.letter})
                        </h4>
                        <span className="text-[11px] text-gray-400">{d.fileSystem} File System</span>
                      </div>
                    </div>
                    <Badge color={color}>{drivePercent.toFixed(0)}%</Badge>
                  </div>

                  <ProgressBar value={drivePercent} color={color} height={6} />

                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    <span>Used: {formatBytes(d.used)}</span>
                    <span className="text-gray-300 font-medium">Free: {formatBytes(d.free)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Quick Access Shortcuts */}
        <motion.div variants={itemVariant} className="space-y-3">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
            Quick Access Shortcuts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {quickAccess.map((qa) => {
              const Icon = qa.icon
              return (
                <button
                  key={qa.label}
                  disabled={!qa.path}
                  onClick={() => qa.path && navigate(`/explorer/${encodeURIComponent(qa.path)}`)}
                  className="glass-card p-3.5 flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-all hover:scale-105 group disabled:opacity-40"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: `${qa.color}20` }}
                  >
                    <Icon size={20} style={{ color: qa.color }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-white">
                    {qa.label}
                  </span>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Two-column layout: Recent Files & File Type Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Recent Files */}
          <motion.div variants={itemVariant} className="lg:col-span-3 glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white">Recent Files</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/recent')}
                icon={<ChevronRight size={13} />}
              >
                View all
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                <RefreshCw size={18} className="animate-spin mr-2" /> Scanning recent files...
              </div>
            ) : recentFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                No recent files found in primary folders.
              </div>
            ) : (
              <div className="space-y-1">
                {recentFiles.map((file) => {
                  const color = getFileTypeColor(file.extension)
                  return (
                    <div
                      key={file.path}
                      onClick={() => window.electronAPI?.shell.openFile(file.path)}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
                    >
                      <FileThumbnail item={file} viewMode="list" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-200 truncate group-hover:text-blue-400 transition-colors">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">{file.path}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-medium text-gray-300 block">
                          {formatBytes(file.size)}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {formatRelativeDate(file.modified)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* File Types Breakdown */}
          <motion.div variants={itemVariant} className="lg:col-span-2 glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart size={16} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white">File Types</h3>
              </div>
              <span className="text-xs text-gray-400 font-medium">
                {totalFilesFound} files analyzed
              </span>
            </div>

            {totalFilesFound === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                Run Storage Analyzer to view breakdown.
              </div>
            ) : (
              <div className="space-y-3.5">
                {Object.entries(fileTypeStats)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const color = typeColors[type] || '#64748b'
                    const pct = (count / totalFilesFound) * 100
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-300 flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ background: color }}
                            />
                            {type}
                          </span>
                          <span className="text-gray-400">
                            {count} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <ProgressBar value={pct} color={color} height={5} />
                      </div>
                    )
                  })}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

