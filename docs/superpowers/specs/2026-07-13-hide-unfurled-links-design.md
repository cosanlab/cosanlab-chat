# Hide unfurled image links

**Date:** 2026-07-13
**Scope:** cosanlab-chat. `src/lib/media.js`, `src/components/MessageBubble.svelte`, `e2e/rooms.spec.js`.

## Problem

When a message contains an image URL, the image unfurls below the bubble but the bubble still shows the raw URL — for a giphy link that's four lines of noise above the meme.

## Design

### Behavior

- Any image URL whose image renders successfully is stripped from the bubble text.
- Image-only message → no bubble at all, just the unfurled image(s).
- Mixed message ("look at this https://…gif") → bubble shows only the words; image below.
- If an image fails to load (`onerror`), its URL reappears in the bubble as a normal link, so the link is never silently lost.

### Implementation

- New pure function `stripImageUrls(text, urls)` in `src/lib/media.js`: removes each URL occurrence, collapses runs of spaces/tabs left behind, trims each line and drops lines that become empty. Returns the cleaned string ('' when nothing but URLs).
- In `MessageBubble.svelte`:
  - `activeImages` = extracted images minus `failedImages` (failed set already exists).
  - `bubbleText` = `stripImageUrls(message.text, activeImages)`; bubble div renders `linkify(bubbleText)` and is skipped entirely when `bubbleText` is empty. Reactivity handles the failure fallback: an image error shrinks `activeImages`, which restores its URL to `bubbleText`.
- Structural: unfurled images move inside the bubble's `relative` wrapper, below the text bubble, so the hover react/reply pill stays anchored when there is no bubble (pill centers beside the whole content block). Image styling (`rounded-xl max-h-64 w-auto`, link to source, `data-testid="meme-image"`) unchanged; the images no longer need their own `max-w-[80%] ml-auto/mr-auto` since the wrapper provides alignment and width.

## Error handling

- Failed image → hidden `<img>` (existing behavior) and URL restored to the bubble via reactivity. A message whose only content is one broken image link shows the URL bubble again (never an empty row).

## Testing

- Unit (vitest): `stripImageUrls` — single URL-only text → ''; text before/after URL preserved and trimmed; multiple URLs; URL not in the list left untouched; multi-line messages keep non-URL lines.
- e2e: update "image links unfurl below the bubble" in `e2e/rooms.spec.js` to assert the image is visible and the raw URL text is not.
- Manual: image-only message shows hover pill beside the image; reactions still attach.
