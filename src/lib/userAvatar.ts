export function getUserInitials(username: string): string {
  const trimmed = username.trim()
  if (!trimmed) return '?'

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }

  return trimmed.slice(0, 2).toUpperCase()
}

export function getUserAvatarColor(username: string): string {
  let hash = 0
  for (let i = 0; i < username.length; i += 1) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 62% 48%)`
}
