import { describe, it, expect } from 'vitest'
import { encodeEmail, decodeEmail, normalizeInviteEmail } from './keys.js'

describe('email keys', () => {
  it('encodes dots as commas, lowercased', () =>
    expect(encodeEmail(' Wasita.Mahaphanit.GR@Dartmouth.edu ')).toBe(
      'wasita,mahaphanit,gr@dartmouth,edu',
    ))
  it('round-trips', () =>
    expect(decodeEmail(encodeEmail('a.b@c.d'))).toBe('a.b@c.d'))
})

describe('normalizeInviteEmail', () => {
  it('strips dots from gmail local parts', () =>
    expect(normalizeInviteEmail('luke.j.chang@gmail.com')).toBe('lukejchang@gmail.com'))
  it('strips dots for googlemail too', () =>
    expect(normalizeInviteEmail('luke.j.chang@googlemail.com')).toBe('lukejchang@googlemail.com'))
  it('keeps dots on non-gmail domains', () =>
    expect(normalizeInviteEmail('luke.j.chang@dartmouth.edu')).toBe('luke.j.chang@dartmouth.edu'))
  it('trims and lowercases', () =>
    expect(normalizeInviteEmail('  Luke.J.Chang@GMAIL.com ')).toBe('lukejchang@gmail.com'))
  it('trims and lowercases non-gmail without touching dots', () =>
    expect(normalizeInviteEmail(' Wasita.M@Dartmouth.EDU ')).toBe('wasita.m@dartmouth.edu'))
})
