import { useState } from 'react'
import { Trash2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'

export function Trash() {
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Recycle Bin & Trash
            <Trash2 size={20} className="text-orange-400" />
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            StorageFlow 1.1 routes deleted files to the Windows Recycle Bin to prevent accidental data loss.
          </p>
        </div>
      </div>

      <div className="glass-card p-6 max-w-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 flex items-center justify-center text-orange-400 flex-shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Safe Deletion Protocol Active</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              All files removed via StorageFlow are safely transferred to your Windows Recycle Bin. You can restore them anytime using Windows Explorer or manage permanent purging below.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-gray-400">System Integration: Native Windows Shell</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.electronAPI?.shell.openExternal('shell:RecycleBinFolder')}
          >
            Open Windows Recycle Bin
          </Button>
        </div>
      </div>
    </div>
  )
}

