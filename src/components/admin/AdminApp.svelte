<script>
  import { ref, get } from 'firebase/database'
  import { db } from '../../lib/firebase.js'
  import { onAuth, signInWithGoogle, signOutUser } from '../../lib/auth.js'
  import { onRoomsIndex, onRoomPresence, sortRooms } from '../../lib/rooms.js'
  import RoomRow from './RoomRow.svelte'

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
    <div class="flex flex-col gap-2" data-testid="room-table">
      {#each rows as [roomId, entry] (roomId)}
        <RoomRow {roomId} {entry} presence={presence[roomId] ?? { count: 0, names: [] }} />
      {/each}
      {#if !rows.length}<p class="text-mist text-center py-8">No rooms yet.</p>{/if}
    </div>
  {/if}
</main>
