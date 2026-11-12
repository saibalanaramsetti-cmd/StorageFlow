import React, { useState, useEffect } from 'react'
import {
  Folder,
  File,
  Image as ImageIcon,
  Video,
  Music,
  Code,
  Archive,
  FileText,
} from 'lucide-react'
import { getFileTypeCategory, getFileTypeColor } from '../../utils/formatters'
import type { FileItem, ViewMode } from '../../types'

interface FileThumbnailProps {
  item: FileItem
  viewMode: ViewMode
  className?: string
}

export function FileThumbnail({ item, viewMode, className = '' }: FileThumbnailProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const isDirectory = item.type === 'directory'
  const category = getFileTypeCategory(item.extension)
  const isImage = category === 'Images' && !isDirectory

  useEffect(() => {
    let active = true
    if (!isImage) {
      setImgSrc(null)
      return
    }

    // Try native file protocol first (accelerated by Chromium GPU when webSecurity is false)
    const normalized = item.path.replace(/\\/g, '/')
    const fileUrl = normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
    setImgSrc(fileUrl)
    setHasError(false)
    setLoaded(false)

    return () => {
      active = false
    }
  }, [item.path, isImage])

  const handleImageError = () => {
    // 3-tier fallback strategy:
    // Tier 1: file://
    // Tier 2: media://local/
    // Tier 3: IPC base64 data URL
    if (imgSrc && imgSrc.startsWith('file:///')) {
      const encoded = encodeURIComponent(item.path)
      setImgSrc(`media://local/${encoded}`)
    } else if (imgSrc && imgSrc.startsWith('media://')) {
      if (window.electronAPI?.fs.getThumbnail) {
        window.electronAPI.fs.getThumbnail(item.path).then((res) => {
          if (res?.success && res.data) {
            setImgSrc(res.data)
          } else {
            setHasError(true)
          }
        }).catch(() => {
          setHasError(true)
        })
      } else {
        setHasError(true)
      }
    } else {
      setHasError(true)
    }
  }

  // Fallback / Standard icon renderer
  const renderIcon = () => {
    if (isDirectory) {
      return (
        <Folder
          size={viewMode === 'grid' ? 36 : 18}
          className="text-amber-400 drop-shadow-sm"
        />
      )
    }

    const color = getFileTypeColor(item.extension)
    const iconSize = viewMode === 'grid' ? 34 : 17

    switch (category) {
      case 'Images':
        return <ImageIcon size={iconSize} style={{ color }} />
      case 'Videos':
        return <Video size={iconSize} style={{ color }} />
      case 'Audio':
        return <Music size={iconSize} style={{ color }} />
      case 'Documents':
        return <FileText size={iconSize} style={{ color }} />
      case 'Code':
        return <Code size={iconSize} style={{ color }} />
      case 'Archives':
        return <Archive size={iconSize} style={{ color }} />
      default:
        return <File size={iconSize} style={{ color }} />
    }
  }

  // If it's an image and has a valid source and hasn't errored
  if (isImage && imgSrc && !hasError) {
    if (viewMode === 'grid') {
      return (
        <div className={`relative w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center group-hover:border-blue-500/40 transition-all ${className}`}>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5 animate-pulse">
              <ImageIcon size={22} className="text-gray-500" />
            </div>
          )}
          <img
            src={imgSrc}
            alt={item.name}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      )
    }

    // List view thumbnail
    return (
      <div className={`w-7 h-7 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 flex items-center justify-center ${className}`}>
        <img
          src={imgSrc}
          alt={item.name}
          loading="lazy"
          onError={handleImageError}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  // Fallback icon container
  if (viewMode === 'grid') {
    return (
      <div className={`w-full h-20 sm:h-24 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${className}`}>
        {renderIcon()}
      </div>
    )
  }

  return (
    <div className={`flex-shrink-0 flex items-center justify-center ${className}`}>
      {renderIcon()}
    </div>
  )
}

