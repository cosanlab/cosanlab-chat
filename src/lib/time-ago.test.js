import { describe, it, expect } from 'vitest'
import { timeAgo } from './time-ago.js'

describe('timeAgo', () => {
  const now = 1_000_000_000_000
  it('under a minute is now', () => expect(timeAgo(now - 30_000, now)).toBe('now'))
  it('minutes', () => expect(timeAgo(now - 3 * 60_000, now)).toBe('3m ago'))
  it('hours', () => expect(timeAgo(now - 2 * 3_600_000, now)).toBe('2h ago'))
  it('days', () => expect(timeAgo(now - 5 * 86_400_000, now)).toBe('5d ago'))
  it('missing ts', () => expect(timeAgo(undefined, now)).toBe('—'))
})
