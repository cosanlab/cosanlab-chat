<script>
  import { flushSync } from 'svelte'
  import { setTyping } from '../lib/chat.js'
  import { TEXT_MAX } from '../lib/chat.js'
  import { searchEmoji, completionQuery, applyCompletion, autoReplace } from '../lib/emoji.js'
  import { mentionQuery, searchNames } from '../lib/mentions.js'

  let {
    roomId,
    identity,
    scope,
    placeholder = 'Message — paste an image link to share memes',
    onSend,
    autofocus = false,
    mentionNames = [],
    disabled = false,
  } = $props()

  let text = $state('')
  let inputEl = $state(null)
  let typingTimer
  let lastPing = 0

  // Focus the composer on desktop only — on phones this would pop the
  // keyboard over half the screen before the reader has seen the room.
  $effect(() => {
    if (autofocus && matchMedia('(hover: hover)').matches) inputEl?.focus()
  })

  // Slack-like feel: the indicator lingers 3 s after the last keystroke
  // instead of vanishing instantly. Writes are throttled to one refresh per
  // 1.5 s so an audience of typers doesn't hammer the database per keystroke.
  function pingTyping() {
    if (disabled) return
    const now = Date.now()
    if (now - lastPing > 1500) {
      lastPing = now
      setTyping(roomId, scope, identity, true)
    }
    clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
      lastPing = 0
      setTyping(roomId, scope, identity, false)
    }, 3000)
  }

  // --- :emoji: and @mention autocomplete --------------------------------------
  let suggestions = $state([]) // [{kind:'emoji', name, emoji} | {kind:'mention', name}]
  let selected = $state(0)

  // names arrive asynchronously (presence sync) — recompute open suggestions
  // when the candidate list changes, not just on keystrokes
  $effect(() => {
    mentionNames
    refreshSuggestions()
  })

  function refreshSuggestions() {
    const caret = inputEl?.selectionStart ?? text.length
    const before = text.slice(0, caret)
    const eq = completionQuery(before)
    if (eq) {
      suggestions = searchEmoji(eq).map((s) => ({ kind: 'emoji', ...s }))
    } else {
      const mq = mentionQuery(before)
      const others = mentionNames.filter((n) => n !== identity.name)
      suggestions =
        mq !== null
          ? searchNames(mq, others).map((name) => ({ kind: 'mention', name }))
          : []
    }
    selected = 0
  }

  function pickSuggestion(i) {
    const caret = inputEl.selectionStart ?? text.length
    const s = suggestions[i]
    const head = text.slice(0, caret)
    const before =
      s.kind === 'emoji'
        ? applyCompletion(head, s.emoji)
        : head.replace(/@[^\s@]*$/, `@${s.name} `)
    // flushSync so the caret moves before any further keystroke lands —
    // an async (rAF) restore races fast typists and scrambles the text
    flushSync(() => {
      text = before + text.slice(caret)
      suggestions = []
    })
    inputEl.focus()
    inputEl.setSelectionRange(before.length, before.length)
  }

  function handleInput() {
    // typing the closing colon of a known :name: converts it inline
    const caret = inputEl?.selectionStart ?? text.length
    const replaced = autoReplace(text.slice(0, caret))
    if (replaced !== null) {
      const tail = text.slice(caret)
      flushSync(() => (text = replaced + tail))
      inputEl.setSelectionRange(replaced.length, replaced.length)
    }
    refreshSuggestions()
    pingTyping()
    autogrow()
  }

  // --- textarea: Enter sends, Shift+Enter adds a newline -----------------------
  function handleKeydown(e) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        selected = (selected + 1) % suggestions.length
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        selected = (selected - 1 + suggestions.length) % suggestions.length
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pickSuggestion(selected)
        return
      }
      if (e.key === 'Escape') {
        e.stopPropagation() // don't also close the thread panel
        suggestions = []
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function autogrow() {
    if (!inputEl) return
    inputEl.style.height = 'auto'
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px' // ~5 lines
  }

  function submit(e) {
    e?.preventDefault()
    if (disabled) return
    const clean = text.trim()
    if (!clean) return
    onSend(clean)
    text = ''
    suggestions = []
    clearTimeout(typingTimer)
    lastPing = 0 // so typing again right after a send re-pings immediately
    setTyping(roomId, scope, identity, false)
    requestAnimationFrame(autogrow)
  }
</script>

<!-- No emoji button: phones have native emoji keyboards, macOS has ⌃⌘Space,
     and :name: autocompletes. Reactions get their own picker per message. -->
<div class="relative px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
  {#if disabled}
    <div class="px-4 py-3 text-center text-sm text-mist" data-testid="composer-locked">
      This room is locked.
    </div>
  {:else}
  {#if suggestions.length > 0}
    <div
      class="absolute bottom-full left-3 right-3 mb-1 rounded-xl bg-surface-2 shadow-xl ring-1 ring-white/10 overflow-hidden"
      data-testid="emoji-suggestions"
    >
      {#each suggestions as s, i (s.kind + s.name)}
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left transition
            {i === selected ? 'bg-accent/30 text-white' : 'text-mist hover:bg-surface'}"
          onpointerdown={(e) => {
            e.preventDefault() // keep focus in the textarea
            pickSuggestion(i)
          }}
          data-testid="suggest-{s.name}"
        >
          {#if s.kind === 'emoji'}
            <span class="text-lg">{s.emoji}</span>
            <span>:{s.name}:</span>
          {:else}
            <span class="text-blush font-semibold">@</span>
            <span>{s.name}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
  <form onsubmit={submit} class="flex items-end gap-2">
    <textarea
      rows="1"
      class="min-w-0 flex-1 resize-none rounded-xl bg-surface border border-surface-2 px-4 py-2.5 leading-6 placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-accent"
      {placeholder}
      maxlength={TEXT_MAX}
      bind:value={text}
      bind:this={inputEl}
      oninput={handleInput}
      onkeydown={handleKeydown}
      enterkeyhint="send"
      data-testid="composer-input"
    ></textarea>
    <button
      type="submit"
      aria-label="Send message"
      data-testid="send-button"
      class="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-r from-accent to-accent-hot text-white shadow-lg shadow-accent/30 active:scale-95 transition disabled:opacity-40 flex items-center justify-center"
      disabled={!text.trim()}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
  </form>
  {/if}
</div>
