export function isValidFileName(name: string): boolean {
  if (!name || name.trim().length === 0) return false
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
  return !reserved.test(name.trim()) && !invalidChars.test(name) && name.length <= 255
}

export function isValidPath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false
  return filePath.trim().length > 0
}

