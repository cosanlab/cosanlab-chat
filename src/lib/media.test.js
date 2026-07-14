import { describe, it, expect } from 'vitest'
import { extractImageUrls, stripImageUrls } from './media.js'

describe('extractImageUrls', () => {
  it('finds https image links', () =>
    expect(extractImageUrls('lol https://i.imgur.com/x.gif so true')).toEqual([
      'https://i.imgur.com/x.gif',
    ]))
  it('allows query strings (giphy style)', () =>
    expect(extractImageUrls('https://media.giphy.com/a.gif?cid=123&rid=x')).toEqual([
      'https://media.giphy.com/a.gif?cid=123&rid=x',
    ]))
  it('is case-insensitive on extension', () =>
    expect(extractImageUrls('https://x.com/MEME.PNG')).toEqual(['https://x.com/MEME.PNG']))
  it('ignores http and non-image urls', () => {
    expect(extractImageUrls('http://x.com/a.png')).toEqual([])
    expect(extractImageUrls('https://example.com/page')).toEqual([])
  })
  it('dedupes and caps at 4', () => {
    const u = (n) => `https://x.com/${n}.png`
    expect(extractImageUrls(`${u(1)} ${u(1)}`)).toEqual([u(1)])
    expect(extractImageUrls([1, 2, 3, 4, 5].map(u).join(' '))).toHaveLength(4)
  })
  it('handles null/empty', () => {
    expect(extractImageUrls('')).toEqual([])
    expect(extractImageUrls(null)).toEqual([])
  })
  it('does not truncate non-image urls into fabricated image urls', () => {
    expect(
      extractImageUrls('https://safe.com/click?redirect=https://evil.com/x.png/steal'),
    ).toEqual([])
    expect(extractImageUrls('https://evil.com/a.png/b.html')).toEqual([])
  })
  it('stops at quotes so extracted urls never contain them', () =>
    expect(extractImageUrls("https://x.com/a.png'onerror='alert(1)")).toEqual([
      'https://x.com/a.png',
    ]))
  it('still finds multiple urls in one message', () =>
    expect(extractImageUrls('https://a.com/1.png and https://b.com/2.jpg?w=5')).toEqual([
      'https://a.com/1.png',
      'https://b.com/2.jpg?w=5',
    ]))
})

describe('stripImageUrls', () => {
  it('returns empty string for a URL-only message', () => {
    expect(stripImageUrls('https://a.com/x.gif', ['https://a.com/x.gif'])).toBe('')
  })

  it('keeps surrounding words and trims the seam', () => {
    expect(stripImageUrls('behold https://a.com/x.gif', ['https://a.com/x.gif'])).toBe('behold')
    expect(stripImageUrls('https://a.com/x.gif wow', ['https://a.com/x.gif'])).toBe('wow')
    expect(stripImageUrls('a https://a.com/x.gif b', ['https://a.com/x.gif'])).toBe('a b')
  })

  it('strips multiple urls', () => {
    expect(
      stripImageUrls('https://a.com/x.gif and https://b.com/y.png', [
        'https://a.com/x.gif',
        'https://b.com/y.png',
      ]),
    ).toBe('and')
  })

  it('leaves urls not in the list untouched', () => {
    expect(stripImageUrls('see https://a.com/x.gif', [])).toBe('see https://a.com/x.gif')
  })

  it('drops lines that become empty but keeps other lines', () => {
    expect(stripImageUrls('look:\nhttps://a.com/x.gif\ndone', ['https://a.com/x.gif'])).toBe(
      'look:\ndone',
    )
  })

  it('handles empty/nullish text', () => {
    expect(stripImageUrls('', ['https://a.com/x.gif'])).toBe('')
    expect(stripImageUrls(null, [])).toBe('')
  })
})
