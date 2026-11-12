import { Minus, Square, X, Layers, Sun, Moon } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

export function TitleBar() {
  const { theme, toggleTheme } = useTheme()
  const minimize = () => window.electronAPI?.window.minimize()
  const maximize = () => window.electronAPI?.window.maximize()
  const close = () => window.electronAPI?.window.close()

  return (
    <div
      className="drag-region flex items-center justify-between h-10 px-4 border-b flex-shrink-0 select-none z-50 transition-colors"
      style={{
        background: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(10, 10, 15, 0.95)',
        borderColor: theme === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="no-drag flex items-center gap-2.5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20"
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
        >
          <Layers size={13} className="text-white" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-tight text-white">StorageFlow</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-500 border border-blue-500/30">
            v1.1 PRO
          </span>
        </div>
      </div>

      <div className="text-[11px] text-gray-500 font-medium tracking-wide hidden md:block">
        High Performance File Management System
      </div>

      <div className="no-drag flex items-center gap-1.5">
        {/* Quick Theme Switcher */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-amber-500"
        >
          {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-600" />}
        </button>

        <div className="w-[1px] h-3.5 bg-gray-400/20 mx-1" />

        <button
          onClick={minimize}
          title="Minimize"
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-white"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={maximize}
          title="Maximize"
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-white"
        >
          <Square size={11} />
        </button>
        <button
          onClick={close}
          title="Close"
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-red-500/80 text-gray-400 hover:text-white"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

