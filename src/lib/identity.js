// No-auth identity: a random clientId + chosen display name, kept in
// localStorage so a refresh doesn't re-prompt. clientId is what reaction
// toggles and typing entries key on; name is display-only.

const CLIENT_KEY = 'cosanlab-chat:clientId'
const NAME_KEY = 'cosanlab-chat:name'
export const NAME_MAX = 30

let storage = typeof localStorage !== 'undefined' ? localStorage : null

// test seam: swap the backing store (node has no localStorage)
export function _setStorage(s) {
  storage = s
  ownCache = null
}

// --- own-message tracking ----------------------------------------------------
// The message schema is locked (append-only rules, no clientId field), so
// "is this bubble mine?" is answered locally: remember the push-ids we sent.
// Name equality would false-positive on two audience members named Sarah.

const OWN_KEY = 'cosanlab-chat:ownMessages'
let ownCache = null

function ownIds() {
  if (!ownCache) {
    try {
      ownCache = new Set(JSON.parse(storage.getItem(OWN_KEY) ?? '[]'))
    } catch {
      ownCache = new Set()
    }
  }
  return ownCache
}

export function rememberOwnMessage(id) {
  const ids = ownIds()
  ids.add(id)
  storage.setItem(OWN_KEY, JSON.stringify([...ids].slice(-500)))
}

export function isOwnMessage(id) {
  return ownIds().has(id)
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `c-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

export function getIdentity() {
  let clientId = storage.getItem(CLIENT_KEY)
  if (!clientId) {
    clientId = randomId()
    storage.setItem(CLIENT_KEY, clientId)
  }
  return { clientId, name: storage.getItem(NAME_KEY) }
}

export function saveName(name) {
  const trimmed = String(name).trim().slice(0, NAME_MAX)
  if (!trimmed) throw new Error('name required')
  storage.setItem(NAME_KEY, trimmed)
}
