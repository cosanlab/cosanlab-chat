import { describe, it, expect } from 'vitest'
import { spaceBelow, opensUpward } from './popover.js'

describe('spaceBelow', () => {
  it('returns the gap between anchor bottom and container bottom', () => {
    expect(spaceBelow({ bottom: 500 }, { bottom: 700 })).toBe(200)
  })

  it('is negative when the anchor extends past the container', () => {
    expect(spaceBelow({ bottom: 720 }, { bottom: 700 })).toBe(-20)
  })
})

describe('opensUpward', () => {
  it('opens upward when space below is less than needed', () => {
    expect(opensUpward(50)).toBe(true)
  })

  it('opens downward when there is room', () => {
    expect(opensUpward(200)).toBe(false)
  })

  it('treats exactly-enough space as room (boundary)', () => {
    expect(opensUpward(90)).toBe(false)
  })

  it('respects a custom needed height', () => {
    expect(opensUpward(100, 120)).toBe(true)
  })
})
