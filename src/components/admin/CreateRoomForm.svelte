<script>
  import { createRoom } from '../../lib/rooms.js'
  import { normalizeSlug, isValidSlug } from '../../lib/router.js'

  let name = $state('')
  let slug = $state('')
  let slugTouched = $state(false)
  let isPrivate = $state(false)
  let error = $state('')
  let { oncreated } = $props()

  // auto-suggest slug from name until the user edits the slug directly
  $effect(() => {
    if (!slugTouched) slug = normalizeSlug(name).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  })

  async function submit(e) {
    e.preventDefault()
    const id = normalizeSlug(slug)
    if (!isValidSlug(id)) { error = 'Slug must be 3–40 chars: a–z, 0–9, dashes (and not a reserved word).'; return }
    if (!name.trim()) { error = 'Give the room a name.'; return }
    error = ''
    try {
      await createRoom({ roomId: id, name: name.trim(), isPrivate })
      name = ''; slug = ''; slugTouched = false; isPrivate = false
      oncreated?.(id)
    } catch (err) { error = 'Create failed — are you still signed in as an admin?'; console.error(err) }
  }
</script>

<form onsubmit={submit} class="rounded-xl bg-surface p-4 flex flex-wrap items-end gap-3">
  <label class="flex-1 min-w-40 text-xs text-mist">room name
    <input class="mt-1 w-full rounded-lg bg-night border border-surface-2 px-3 py-2 text-base text-white"
           bind:value={name} data-testid="create-name" placeholder="Psych 53 — Fall 2026" />
  </label>
  <label class="flex-1 min-w-40 text-xs text-mist">slug (URL)
    <input class="mt-1 w-full rounded-lg bg-night border border-surface-2 px-3 py-2 text-base text-white font-mono"
           bind:value={slug} oninput={() => (slugTouched = true)} data-testid="create-slug" placeholder="psych53-f2026" />
  </label>
  <label class="flex items-center gap-2 text-sm text-mist pb-2">
    <input type="checkbox" bind:checked={isPrivate} data-testid="create-private" /> private
  </label>
  <button class="rounded-lg bg-accent px-4 py-2 font-semibold text-white" type="submit" data-testid="create-submit">
    Create room
  </button>
  {#if error}<p class="w-full text-blush text-sm">{error}</p>{/if}
</form>
