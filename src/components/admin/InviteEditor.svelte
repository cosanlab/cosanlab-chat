<script>
  import { ref, onValue } from 'firebase/database'
  import { db } from '../../lib/firebase.js'
  import { roomPath } from '../../lib/paths.js'
  import { addInvite, removeInvite } from '../../lib/rooms.js'
  import { decodeEmail } from '../../lib/keys.js'

  let { roomId } = $props()
  let invited = $state([])
  let draft = $state('')
  let inviteError = $state('')
  $effect(() =>
    onValue(ref(db, roomPath(roomId, 'meta', 'invited')), (snap) =>
      (invited = Object.keys(snap.val() ?? {}).map(decodeEmail)),
    ),
  )

  async function add(e) {
    e.preventDefault()
    inviteError = ''
    const email = draft.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    try {
      await addInvite(roomId, email)
      draft = ''
    } catch {
      inviteError = 'couldn’t add invite — still signed in as an admin?'
    }
  }

  function remove(email) {
    inviteError = ''
    removeInvite(roomId, email).catch(() => (inviteError = 'couldn’t remove invite'))
  }
</script>

<div class="mt-2" data-testid="invite-editor">
  <form onsubmit={add} class="flex gap-2">
    <input class="flex-1 rounded-lg bg-night border border-surface-2 px-3 py-2 text-white"
           type="email" placeholder="invite email…" bind:value={draft} data-testid="invite-input" />
    <button class="rounded-lg bg-accent px-3 py-2 text-white" type="submit" data-testid="invite-add">Add</button>
  </form>
  <ul class="mt-2 flex flex-wrap gap-2">
    {#each invited as email (email)}
      <li class="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs">
        {email}
        <button class="text-blush" onclick={() => remove(email)} aria-label="remove {email}">×</button>
      </li>
    {/each}
  </ul>
  {#if inviteError}<p class="mt-2 text-blush text-xs" data-testid="invite-error">{inviteError}</p>{/if}
</div>
