// meme unfurling is URL-based (Spark plan: no Storage uploads).
const IMG_RE = /https:\/\/[^\s<>"]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"]*)?/gi

export function extractImageUrls(text) {
  if (!text) return []
  return [...new Set(String(text).match(IMG_RE) ?? [])].slice(0, 4)
}
