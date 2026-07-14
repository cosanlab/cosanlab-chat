# Hide Unfurled Image Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip successfully-unfurled image URLs from the message bubble; hide the bubble entirely for image-only messages; restore the URL if its image fails to load.

**Architecture:** A pure `stripImageUrls(text, urls)` in `src/lib/media.js` cleans the bubble text. `MessageBubble.svelte` derives `activeImages` (extracted minus failed) and `bubbleText`, skips the bubble when empty, and moves the unfurled images inside the bubble's `relative` wrapper so the hover pill stays anchored without a bubble.

**Tech Stack:** Svelte 5 (runes), Tailwind 4, vitest, Playwright.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-hide-unfurled-links-design.md`
- Branch: `fix/hover-actions-picker` (continues PR #1).
- `data-testid="meme-image"` and all other testids unchanged.
- Failed images must restore their URL to the bubble (never lose the link; never render an empty message row).

---

### Task 1: `stripImageUrls` helper (TDD)

**Files:**
- Modify: `src/lib/media.js`
- Test: `src/lib/media.test.js` (append)

**Interfaces:**
- Produces: `stripImageUrls(text, urls: string[]) -> string` — removes each URL occurrence, collapses leftover space runs, trims lines, drops emptied lines; returns `''` when nothing remains.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/media.test.js`:

```js
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
```

Also add `stripImageUrls` to the import at the top of the file:

```js
import { extractImageUrls, stripImageUrls } from './media.js'
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/media.test.js`
Expected: FAIL — `stripImageUrls` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/media.js`:

```js
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/media.test.js`
Expected: PASS (existing extractImageUrls tests + 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/media.js src/lib/media.test.js
git commit -m "feat: stripImageUrls helper for unfurled-link hiding"
```

---

### Task 2: Bubble hides stripped text; images move into the wrapper

**Files:**
- Modify: `src/components/MessageBubble.svelte`

**Interfaces:**
- Consumes: `stripImageUrls` from Task 1; existing `images`, `failedImages`, `linkify`.

- [ ] **Step 1: Derive active images and bubble text**

In the script block, extend the media import and replace the images derivation:

```js
import { extractImageUrls, stripImageUrls } from '../lib/media.js'
```

```js
// Extract image URLs from message text
let images = $derived(extractImageUrls(message.text))
let failedImages = $state({}) // url -> true once its <img> errored
let activeImages = $derived(images.filter((s) => !failedImages[s]))
// Unfurled URLs leave the bubble; a failed image puts its URL back.
let bubbleText = $derived(stripImageUrls(message.text, activeImages))
```

- [ ] **Step 2: Conditional bubble + images inside the wrapper**

Inside the `relative` wrapper div (`class="relative inline-block max-w-[80%] mt-0.5 ..."`):

1. Wrap the text bubble div in `{#if bubbleText !== ''}` and change its `{#each linkify(message.text) ...}` to `{#each linkify(bubbleText) ...}`.
2. Move the meme-unfurl `{#each}` block (currently after the flex row, rendering `<a>` with `max-w-[80%] {mine ? 'ml-auto' : 'mr-auto'}`) to directly after the text bubble div, inside the wrapper, simplified to:

```svelte
      {#each activeImages as src (src)}
        <a href={src} target="_blank" rel="noopener noreferrer" class="block mt-1 {mine ? 'ml-auto' : 'mr-auto'} w-fit">
          <img
            {src}
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            class="rounded-xl max-h-64 w-auto shadow-md"
            onerror={() => (failedImages[src] = true)}
            data-testid="meme-image"
          />
        </a>
      {/each}
```

(`images.filter(...)` becomes the `activeImages` derived; `max-w-[80%]` drops because the wrapper already caps width; `w-fit` + `ml-auto`/`mr-auto` keeps images hugging the message's side.)

3. Delete the old meme-unfurl block outside the flex row.

- [ ] **Step 3: Verify tests and build**

Run: `npm test && npm run build`
Expected: all vitest suites PASS; build clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/MessageBubble.svelte
git commit -m "fix: hide raw image links once they unfurl; bubble skipped for image-only messages"
```

---

### Task 3: e2e assertion + full regression

**Files:**
- Modify: `e2e/rooms.spec.js` ("image links unfurl below the bubble" test)

- [ ] **Step 1: Strengthen the unfurl test**

In `e2e/rooms.spec.js`, after `await expect(page.getByTestId('meme-image')).toBeVisible()` add:

```js
  await expect(page.getByText('behold', { exact: true })).toBeVisible()
  await expect(page.getByText(/upload\.wikimedia\.org/)).not.toBeVisible()
```

- [ ] **Step 2: Run the full e2e suite**

Run: `npm run e2e`
Expected: 8 passed.

- [ ] **Step 3: Visual check**

Scripted browser check (emulators + dev server): post an image-only giphy-style URL and a mixed message; screenshot both; verify no URL bubble on the image-only message, hover pill appears beside the image, and reacting works.

- [ ] **Step 4: Commit**

```bash
git add e2e/rooms.spec.js
git commit -m "test: unfurl e2e asserts the raw link is hidden"
```
