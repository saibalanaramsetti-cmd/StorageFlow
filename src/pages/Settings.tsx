import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  FolderOpen,
  Wifi,
  Sliders,
  Shield,
  Info,
  Check,
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function Settings() {
  const { theme, toggleTheme } = useTheme()
  const [downloadPath, setDownloadPath] = useState<string>('')
  const [transferPort, setTransferPort] = useState<number>(52140)
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(true)
  const [confirmDelete, setConfirmDelete] = useState<boolean>(true)
  const [savedNotice, setSavedNotice] = useState<boolean>(false)

  useEffect(() => {
    const saved = localStorage.getItem('sf-download-dir')
    if (saved) {
      setDownloadPath(saved)
    } else {
      window.electronAPI?.system.getInfo().then((res) => {
        if (res?.success && res.data?.homeDir) {
          setDownloadPath(`${res.data.homeDir}\\Downloads\\StorageFlow`)
        }
      })
    }
  }, [])

  const handleSelectDownloadDir = async () => {
    const res = await window.electronAPI?.dialog.openDirectory()
    if (res?.success && res.data && !res.data.canceled && res.data.filePaths[0]) {
      const chosen = res.data.filePaths[0]
      setDownloadPath(chosen)
      localStorage.setItem('sf-download-dir', chosen)
      window.electronAPI?.transfer.setDownloadDir(chosen)
    }
  }

  const handleSave = () => {
    if (downloadPath) {
      localStorage.setItem('sf-download-dir', downloadPath)
      window.electronAPI?.transfer.setDownloadDir(downloadPath)
    }
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2500)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Settings & Preferences
            <SettingsIcon size={20} className="text-gray-400" />
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Configure application appearance, wireless transfer behavior, and security defaults
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave}>
          {savedNotice ? 'Saved Successfully! ✓' : 'Save Changes'}
        </Button>
      </div>

      {/* Appearance Section */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Moon size={16} className="text-blue-400" />
          Appearance & Themes
        </h3>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
          <div>
            <p className="text-xs font-semibold text-white">Visual Theme</p>
            <p className="text-[11px] text-gray-400">Toggle between macOS dark glassmorphism and clean light mode</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleTheme}
            icon={theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          >
            {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </Button>
        </div>
      </div>

      {/* Wireless Transfer Section */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Wifi size={16} className="text-emerald-400" />
          Wireless Direct Transfer Configuration
        </h3>

        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Default Download Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={downloadPath}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
              <Button variant="secondary" size="sm" onClick={handleSelectDownloadDir} icon={<FolderOpen size={13} />}>
                Browse...
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-48">
            <label className="text-xs font-semibold text-gray-300">Local Transfer Port</label>
            <input
              type="number"
              value={transferPort}
              onChange={(e) => setTransferPort(parseInt(e.target.value) || 52140)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* File Management & Safety */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield size={16} className="text-purple-400" />
          File Safety & Scanner Options
        </h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-white">File Previews</p>
              <p className="text-[11px] text-gray-400">Generate image and text previews inside explorer</p>
            </div>
            <input
              type="checkbox"
              checked={previewEnabled}
              onChange={(e) => setPreviewEnabled(e.target.checked)}
              className="rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-white">Confirm Before Deletion</p>
              <p className="text-[11px] text-gray-400">Always ask for confirmation before moving to Recycle Bin</p>
            </div>
            <input
              type="checkbox"
              checked={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.checked)}
              className="rounded"
            />
          </label>
        </div>
      </div>

      {/* Application Information */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Info size={16} className="text-blue-400" />
          Application Information
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white/5">
            <span className="text-gray-400 block">App Name</span>
            <span className="font-bold text-white">StorageFlow</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5">
            <span className="text-gray-400 block">Version</span>
            <span className="font-bold text-blue-400">1.1.0 Pro</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5">
            <span className="text-gray-400 block">Architecture</span>
            <span className="font-bold text-gray-200">Electron + React + TS</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5">
            <span className="text-gray-400 block">Security Isolation</span>
            <span className="font-bold text-emerald-400">Context Isolated</span>
          </div>
        </div>
      </div>
    </div>
  )
}

