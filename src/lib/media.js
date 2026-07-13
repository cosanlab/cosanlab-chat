// meme unfurling is URL-based (Spark plan: no Storage uploads).
// Anchored to the token end so a non-image URL can never be truncated into a
// fabricated image URL; quotes excluded since results land in HTML attributes.
const IMG_RE = /https:\/\/[^\s<>"']+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"']*)?(?=[\s<>"']|$)/gi

export function extractImageUrls(text) {
  if (!text) return []
  return [...new Set(String(text).match(IMG_RE) ?? [])].slice(0, 4)
}
