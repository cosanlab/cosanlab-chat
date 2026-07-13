<script>
  import { getIdentity, saveName, NAME_MAX } from './lib/identity.js'
  import Room from './components/Room.svelte'

  let identity = $state(getIdentity())
  let draft = $state('')
  let joinError = $state('')
  let nameInput = $state(null)

  $effect(() => nameInput?.focus())

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

{#if identity.name === null}
  <main class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
    <div class="w-full max-w-sm">
      <p class="text-5xl mb-4">💬</p>
      <h1 class="text-5xl text-accent">
        cosanlab chat
      </h1>
      <p class="mt-4 text-mist">Real-time chat for COSAN Lab events and courses.</p>
      <form onsubmit={join} class="mt-8 flex flex-col gap-3">
        <input
          class="w-full rounded-xl bg-surface border border-surface-2 px-4 py-3 text-lg placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Your name"
          maxlength={NAME_MAX}
          bind:value={draft}
          bind:this={nameInput}
          autocomplete="name"
          data-testid="name-input"
        />
        <button
          class="w-full rounded-xl bg-gradient-to-r from-accent to-accent-hot px-4 py-3 text-lg font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98] transition"
          type="submit"
          data-testid="join-button"
        >
          Join the chat
        </button>
        {#if joinError}
          <p class="text-blush text-sm">{joinError}</p>
        {/if}
      </form>
      <p class="mt-6 text-xs text-petal/70">no account needed — just be kind 💜</p>
    </div>
  </main>
{:else}
  <Room {identity} />
{/if}
