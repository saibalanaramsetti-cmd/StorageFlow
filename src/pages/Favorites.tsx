import { useState, useEffect } from 'react'
import { Heart, Folder, Plus, Trash2, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { formatBytes } from '../utils/formatters'

export function Favorites() {
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState<Array<{ name: string; path: string; addedAt: string }>>(() => {
    try {
      const saved = localStorage.getItem('sf-favorites')
      if (saved) return JSON.parse(saved)
    } catch {}
    return [
      { name: 'StorageFlow Project', path: 'C:\\Users\\saiba\\OneDrive\\Desktop\\storage flow', addedAt: new Date().toISOString() },
    ]
  })

  useEffect(() => {
    localStorage.setItem('sf-favorites', JSON.stringify(favorites))
  }, [favorites])

  const handleAddFavorite = async () => {
    const res = await window.electronAPI?.dialog.openDirectory()
    if (res?.success && res.data && !res.data.canceled && res.data.filePaths[0]) {
      const p = res.data.filePaths[0]
      const name = p.split('\\').pop() || p
      if (!favorites.some((f) => f.path === p)) {
        setFavorites([...favorites, { name, path: p, addedAt: new Date().toISOString() }])
      }
    }
  }

  const removeFavorite = (path: string) => {
    setFavorites(favorites.filter((f) => f.path !== path))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Pinned Favorites
            <Heart size={20} className="text-pink-500 fill-pink-500/20" />
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Fast one-click access to your essential folders and projects
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleAddFavorite} icon={<Plus size={14} />}>
          Add Folder to Favorites
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {favorites.map((fav) => (
          <div
            key={fav.path}
            onClick={() => navigate(`/explorer/${encodeURIComponent(fav.path)}`)}
            className="glass-card p-4 hover:border-pink-500/40 cursor-pointer transition-all hover:-translate-y-0.5 group relative"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-pink-500/15 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                <Folder size={20} />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeFavorite(fav.path)
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 transition-opacity"
                title="Remove from favorites"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors truncate">
              {fav.name}
            </h4>
            <p className="text-xs text-gray-500 font-mono truncate mt-1">{fav.path}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

