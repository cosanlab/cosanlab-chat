export const RESERVED = ['admin', 'login', 'assets', 'fonts', 'rooms', 'api', 'r']
const SLUG_RE = /^[a-z0-9-]{3,40}$/

export function normalizeSlug(s) {
  return String(s).trim().toLowerCase()
}

export function isValidSlug(s) {
  return SLUG_RE.test(s) && !RESERVED.includes(s)
}

export function parsePath(pathname) {
  const seg = pathname.replace(/\/+$/, '').split('/').slice(1)
  if (seg.length === 0 || seg[0] === '') return { view: 'landing' }
  const slug = normalizeSlug(decodeURIComponent(seg.join('/')))
  if (slug === 'admin') return { view: 'admin' }
  if (isValidSlug(slug)) return { view: 'room', roomId: slug }
  return { view: 'notfound', slug }
}

export function navigate(path) {
  history.pushState({}, '', path)
  dispatchEvent(new PopStateEvent('popstate'))
}
