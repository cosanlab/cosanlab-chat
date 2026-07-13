import { describe, it, expect } from 'vitest'
import { extractImageUrls } from './media.js'

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
