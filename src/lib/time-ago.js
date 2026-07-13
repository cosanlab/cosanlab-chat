export function timeAgo(ts, now = Date.now()) {
  if (!ts) return '—'
  const s = Math.max(0, now - ts) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
