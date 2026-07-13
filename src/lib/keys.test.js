import { describe, it, expect } from 'vitest'
import { encodeEmail, decodeEmail } from './keys.js'

describe('email keys', () => {
  it('encodes dots as commas, lowercased', () =>
    expect(encodeEmail(' Wasita.Mahaphanit.GR@Dartmouth.edu ')).toBe(
      'wasita,mahaphanit,gr@dartmouth,edu',
    ))
  it('round-trips', () =>
    expect(decodeEmail(encodeEmail('a.b@c.d'))).toBe('a.b@c.d'))
})
