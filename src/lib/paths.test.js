import { describe, it, expect } from 'vitest'
import { roomPath } from './paths.js'

describe('roomPath', () => {
  it('builds nested paths', () =>
    expect(roomPath('lab-meeting', 'messages')).toBe('rooms/lab-meeting/messages'))
  it('joins deep segments', () =>
    expect(roomPath('lab-meeting', 'reactions', 'm1', '👍', 'c1')).toBe(
      'rooms/lab-meeting/reactions/m1/👍/c1',
    ))
  it('throws on invalid room ids (defense in depth)', () => {
    expect(() => roomPath('admin', 'messages')).toThrow('invalid roomId')
    expect(() => roomPath('../config', 'x')).toThrow('invalid roomId')
  })
})
