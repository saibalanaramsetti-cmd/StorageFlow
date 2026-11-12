import { Outlet } from 'react-router-dom'
import { TitleBar } from '../components/layout/TitleBar'
import { Sidebar } from '../components/layout/Sidebar'
import { useTheme } from '../hooks/useTheme'

export function AppLayout() {
  const { theme } = useTheme()

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden ${theme}`}
      style={{
        background:
          theme === 'light'
            ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)'
            : 'radial-gradient(ellipse at top left, #121324 0%, #090a0f 60%, #06060a 100%)',
        color: 'var(--text-primary)',
        transition: 'background 0.3s ease',
      }}
    >
      <TitleBar />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

