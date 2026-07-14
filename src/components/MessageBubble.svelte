<script>
  import ReactionBar from './ReactionBar.svelte'
  import EmojiPicker from './EmojiPicker.svelte'
  import { shortTime } from '../lib/time.js'
  import { linkify } from '../lib/derive.js'
  import { tokenizeMentions } from '../lib/mentions.js'
  import { extractImageUrls, stripImageUrls } from '../lib/media.js'
  import { spaceBelow, opensUpward, findScrollParent } from '../lib/popover.js'

  let {
    message,
    mine,
    reactions = [],
    replyCount = 0,
    showMeta = true, // false when grouped under the previous message (same author, close in time)
    knownNames = [],
    selfName = '',
    onToggleReaction,
    onOpenThread = null,
  } = $props()

  // ts is null until the server acks the write — that's the "pending" look
  let pending = $derived(!message.ts)
  let showPicker = $state(false)
  let pickerAbove = $state(false)
  let rowEl = $state(null)

  // Slack-style "you were mentioned" row treatment
  let mentionsMe = $derived(
    selfName !== '' &&
      tokenizeMentions(message.text, knownNames).some(
        (p) => p.mention?.toLowerCase() === selfName.toLowerCase(),
      ),
  )

  // Extract image URLs from message text
  let images = $derived(extractImageUrls(message.text))
  let failedImages = $state({}) // url -> true once its <img> errored
  let activeImages = $derived(images.filter((s) => !failedImages[s]))
  // Unfurled URLs leave the bubble; a failed image puts its URL back.
  let bubbleText = $derived(stripImageUrls(message.text, activeImages))

  function pick(emoji) {
    showPicker = false
    onToggleReaction(message.id, emoji)
  }

  // Overlay direction: open upward when the message is near the bottom
  // of its scroll container, so the picker never forces a scroll.
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
</script>

<div
  bind:this={rowEl}
  class="group relative px-4 {showMeta ? 'pt-2' : 'pt-0.5'} pb-0.5 hover:bg-white/[0.02]
    {mentionsMe ? 'bg-blush/10 border-l-2 border-blush rounded-r-lg' : 'rounded-lg'}"
  data-testid="message-{message.id}"
>
  {#if showMeta}
    <div class="flex items-baseline gap-2 {mine ? 'justify-end' : ''}">
      <span class="text-sm font-bold text-petal">{message.name}</span>
      <span class="text-xs text-mist/70">{shortTime(message.ts)}</span>
    </div>
  {/if}

  <div class="flex {mine ? 'justify-end' : 'justify-start'}">
    <div class="relative inline-block max-w-[80%] mt-0.5 {mine ? 'ml-16' : 'mr-16'}">
      {#if bubbleText !== ''}
      <div
        class="px-3 py-1.5 text-white shadow-md break-words whitespace-pre-wrap transition-opacity
          {pending ? 'opacity-60' : 'opacity-100'}
          {mine
          ? 'bg-own rounded-tl-xl rounded-tr-xl rounded-bl-xl'
          : 'bg-other text-[#081030] rounded-tl-xl rounded-tr-xl rounded-br-xl'}"
      >
        {#each linkify(bubbleText) as part, i (i)}
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
      {/if}

      <!-- Meme unfurling: extracted image links render as images, not text -->
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
          onclick={togglePicker}
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

  {#if showPicker}
    <div
      class="absolute {pickerAbove ? 'bottom-full mb-1' : 'top-full mt-1'} {mine ? 'right-4' : 'left-4'} z-20"
    >
      <EmojiPicker onPick={pick} onClose={() => (showPicker = false)} />
    </div>
  {/if}

  <ReactionBar {reactions} {mine} onToggle={(emoji) => onToggleReaction(message.id, emoji)} />

  {#if onOpenThread && replyCount > 0}
    <div class="flex {mine ? 'justify-end' : 'justify-start'}">
      <button
        type="button"
        data-testid="thread-count-{message.id}"
        class="mt-1 flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hot transition"
        onclick={() => onOpenThread(message.id)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
      </button>
    </div>
  {/if}
</div>
