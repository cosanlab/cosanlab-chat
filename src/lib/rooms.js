import { ref, onValue } from 'firebase/database'
import { db } from './firebase.js'
import { roomPath } from './paths.js'

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
