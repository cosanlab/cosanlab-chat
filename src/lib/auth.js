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

// Call once on app boot; completes the round-trip if this load IS the link.
export async function completeMagicLink() {
  if (!isSignInWithEmailLink(auth, location.href)) return false
  const email =
    localStorage.getItem(PENDING_KEY) ??
    prompt('Confirm your email to finish signing in:') // link opened on another device
  await signInWithEmailLink(auth, email, location.href)
  localStorage.removeItem(PENDING_KEY)
  history.replaceState({}, '', location.pathname) // strip oobCode etc.
  return true
}
