<script>
  import { timeAgo } from '../../lib/time-ago.js'
  let { roomId, entry, presence } = $props()
  let expanded = $state(false)
  let copied = $state(false)

  function copyLink() {
    navigator.clipboard.writeText(`${location.origin}/${roomId}`)
    copied = true
    setTimeout(() => (copied = false), 1500)
  }
</script>

<div class="rounded-xl bg-surface px-4 py-3" data-testid="room-row-{roomId}">
  <div class="flex items-center gap-3">
    <button class="flex-1 text-left" onclick={() => (expanded = !expanded)}>
      <span class="font-semibold">{entry.name}</span>
      <span class="ml-2 text-xs text-mist">/{roomId}</span>
    </button>
    {#if presence.count > 0}
      <span class="text-xs text-petal" data-testid="present-count">🟢 {presence.count}</span>
    {/if}
    <span class="text-xs text-mist">{entry.private ? '🔒 private' : '🌐 public'}</span>
    <span class="text-xs text-mist">{entry.locked ? 'locked' : 'open'}</span>
    <span class="text-xs text-mist w-16 text-right">{timeAgo(entry.lastActivityAt)}</span>
    <button class="text-xs text-accent" onclick={copyLink} data-testid="copy-link">
      {copied ? 'copied!' : 'copy link'}
    </button>
  </div>
  {#if expanded}
    <div class="mt-3 border-t border-surface-2 pt-3 text-sm text-mist" data-testid="room-detail">
      {#if presence.names.length}
        <p>here now: {presence.names.join(', ')}</p>
      {:else}
        <p>nobody here right now</p>
      {/if}
      <!-- Task 14 adds the action buttons in this panel -->
    </div>
  {/if}
</div>
