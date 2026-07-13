<script>
  import { sendMagicLink, signOutUser } from '../lib/auth.js'

  let { roomId, signedInAs } = $props()
  let email = $state('')
  let sent = $state(false)
  let error = $state('')

  async function submit(e) {
    e.preventDefault()
    error = ''
    try {
      await sendMagicLink(email.trim(), roomId)
      sent = true
    } catch (err) {
      error = 'Could not send the link — check the address and try again.'
      console.error(err)
    }
  }
</script>

<main class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
  <div class="w-full max-w-sm">
    <p class="text-5xl mb-4">🔒</p>
    <h1 class="text-3xl font-bold text-accent">Private room</h1>
    {#if signedInAs}
      <p class="mt-4 text-mist" data-testid="not-invited">
        <span class="font-semibold">{signedInAs}</span> isn't on this room's invite list.
        If you were invited under a different address, sign out and use that one.
      </p>
      <button class="mt-4 rounded-xl bg-surface px-4 py-2 text-mist hover:bg-surface-2"
              onclick={() => signOutUser()} data-testid="gate-signout">Sign out</button>
    {:else if sent}
      <p class="mt-4 text-mist" data-testid="link-sent">
        Check your email — we sent <span class="font-semibold">{email}</span> a sign-in link.
        Open it on this device to enter the room.
      </p>
    {:else}
      <p class="mt-4 text-mist">Enter the email address you were invited with.</p>
      <form onsubmit={submit} class="mt-6 flex flex-col gap-3">
        <input
          class="w-full rounded-xl bg-surface border border-surface-2 px-4 py-3 placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-accent"
          type="email" required placeholder="you@dartmouth.edu"
          bind:value={email} data-testid="gate-email-input"
        />
        <button class="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white"
                type="submit" data-testid="gate-email-send">Email me a sign-in link</button>
        {#if error}<p class="text-blush text-sm">{error}</p>{/if}
      </form>
    {/if}
  </div>
</main>
