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
  $effect(() => onAuth((u) => (user = u)))

  // Magic-link boot: false → not a link; true → auth listener takes over;
  // 'needs-email' → link opened in a browser without the stored pending
  // email (cross-device/profile) — render an in-page confirm form.
  let linkNeedsEmail = $state(false)
  let linkEmail = $state('')
  let linkError = $state('')
  $effect(() => {
    completeMagicLink()
      .then((r) => { if (r === 'needs-email') linkNeedsEmail = true })
      .catch((e) => console.error('magic link', e))
  })

  async function confirmLinkEmail(e) {
    e.preventDefault()
    linkError = ''
    try {
      await completeMagicLink(linkEmail.trim())
      linkNeedsEmail = false
    } catch (err) {
      console.error('magic link confirm', err)
      linkError = 'That didn’t match — the link may have expired. Ask for a new one from the room page.'
    }
  }

  function abandonLink() {
    history.replaceState({}, '', location.pathname)
    linkNeedsEmail = false
  }

  // Room gate state. meta === undefined → still loading; null → no such room
  // (or just created); denied → private and we lack access.
  let meta = $state(undefined)
  let denied = $state(false)
  $effect(() => {
    if (route.view !== 'room') return
    void user // tracked dep: RTDB cancels denied listeners; re-subscribe on auth changes
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

{#if linkNeedsEmail}
  <main class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
    <div class="w-full max-w-sm">
      <p class="text-5xl mb-4">✉️</p>
      <h1 class="text-3xl font-bold text-accent">Confirm your email</h1>
      <p class="mt-4 text-mist">
        This sign-in link was opened in a different browser than where it was requested.
        Enter the email it was sent to:
      </p>
      <form onsubmit={confirmLinkEmail} class="mt-6 flex flex-col gap-3">
        <input
          class="w-full rounded-xl bg-surface border border-surface-2 px-4 py-3 placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-accent"
          type="email" required placeholder="you@dartmouth.edu"
          bind:value={linkEmail} data-testid="link-confirm-input"
        />
        <button class="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white"
                type="submit" data-testid="link-confirm-submit">Sign in</button>
        {#if linkError}
          <p class="text-blush text-sm">{linkError}</p>
          <button type="button" class="text-accent underline text-sm" onclick={abandonLink}>start over</button>
        {/if}
      </form>
    </div>
  </main>
{:else if route.view === 'landing'}
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
