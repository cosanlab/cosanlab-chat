// meme unfurling is URL-based (Spark plan: no Storage uploads).
// Anchored to the token end so a non-image URL can never be truncated into a
// fabricated image URL; quotes excluded since results land in HTML attributes.
const IMG_RE = /https:\/\/[^\s<>"']+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"']*)?(?=[\s<>"']|$)/gi

export function extractImageUrls(text) {
  if (!text) return []
  return [...new Set(String(text).match(IMG_RE) ?? [])].slice(0, 4)
}

// Remove unfurled image URLs from the bubble text. Splitting on URL
// occurrences (not regex) keeps this exact; whitespace tidy-up collapses
// the seams and drops lines that were nothing but a URL.
export function stripImageUrls(text, urls) {
  let out = String(text ?? '')
  for (const url of urls) out = out.split(url).join(' ')
  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n')
}
