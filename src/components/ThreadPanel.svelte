<script>
  import MessageBubble from './MessageBubble.svelte'
  import Composer from './Composer.svelte'
  import TypingDots from './TypingDots.svelte'
  import { sendMessage, onTyping } from '../lib/chat.js'
  import { replies, typingLabel, groupReactions, sameGroup } from '../lib/derive.js'
  import { isOwnMessage } from '../lib/identity.js'

  let {
    roomId,
    identity,
    parent,
    messages,
    reactionsRaw,
    knownNames = [],
    onToggleReaction,
    onClose,
    disabled = false,
  } = $props()

  let threadReplies = $derived(replies(messages, parent.id))

  let typing = $state([])
  $effect(() => onTyping(roomId, parent.id, (entries) => (typing = entries)))
  let label = $derived(typingLabel(typing, identity.clientId))

  function send(text) {
    sendMessage(roomId, { name: identity.name, text, parentId: parent.id })
  }

  function handleKey(e) {
    // Esc closes the thread — unless an emoji picker is open (it eats Esc first)
    if (e.key === 'Escape' && !document.querySelector('[data-testid="emoji-picker"]')) {
      onClose()
    }
  }
</script>

<svelte:window onkeydown={handleKey} />

<!-- Backdrop on desktop so the room dims behind the side panel -->
<div
  class="fixed inset-0 z-20 bg-black/40 hidden sm:block"
  onpointerdown={onClose}
  aria-hidden="true"
></div>

<div
  class="fixed inset-0 z-30 flex flex-col bg-card sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[26rem] sm:rounded-2xl sm:ring-1 sm:ring-white/10 sm:shadow-2xl overflow-hidden"
  data-testid="thread-panel"
>
  <header class="flex items-center gap-3 px-3 py-2 bg-surface border-b border-white/5">
    <button
      type="button"
      aria-label="Close thread"
      data-testid="close-thread"
      class="h-9 w-9 rounded-lg bg-surface-2 text-mist hover:text-white active:scale-95 transition"
      onclick={onClose}
    >
      ✕
    </button>
    <div>
      <h2 class="font-bold text-sm">Thread</h2>
      <p class="text-xs text-mist">replying to {parent.name}</p>
    </div>
  </header>

  <div class="flex-1 overflow-y-auto py-2">
    <MessageBubble
      message={parent}
      mine={isOwnMessage(parent.id)}
      reactions={groupReactions(reactionsRaw[parent.id], identity.clientId)}
      {knownNames}
      selfName={identity.name}
      onToggleReaction={(id, emoji) => onToggleReaction(id, emoji)}
    />
    <div class="mx-4 my-2 flex items-center gap-2 text-xs text-mist/60">
      <span class="flex-1 border-t border-surface-2"></span>
      {threadReplies.length}
      {threadReplies.length === 1 ? 'reply' : 'replies'}
      <span class="flex-1 border-t border-surface-2"></span>
    </div>
    {#each threadReplies as m, i (m.id)}
      <MessageBubble
        message={m}
        mine={isOwnMessage(m.id)}
        showMeta={!sameGroup(threadReplies[i - 1], m)}
        reactions={groupReactions(reactionsRaw[m.id], identity.clientId)}
        {knownNames}
        selfName={identity.name}
        onToggleReaction={(id, emoji) => onToggleReaction(id, emoji)}
      />
    {/each}
  </div>

  <TypingDots {label} />
  <Composer
    {roomId}
    {identity}
    scope={parent.id}
    placeholder="Reply in thread…"
    onSend={send}
    mentionNames={knownNames}
    {disabled}
    lockedTestid="composer-locked-thread"
  />
</div>
