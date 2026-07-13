<script>
  import { onRoomsIndex } from '../lib/rooms.js'
  import { navigate, normalizeSlug, isValidSlug } from '../lib/router.js'

  let index = $state({})
  let code = $state('')
  let codeError = $state('')
  $effect(() => onRoomsIndex((v) => (index = v)))

  let publicRooms = $derived(
    Object.entries(index)
      .filter(([, r]) => !r.private && !r.locked)
      .sort(([, a], [, b]) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0)),
  )

  function go(e) {
    e.preventDefault()
    const slug = normalizeSlug(code)
    if (!isValidSlug(slug)) {
      codeError = 'Room codes are 3–40 letters, numbers, and dashes.'
      return
    }
    navigate(`/${slug}`)
  }
</script>

<main class="flex flex-col items-center min-h-dvh px-6 py-16">
  <div class="w-full max-w-md text-center">
    <img src="/img/cosanlab-sticker.png" alt="COSAN Lab" class="mx-auto mb-4 h-16 w-auto" />
    <h1 class="text-4xl font-bold text-accent">cosanlab chat</h1>
    <p class="mt-2 text-mist">Real-time chat for COSAN Lab events and courses.</p>

    <form onsubmit={go} class="mt-8 flex gap-2">
      <input
        class="flex-1 rounded-xl bg-surface border border-surface-2 px-4 py-3 placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-accent"
        placeholder="room code (e.g. psych53-f2026)"
        bind:value={code}
        data-testid="room-code-input"
      />
      <button class="rounded-xl bg-accent px-5 py-3 font-semibold text-white" type="submit" data-testid="room-code-go">
        Go
      </button>
    </form>
    {#if codeError}<p class="mt-2 text-blush text-sm">{codeError}</p>{/if}

    {#if publicRooms.length}
      <h2 class="mt-10 mb-3 text-xs uppercase tracking-[0.2em] text-mist/80">open rooms</h2>
      <ul class="flex flex-col gap-2" data-testid="public-room-list">
        {#each publicRooms as [id, r] (id)}
          <li>
            <a class="block rounded-xl bg-surface hover:bg-surface-2 px-4 py-3 text-left transition"
               href="/{id}"
               onclick={(e) => { e.preventDefault(); navigate(`/${id}`) }}>
              <span class="font-semibold">{r.name}</span>
              <span class="ml-2 text-xs text-mist">/{id}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</main>
