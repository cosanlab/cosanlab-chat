import {
  ref,
  push,
  set,
  update,
  remove,
  onChildAdded,
  onValue,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database'
import { db } from './firebase.js'
import { roomPath } from './paths.js'
import { rememberOwnMessage } from './identity.js'

export const TEXT_MAX = 500

// --- messages ---------------------------------------------------------------

export function sendMessage(roomId, { name, text, parentId = null }) {
  const clean = String(text).trim().slice(0, TEXT_MAX)
  if (!clean) return null
  const msg = { name, text: clean, ts: serverTimestamp() }
  if (parentId) msg.parentId = parentId
  const key = push(ref(db, roomPath(roomId, 'messages'))).key
  // Multi-path: the send also bumps the room's activity stamp for the
  // dashboard sort. Rules allow both paths iff the room is unlocked.
  update(ref(db), {
    [roomPath(roomId, 'messages', key)]: msg,
    [`roomsIndex/${roomId}/lastActivityAt`]: serverTimestamp(),
  })
  rememberOwnMessage(key)
  return key
}

export function onMessages(roomId, cb) {
  return onChildAdded(ref(db, roomPath(roomId, 'messages')), (snap) => {
    cb({ id: snap.key, parentId: null, ...snap.val() })
  })
}

// --- reactions --------------------------------------------------------------

export function toggleReaction(roomId, msgId, emoji, { clientId, name }, currentlyMine) {
  const node = ref(db, roomPath(roomId, 'reactions', msgId, emoji, clientId))
  return currentlyMine ? remove(node) : set(node, name)
}

export function onReactions(roomId, cb) {
  return onValue(ref(db, roomPath(roomId, 'reactions')), (snap) => cb(snap.val() ?? {}))
}

// --- typing (scope = 'main' or a thread's parent message id) ----------------

export function setTyping(roomId, scope, { clientId, name }, isTyping) {
  const node = ref(db, roomPath(roomId, 'typing', scope, clientId))
  // typing is best-effort: a lock can land between check and write; losing an
  // indicator is fine, an unhandled rejection is not
  if (isTyping) {
    onDisconnect(node).remove()
    return set(node, { name, ts: serverTimestamp() }).catch(() => {})
  }
  return remove(node).catch(() => {})
}

export function onTyping(roomId, scope, cb) {
  return onValue(ref(db, roomPath(roomId, 'typing', scope)), (snap) => {
    const val = snap.val() ?? {}
    cb(Object.entries(val).map(([clientId, v]) => ({ clientId, name: v.name, ts: v.ts })))
  })
}

// --- presence ----------------------------------------------------------------

export function joinPresence(roomId, { clientId, name }) {
  const node = ref(db, roomPath(roomId, 'presence', clientId))
  onDisconnect(node).remove()
  set(node, { name, ts: serverTimestamp() })
  return () => remove(node) // leave(): called on unmount/room switch
}

export function onPresence(roomId, cb) {
  return onValue(ref(db, roomPath(roomId, 'presence')), (snap) => {
    const val = snap.val() ?? {}
    const entries = Object.values(val)
    cb({ count: entries.length, names: entries.map((e) => e.name).filter(Boolean) })
  })
}

// --- connection state -------------------------------------------------------

export function onConnected(cb) {
  return onValue(ref(db, '.info/connected'), (snap) => cb(snap.val() === true))
}
