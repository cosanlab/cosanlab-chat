<script>
  import { getIdentity, saveName, NAME_MAX } from './lib/identity.js'
  import { parsePath } from './lib/router.js'
  import { onAuth, completeMagicLink } from './lib/auth.js'
  import { onRoomMeta } from './lib/rooms.js'
  import Room from './components/Room.svelte'
  import Landing from './components/Landing.svelte'
  import EmailGate from './components/EmailGate.svelte'
  import AdminApp from './components/admin/AdminApp.svelte'

  let route = $state(parsePath(location.pathname))
  $effect(() => {
    const onPop = () => (route = parsePath(location.pathname))
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  })

  let user = $state(null) // {uid, email} | null
  let authReady = $state(false)
  $effect(() => onAuth((u) => { user = u; authReady = true }))
  $effect(() => { completeMagicLink().catch((e) => console.error('magic link', e)) })

  // Room gate state. meta === undefined → still loading; null → no such room
  // (or just created); denied → private and we lack access.
  let meta = $state(undefined)
  let denied = $state(false)
  $effect(() => {
    if (route.view !== 'room') return
    meta = undefined
    denied = false
    return onRoomMeta(route.roomId, (m) => { meta = m; denied = false }, () => (denied = true))
  })

  let identity = $state(getIdentity())
  let draft = $state('')
  let joinError = $state('')

  function join(e) {
    e.preventDefault()
    try {
      saveName(draft)
      identity = getIdentity()
    } catch {
      joinError = 'Please enter a name to join.'
    }
  }
</script>

{#if route.view === 'landing'}
  <Landing />
{:else if route.view === 'admin'}
  <AdminApp />
{:else if route.view === 'notfound'}
  <main class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
    <p class="text-5xl mb-4">🤷</p>
    <p class="text-mist">“{route.slug}” isn’t a valid room code.</p>
    <a href="/" class="mt-4 text-accent underline">back to cosanlab chat</a>
  </main>
{:else if denied}
  <EmailGate roomId={route.roomId} signedInAs={user?.email ?? null} />
{:else if meta === undefined}
  <main class="grid place-items-center min-h-dvh text-mist">loading…</main>
{:else if meta === null}
  <main class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
    <p class="text-5xl mb-4">🚪</p>
    <p class="text-mist">No room here yet. Check the code, or ask the organizer.</p>
    <a href="/" class="mt-4 text-accent underline">back to cosanlab chat</a>
  </main>
{:else if identity.name === null}
  <main class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
    <div class="w-full max-w-sm">
      <img src="/img/cosanlab-sticker.png" alt="COSAN Lab" class="mx-auto mb-4 h-16 w-auto" />
      <h1 class="text-4xl font-bold text-accent">{meta.name}</h1>
      <p class="mt-2 text-xs uppercase tracking-[0.2em] text-mist/80">cosanlab chat</p>
      <form onsubmit={join} class="mt-8 flex flex-col gap-3">
        <input
          class="w-full rounded-xl bg-surface border border-surface-2 px-4 py-3 text-lg placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Your name"
          maxlength={NAME_MAX}
          bind:value={draft}
          autocomplete="name"
          data-testid="name-input"
        />
        <button
          class="w-full rounded-xl bg-gradient-to-r from-accent to-accent-hot px-4 py-3 text-lg font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98] transition"
          type="submit"
          data-testid="join-button"
        >Join the chat</button>
        {#if joinError}<p class="text-blush text-sm">{joinError}</p>{/if}
      </form>
      <p class="mt-6 text-xs text-petal/70">no account needed — just be kind</p>
    </div>
  </main>
{:else}
  {#key route.roomId}
    <Room {identity} roomId={route.roomId} {meta} />
  {/key}
{/if}
