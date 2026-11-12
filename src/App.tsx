import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { Dashboard } from './pages/Dashboard'
import { FileExplorer } from './pages/FileExplorer'
import { StorageAnalyzer } from './pages/StorageAnalyzer'
import { WirelessTransfer } from './pages/WirelessTransfer'
import { RecentFiles } from './pages/RecentFiles'
import { Favorites } from './pages/Favorites'
import { Trash } from './pages/Trash'
import { Settings } from './pages/Settings'
import { ThemeProvider } from './hooks/useTheme'

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="explorer" element={<FileExplorer />} />
            <Route path="explorer/:encodedPath" element={<FileExplorer />} />
            <Route path="analyzer" element={<StorageAnalyzer />} />
            <Route path="transfer" element={<WirelessTransfer />} />
            <Route path="recent" element={<RecentFiles />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="trash" element={<Trash />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}
