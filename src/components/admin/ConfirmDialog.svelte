<script>
  let { label, expected, onconfirm, onclose } = $props()
  let typed = $state('')
</script>

<div class="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog">
  <div class="w-full max-w-sm rounded-xl bg-surface p-5">
    <p class="text-sm text-mist">{label}</p>
    <p class="mt-2 text-xs text-mist">Type <span class="font-mono text-white">{expected}</span> to confirm.</p>
    <input class="mt-3 w-full rounded-lg bg-night border border-surface-2 px-3 py-2"
           bind:value={typed} data-testid="confirm-input" />
    <div class="mt-4 flex justify-end gap-2">
      <button class="px-4 py-2 text-mist" onclick={onclose}>Cancel</button>
      <button class="rounded-lg bg-blush px-4 py-2 font-semibold text-night disabled:opacity-40"
              disabled={typed !== expected} onclick={() => { onconfirm(); onclose() }}
              data-testid="confirm-button">Confirm</button>
    </div>
  </div>
</div>
