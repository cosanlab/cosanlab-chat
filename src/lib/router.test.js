import { describe, it, expect } from 'vitest'
import { parsePath, normalizeSlug, isValidSlug } from './router.js'

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
})

describe('isValidSlug', () => {
  it('rejects reserved names', () => expect(isValidSlug('admin')).toBe(false))
  it('accepts course slugs', () => expect(isValidSlug('psych53-f2026')).toBe(true))
  it('normalizeSlug lowercases and trims', () => expect(normalizeSlug('  Lab-Meeting ')).toBe('lab-meeting'))
})
