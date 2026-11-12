export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const idx = Math.min(i, sizes.length - 1)
  return parseFloat((bytes / Math.pow(k, idx)).toFixed(dm)) + ' ' + sizes[idx]
}

export function formatDate(date: Date | string): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeDate(date: Date | string): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) return formatDate(date)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

export function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + '/s'
}

export function getFileTypeColor(extension: string): string {
  const ext = (extension || '').toLowerCase().replace('.', '')
  const colorMap: Record<string, string> = {
    jpg: '#f59e0b', jpeg: '#f59e0b', png: '#f59e0b', gif: '#f59e0b', webp: '#f59e0b', svg: '#f59e0b',
    mp4: '#8b5cf6', mkv: '#8b5cf6', avi: '#8b5cf6', mov: '#8b5cf6', wmv: '#8b5cf6',
    mp3: '#10b981', wav: '#10b981', flac: '#10b981', aac: '#10b981',
    pdf: '#ef4444', doc: '#3b82f6', docx: '#3b82f6', xls: '#10b981', xlsx: '#10b981', ppt: '#f59e0b', pptx: '#f59e0b',
    ts: '#3b82f6', tsx: '#3b82f6', js: '#f59e0b', jsx: '#f59e0b', py: '#10b981', rs: '#f97316', go: '#06b6d4',
    zip: '#f97316', rar: '#f97316', gz: '#f97316', '7z': '#f97316',
    txt: '#94a3b8', md: '#38bdf8', json: '#fbbf24', html: '#ea580c', css: '#38bdf8',
  }
  return colorMap[ext] || '#64748b'
}

export function getFileTypeCategory(extension: string): string {
  const ext = (extension || '').toLowerCase().replace('.', '')
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'Images'
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) return 'Videos'
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return 'Audio'
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt'].includes(ext)) return 'Documents'
  if (['zip', 'rar', 'gz', 'tar', '7z', 'bz2', 'iso'].includes(ext)) return 'Archives'
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml'].includes(ext)) return 'Code'
  return 'Other'
}

