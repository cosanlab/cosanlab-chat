<script>
  import { timeAgo } from '../../lib/time-ago.js'
  import { setRoomFlag, exportRoom, resetRoom, deleteRoom } from '../../lib/rooms.js'
  import { downloadJson } from '../../lib/download.js'
  import InviteEditor from './InviteEditor.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  let { roomId, entry, presence, expandInitially = false } = $props()
  // svelte-ignore state_referenced_locally -- intentional: only the initial value matters
  let expanded = $state(expandInitially)
  let copied = $state(false)
  let confirming = $state(null)
  let actionError = $state('')
  const today = () => new Date().toISOString().slice(0, 10)

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
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs" data-testid="toggle-locked"
                onclick={() => { actionError = ''; setRoomFlag(roomId, 'locked', !entry.locked).catch(() => (actionError = 'lock/unlock failed — still signed in as an admin?')) }}>
          {entry.locked ? 'unlock' : 'lock'}
        </button>
        <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs" data-testid="toggle-private"
                onclick={() => { actionError = ''; setRoomFlag(roomId, 'private', !entry.private).catch(() => (actionError = 'public/private toggle failed — still signed in as an admin?')) }}>
          make {entry.private ? 'public' : 'private'}
        </button>
        <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs" data-testid="export-room"
                onclick={async () => {
                  actionError = ''
                  try { downloadJson(`${roomId}-${today()}.json`, await exportRoom(roomId)) }
                  catch { actionError = 'export failed' }
                }}>
          export json
        </button>
        <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-blush" data-testid="reset-room"
                onclick={() => { actionError = ''; confirming = 'reset' }}>reset…</button>
        <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-blush" data-testid="delete-room"
                onclick={() => { actionError = ''; confirming = 'delete' }}>delete…</button>
      </div>
      {#if entry.private}<InviteEditor {roomId} />{/if}
      {#if confirming === 'reset'}
        <ConfirmDialog label="Erase every message, reaction, and presence entry in “{entry.name}”? Meta and invites survive."
                       expected={roomId} onconfirm={() => resetRoom(roomId).catch(() => (actionError = 'reset failed — nothing was deleted'))} onclose={() => (confirming = null)} />
      {:else if confirming === 'delete'}
        <ConfirmDialog label="Permanently delete “{entry.name}” and all its data?"
                       expected={roomId} onconfirm={() => deleteRoom(roomId).catch(() => (actionError = 'delete failed — the room is still here'))} onclose={() => (confirming = null)} />
      {/if}
      {#if actionError}<p class="mt-2 text-blush text-xs" data-testid="action-error">{actionError}</p>{/if}
    </div>
  {/if}
</div>
