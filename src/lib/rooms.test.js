import { describe, it, expect, vi } from 'vitest'
// firebase.js eagerly initializes the SDK; sortRooms is pure — mock the module out
vi.mock('./firebase.js', () => ({ db: {}, auth: {}, USING_EMULATORS: false }))
import { sortRooms } from './rooms.js'

describe('sortRooms', () => {
  const index = {
    quiet: { name: 'Quiet', lastActivityAt: 100 },
    busy: { name: 'Busy', lastActivityAt: 50 },
    recent: { name: 'Recent', lastActivityAt: 999 },
    ghost: { name: 'Ghost' },
  }
  it('live presence first, then recency, then name', () =>
    expect(sortRooms(index, { busy: 3 }).map(([id]) => id)).toEqual([
      'busy', 'recent', 'quiet', 'ghost',
    ]))
  it('presence count breaks presence ties', () =>
    expect(sortRooms(index, { busy: 1, quiet: 5 }).map(([id]) => id).slice(0, 2)).toEqual([
      'quiet', 'busy',
    ]))
})
