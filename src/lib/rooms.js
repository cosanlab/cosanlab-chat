import { ref, onValue, get, update, serverTimestamp } from 'firebase/database'
import { db } from './firebase.js'
import { roomPath } from './paths.js'
import { encodeEmail, normalizeInviteEmail } from './keys.js'

export function onRoomsIndex(cb) {
  return onValue(ref(db, 'roomsIndex'), (snap) => cb(snap.val() ?? {}))
}

// onDenied fires on permission_denied — the "private room, prove yourself"
// signal for unauthenticated/uninvited visitors.
export function onRoomMeta(roomId, cb, onDenied = () => {}) {
  return onValue(
    ref(db, roomPath(roomId, 'meta')),
    (snap) => cb(snap.val()),
    (err) => (err?.code === 'PERMISSION_DENIED' || /denied/i.test(err?.message) ? onDenied() : console.error(err)),
  )
}

// --- admin API (rules enforce admin-only; these are conveniences) -----------

export function createRoom({ roomId, name, isPrivate = false }) {
  return update(ref(db), {
    [roomPath(roomId, 'meta')]: {
      name, createdAt: serverTimestamp(), locked: false, private: isPrivate,
    },
    [`roomsIndex/${roomId}`]: {
      name, private: isPrivate, locked: false,
      createdAt: serverTimestamp(), lastActivityAt: serverTimestamp(),
    },
  })
}

export function setRoomFlag(roomId, flag, value) {
  const updates = {
    [roomPath(roomId, 'meta', flag)]: value,
    [`roomsIndex/${roomId}/${flag}`]: value,
  }
  // Locking a room denies further writes from non-admins, including the
  // typing/presence cleanup each client normally performs on disconnect or
  // blur. Without this, stale typing/presence entries survive forever once
  // a room is locked. Admins are allowed to delete these paths post-lock
  // (proven by the rules tests), so fold the cleanup into the same
  // multi-path update as the lock itself. Every other flag/value
  // combination keeps the plain two-path shape.
  if (flag === 'locked' && value === true) {
    updates[roomPath(roomId, 'typing')] = null
    updates[roomPath(roomId, 'presence')] = null
  }
  return update(ref(db), updates)
}

export function addInvite(roomId, email) {
  return update(ref(db), { [roomPath(roomId, 'meta', 'invited', encodeEmail(normalizeInviteEmail(email)))]: true })
}

export function removeInvite(roomId, email) {
  return update(ref(db), { [roomPath(roomId, 'meta', 'invited', encodeEmail(normalizeInviteEmail(email)))]: null })
}

export function deleteRoom(roomId) {
  return update(ref(db), { [roomPath(roomId)]: null, [`roomsIndex/${roomId}`]: null })
}

export function resetRoom(roomId) {
  return update(ref(db), {
    [roomPath(roomId, 'messages')]: null,
    [roomPath(roomId, 'reactions')]: null,
    [roomPath(roomId, 'typing')]: null,
    [roomPath(roomId, 'presence')]: null,
  })
}

export async function exportRoom(roomId) {
  return (await get(ref(db, roomPath(roomId)))).val()
}

export async function exportAll() {
  return (await get(ref(db, 'rooms'))).val()
}

export function onRoomPresence(roomId, cb) {
  return onValue(ref(db, roomPath(roomId, 'presence')), (snap) => {
    const val = snap.val() ?? {}
    cb({ count: Object.keys(val).length, names: Object.values(val).map((e) => e.name) })
  })
}

export function onAdminEmails(cb) {
  return onValue(ref(db, 'config/adminEmails'), (snap) => cb(Object.keys(snap.val() ?? {})))
}

export function addAdmin(email) {
  return update(ref(db), { [`config/adminEmails/${encodeEmail(normalizeInviteEmail(email))}`]: true })
}

export function removeAdmin(email) {
  return update(ref(db), { [`config/adminEmails/${encodeEmail(normalizeInviteEmail(email))}`]: null })
}

// Dashboard ordering: rooms with people in them first (more people first),
// then most recent activity, then name.
export function sortRooms(index, presence = {}) {
  return Object.entries(index).sort(([idA, a], [idB, b]) => {
    const pa = presence[idA] ?? 0
    const pb = presence[idB] ?? 0
    if (pa !== pb) return pb - pa
    const ta = a.lastActivityAt ?? 0
    const tb = b.lastActivityAt ?? 0
    if (ta !== tb) return tb - ta
    return (a.name ?? '').localeCompare(b.name ?? '')
  })
}
