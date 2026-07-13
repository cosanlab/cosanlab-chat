import { describe, it, expect, vi, afterEach } from 'vitest'
import { parsePath, normalizeSlug, isValidSlug, navigate } from './router.js'

describe('parsePath', () => {
  it('root is landing', () => expect(parsePath('/')).toEqual({ view: 'landing' }))
  it('admin is reserved', () => expect(parsePath('/admin')).toEqual({ view: 'admin' }))
  it('slug routes to room, lowercased', () =>
    expect(parsePath('/PSYCH53-F2026')).toEqual({ view: 'room', roomId: 'psych53-f2026' }))
  it('trailing slash ok', () =>
    expect(parsePath('/lab-meeting/')).toEqual({ view: 'room', roomId: 'lab-meeting' }))
  it('bad slugs are notfound', () => {
    expect(parsePath('/ab')).toEqual({ view: 'notfound', slug: 'ab' })
    expect(parsePath('/has_underscore')).toEqual({ view: 'notfound', slug: 'has_underscore' })
    expect(parsePath('/a/b')).toEqual({ view: 'notfound', slug: 'a/b' })
  })
  it('bad percent-escapes are notfound, not a throw', () =>
    expect(parsePath('/%zz')).toEqual({ view: 'notfound', slug: '%zz' }))
})

describe('isValidSlug', () => {
  it('rejects reserved names', () => expect(isValidSlug('admin')).toBe(false))
  it('accepts course slugs', () => expect(isValidSlug('psych53-f2026')).toBe(true))
  it('normalizeSlug lowercases and trims', () => expect(normalizeSlug('  Lab-Meeting ')).toBe('lab-meeting'))
})

describe('navigate', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('pushes state and dispatches popstate', () => {
    vi.stubGlobal('history', { pushState: vi.fn() })
    vi.stubGlobal('dispatchEvent', vi.fn())
    vi.stubGlobal('PopStateEvent', class PopStateEvent {
      constructor(type) { this.type = type }
    })

    navigate('/foo')

    expect(history.pushState).toHaveBeenCalledWith({}, '', '/foo')
    expect(dispatchEvent).toHaveBeenCalledTimes(1)
    expect(dispatchEvent.mock.calls[0][0].type).toBe('popstate')
  })
})
