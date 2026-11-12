import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart,
  HardDrive,
  Folder,
  FileText,
  StopCircle,
  Play,
  RotateCw,
  TrendingDown,
  Layers,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'
import { FolderConsumptionTree } from '../components/analyzer/FolderConsumptionTree'
import { formatBytes, getFileTypeColor } from '../utils/formatters'
import type { DriveInfo } from '../types'

export function StorageAnalyzer() {
  const navigate = useNavigate()
  const [drives, setDrives] = useState<DriveInfo[]>([])
  const [selectedPath, setSelectedPath] = useState<string>('C:\\')
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [progress, setProgress] = useState<{
    currentPath: string
    scannedFiles: number
    scannedSize: number
    scannedFolders: number
  }>({
    currentPath: '',
    scannedFiles: 0,
    scannedSize: 0,
    scannedFolders: 0,
  })
  const [scanResult, setScanResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Load available drives
  useEffect(() => {
    window.electronAPI?.fs.getDrives().then((res) => {
      if (res?.success && res.data && res.data.length > 0) {
        setDrives(res.data)
        setSelectedPath(`${res.data[0].letter}\\`)
      }
    })
  }, [])

  // Listen to asynchronous scanner progress events from IPC
  useEffect(() => {
    const unsubscribe = window.electronAPI?.analyzer.onProgress((data) => {
      setProgress(data)
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Start Scan
  const handleStartScan = async () => {
    if (!selectedPath) return
    setIsScanning(true)
    setError(null)
    setScanResult(null)
    setProgress({ currentPath: 'Initializing...', scannedFiles: 0, scannedSize: 0, scannedFolders: 0 })

    try {
      const res = await window.electronAPI?.analyzer.startScan(selectedPath)
      if (res?.success && res.data) {
        setScanResult(res.data)
      } else if (res?.cancelled) {
        setError('Scan was cancelled by user.')
      } else {
        setError(res?.error || 'Failed to complete scan')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsScanning(false)
    }
  }

  // Cancel Scan
  const handleCancelScan = async () => {
    await window.electronAPI?.analyzer.cancelScan()
    setIsScanning(false)
  }

  // Select custom folder for scan
  const handleChooseFolder = async () => {
    const res = await window.electronAPI?.dialog.openDirectory()
    if (res?.success && res.data && !res.data.canceled && res.data.filePaths[0]) {
      setSelectedPath(res.data.filePaths[0])
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Storage Analyzer
            <PieChart size={20} className="text-purple-400" />
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Deep recursive disk usage inspection, largest folders identification & type distribution
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isScanning ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelScan}
              icon={<StopCircle size={14} />}
            >
              Cancel Scan
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartScan}
              icon={<Play size={14} />}
            >
              Start Deep Scan
            </Button>
          )}
        </div>
      </div>

      {/* Target Drive / Folder Selector */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Target Location:
          </span>
          <div className="flex items-center gap-2">
            {drives.map((d) => (
              <button
                key={d.letter}
                disabled={isScanning}
                onClick={() => setSelectedPath(`${d.letter}\\`)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                  selectedPath.startsWith(d.letter)
                    ? 'bg-purple-600/30 border-purple-500/60 text-white shadow-md shadow-purple-500/20'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <HardDrive size={13} />
                {d.letter} ({formatBytes(d.total)})
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono max-w-xs truncate">
            {selectedPath}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={isScanning}
            onClick={handleChooseFolder}
          >
            Choose Folder...
          </Button>
        </div>
      </div>

      {/* Live Scan Progress Card */}
      {isScanning && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 border border-purple-500/30 bg-purple-950/10 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                <RotateCw size={16} className="animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Analyzing Storage Hierarchy...</h4>
                <p className="text-xs text-gray-400 font-mono truncate max-w-xl">
                  {progress.currentPath}
                </p>
              </div>
            </div>
            <Badge color="#8b5cf6">Scanning Non-Blocking</Badge>
          </div>

          <ProgressBar value={100} color="#8b5cf6" height={6} className="animate-pulse" />

          <div className="grid grid-cols-3 gap-4 pt-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-white/5">
              <span className="text-gray-400 block">Total Scanned Size</span>
              <span className="text-base font-bold text-white">
                {formatBytes(progress.scannedSize)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5">
              <span className="text-gray-400 block">Files Processed</span>
              <span className="text-base font-bold text-purple-300">
                {progress.scannedFiles.toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5">
              <span className="text-gray-400 block">Directories Traversed</span>
              <span className="text-base font-bold text-gray-200">
                {progress.scannedFolders.toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Scan Results Display */}
      {scanResult && !isScanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Summary Metric Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-4">
              <span className="text-xs text-gray-400 font-semibold uppercase">Analyzed Size</span>
              <p className="text-2xl font-extrabold text-white mt-1">
                {formatBytes(scanResult.totalSize)}
              </p>
              <span className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle2 size={12} /> Scan Cached
              </span>
            </div>

            <div className="glass-card p-4">
              <span className="text-xs text-gray-400 font-semibold uppercase">Total Files</span>
              <p className="text-2xl font-extrabold text-purple-400 mt-1">
                {scanResult.totalFiles.toLocaleString()}
              </p>
              <span className="text-xs text-gray-400 mt-1 block">Cataloged items</span>
            </div>

            <div className="glass-card p-4">
              <span className="text-xs text-gray-400 font-semibold uppercase">Total Folders</span>
              <p className="text-2xl font-extrabold text-blue-400 mt-1">
                {scanResult.totalFolders.toLocaleString()}
              </p>
              <span className="text-xs text-gray-400 mt-1 block">Subdirectories</span>
            </div>

            <div className="glass-card p-4">
              <span className="text-xs text-gray-400 font-semibold uppercase">Root Path</span>
              <p className="text-xs font-mono font-bold text-gray-200 mt-2 truncate">
                {scanResult.rootTree?.path || selectedPath}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() =>
                  navigate(`/explorer/${encodeURIComponent(scanResult.rootTree?.path || selectedPath)}`)
                }
              >
                Open in Explorer
              </Button>
            </div>
          </div>

          {/* Hierarchical Folder Consumption Tree (Matches Reference Image) */}
          {scanResult.rootTree && (
            <FolderConsumptionTree
              rootNode={scanResult.rootTree}
              totalScanSize={scanResult.totalSize}
            />
          )}

          {/* Two Columns: Largest Folders & Type Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Largest Folders List */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown size={18} className="text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Largest Folders (Space Hogs)</h3>
                </div>
                <span className="text-xs text-gray-400">Top consumers</span>
              </div>

              <div className="space-y-3">
                {scanResult.largestFolders.map((folder: any, index: number) => {
                  const pct =
                    scanResult.totalSize > 0 ? (folder.size / scanResult.totalSize) * 100 : 0
                  return (
                    <div
                      key={folder.path}
                      onClick={() =>
                        navigate(`/explorer/${encodeURIComponent(folder.path)}`)
                      }
                      className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="w-5 text-gray-500 font-mono text-[11px]">
                            #{index + 1}
                          </span>
                          <Folder size={14} className="text-amber-400 flex-shrink-0" />
                          <span className="font-semibold text-gray-200 truncate" title={folder.path}>
                            {folder.name}
                          </span>
                        </div>
                        <span className="font-bold text-white flex-shrink-0">
                          {formatBytes(folder.size)}
                        </span>
                      </div>
                      <ProgressBar value={pct} color="#f59e0b" height={4} />
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span className="truncate max-w-[280px]">{folder.path}</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* File Type Distribution */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Storage Breakdown by Category</h3>
                </div>
                <span className="text-xs text-gray-400">Disk Consumption</span>
              </div>

              <div className="space-y-4">
                {Object.entries(scanResult.typeDistribution)
                  .sort(([, a]: any, [, b]: any) => b.size - a.size)
                  .map(([type, stats]: [string, any]) => {
                    const color = getFileTypeColor(type)
                    const pct =
                      scanResult.totalSize > 0 ? (stats.size / scanResult.totalSize) * 100 : 0
                    return (
                      <div key={type} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-300 flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ background: color }}
                            />
                            {type}
                          </span>
                          <div className="text-right">
                            <span className="font-bold text-white mr-2">
                              {formatBytes(stats.size)}
                            </span>
                            <span className="text-gray-500">
                              ({stats.count.toLocaleString()} files, {pct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        <ProgressBar value={pct} color={color} height={6} />
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

