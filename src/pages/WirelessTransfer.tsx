import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Wifi,
  Power,
  QrCode,
  Smartphone,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Plus,
  Trash2,
  HardDrive,
  Copy,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/ProgressBar'
import { formatBytes, formatRelativeDate } from '../utils/formatters'
import type { TransferDevice, TransferFile } from '../types'

export function WirelessTransfer() {
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [serverUrl, setServerUrl] = useState<string>('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [localIp, setLocalIp] = useState<string>('')
  const [port, setPort] = useState<number>(52140)
  const [downloadDir, setDownloadDir] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const [connectedDevices, setConnectedDevices] = useState<TransferDevice[]>([])
  const [sharedFiles, setSharedFiles] = useState<Array<{ id: string; name: string; size: number; path: string }>>([])
  const [transferHistory, setTransferHistory] = useState<TransferFile[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [activeTransfer, setActiveTransfer] = useState<{
    fileName: string
    progress: number
    speed: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [shareNotice, setShareNotice] = useState<string | null>(null)

  // Fetch initial status
  const refreshStatus = async () => {
    try {
      const res = await window.electronAPI?.transfer.getStatus()
      if (res?.success && res.data) {
        setIsRunning(res.data.isRunning)
        setPort(res.data.port)
        setLocalIp(res.data.ip)
        setToken(res.data.token)
        
        const savedDir = localStorage.getItem('sf-download-dir')
        if (savedDir) {
          setDownloadDir(savedDir)
          window.electronAPI?.transfer.setDownloadDir(savedDir)
        } else {
          setDownloadDir(res.data.downloadDir)
        }

        setConnectedDevices(res.data.connectedDevices || [])
        setTransferHistory(res.data.history || [])

        if (res.data.isRunning) {
          const url = `http://${res.data.ip}:${res.data.port}?token=${res.data.token}`
          setServerUrl(url)
        }
      }

      const filesRes = await window.electronAPI?.transfer.getSharedFiles()
      if (filesRes?.success && filesRes.data) {
        setSharedFiles(filesRes.data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    refreshStatus()

    // Subscriptions
    const unsubProgress = window.electronAPI?.transfer.onProgress((data) => {
      if (data.type === 'upload_batch' && data.items) {
        setTransferHistory((prev) => [...data.items, ...prev])
      } else if (data.fileName) {
        setTransferHistory((prev) => [data, ...prev])
      }
    })

    const unsubDeviceConn = window.electronAPI?.transfer.onDeviceConnected((dev) => {
      setConnectedDevices((prev) => {
        if (prev.find((d) => d.id === dev.id)) return prev
        return [...prev, dev]
      })
    })

    const unsubDeviceDisconn = window.electronAPI?.transfer.onDeviceDisconnected((id) => {
      setConnectedDevices((prev) => prev.filter((d) => d.id !== id))
    })

    return () => {
      if (unsubProgress) unsubProgress()
      if (unsubDeviceConn) unsubDeviceConn()
      if (unsubDeviceDisconn) unsubDeviceDisconn()
    }
  }, [])

  // Start Server
  const handleStartServer = async () => {
    setLoading(true)
    try {
      const res = await window.electronAPI?.transfer.start(port, downloadDir)
      if (res?.success) {
        setIsRunning(true)
        setServerUrl(res.url)
        setQrCodeUrl(res.qrCodeDataUrl)
        setLocalIp(res.ip)
        setToken(res.token)
        refreshStatus()
      } else {
        alert(`Failed to start server: ${res?.error}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // Stop Server
  const handleStopServer = async () => {
    setLoading(true)
    try {
      await window.electronAPI?.transfer.stop()
      setIsRunning(false)
      setServerUrl('')
      setQrCodeUrl('')
      setConnectedDevices([])
    } finally {
      setLoading(false)
    }
  }

  // Add Files for Android to download
  const handleAddFiles = async () => {
    if (!isRunning) {
      await handleStartServer()
    }
    const res = await window.electronAPI?.dialog.openFile()
    if (res?.success && res.data && !res.data.canceled) {
      let added = 0
      for (const p of res.data.filePaths) {
        await window.electronAPI?.transfer.addSharedFile(p)
        added++
      }
      const filesRes = await window.electronAPI?.transfer.getSharedFiles()
      if (filesRes?.success && filesRes.data) {
        setSharedFiles(filesRes.data)
      }
      setShareNotice(`Ready! ${added} file(s) available on your phone.`)
      setTimeout(() => setShareNotice(null), 4000)
    }
  }

  // Handle Drag & Drop files from Windows into browser
  const handleDropFiles = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return

    if (!isRunning) {
      await handleStartServer()
    }

    let added = 0
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i]
      const filePath = (file as any).path
      if (filePath) {
        await window.electronAPI?.transfer.addSharedFile(filePath)
        added++
      }
    }

    const filesRes = await window.electronAPI?.transfer.getSharedFiles()
    if (filesRes?.success && filesRes.data) {
      setSharedFiles(filesRes.data)
    }
    if (added > 0) {
      setShareNotice(`Ready! ${added} file(s) available on your phone.`)
      setTimeout(() => setShareNotice(null), 4000)
    }
  }

  // Remove shared file
  const handleRemoveShared = async (id: string) => {
    await window.electronAPI?.transfer.removeSharedFile(id)
    setSharedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  // Choose custom path for received files
  const handleChooseDownloadDir = async () => {
    const res = await window.electronAPI?.dialog.openDirectory()
    if (res?.success && res.data && !res.data.canceled && res.data.filePaths[0]) {
      const chosen = res.data.filePaths[0]
      setDownloadDir(chosen)
      localStorage.setItem('sf-download-dir', chosen)
      await window.electronAPI?.transfer.setDownloadDir(chosen)
    }
  }

  // Copy pairing URL
  const copyUrl = () => {
    navigator.clipboard.writeText(serverUrl)
    alert('Pairing URL copied to clipboard!')
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Wireless Direct Transfer
            <Wifi size={20} className={isRunning ? 'text-emerald-400' : 'text-gray-500'} />
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Seamless high-speed local Wi-Fi transfer between Windows PC and Android phones. No internet or cloud required.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={isRunning ? 'danger' : 'primary'}
            size="md"
            loading={loading}
            onClick={isRunning ? handleStopServer : handleStartServer}
            icon={<Power size={15} />}
          >
            {isRunning ? 'Stop Wireless Server' : 'Start Wireless Server'}
          </Button>
        </div>
      </div>

      {/* Main Grid: Server Control & QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection QR & Pairing Info */}
        <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <QrCode size={16} className="text-blue-400" />
            <span>Scan to Connect Android</span>
          </div>

          {isRunning && qrCodeUrl ? (
            <div className="p-3 bg-white rounded-2xl shadow-xl shadow-black/40">
              <img src={qrCodeUrl} alt="Pairing QR Code" className="w-56 h-56 rounded-lg" />
            </div>
          ) : (
            <div className="w-56 h-56 rounded-2xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center text-gray-500 gap-2 p-4">
              <Power size={32} />
              <p className="text-xs font-medium">Server is offline.<br />Click "Start Server" to generate pairing QR code.</p>
            </div>
          )}

          {isRunning && (
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="font-mono text-gray-300 truncate mr-2">{serverUrl}</span>
                <button
                  onClick={copyUrl}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                  title="Copy link"
                >
                  <Copy size={13} />
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Ensure phone and PC are connected to the same Wi-Fi network.
              </p>
            </div>
          )}
        </div>

        {/* Server & Security Status */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                Transfer Gateway Status
              </h3>
              <Badge color={isRunning ? '#10b981' : '#64748b'}>
                {isRunning ? 'Online & Listening' : 'Inactive'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5">
                <span className="text-gray-400 block">Local IP</span>
                <span className="font-mono font-bold text-white text-sm">{localIp || '--'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <span className="text-gray-400 block">Port</span>
                <span className="font-mono font-bold text-blue-400 text-sm">{port}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <span className="text-gray-400 block">Connected Devices</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {connectedDevices.length} phone(s)
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 text-xs space-y-2 border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                  <FolderOpen size={14} className="text-amber-400" />
                  Received Files Save Destination:
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">● Live Sync Active</span>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-black/30 p-2 rounded-lg border border-white/5">
                <span className="font-mono text-gray-200 truncate flex-1 text-[11px] select-all" title={downloadDir}>
                  {downloadDir || 'Default (Downloads/StorageFlow)'}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleChooseDownloadDir}
                    icon={<FolderOpen size={12} />}
                  >
                    Change Folder...
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => downloadDir && window.electronAPI?.shell.openFile(downloadDir)}
                    icon={<ExternalLink size={12} />}
                  >
                    Open
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-gray-500">
                All photos, videos, and documents sent from your mobile device will be saved directly into this directory.
              </p>
            </div>
          </div>

          {/* Connected Devices List */}
          <div className="pt-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Paired Mobile Devices ({connectedDevices.length})
            </h4>
            {connectedDevices.length === 0 ? (
              <p className="text-xs text-gray-500 py-3">No mobile devices currently connected.</p>
            ) : (
              <div className="space-y-2">
                {connectedDevices.map((dev) => (
                  <div
                    key={dev.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone size={16} className="text-emerald-400" />
                      <div>
                        <p className="font-bold text-white">{dev.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{dev.ip}</p>
                      </div>
                    </div>
                    <Badge color="#10b981">Live Paired</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shared Files (PC to Android) & Transfer History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shared Files on PC */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDropFiles}
          className={`glass-card p-5 space-y-4 transition-all ${
            isDragging ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download size={16} className="text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Files Shared to Phone</h3>
                <p className="text-[10px] text-gray-400">Drag files here or click Add Files</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleAddFiles} icon={<Plus size={13} />}>
              Add Files...
            </Button>
          </div>

          {shareNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between font-medium">
              <span>{shareNotice}</span>
              <CheckCircle2 size={14} />
            </div>
          )}

          {sharedFiles.length === 0 ? (
            <div
              onClick={handleAddFiles}
              className="text-center py-10 px-4 text-xs text-gray-500 border border-dashed border-white/10 rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-white/[0.02] transition-colors"
            >
              <Download size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="font-semibold text-gray-300">Drop files here to send to phone</p>
              <p className="text-[11px] text-gray-500 mt-1">or click to browse from PC</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sharedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] text-xs hover:bg-white/[0.06] transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-gray-200 truncate">{file.name}</p>
                    <span className="text-[10px] text-gray-500">{formatBytes(file.size)} • Live on Phone</span>
                  </div>
                  <button
                    onClick={() => handleRemoveShared(file.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                    title="Remove from shared queue"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transfer History */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-purple-400" />
              <h3 className="text-sm font-bold text-white">Transfer Activity & History</h3>
            </div>
            <span className="text-xs text-gray-500">{transferHistory.length} events</span>
          </div>

          {transferHistory.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
              Transfers initiated from phone or PC will show here in real-time.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {transferHistory.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        item.direction === 'upload'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {item.direction === 'upload' ? <Upload size={13} /> : <Download size={13} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-200 truncate">{item.fileName}</p>
                      <span className="text-[10px] text-gray-500">
                        {item.direction === 'upload' ? 'Received from Phone' : 'Sent to Phone'} •{' '}
                        {formatBytes(item.fileSize)}
                      </span>
                    </div>
                  </div>
                  <Badge color="#10b981">Success</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

