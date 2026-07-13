<script>
  import { ref, get } from 'firebase/database'
  import { db } from '../../lib/firebase.js'
  import { onAuth, signInWithGoogle, signOutUser } from '../../lib/auth.js'
  import { onRoomsIndex, onRoomPresence, sortRooms, exportAll, onAdminEmails, addAdmin, removeAdmin } from '../../lib/rooms.js'
  import { downloadJson } from '../../lib/download.js'
  import { decodeEmail } from '../../lib/keys.js'
  import RoomRow from './RoomRow.svelte'
  import CreateRoomForm from './CreateRoomForm.svelte'

  let user = $state(null)
  let authReady = $state(false)
  let isAdmin = $state(null) // null = unknown, false = signed in but not admin
  $effect(() =>
    onAuth(async (u) => {
      user = u
      authReady = true
      if (!u) { isAdmin = null; return }
      try {
        await get(ref(db, 'config/adminEmails'))
        isAdmin = true
      } catch {
        isAdmin = false
      }
    }),
  )

  let index = $state({})
  $effect(() => { if (isAdmin) return onRoomsIndex((v) => (index = v)) })

  // One presence subscription per room; cleaned up when rooms disappear.
  // This effect only tracks `isAdmin` and `index` — it never reads
  // `presence` synchronously inside the effect body. The `presence = {
  // ...presence, [id]: p }` spread happens inside the onRoomPresence
  // callback, which fires asynchronously (outside this effect's reactive
  // tracking scope), so writing `presence` there does not re-trigger this
  // effect. Only a change to `index` (or `isAdmin`) re-subscribes.
  let presence = $state({}) // roomId -> {count, names}
  $effect(() => {
    if (!isAdmin) return
    const unsubs = Object.keys(index).map((id) =>
      onRoomPresence(id, (p) => (presence = { ...presence, [id]: p })),
    )
    return () => unsubs.forEach((u) => u())
  })

  let rows = $derived(
    sortRooms(index, Object.fromEntries(Object.entries(presence).map(([id, p]) => [id, p.count]))),
  )

  let adminEmails = $state([])
  let adminDraft = $state('')
  let headerError = $state('')
  $effect(() => { if (isAdmin) return onAdminEmails((v) => (adminEmails = v)) })

  async function addAdminSubmit(e) {
    e.preventDefault()
    headerError = ''
    if (!adminDraft.includes('@')) return
    try {
      await addAdmin(adminDraft)
      adminDraft = ''
    } catch {
      headerError = 'couldn’t add admin — still signed in as an admin?'
    }
  }

  async function exportAllClick() {
    headerError = ''
    try {
      downloadJson(`cosanlab-chat-all-${new Date().toISOString().slice(0, 10)}.json`, await exportAll())
    } catch {
      headerError = 'export failed'
    }
  }
</script>

<main class="min-h-dvh px-4 py-8 max-w-4xl mx-auto">
  {#if !authReady}
    <p class="text-mist text-center">loading…</p>
  {:else if !user}
    <div class="grid place-items-center min-h-[60dvh]">
      <button class="rounded-xl bg-accent px-6 py-3 font-semibold text-white"
              onclick={() => signInWithGoogle()} data-testid="admin-google-signin">
        Sign in with Google
      </button>
    </div>
  {:else if isAdmin === false}
    <div class="grid place-items-center min-h-[60dvh] text-center">
      <div>
        <p class="text-mist" data-testid="not-admin">{user.email} isn’t an admin.</p>
        <button class="mt-4 text-accent underline" onclick={() => signOutUser()}>sign out</button>
      </div>
    </div>
  {:else if isAdmin}
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-accent">cosanlab chat · admin</h1>
      <button class="text-sm text-mist hover:text-white" onclick={() => signOutUser()}>
        {user.email} · sign out
      </button>
    </header>

    <CreateRoomForm oncreated={() => {}} />

    <details class="mt-4 rounded-xl bg-surface px-4 py-3">
      <summary class="cursor-pointer text-sm text-mist">admins & export</summary>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs" data-testid="export-all"
                onclick={exportAllClick}>
          export all rooms
        </button>
      </div>
      <form class="mt-3 flex gap-2" onsubmit={addAdminSubmit}>
        <input class="flex-1 rounded-lg bg-night border border-surface-2 px-3 py-2 text-white"
               type="email" placeholder="add admin email…" bind:value={adminDraft} data-testid="admin-email-input" />
        <button class="rounded-lg bg-accent px-3 py-2 text-white" type="submit" data-testid="admin-email-add">Add</button>
      </form>
      <ul class="mt-2 flex flex-wrap gap-2">
        {#each adminEmails as key (key)}
          <li class="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs">
            {decodeEmail(key)}
            {#if decodeEmail(key) !== user.email.toLowerCase()}
              <button class="text-blush" onclick={() => { headerError = ''; removeAdmin(decodeEmail(key)).catch(() => (headerError = 'couldn’t remove admin')) }}>×</button>
            {/if}
          </li>
        {/each}
      </ul>
      {#if headerError}<p class="mt-2 text-blush text-xs" data-testid="admin-error">{headerError}</p>{/if}
    </details>

    <div class="mt-4 flex flex-col gap-2" data-testid="room-table">
      {#each rows as [roomId, entry] (roomId)}
        <RoomRow {roomId} {entry} presence={presence[roomId] ?? { count: 0, names: [] }} />
      {/each}
      {#if !rows.length}<p class="text-mist text-center py-8">No rooms yet.</p>{/if}
    </div>
  {/if}
</main>
