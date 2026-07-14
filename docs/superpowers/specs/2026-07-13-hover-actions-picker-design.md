# Hover actions & emoji picker positioning

**Date:** 2026-07-13
**Scope:** cosanlab-chat only. `src/components/MessageBubble.svelte` (used by both `Room.svelte` and `ThreadPanel.svelte`).

## Problems

1. The react/reply hover toolbar is anchored to the message **row's** corner opposite the bubble (`absolute -top-2.5 {mine ? 'left-3' : 'right-3'}`). Bubbles hug one side of the row, so on wide windows the buttons appear far from the message they act on.
2. The emoji picker renders **in normal flow** below the message (`mt-1` block). For the newest message this grows the scroll area past the viewport, forcing the user to scroll down to reach the picker.

## Design

### 1. Hover actions sit beside the bubble

- The bubble div gains `relative`; the actions pill moves inside it as an absolutely positioned child:
  - others' messages (left-aligned bubble): `left-full ml-1.5`
  - own messages (right-aligned bubble): `right-full mr-1.5`
  - both: `top-1/2 -translate-y-1/2`, vertically centered on the bubble.
- The pill occupies the gutter the bubble already reserves via `ml-10` / `mr-10`.
- Absolute positioning means the reveal causes zero layout shift.
- Reveal mechanism (`hidden group-hover:flex group-focus-within:flex`), pill styling, and all `data-testid` attributes are unchanged.

### 2. Emoji picker overlays and flips

- The picker wrapper becomes `absolute` (overlaying content) instead of in-flow, anchored to the message row, hugging the bubble's side as today. Opening it never changes the scroll height.
- On open, decide direction with a measurement:
  - Walk up `parentElement` from the row to the nearest scrollable ancestor (`overflow-y: auto|scroll` via `getComputedStyle`); fall back to the viewport. This covers both scroll contexts (Room's `h-full overflow-y-auto` and ThreadPanel's `flex-1 overflow-y-auto`).
  - If space below the row within that container is less than ~90px (picker height + margin), anchor the picker above the row (`bottom-full mb-1`); otherwise below (`top-full mt-1`).
- Escape / outside-click close behavior in `EmojiPicker.svelte` is untouched.

## Error handling

- If no scrollable ancestor is found (shouldn't happen), the viewport fallback keeps the measurement sane.
- Direction is computed once per open; the picker doesn't reposition live on scroll (closes on outside interaction anyway).

## Testing

- Existing vitest suite passes unchanged.
- Existing Playwright e2e reaction specs pass unchanged (testids preserved).
- Manual check: picker opens upward on the newest message, downward on the oldest; hover pill appears beside bubbles on both sides with no layout shift.
