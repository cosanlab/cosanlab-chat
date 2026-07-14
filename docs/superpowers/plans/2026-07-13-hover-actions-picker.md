# Hover Actions & Emoji Picker Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the react/reply hover pill beside the message bubble, and make the emoji picker an overlay that flips upward when the message is near the bottom of the chat.

**Architecture:** All UI changes live in `src/components/MessageBubble.svelte`. The bubble gets a `relative` positioning wrapper; the actions pill anchors to the bubble's outer edge. The picker becomes `absolute` (overlay, no layout growth) with its open direction decided by pure helpers in a new `src/lib/popover.js`.

**Tech Stack:** Svelte 5 (runes), Tailwind 4, vitest (plain Node — pure functions only), Playwright e2e via Firebase emulators.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-hover-actions-picker-design.md`
- All existing `data-testid` attributes must be preserved (`add-reaction`, `open-thread-{id}`, `emoji-picker`, `pick-{emoji}`).
- The `msg-actions` class must stay on the actions pill — `src/app.css:20-24` uses it to keep actions visible on touch screens (`@media (hover: none)`).
- The actions pill must fit inside the bubble's reserved side gutter on a 375px-wide phone with the bubble at max width: pill ≈ 62px wide, so the gutter margin becomes `ml-16`/`mr-16` (64px), replacing `ml-10`/`mr-10`. Anything poking past the row edge causes horizontal scroll (the chat container's `overflow-y-auto` makes `overflow-x` compute to `auto`).
- Run unit tests with `npm test`. Full e2e (`npm run e2e`) needs Firebase emulators and runs once at the end.

---

### Task 1: Popover direction helpers (pure, TDD)

**Files:**
- Create: `src/lib/popover.js`
- Test: `src/lib/popover.test.js`

**Interfaces:**
- Produces: `spaceBelow(anchorRect, containerRect) -> number` (px between anchor bottom and container bottom); `opensUpward(space, needed = 90) -> boolean`; `findScrollParent(el) -> Element | null` (DOM walker, e2e-covered only — vitest here has no DOM).

- [ ] **Step 1: Write the failing test**

Create `src/lib/popover.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/popover.test.js`
Expected: FAIL — `Cannot find module './popover.js'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `src/lib/popover.js`:

```js
// Positioning helpers for message-anchored popovers (emoji picker).

// px of free space between an anchor's bottom edge and its scroll
// container's bottom edge. Rects are DOMRect-shaped ({ bottom }).
export function spaceBelow(anchorRect, containerRect) {
  return containerRect.bottom - anchorRect.bottom
}

// A popover needs ~90px below the anchor (picker height + margin);
// with less than that it should open upward instead.
export function opensUpward(space, needed = 90) {
  return space < needed
}

// Nearest ancestor that scrolls vertically, or null (caller falls back
// to the viewport). Not unit-tested: vitest runs without a DOM here.
export function findScrollParent(el) {
  let node = el?.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
    node = node.parentElement
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/popover.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/popover.js src/lib/popover.test.js
git commit -m "feat: popover direction helpers for message-anchored popovers"
```

---

### Task 2: Hover actions beside the bubble

**Files:**
- Modify: `src/components/MessageBubble.svelte:55-138`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `relative` bubble wrapper div inside the flex row (Task 3 does NOT depend on it — the picker anchors to the row root, not this wrapper).

- [ ] **Step 1: Restructure the bubble row**

In `src/components/MessageBubble.svelte`, replace the flex row (lines 55–84) so the bubble sits inside a `relative` wrapper that owns the max-width and side gutter, and move the actions pill (currently lines 101–138, anchored to the row corner) inside that wrapper, beside the bubble. The old actions div at the row corner is deleted.

Replace lines 55–84 with:

```svelte
  <div class="flex {mine ? 'justify-end' : 'justify-start'}">
    <div class="relative inline-block max-w-[80%] mt-0.5 {mine ? 'ml-16' : 'mr-16'}">
      <div
        class="px-3 py-1.5 text-white shadow-md break-words whitespace-pre-wrap transition-opacity
          {pending ? 'opacity-60' : 'opacity-100'}
          {mine
          ? 'bg-own rounded-tl-xl rounded-tr-xl rounded-bl-xl'
          : 'bg-other text-[#081030] rounded-tl-xl rounded-tr-xl rounded-br-xl'}"
      >
        {#each linkify(message.text) as part, i (i)}
          {#if part.url}
            <a
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              class="underline decoration-current/60 hover:decoration-current break-all"
            >{part.url}</a>
          {:else}
            {#each tokenizeMentions(part.text, knownNames) as piece, j (j)}
              {#if piece.mention}
                <span
                  class="font-bold rounded px-1 {piece.mention.toLowerCase() === selfName.toLowerCase()
                    ? 'bg-white/90 text-[#081030]'
                    : mine ? 'bg-white/25' : 'bg-[#081030]/15'}"
                >@{piece.mention}</span>
              {:else}{piece.text}{/if}
            {/each}
          {/if}
        {/each}
      </div>

      <!-- Hover actions: react + reply icons, beside the bubble's outer edge -->
      <div
        class="msg-actions absolute top-1/2 -translate-y-1/2 {mine ? 'right-full mr-1.5' : 'left-full ml-1.5'} z-10 hidden group-hover:flex group-focus-within:flex items-center rounded-lg bg-surface-2 shadow-lg ring-1 ring-white/10 overflow-hidden"
      >
        <button
          type="button"
          aria-label="Add reaction"
          title="Add reaction"
          data-testid="add-reaction"
          class="p-1.5 text-mist hover:text-white hover:bg-surface transition"
          onclick={() => (showPicker = !showPicker)}
        >
          <!-- smiley-plus -->
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="12" r="8" />
            <path d="M8 14s1.2 1.5 3 1.5 3-1.5 3-1.5" />
            <line x1="8.5" y1="10" x2="8.51" y2="10" />
            <line x1="13.5" y1="10" x2="13.51" y2="10" />
            <line x1="20" y1="3" x2="20" y2="7" />
            <line x1="18" y1="5" x2="22" y2="5" />
          </svg>
        </button>
        {#if onOpenThread}
          <button
            type="button"
            aria-label="Reply in thread"
            title="Reply in thread"
            data-testid="open-thread-{message.id}"
            class="p-1.5 text-mist hover:text-white hover:bg-surface transition"
            onclick={() => onOpenThread(message.id)}
          >
            <!-- speech bubble -->
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </div>
```

Then delete the old actions block that remains after the meme-unfurl `{#each}` (the div starting with `<!-- Slack-style hover actions...` through its closing `</div>`).

Notes on deliberate details:
- The actions div lives in the *wrapper*, not the text bubble div — the bubble has `whitespace-pre-wrap`, and markup whitespace inside it would render as stray blank lines.
- `mt-0.5`, `max-w-[80%]`, `inline-block`, and the side margin move from the bubble to the wrapper so `left-full`/`right-full` measure from the bubble's true edge.
- `ml-10`/`mr-10` become `ml-16`/`mr-16` (see Global Constraints — the always-visible touch pill must fit in the gutter).
- The add-reaction button keeps the existing inline handler `onclick={() => (showPicker = !showPicker)}` in this task; Task 3 swaps it for `togglePicker`.

- [ ] **Step 2: Verify it compiles and unit tests pass**

Run: `npm test && npm run build`
Expected: all vitest suites PASS; vite build completes without errors.

- [ ] **Step 3: Visual check (dev server)**

Run: `npm run dev` and hover messages on both sides in a room with several messages.
Expected: pill appears vertically centered beside the bubble's outer edge (left of yours, right of theirs); no layout shift on hover; name/timestamp never covered.

- [ ] **Step 4: Commit**

```bash
git add src/components/MessageBubble.svelte
git commit -m "fix: hover actions sit beside the bubble, not across the row"
```

---

### Task 3: Emoji picker overlays and flips upward near the bottom

**Files:**
- Modify: `src/components/MessageBubble.svelte` (script block + picker markup at what was lines 140–144)

**Interfaces:**
- Consumes: `spaceBelow`, `opensUpward`, `findScrollParent` from `src/lib/popover.js` (Task 1).

- [ ] **Step 1: Add measurement state and toggle handler**

In the `<script>` block of `MessageBubble.svelte`:

Add the import:

```js
import { spaceBelow, opensUpward, findScrollParent } from '../lib/popover.js'
```

Below `let showPicker = $state(false)` add:

```js
let pickerAbove = $state(false)
let rowEl = $state(null)
```

Below the `pick(emoji)` function add:

```js
function togglePicker() {
  if (!showPicker && rowEl) {
    const container = findScrollParent(rowEl)
    const containerRect = container
      ? container.getBoundingClientRect()
      : { bottom: window.innerHeight }
    pickerAbove = opensUpward(spaceBelow(rowEl.getBoundingClientRect(), containerRect))
  }
  showPicker = !showPicker
}
```

- [ ] **Step 2: Bind the row element and wire the handler**

On the root row div (`class="group relative px-4 ..."`), add `bind:this={rowEl}`:

```svelte
<div
  bind:this={rowEl}
  class="group relative px-4 {showMeta ? 'pt-2' : 'pt-0.5'} pb-0.5 hover:bg-white/[0.02]
    {mentionsMe ? 'bg-blush/10 border-l-2 border-blush rounded-r-lg' : 'rounded-lg'}"
  data-testid="message-{message.id}"
>
```

On the add-reaction button (Task 2's markup), change `onclick={() => (showPicker = !showPicker)}` to `onclick={togglePicker}`.

- [ ] **Step 3: Make the picker an overlay with direction classes**

Replace the in-flow picker block:

```svelte
  {#if showPicker}
    <div class="relative z-20 mt-1 flex {mine ? 'justify-end' : 'justify-start'}">
      <EmojiPicker onPick={pick} onClose={() => (showPicker = false)} />
    </div>
  {/if}
```

with an absolute overlay anchored to the row (the row div is already `relative`):

```svelte
  {#if showPicker}
    <div
      class="absolute {pickerAbove ? 'bottom-full mb-1' : 'top-full mt-1'} {mine ? 'right-4' : 'left-4'} z-20"
    >
      <EmojiPicker onPick={pick} onClose={() => (showPicker = false)} />
    </div>
  {/if}
```

- [ ] **Step 4: Verify compile and unit tests**

Run: `npm test && npm run build`
Expected: all vitest suites PASS; build clean.

- [ ] **Step 5: Visual check (dev server)**

Run: `npm run dev`, in a room with enough messages to scroll:
- Click react on the **newest** message → picker opens **above** the row, overlaying earlier messages; no scroll-height change.
- Click react on a message near the **top** of the viewport → picker opens **below**.
- Same checks inside a thread panel.
- Escape and outside-click still close it; picking an emoji still toggles the reaction.

- [ ] **Step 6: Commit**

```bash
git add src/components/MessageBubble.svelte
git commit -m "fix: emoji picker overlays and flips upward near the bottom"
```

---

### Task 4: Full e2e regression

**Files:** none modified.

- [ ] **Step 1: Run the Playwright suite under emulators**

Run: `npm run e2e`
Expected: all specs PASS — `e2e/smoke.spec.js` exercises `add-reaction` → `pick-💜` on a real page, which now goes through the new pill and overlay.

- [ ] **Step 2: If e2e passes, done.** If a reaction-flow spec fails, debug with `npx playwright test --headed e2e/smoke.spec.js` under `firebase emulators:exec` before changing any test expectations.
