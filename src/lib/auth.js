// Thin wrappers over firebase/auth. Admins use Google; private-room
// participants use email magic links (Firebase sends the email — Spark-safe).
import {
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth'
import { auth } from './firebase.js'

const PENDING_KEY = 'cosanlab-chat:pendingEmail'

export function onAuth(cb) {
  return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null))
}

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider())
}

export function signOutUser() {
  return signOut(auth)
}

export function sendMagicLink(email, roomId) {
  localStorage.setItem(PENDING_KEY, email)
  return sendSignInLinkToEmail(auth, email, {
    url: `${location.origin}/${roomId}`,
    handleCodeInApp: true,
  })
}

export function pendingLinkEmail() {
  return localStorage.getItem(PENDING_KEY)
}

export function isMagicLink() {
  return isSignInWithEmailLink(auth, location.href)
}

// Call once on app boot; completes the round-trip if this load IS the link.
// Returns false (not a link), true (signed in), or 'needs-email' when the
// link was opened in a browser without the stored pending email — the
// caller renders a confirm form and calls back with the typed address.
export async function completeMagicLink(email = pendingLinkEmail()) {
  if (!isMagicLink()) return false
  if (!email) return 'needs-email'
  await signInWithEmailLink(auth, email, location.href)
  localStorage.removeItem(PENDING_KEY)
  history.replaceState({}, '', location.pathname) // strip oobCode etc.
  return true
}
