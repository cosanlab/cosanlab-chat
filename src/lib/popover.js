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
