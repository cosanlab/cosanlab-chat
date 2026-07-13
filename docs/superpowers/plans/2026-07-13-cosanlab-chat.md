# cosanlab-chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the xoxowasita defense chat into cosanlab-chat: multi-room, admin dashboard, public/private rooms with magic-link invites, and image-URL meme unfurling — all on the Firebase Spark (free) plan.

**Architecture:** Pure serverless SPA (Svelte 5 + Vite + Tailwind v4 → Firebase Hosting). All room data nests under `rooms/{roomId}` in RTDB; a world-readable `roomsIndex` powers the landing page and dashboard. Firebase Auth (Google for admins, email magic-link for private-room participants); ALL enforcement lives in `database.rules.json`. No backend, no router library.

**Tech Stack:** Svelte 5 (runes), Vite 6, Tailwind CSS 4, firebase JS SDK v12 (`firebase/database`, `firebase/auth`), Vitest 3, Playwright, Firebase emulator suite (database + auth), `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-07-13-cosanlab-chat-design.md` — read it before starting.

## Global Constraints

- **Spark plan only:** never import `firebase/storage` or `firebase/functions`; no Cloud Functions, no Trigger Email.
- **Schemas unchanged** from xoxowasita: `messages/{pushId}: {name, text, ts, parentId?}`, `reactions/{msgId}/{emoji}/{clientId}: name`, `typing/{scope}/{clientId}: {name, ts}`, `presence/{clientId}: {name, ts}`. `NAME_MAX = 30`, `TEXT_MAX = 500`.
- **Room slugs:** `^[a-z0-9-]{3,40}$`, normalized to lowercase. Reserved: `admin`, `login`, `assets`, `fonts`, `rooms`, `api`, `r`.
- **Email keys in RTDB:** lowercase, `.` → `,` (RTDB keys cannot contain dots).
- **RTDB rules language:** use `==` / `!=` only (no `===`), `auth.token.email.toLowerCase().replace('.', ',')` for email keys, require `auth.token.email_verified == true` on every email check.
- **Svelte 5 runes style** (`$state`, `$derived`, `$effect`, `$props`) — match existing components.
- **No new runtime dependencies.** `firebase/auth` ships inside the existing `firebase` package. Dev-deps allowed: `@firebase/rules-unit-testing`, `firebase-tools`.
- **localStorage prefix:** `cosanlab-chat:` (replaces `defense-chat:`).
- Commit after every task (steps include the commands). Working dir: repo root `cosanlab-chat/`.

---

### Task 1: Rebrand — package, storage keys, palette, copy

**Files:**
- Modify: `package.json` (name), `index.html` (title), `src/app.css` (palette), `src/App.svelte` (join copy — temporary, Task 8 rewrites this file), `src/lib/identity.js:5-7,22` (storage keys)
- Test: `src/lib/identity.test.js` (existing suite must stay green)

**Interfaces:**
- Consumes: nothing.
- Produces: theme token names are UNCHANGED (`--color-night`, `--color-surface`, `--color-surface-2`, `--color-mist`, `--color-own`, `--color-other`, `--color-accent`, `--color-accent-hot`, `--color-blush`, `--color-petal`, `--color-card`) so no component class edits are needed — only the hex values change.

- [ ] **Step 1: Update identity.js storage keys**

In `src/lib/identity.js` replace the three key constants (lines 5–7 and 22):

```js
const CLIENT_KEY = 'cosanlab-chat:clientId'
const NAME_KEY = 'cosanlab-chat:name'
// ...
const OWN_KEY = 'cosanlab-chat:ownMessages'
```

- [ ] **Step 2: Run existing unit tests**

Run: `npm test`
Expected: all existing suites PASS (identity tests use `_setStorage`, not real key names).

- [ ] **Step 3: Swap palette values in `src/app.css`**

Replace the `@theme` hex values (names stay identical) and delete the Monas `@font-face` block and `public/fonts/monas.woff2`:

```css
@theme {
  /* COSAN Lab brand blues, sampled from the lab's gem logo
     (cosanlab.com/static/img/cosanlab_sticker_trans_small.png) */
  --color-night: #060c26;    /* deepened logo navy — app background */
  --color-surface: #101d3f;
  --color-surface-2: #1a2b55;
  --color-mist: #9db4cc;
  --color-own: #0a6aa6;      /* brand blue (#006098, brightened) — own bubble */
  --color-other: #a8d8e8;    /* light logo blue — others' bubbles (navy text) */
  --color-accent: #48a0c8;   /* logo mid blue */
  --color-accent-hot: #70c0d8;
  --color-blush: #fb7185;    /* rose-400 — errors */
  --color-petal: #d0e8f0;    /* logo pale ice — decoration */
  --color-card: #0a1430;
}
```

Also in `src/components/MessageBubble.svelte` the others'-bubble text colors are hardcoded violet (`text-[#3b0764]`, `text-[#6d28d9]`): change both to `text-[#081030]` (logo navy).

Download the lab logo into the app (used by Task 8's screens):

```bash
curl -s -o public/img/cosanlab-sticker.png https://cosanlab.com/static/img/cosanlab_sticker_trans_small.png
```

- [ ] **Step 4: Update `package.json` name and `index.html` title**

`"name": "cosanlab-chat"`; `<title>cosanlab chat</title>`. In `src/App.svelte`, change the wordmark `xoxo wasita` → `cosanlab chat`, remove the `style="font-family: 'Monas'…"` attribute, and replace the two tagline `<p>` blocks with `<p class="mt-4 text-mist">Real-time chat for COSAN Lab events and courses.</p>`.

- [ ] **Step 5: Build and commit**

Run: `npm run build`
Expected: vite build succeeds, no missing-font warnings.

```bash
git add -A && git commit -m "chore: rebrand fork as cosanlab-chat (name, keys, palette, copy)"
```

---

### Task 2: Route parsing (`src/lib/router.js`)

**Files:**
- Create: `src/lib/router.js`
- Test: `src/lib/router.test.js`

**Interfaces:**
- Produces:
  - `RESERVED: string[]`
  - `normalizeSlug(s: string): string` — trim + lowercase
  - `isValidSlug(s: string): boolean` — matches `^[a-z0-9-]{3,40}$` AND not reserved
  - `parsePath(pathname: string): {view:'landing'} | {view:'admin'} | {view:'room', roomId:string} | {view:'notfound', slug:string}`
  - `navigate(path: string): void` — `history.pushState` + dispatches `popstate` (App listens once)

- [ ] **Step 1: Write the failing test**

```js
// src/lib/router.test.js
import { describe, it, expect } from 'vitest'
import { parsePath, normalizeSlug, isValidSlug } from './router.js'

describe('parsePath', () => {
  it('root is landing', () => expect(parsePath('/')).toEqual({ view: 'landing' }))
  it('admin is reserved', () => expect(parsePath('/admin')).toEqual({ view: 'admin' }))
  it('slug routes to room, lowercased', () =>
    expect(parsePath('/PSYCH53-F2026')).toEqual({ view: 'room', roomId: 'psych53-f2026' }))
  it('trailing slash ok', () =>
    expect(parsePath('/lab-meeting/')).toEqual({ view: 'room', roomId: 'lab-meeting' }))
  it('bad slugs are notfound', () => {
    expect(parsePath('/ab')).toEqual({ view: 'notfound', slug: 'ab' })
    expect(parsePath('/has_underscore')).toEqual({ view: 'notfound', slug: 'has_underscore' })
    expect(parsePath('/a/b')).toEqual({ view: 'notfound', slug: 'a/b' })
  })
})

describe('isValidSlug', () => {
  it('rejects reserved names', () => expect(isValidSlug('admin')).toBe(false))
  it('accepts course slugs', () => expect(isValidSlug('psych53-f2026')).toBe(true))
  it('normalizeSlug lowercases and trims', () => expect(normalizeSlug('  Lab-Meeting ')).toBe('lab-meeting'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/router.test.js`
Expected: FAIL — cannot resolve `./router.js`.

- [ ] **Step 3: Implement**

```js
// src/lib/router.js — path-based rooms, no router lib.
export const RESERVED = ['admin', 'login', 'assets', 'fonts', 'rooms', 'api', 'r']
const SLUG_RE = /^[a-z0-9-]{3,40}$/

export function normalizeSlug(s) {
  return String(s).trim().toLowerCase()
}

export function isValidSlug(s) {
  return SLUG_RE.test(s) && !RESERVED.includes(s)
}

export function parsePath(pathname) {
  const seg = pathname.replace(/\/+$/, '').split('/').slice(1)
  if (seg.length === 0 || seg[0] === '') return { view: 'landing' }
  const slug = normalizeSlug(decodeURIComponent(seg.join('/')))
  if (slug === 'admin') return { view: 'admin' }
  if (isValidSlug(slug)) return { view: 'room', roomId: slug }
  return { view: 'notfound', slug }
}

export function navigate(path) {
  history.pushState({}, '', path)
  dispatchEvent(new PopStateEvent('popstate'))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/router.test.js` — Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/router.js src/lib/router.test.js
git commit -m "feat: path-based route parsing with reserved slugs"
```

---

### Task 3: Email key encoding (`src/lib/keys.js`)

**Files:**
- Create: `src/lib/keys.js`
- Test: `src/lib/keys.test.js`

**Interfaces:**
- Produces: `encodeEmail(email: string): string` (lowercase, trim, `.`→`,`), `decodeEmail(key: string): string` (`,`→`.`)

- [ ] **Step 1: Write the failing test**

```js
// src/lib/keys.test.js
import { describe, it, expect } from 'vitest'
import { encodeEmail, decodeEmail } from './keys.js'

describe('email keys', () => {
  it('encodes dots as commas, lowercased', () =>
    expect(encodeEmail(' Wasita.Mahaphanit.GR@Dartmouth.edu ')).toBe(
      'wasita,mahaphanit,gr@dartmouth,edu',
    ))
  it('round-trips', () =>
    expect(decodeEmail(encodeEmail('a.b@c.d'))).toBe('a.b@c.d'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/keys.test.js` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
// src/lib/keys.js — RTDB keys can't contain '.'; standard ','-for-'.' idiom.
// MUST match the rules expression auth.token.email.toLowerCase().replace('.', ',')
export function encodeEmail(email) {
  return String(email).trim().toLowerCase().replaceAll('.', ',')
}

export function decodeEmail(key) {
  return String(key).replaceAll(',', '.')
}
```

- [ ] **Step 4: Run test** — `npx vitest run src/lib/keys.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/keys.js src/lib/keys.test.js
git commit -m "feat: email<->RTDB-key encoding"
```

---

### Task 4: Image-URL extraction (`src/lib/media.js`)

**Files:**
- Create: `src/lib/media.js`
- Test: `src/lib/media.test.js`

**Interfaces:**
- Produces: `extractImageUrls(text: string): string[]` — `https://` URLs ending in png/jpg/jpeg/gif/webp, query strings allowed, case-insensitive, deduped, max 4.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/media.test.js
import { describe, it, expect } from 'vitest'
import { extractImageUrls } from './media.js'

describe('extractImageUrls', () => {
  it('finds https image links', () =>
    expect(extractImageUrls('lol https://i.imgur.com/x.gif so true')).toEqual([
      'https://i.imgur.com/x.gif',
    ]))
  it('allows query strings (giphy style)', () =>
    expect(extractImageUrls('https://media.giphy.com/a.gif?cid=123&rid=x')).toEqual([
      'https://media.giphy.com/a.gif?cid=123&rid=x',
    ]))
  it('is case-insensitive on extension', () =>
    expect(extractImageUrls('https://x.com/MEME.PNG')).toEqual(['https://x.com/MEME.PNG']))
  it('ignores http and non-image urls', () => {
    expect(extractImageUrls('http://x.com/a.png')).toEqual([])
    expect(extractImageUrls('https://example.com/page')).toEqual([])
  })
  it('dedupes and caps at 4', () => {
    const u = (n) => `https://x.com/${n}.png`
    expect(extractImageUrls(`${u(1)} ${u(1)}`)).toEqual([u(1)])
    expect(extractImageUrls([1, 2, 3, 4, 5].map(u).join(' '))).toHaveLength(4)
  })
  it('handles null/empty', () => {
    expect(extractImageUrls('')).toEqual([])
    expect(extractImageUrls(null)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/media.test.js` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
// src/lib/media.js — meme unfurling is URL-based (Spark plan: no Storage uploads).
const IMG_RE = /https:\/\/[^\s<>"]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"]*)?/gi

export function extractImageUrls(text) {
  if (!text) return []
  return [...new Set(String(text).match(IMG_RE) ?? [])].slice(0, 4)
}
```

- [ ] **Step 4: Run test** — `npx vitest run src/lib/media.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/media.js src/lib/media.test.js
git commit -m "feat: image-url extraction for meme unfurling"
```

---

### Task 5: Room-scope `chat.js`

**Files:**
- Modify: `src/lib/chat.js` (every function gains a leading `roomId` param), `src/components/Room.svelte` and `src/components/ThreadPanel.svelte` and `src/components/Composer.svelte` call sites (mechanical: thread the `roomId` prop through)
- Create: `src/lib/paths.js`
- Test: `src/lib/paths.test.js`

**Interfaces:**
- Produces:
  - `roomPath(roomId, ...segments): string` in `paths.js` — throws `Error('invalid roomId')` unless `isValidSlug(roomId)`; joins as `rooms/{roomId}/{segments…}`.
  - New chat.js signatures (all existing behavior preserved, `onConnected(cb)` unchanged):
    `sendMessage(roomId, {name, text, parentId})`, `onMessages(roomId, cb)`, `onReactions(roomId, cb)`, `toggleReaction(roomId, msgId, emoji, identity, currentlyMine)`, `setTyping(roomId, scope, identity, isTyping)`, `onTyping(roomId, scope, cb)`, `joinPresence(roomId, identity)`, `onPresence(roomId, cb)`.
  - `sendMessage` becomes a **multi-path update** that also stamps `roomsIndex/{roomId}/lastActivityAt = serverTimestamp()` (spec: activity sorting).

- [ ] **Step 1: Write the failing paths test**

```js
// src/lib/paths.test.js
import { describe, it, expect } from 'vitest'
import { roomPath } from './paths.js'

describe('roomPath', () => {
  it('builds nested paths', () =>
    expect(roomPath('lab-meeting', 'messages')).toBe('rooms/lab-meeting/messages'))
  it('joins deep segments', () =>
    expect(roomPath('lab-meeting', 'reactions', 'm1', '👍', 'c1')).toBe(
      'rooms/lab-meeting/reactions/m1/👍/c1',
    ))
  it('throws on invalid room ids (defense in depth)', () => {
    expect(() => roomPath('admin', 'messages')).toThrow('invalid roomId')
    expect(() => roomPath('../config', 'x')).toThrow('invalid roomId')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/paths.test.js` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `paths.js`**

```js
// src/lib/paths.js
import { isValidSlug } from './router.js'

export function roomPath(roomId, ...segments) {
  if (!isValidSlug(roomId)) throw new Error('invalid roomId')
  return ['rooms', roomId, ...segments].join('/')
}
```

- [ ] **Step 4: Run test** — `npx vitest run src/lib/paths.test.js` — Expected: PASS.

- [ ] **Step 5: Rewrite `src/lib/chat.js` with room scoping**

Full new content (diff vs old: `update` import, `roomPath` usage, `roomId` params, multi-path send):

```js
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
  if (isTyping) {
    onDisconnect(node).remove()
    return set(node, { name, ts: serverTimestamp() })
  }
  return remove(node)
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
  return set(node, { name, ts: serverTimestamp() })
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
```

- [ ] **Step 6: Thread `roomId` through the components**

`src/components/Room.svelte`: add `roomId` to props (`let { identity, roomId } = $props()`), and prefix every chat.js call: `onMessages(roomId, …)`, `onReactions(roomId, …)`, `onTyping(roomId, 'main', …)`, `joinPresence(roomId, identity)`, `onPresence(roomId, …)`, `toggleReaction(roomId, msgId, emoji, identity, !!mine)`, and pass `{roomId}` to `<Composer>` and `<ThreadPanel>`. In `Composer.svelte` and `ThreadPanel.svelte`, accept `roomId` in `$props()` and prefix their `sendMessage`/`setTyping`/`onTyping` calls the same way. `App.svelte` temporarily hardcodes `<Room {identity} roomId="lobby" />` (Task 8 replaces this).

- [ ] **Step 7: Verify**

Run: `npm test && npm run build`
Expected: all unit suites PASS; build succeeds. (Grep check: `grep -rn "ref(db, '" src/lib/chat.js` returns nothing — every ref goes through `roomPath`.)

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: room-scope all chat operations; sends stamp roomsIndex activity"
```

---

### Task 6: Auth plumbing + emulator wiring (`firebase.js`, `auth.js`)

**Files:**
- Modify: `src/lib/firebase.js`
- Create: `src/lib/auth.js`
- Test: none (thin SDK wrappers; behavior covered by rules tests in Task 7 and e2e in Task 15)

**Interfaces:**
- Produces from `firebase.js`: existing `db`, new `auth` (Firebase Auth instance), `USING_EMULATORS: boolean`.
- Produces from `auth.js`:
  - `onAuth(cb): unsubscribe` — cb receives `{uid, email} | null`
  - `signInWithGoogle(): Promise<void>`
  - `signOutUser(): Promise<void>`
  - `sendMagicLink(email, roomId): Promise<void>` — stores email under `cosanlab-chat:pendingEmail`
  - `completeMagicLink(): Promise<boolean>` — true iff a link sign-in was completed on this page load

- [ ] **Step 1: Extend `src/lib/firebase.js`**

```js
import { initializeApp } from 'firebase/app'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { getAuth, connectAuthEmulator } from 'firebase/auth'

// Set VITE_USE_EMULATOR=true (dev/e2e) to run fully offline against the
// Firebase emulator suite — no .env.local needed in that mode.
export const USING_EMULATORS = import.meta.env.VITE_USE_EMULATOR === 'true'

const firebaseConfig = USING_EMULATORS
  ? {
      apiKey: 'demo-key',
      authDomain: 'demo-cosanlab.firebaseapp.com',
      databaseURL: 'http://127.0.0.1:9000?ns=demo-cosanlab-default-rtdb',
      projectId: 'demo-cosanlab',
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export const auth = getAuth(app)

if (USING_EMULATORS) {
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}
```

- [ ] **Step 2: Create `src/lib/auth.js`**

```js
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
```

- [ ] **Step 3: Verify build** — Run: `npm run build` — Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebase.js src/lib/auth.js
git commit -m "feat: firebase auth instance, magic-link helpers, emulator wiring"
```

---

### Task 7: Security rules + rules unit tests

**Files:**
- Modify: `database.rules.json` (full rewrite), `firebase.json` (emulators + project), `.firebaserc`, `package.json` (scripts + dev-deps)
- Create: `test/rules.test.js`, `vitest.config.js`

**Interfaces:**
- Consumes: email-key convention from Task 3 (`.`→`,`, lowercase).
- Produces: the enforced permission matrix every later task relies on:
  public room = world read, writes while unlocked; private room = invited/admin only; `meta`/`roomsIndex`/`config` admin-write; `roomsIndex` world-read; `lastActivityAt` writable by senders (number, unlocked room only).

- [ ] **Step 1: Write `database.rules.json`**

The admin check appears inlined everywhere (rules JSON has no functions):
`auth != null && auth.token.email_verified == true && root.child('config/adminEmails').child(auth.token.email.toLowerCase().replace('.', ',')).val() == true` — abbreviated below as `<ADMIN>`; the invited check `auth != null && auth.token.email_verified == true && root.child('rooms').child($roomId).child('meta/invited').child(auth.token.email.toLowerCase().replace('.', ',')).val() == true` as `<INVITED>`; `root.child('rooms').child($roomId).child('meta').exists() && root.child('rooms').child($roomId).child('meta/locked').val() != true` as `<UNLOCKED>` (the `meta.exists()` clause blocks "ghost rooms" — without it, locked/private checks are vacuously true for rooms nobody created, letting anonymous clients spam storage under arbitrary room ids); `root.child('rooms').child($roomId).child('meta/private').val() != true` as `<PUBLIC>`. The `lastActivityAt` write rule additionally requires `(<PUBLIC> || <INVITED>)` so outsiders cannot bump a private room's world-readable activity stamp — "writable by whoever can post" means exactly that. **Write the file with every occurrence fully expanded — no placeholders in the actual JSON.**

```json
{
  "rules": {
    "rooms": {
      ".read": "<ADMIN>",
      ".write": "<ADMIN>",
      "$roomId": {
        ".read": "data.child('meta/private').val() != true || <INVITED>",
        "messages": {
          "$msgId": {
            ".write": "!data.exists() && newData.exists() && <UNLOCKED> && (<PUBLIC> || <INVITED>)",
            ".validate": "newData.hasChildren(['name','text','ts'])",
            "name": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 30" },
            "text": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 500" },
            "ts": { ".validate": "newData.isNumber()" },
            "parentId": { ".validate": "newData.isString() && newData.val().length <= 100" },
            "$other": { ".validate": false }
          }
        },
        "reactions": {
          "$msgId": {
            "$emoji": {
              "$clientId": {
                ".write": "<UNLOCKED> && (<PUBLIC> || <INVITED>)",
                ".validate": "newData.isString() && newData.val().length <= 30"
              }
            }
          }
        },
        "typing": {
          "$scope": {
            "$clientId": {
              ".write": "<UNLOCKED> && (<PUBLIC> || <INVITED>)",
              ".validate": "newData.hasChildren(['name','ts'])",
              "name": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 30" },
              "ts": { ".validate": "newData.isNumber()" },
              "$other": { ".validate": false }
            }
          }
        },
        "presence": {
          "$clientId": {
            ".write": "<UNLOCKED> && (<PUBLIC> || <INVITED>)",
            ".validate": "newData.hasChildren(['name','ts'])",
            "name": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 30" },
            "ts": { ".validate": "newData.isNumber()" },
            "$other": { ".validate": false }
          }
        }
      }
    },
    "roomsIndex": {
      ".read": true,
      ".write": "<ADMIN>",
      "$roomId": {
        "lastActivityAt": {
          ".write": "root.child('rooms').child($roomId).child('meta').exists() && <UNLOCKED> && newData.isNumber()"
        }
      }
    },
    "config": {
      ".read": "<ADMIN>",
      ".write": "<ADMIN>",
      "adminEmails": { "$email": { ".validate": "newData.val() == true" } }
    }
  }
}
```

Notes to preserve as JSON is written out: deletes (`newData` null) skip `.validate`, so admin resets work; the `rooms`-level admin grant cascades down (RTDB write/read rules can only widen, never narrow — which is also why invitees can read a private room's own invite list: acceptable, spec's accepted trade-off).

- [ ] **Step 2: Add emulator config**

`firebase.json` — add alongside existing keys:

```json
"emulators": {
  "database": { "port": 9000 },
  "auth": { "port": 9099 },
  "ui": { "enabled": false }
}
```

`.firebaserc` → `{ "projects": { "default": "cosanlab-chat" } }`.

`package.json` — dev-deps `"@firebase/rules-unit-testing": "^4.0.0"`, `"firebase-tools": "^13.0.0"`; scripts:

```json
"test:rules": "firebase emulators:exec --only database --project demo-cosanlab 'vitest run test/rules.test.js'"
```

Create `vitest.config.js` so plain `npm test` skips the emulator-dependent suite:

```js
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { exclude: ['test/rules.test.js', 'node_modules/**', 'e2e/**'] } })
```

Run `npm install` after editing.

- [ ] **Step 3: Write the failing rules tests**

```js
// test/rules.test.js — permission matrix against the database emulator.
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { ref, get, set, update } from 'firebase/database'

let env
const ADMIN = { email: 'luke@dartmouth.edu', email_verified: true }
const INVITEE = { email: 'student@dartmouth.edu', email_verified: true }

function dbAs(claims) {
  return claims
    ? env.authenticatedContext(claims.email.replace(/\W/g, ''), claims).database()
    : env.unauthenticatedContext().database()
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), '/'), {
      config: { adminEmails: { 'luke@dartmouth,edu': true } },
      rooms: {
        'open-room': { meta: { name: 'Open', createdAt: 1, locked: false, private: false } },
        'locked-room': { meta: { name: 'Done', createdAt: 1, locked: true, private: false } },
        'secret-room': {
          meta: {
            name: 'Secret', createdAt: 1, locked: false, private: true,
            invited: { 'student@dartmouth,edu': true },
          },
          messages: { m1: { name: 'A', text: 'hi', ts: 1 } },
        },
      },
      roomsIndex: {
        'open-room': { name: 'Open', private: false, locked: false, createdAt: 1, lastActivityAt: 1 },
        'locked-room': { name: 'Done', private: false, locked: true, createdAt: 1, lastActivityAt: 1 },
        'secret-room': { name: 'Secret', private: true, locked: false, createdAt: 1, lastActivityAt: 1 },
      },
    })
  })
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cosanlab',
    database: { rules: readFileSync('database.rules.json', 'utf8') },
  })
})
beforeEach(async () => {
  await env.clearDatabase()
  await seed()
})
afterAll(() => env.cleanup())

const msg = { name: 'Anon', text: 'hello', ts: 111 }

describe('public rooms', () => {
  it('anyone reads', () => assertSucceeds(get(ref(dbAs(null), 'rooms/open-room/messages'))))
  it('anyone posts while unlocked (multi-path send shape)', () =>
    assertSucceeds(
      update(ref(dbAs(null)), {
        'rooms/open-room/messages/mA': msg,
        'roomsIndex/open-room/lastActivityAt': 222,
      }),
    ))
  it('no posts when locked', () =>
    assertFails(set(ref(dbAs(null), 'rooms/locked-room/messages/mB'), msg)))
  it('locked room still readable', () =>
    assertSucceeds(get(ref(dbAs(null), 'rooms/locked-room/messages'))))
  it('no edits of existing messages, even by author shape', async () => {
    await set(ref(dbAs(null), 'rooms/open-room/messages/mC'), msg)
    await assertFails(set(ref(dbAs(null), 'rooms/open-room/messages/mC'), { ...msg, text: 'edited' }))
  })
  it('rejects extra fields', () =>
    assertFails(set(ref(dbAs(null), 'rooms/open-room/messages/mD'), { ...msg, evil: 1 })))
})

describe('private rooms', () => {
  it('unauthenticated cannot read', () =>
    assertFails(get(ref(dbAs(null), 'rooms/secret-room/messages'))))
  it('uninvited (but signed-in) cannot read', () =>
    assertFails(get(ref(dbAs({ email: 'rando@x.com', email_verified: true }), 'rooms/secret-room/messages'))))
  it('invitee reads and posts', async () => {
    await assertSucceeds(get(ref(dbAs(INVITEE), 'rooms/secret-room/messages')))
    await assertSucceeds(set(ref(dbAs(INVITEE), 'rooms/secret-room/messages/mE'), msg))
  })
  it('unverified email is not enough', () =>
    assertFails(get(ref(dbAs({ email: 'student@dartmouth.edu', email_verified: false }), 'rooms/secret-room/messages'))))
})

describe('admin powers', () => {
  it('admin reads everything (export-all)', () =>
    assertSucceeds(get(ref(dbAs(ADMIN), 'rooms'))))
  it('admin creates a room (meta + index, multi-path)', () =>
    assertSucceeds(
      update(ref(dbAs(ADMIN)), {
        'rooms/new-room/meta': { name: 'New', createdAt: 1, locked: false, private: false },
        'roomsIndex/new-room': { name: 'New', private: false, locked: false, createdAt: 1, lastActivityAt: 1 },
      }),
    ))
  it('admin locks a room', () =>
    assertSucceeds(
      update(ref(dbAs(ADMIN)), {
        'rooms/open-room/meta/locked': true,
        'roomsIndex/open-room/locked': true,
      }),
    ))
  it('admin resets a room (deletes skip validation)', () =>
    assertSucceeds(
      update(ref(dbAs(ADMIN)), {
        'rooms/secret-room/messages': null,
        'rooms/secret-room/reactions': null,
        'rooms/secret-room/typing': null,
        'rooms/secret-room/presence': null,
      }),
    ))
  it('non-admin cannot touch meta, index, or config', async () => {
    await assertFails(set(ref(dbAs(null), 'rooms/open-room/meta/locked'), true))
    await assertFails(set(ref(dbAs(INVITEE), 'roomsIndex/open-room/name'), 'x'))
    await assertFails(set(ref(dbAs(INVITEE), 'config/adminEmails/evil@x,com'), true))
  })
  it('anyone reads the index, nobody unauthorized writes it', async () => {
    await assertSucceeds(get(ref(dbAs(null), 'roomsIndex')))
    await assertFails(set(ref(dbAs(null), 'roomsIndex/open-room/lastActivityAt'), 'not-a-number'))
    await assertFails(set(ref(dbAs(null), 'roomsIndex/ghost-room/lastActivityAt'), 999))
  })
})
```

- [ ] **Step 4: Run rules tests, iterate until green**

Run: `npm run test:rules`
Expected: all ~16 tests PASS. (First run downloads the emulator jar; requires Java. If a test fails, fix the RULES, not the test — the matrix above is the spec.)

- [ ] **Step 5: Commit**

```bash
git add database.rules.json firebase.json .firebaserc package.json package-lock.json vitest.config.js test/rules.test.js
git commit -m "feat: multi-room security rules with emulator test matrix"
```

---

### Task 8: App shell — routing, Landing, room join flow

**Files:**
- Create: `src/components/Landing.svelte`, `src/lib/rooms.js` (subscriber half; admin half grows in Task 11)
- Modify: `src/App.svelte` (full rewrite), `src/main.js` (unchanged unless import breaks)
- Test: existing unit suites stay green; behavior covered by e2e (Task 15)

**Interfaces:**
- Consumes: `parsePath`/`navigate` (Task 2), `onAuth`/`completeMagicLink` (Task 6), `roomPath` (Task 5).
- Produces in `src/lib/rooms.js` (later tasks extend this file):
  - `onRoomsIndex(cb): unsubscribe` — cb(objectOrEmpty)
  - `onRoomMeta(roomId, cb, onDenied): unsubscribe` — cb(metaOrNull); permission-denied calls `onDenied()` (that's how the app detects "private room, not signed in / not invited")
- Produces: `<Landing>` (public unlocked room list + code box) and the App routing contract: `landing | room | admin | notfound` views; room view renders name-join (public) or `<EmailGate>` placeholder slot (Task 9) before `<Room>`.

- [ ] **Step 1: Start `src/lib/rooms.js`**

```js
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
```

- [ ] **Step 2: Create `src/components/Landing.svelte`**

```svelte
<script>
  import { onRoomsIndex } from '../lib/rooms.js'
  import { navigate, normalizeSlug, isValidSlug } from '../lib/router.js'

  let index = $state({})
  let code = $state('')
  let codeError = $state('')
  $effect(() => onRoomsIndex((v) => (index = v)))

  let publicRooms = $derived(
    Object.entries(index)
      .filter(([, r]) => !r.private && !r.locked)
      .sort(([, a], [, b]) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0)),
  )

  function go(e) {
    e.preventDefault()
    const slug = normalizeSlug(code)
    if (!isValidSlug(slug)) {
      codeError = 'Room codes are 3–40 letters, numbers, and dashes.'
      return
    }
    navigate(`/${slug}`)
  }
</script>

<main class="flex flex-col items-center min-h-dvh px-6 py-16">
  <div class="w-full max-w-md text-center">
    <img src="/img/cosanlab-sticker.png" alt="COSAN Lab" class="mx-auto mb-4 h-16 w-auto" />
    <h1 class="text-4xl font-bold text-accent">cosanlab chat</h1>
    <p class="mt-2 text-mist">Real-time chat for COSAN Lab events and courses.</p>

    <form onsubmit={go} class="mt-8 flex gap-2">
      <input
        class="flex-1 rounded-xl bg-surface border border-surface-2 px-4 py-3 placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-accent"
        placeholder="room code (e.g. psych53-f2026)"
        bind:value={code}
        data-testid="room-code-input"
      />
      <button class="rounded-xl bg-accent px-5 py-3 font-semibold text-white" type="submit" data-testid="room-code-go">
        Go
      </button>
    </form>
    {#if codeError}<p class="mt-2 text-blush text-sm">{codeError}</p>{/if}

    {#if publicRooms.length}
      <h2 class="mt-10 mb-3 text-xs uppercase tracking-[0.2em] text-mist/80">open rooms</h2>
      <ul class="flex flex-col gap-2" data-testid="public-room-list">
        {#each publicRooms as [id, r] (id)}
          <li>
            <a class="block rounded-xl bg-surface hover:bg-surface-2 px-4 py-3 text-left transition"
               href="/{id}"
               onclick={(e) => { e.preventDefault(); navigate(`/${id}`) }}>
              <span class="font-semibold">{r.name}</span>
              <span class="ml-2 text-xs text-mist">/{id}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</main>
```

- [ ] **Step 3: Rewrite `src/App.svelte`**

```svelte
<script>
  import { getIdentity, saveName, NAME_MAX } from './lib/identity.js'
  import { parsePath } from './lib/router.js'
  import { onAuth, completeMagicLink } from './lib/auth.js'
  import { onRoomMeta } from './lib/rooms.js'
  import Room from './components/Room.svelte'
  import Landing from './components/Landing.svelte'
  import EmailGate from './components/EmailGate.svelte'
  import AdminApp from './components/admin/AdminApp.svelte'

  let route = $state(parsePath(location.pathname))
  $effect(() => {
    const onPop = () => (route = parsePath(location.pathname))
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  })

  let user = $state(null) // {uid, email} | null
  $effect(() => onAuth((u) => (user = u)))
  $effect(() => { completeMagicLink().catch((e) => console.error('magic link', e)) })

  // Room gate state. meta === undefined → still loading; null → no such room
  // (or just created); denied → private and we lack access.
  let meta = $state(undefined)
  let denied = $state(false)
  $effect(() => {
    if (route.view !== 'room') return
    void user // tracked dep: RTDB cancels denied listeners; re-subscribe on auth changes
    meta = undefined
    denied = false
    return onRoomMeta(route.roomId, (m) => { meta = m; denied = false }, () => (denied = true))
  })

  let identity = $state(getIdentity())
  let draft = $state('')
  let joinError = $state('')

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

{#if route.view === 'landing'}
  <Landing />
{:else if route.view === 'admin'}
  <AdminApp />
{:else if route.view === 'notfound'}
  <main class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
    <p class="text-5xl mb-4">🤷</p>
    <p class="text-mist">“{route.slug}” isn’t a valid room code.</p>
    <a href="/" class="mt-4 text-accent underline">back to cosanlab chat</a>
  </main>
{:else if denied}
  <EmailGate roomId={route.roomId} signedInAs={user?.email ?? null} />
{:else if meta === undefined}
  <main class="grid place-items-center min-h-dvh text-mist">loading…</main>
{:else if meta === null}
  <main class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
    <p class="text-5xl mb-4">🚪</p>
    <p class="text-mist">No room here yet. Check the code, or ask the organizer.</p>
    <a href="/" class="mt-4 text-accent underline">back to cosanlab chat</a>
  </main>
{:else if identity.name === null}
  <main class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
    <div class="w-full max-w-sm">
      <img src="/img/cosanlab-sticker.png" alt="COSAN Lab" class="mx-auto mb-4 h-16 w-auto" />
      <h1 class="text-4xl font-bold text-accent">{meta.name}</h1>
      <p class="mt-2 text-xs uppercase tracking-[0.2em] text-mist/80">cosanlab chat</p>
      <form onsubmit={join} class="mt-8 flex flex-col gap-3">
        <input
          class="w-full rounded-xl bg-surface border border-surface-2 px-4 py-3 text-lg placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Your name"
          maxlength={NAME_MAX}
          bind:value={draft}
          autocomplete="name"
          data-testid="name-input"
        />
        <button
          class="w-full rounded-xl bg-gradient-to-r from-accent to-accent-hot px-4 py-3 text-lg font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98] transition"
          type="submit"
          data-testid="join-button"
        >Join the chat</button>
        {#if joinError}<p class="text-blush text-sm">{joinError}</p>{/if}
      </form>
      <p class="mt-6 text-xs text-petal/70">no account needed — just be kind</p>
    </div>
  </main>
{:else}
  {#key route.roomId}
    <Room {identity} roomId={route.roomId} {meta} />
  {/key}
{/if}
```

The `{#key route.roomId}` block is load-bearing, not decorative: `Room.svelte`'s
`$effect` subscriptions (`onMessages`/`onReactions`/`onTyping`) return no cleanup
and `joinPresence` arms `onDisconnect` on the old room's node — navigating
between rooms without a full remount would leak the old room's listeners and
leave a ghost presence entry. `{#key}` destroys and recreates `Room` on every
room change, tearing down all effects.

Create a stub `src/components/EmailGate.svelte` so the build passes (Task 9 fills it):

```svelte
<script>
  let { roomId, signedInAs } = $props()
</script>
<main class="grid place-items-center min-h-dvh text-mist">private room — sign-in coming in Task 9 ({roomId})</main>
```

And a stub `src/components/admin/AdminApp.svelte` (Task 12 fills it):

```svelte
<main class="grid place-items-center min-h-dvh text-mist">admin dashboard — Task 12</main>
```

- [ ] **Step 4: Update `Room.svelte` to accept `meta`**

`let { identity, roomId, meta } = $props()` — (Task 10 uses `meta`; accepting it now keeps one migration).

- [ ] **Step 5: Verify**

Run: `npm test && npm run build` — Expected: PASS / build succeeds.
Manual smoke (optional but recommended): `firebase emulators:exec --only database,auth --project demo-cosanlab 'sleep 600'` in one shell, `VITE_USE_EMULATOR=true npm run dev` in another; visit `/`, `/admin`, `/nope!`, `/some-room` — landing, stub, notfound, and "no room here yet" respectively.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: routed app shell with landing page and room join flow"
```

---

### Task 9: EmailGate — private-room magic-link sign-in

**Files:**
- Modify: `src/components/EmailGate.svelte` (replace stub)

**Interfaces:**
- Consumes: `sendMagicLink(email, roomId)` (Task 6). Props: `roomId: string`, `signedInAs: string | null`.
- Behavior: three states — (a) not signed in → email form → "check your inbox" confirmation; (b) signed in but still denied (not on invite list) → "this account isn't invited" + sign-out-and-retry; (c) after successful magic-link completion App's `onRoomMeta` re-fires without denial, so this component simply unmounts.

- [ ] **Step 1: Implement**

```svelte
<script>
  import { sendMagicLink } from '../lib/auth.js'
  import { signOutUser } from '../lib/auth.js'

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
        <span class="font-semibold">{signedInAs}</span> isn’t on this room’s invite list.
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
```

- [ ] **Step 2: Verify** — Run: `npm run build` — Expected: succeeds. (Flow is e2e-tested in Task 15 via the auth emulator, where magic-link emails appear in the emulator log.)

- [ ] **Step 3: Commit**

```bash
git add src/components/EmailGate.svelte
git commit -m "feat: email magic-link gate for private rooms"
```

---

### Task 10: Room UI — room name header, locked banner

**Files:**
- Modify: `src/components/Room.svelte`, `src/components/Composer.svelte`

**Interfaces:**
- Consumes: `meta` prop (`{name, locked, private}`) from Task 8; `Composer` gains prop `disabled: boolean`.

- [ ] **Step 1: Header + locked banner in `Room.svelte`**

Where the header currently renders the fixed wordmark, render `{meta.name}` instead (keep layout/classes). Below the header, add:

```svelte
{#if meta.locked}
  <div class="bg-surface-2 text-mist text-sm text-center py-2 px-4" data-testid="locked-banner">
    🔒 This room is locked — you’re viewing the archive.
  </div>
{/if}
```

Gate the write-side effects so a locked/archived room never attempts denied writes (presence/typing writes would fail rules), and make leaving a room remove the presence entry (without this, navigating away leaves a ghost "here now" entry until the tab disconnects). First change `joinPresence` in `src/lib/chat.js` to return a leave function:

```js
export function joinPresence(roomId, { clientId, name }) {
  const node = ref(db, roomPath(roomId, 'presence', clientId))
  onDisconnect(node).remove()
  set(node, { name, ts: serverTimestamp() })
  return () => remove(node) // leave(): called on unmount/room switch
}
```

Then in `Room.svelte`, merge the presence effect so teardown both leaves and unsubscribes:

```svelte
$effect(() => {
  if (meta.locked) return onPresence(roomId, (p) => { hereCount = p.count; presentNames = p.names })
  const leave = joinPresence(roomId, identity)
  const unsub = onPresence(roomId, (p) => { hereCount = p.count; presentNames = p.names })
  return () => { leave(); unsub() }
})
```

(`onPresence`/`onMessages`/`onReactions`/`onTyping` subscriptions stay unconditional — reads are allowed.) Replace `<Composer …/>` with:

```svelte
<Composer {roomId} {identity} {knownNames} disabled={meta.locked} … />
```

- [ ] **Step 2: `Composer.svelte` disabled state + meme hint**

Accept `disabled = false` in `$props()`. When disabled, render instead of the form:

```svelte
{#if disabled}
  <div class="px-4 py-3 text-center text-sm text-mist" data-testid="composer-locked">
    This room is locked.
  </div>
{:else}
  <!-- existing form -->
{/if}
```

Change the input placeholder to `Message — paste an image link to share memes`. Skip `setTyping` calls when `disabled`.

- [ ] **Step 3: Verify** — Run: `npm test && npm run build` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Room.svelte src/components/Composer.svelte
git commit -m "feat: per-room header, locked banner, composer disabled state"
```

---

### Task 11: Meme unfurling in MessageBubble

**Files:**
- Modify: `src/components/MessageBubble.svelte`
- Test: `src/lib/media.test.js` already covers extraction; rendering verified in e2e Task 15.

**Interfaces:**
- Consumes: `extractImageUrls` (Task 4). `linkify` (existing, `src/lib/derive.js:50`) keeps rendering the URL as a clickable link inside the bubble; images render *below* the bubble.

- [ ] **Step 1: Render images**

In the `<script>` block: `import { extractImageUrls } from '../lib/media.js'` and `let images = $derived(extractImageUrls(message.text))`. After the bubble `</div>` (below the `{#each linkify(...)}` block's container), add:

```svelte
{#each images as src (src)}
  <a href={src} target="_blank" rel="noopener noreferrer" class="block mt-1 max-w-[80%]">
    <img
      {src}
      alt="shared image"
      loading="lazy"
      referrerpolicy="no-referrer"
      class="rounded-xl max-h-64 w-auto shadow-md"
      onerror={(e) => e.currentTarget.parentElement.remove()}
      data-testid="meme-image"
    />
  </a>
{/each}
```

(`onerror` removes the wrapper so a dead link degrades to just the plain link text already rendered by `linkify` — the spec's fallback behavior. Mirror the own/other alignment the bubble uses: add `ml-auto`/`mr-auto` matching the bubble's `mine` conditional classes.)

- [ ] **Step 2: Verify** — `npm run build`; then manual: emulator dev server, send `https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg` in a room → image renders under the bubble; send `https://example.com/nope.png` → no broken-image icon remains.

- [ ] **Step 3: Commit**

```bash
git add src/components/MessageBubble.svelte
git commit -m "feat: unfurl https image links below message bubbles"
```

---

### Task 12: rooms.js admin API + sort

**Files:**
- Modify: `src/lib/rooms.js`
- Test: `src/lib/rooms.test.js` (pure `sortRooms` only)

**Interfaces:**
- Produces (all admin-only by rules; UI in Tasks 13–14):
  - `createRoom({roomId, name, isPrivate}): Promise` — multi-path meta+index
  - `setRoomFlag(roomId, flag: 'locked'|'private', value: boolean): Promise` — meta+index
  - `addInvite(roomId, email)` / `removeInvite(roomId, email)`
  - `deleteRoom(roomId)` / `resetRoom(roomId)`
  - `exportRoom(roomId): Promise<object>` / `exportAll(): Promise<object>`
  - `onRoomPresence(roomId, cb)` — `{count, names}`
  - `onAdminEmails(cb)` / `addAdmin(email)` / `removeAdmin(email)`
  - `sortRooms(index: object, presence: {roomId: count}): [roomId, entry][]` — present-count desc, then lastActivityAt desc, then name A→Z (pure)

- [ ] **Step 1: Write the failing sort test**

```js
// src/lib/rooms.test.js
import { describe, it, expect } from 'vitest'
import { sortRooms } from './rooms.js'

describe('sortRooms', () => {
  const index = {
    quiet: { name: 'Quiet', lastActivityAt: 100 },
    busy: { name: 'Busy', lastActivityAt: 50 },
    recent: { name: 'Recent', lastActivityAt: 999 },
    ghost: { name: 'Ghost' },
  }
  it('live presence first, then recency, then name', () =>
    expect(sortRooms(index, { busy: 3 }).map(([id]) => id)).toEqual([
      'busy', 'recent', 'quiet', 'ghost',
    ]))
  it('presence count breaks presence ties', () =>
    expect(sortRooms(index, { busy: 1, quiet: 5 }).map(([id]) => id).slice(0, 2)).toEqual([
      'quiet', 'busy',
    ]))
})
```

- [ ] **Step 2: Run test** — `npx vitest run src/lib/rooms.test.js` — Expected: FAIL (`sortRooms` not exported).

- [ ] **Step 3: Extend `src/lib/rooms.js`**

Append (imports at top grow to `{ ref, onValue, get, update, serverTimestamp }` plus `import { encodeEmail } from './keys.js'`):

```js
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
  return update(ref(db), {
    [roomPath(roomId, 'meta', flag)]: value,
    [`roomsIndex/${roomId}/${flag}`]: value,
  })
}

export function addInvite(roomId, email) {
  return update(ref(db), { [roomPath(roomId, 'meta', 'invited', encodeEmail(email))]: true })
}

export function removeInvite(roomId, email) {
  return update(ref(db), { [roomPath(roomId, 'meta', 'invited', encodeEmail(email))]: null })
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
  return update(ref(db), { [`config/adminEmails/${encodeEmail(email)}`]: true })
}

export function removeAdmin(email) {
  return update(ref(db), { [`config/adminEmails/${encodeEmail(email)}`]: null })
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
```

- [ ] **Step 4: Run tests** — `npm test` — Expected: PASS including `rooms.test.js`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rooms.js src/lib/rooms.test.js
git commit -m "feat: admin room API (create/flag/invite/delete/reset/export) and dashboard sort"
```

---

### Task 13: Admin dashboard — sign-in + live room table

**Files:**
- Modify: `src/components/admin/AdminApp.svelte` (replace stub)
- Create: `src/components/admin/RoomRow.svelte`, `src/lib/time-ago.js`
- Test: `src/lib/time-ago.test.js`

**Interfaces:**
- Consumes: `onAuth`, `signInWithGoogle`, `signOutUser` (Task 6); `onRoomsIndex`, `onRoomPresence`, `sortRooms` (Tasks 8/12).
- Produces: `timeAgo(ts, now): string` (`'now'`, `'3m ago'`, `'2h ago'`, `'5d ago'`); `RoomRow` props contract used by Task 14: `{ roomId, entry, presence: {count, names} }`.
- Admin detection is client-side courtesy only: after sign-in, attempt `get(ref(db, 'config/adminEmails'))` — if it throws, show "not an admin" (rules are the real gate).

- [ ] **Step 1: Failing `timeAgo` test**

```js
// src/lib/time-ago.test.js
import { describe, it, expect } from 'vitest'
import { timeAgo } from './time-ago.js'

describe('timeAgo', () => {
  const now = 1_000_000_000_000
  it('under a minute is now', () => expect(timeAgo(now - 30_000, now)).toBe('now'))
  it('minutes', () => expect(timeAgo(now - 3 * 60_000, now)).toBe('3m ago'))
  it('hours', () => expect(timeAgo(now - 2 * 3_600_000, now)).toBe('2h ago'))
  it('days', () => expect(timeAgo(now - 5 * 86_400_000, now)).toBe('5d ago'))
  it('missing ts', () => expect(timeAgo(undefined, now)).toBe('—'))
})
```

- [ ] **Step 2: Run** — `npx vitest run src/lib/time-ago.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/time-ago.js`**

```js
export function timeAgo(ts, now = Date.now()) {
  if (!ts) return '—'
  const s = Math.max(0, now - ts) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
```

- [ ] **Step 4: Run** — `npx vitest run src/lib/time-ago.test.js` — Expected: PASS.

- [ ] **Step 5: `AdminApp.svelte`**

```svelte
<script>
  import { ref, get } from 'firebase/database'
  import { db } from '../../lib/firebase.js'
  import { onAuth, signInWithGoogle, signOutUser } from '../../lib/auth.js'
  import { onRoomsIndex, onRoomPresence, sortRooms } from '../../lib/rooms.js'
  import RoomRow from './RoomRow.svelte'

  let user = $state(null)
  let authReady = $state(false)
  let isAdmin = $state(null) // null = unknown, false = signed in but not admin
  $effect(() =>
    onAuth(async (u) => {
      user = u
      authReady = true
      if (!u) { isAdmin = null; return }
      try {
        await get(ref(db, 'config/adminEmails'))
        isAdmin = true
      } catch {
        isAdmin = false
      }
    }),
  )

  let index = $state({})
  $effect(() => { if (isAdmin) return onRoomsIndex((v) => (index = v)) })

  // One presence subscription per room; cleaned up when rooms disappear.
  let presence = $state({}) // roomId -> {count, names}
  $effect(() => {
    if (!isAdmin) return
    const unsubs = Object.keys(index).map((id) =>
      onRoomPresence(id, (p) => (presence = { ...presence, [id]: p })),
    )
    return () => unsubs.forEach((u) => u())
  })

  let rows = $derived(
    sortRooms(index, Object.fromEntries(Object.entries(presence).map(([id, p]) => [id, p.count]))),
  )
</script>

<main class="min-h-dvh px-4 py-8 max-w-4xl mx-auto">
  {#if !authReady}
    <p class="text-mist text-center">loading…</p>
  {:else if !user}
    <div class="grid place-items-center min-h-[60dvh]">
      <button class="rounded-xl bg-accent px-6 py-3 font-semibold text-white"
              onclick={() => signInWithGoogle()} data-testid="admin-google-signin">
        Sign in with Google
      </button>
    </div>
  {:else if isAdmin === false}
    <div class="grid place-items-center min-h-[60dvh] text-center">
      <div>
        <p class="text-mist" data-testid="not-admin">{user.email} isn’t an admin.</p>
        <button class="mt-4 text-accent underline" onclick={() => signOutUser()}>sign out</button>
      </div>
    </div>
  {:else if isAdmin}
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-accent">cosanlab chat · admin</h1>
      <button class="text-sm text-mist hover:text-white" onclick={() => signOutUser()}>
        {user.email} · sign out
      </button>
    </header>
    <div class="flex flex-col gap-2" data-testid="room-table">
      {#each rows as [roomId, entry] (roomId)}
        <RoomRow {roomId} {entry} presence={presence[roomId] ?? { count: 0, names: [] }} />
      {/each}
      {#if !rows.length}<p class="text-mist text-center py-8">No rooms yet.</p>{/if}
    </div>
  {/if}
</main>
```

- [ ] **Step 6: `RoomRow.svelte` (display only — actions arrive in Task 14)**

```svelte
<script>
  import { timeAgo } from '../../lib/time-ago.js'
  let { roomId, entry, presence } = $props()
  let expanded = $state(false)
  let copied = $state(false)

  function copyLink() {
    navigator.clipboard.writeText(`${location.origin}/${roomId}`)
    copied = true
    setTimeout(() => (copied = false), 1500)
  }
</script>

<div class="rounded-xl bg-surface px-4 py-3" data-testid="room-row-{roomId}">
  <div class="flex items-center gap-3">
    <button class="flex-1 text-left" onclick={() => (expanded = !expanded)}>
      <span class="font-semibold">{entry.name}</span>
      <span class="ml-2 text-xs text-mist">/{roomId}</span>
    </button>
    {#if presence.count > 0}
      <span class="text-xs text-petal" data-testid="present-count">🟢 {presence.count}</span>
    {/if}
    <span class="text-xs text-mist">{entry.private ? '🔒 private' : '🌐 public'}</span>
    <span class="text-xs text-mist">{entry.locked ? 'locked' : 'open'}</span>
    <span class="text-xs text-mist w-16 text-right">{timeAgo(entry.lastActivityAt)}</span>
    <button class="text-xs text-accent" onclick={copyLink} data-testid="copy-link">
      {copied ? 'copied!' : 'copy link'}
    </button>
  </div>
  {#if expanded}
    <div class="mt-3 border-t border-surface-2 pt-3 text-sm text-mist" data-testid="room-detail">
      {#if presence.names.length}
        <p>here now: {presence.names.join(', ')}</p>
      {:else}
        <p>nobody here right now</p>
      {/if}
      <!-- Task 14 adds the action buttons in this panel -->
    </div>
  {/if}
</div>
```

- [ ] **Step 7: Verify** — `npm test && npm run build` — PASS. Manual: emulator dev, seed an admin (see Task 15 Step 1's seed command), visit `/admin`, sign in via the emulator's fake Google account chooser, see the (empty) table.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: admin dashboard shell with live activity-sorted room table"
```

---

### Task 14: Admin actions — create, toggles, invites, export/reset/delete, admins box

**Files:**
- Modify: `src/components/admin/AdminApp.svelte`, `src/components/admin/RoomRow.svelte`
- Create: `src/components/admin/CreateRoomForm.svelte`, `src/components/admin/InviteEditor.svelte`, `src/components/admin/ConfirmDialog.svelte`, `src/lib/download.js`

**Interfaces:**
- Consumes: everything from Task 12; `normalizeSlug`/`isValidSlug` (Task 2); `decodeEmail` (Task 3).
- Produces: `downloadJson(filename: string, data: object): void` in `download.js`; `<ConfirmDialog {label} {expected} onconfirm onclose>` — typed-confirmation modal (user must type `expected` before Confirm enables).

- [ ] **Step 1: `src/lib/download.js`**

```js
// Browser JSON download — the dashboard's "export" buttons.
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: `ConfirmDialog.svelte`**

```svelte
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
```

- [ ] **Step 3: `CreateRoomForm.svelte`**

```svelte
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
```

- [ ] **Step 4: `InviteEditor.svelte`**

```svelte
<script>
  import { ref, onValue } from 'firebase/database'
  import { db } from '../../lib/firebase.js'
  import { roomPath } from '../../lib/paths.js'
  import { addInvite, removeInvite } from '../../lib/rooms.js'
  import { decodeEmail } from '../../lib/keys.js'

  let { roomId } = $props()
  let invited = $state([])
  let draft = $state('')
  $effect(() =>
    onValue(ref(db, roomPath(roomId, 'meta', 'invited')), (snap) =>
      (invited = Object.keys(snap.val() ?? {}).map(decodeEmail)),
    ),
  )

  async function add(e) {
    e.preventDefault()
    const email = draft.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    await addInvite(roomId, email)
    draft = ''
  }
</script>

<div class="mt-2" data-testid="invite-editor">
  <form onsubmit={add} class="flex gap-2">
    <input class="flex-1 rounded-lg bg-night border border-surface-2 px-3 py-2 text-white"
           type="email" placeholder="invite email…" bind:value={draft} data-testid="invite-input" />
    <button class="rounded-lg bg-accent px-3 py-2 text-white" type="submit" data-testid="invite-add">Add</button>
  </form>
  <ul class="mt-2 flex flex-wrap gap-2">
    {#each invited as email (email)}
      <li class="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs">
        {email}
        <button class="text-blush" onclick={() => removeInvite(roomId, email)} aria-label="remove {email}">×</button>
      </li>
    {/each}
  </ul>
</div>
```

- [ ] **Step 5: Wire actions into `RoomRow.svelte`'s expanded panel**

Replace the `<!-- Task 14 -->` comment with (script gains the imports + `let confirming = $state(null)` + `today()` helper):

```svelte
<div class="mt-3 flex flex-wrap gap-2">
  <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs" data-testid="toggle-locked"
          onclick={() => setRoomFlag(roomId, 'locked', !entry.locked)}>
    {entry.locked ? 'unlock' : 'lock'}
  </button>
  <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs" data-testid="toggle-private"
          onclick={() => setRoomFlag(roomId, 'private', !entry.private)}>
    make {entry.private ? 'public' : 'private'}
  </button>
  <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs" data-testid="export-room"
          onclick={async () => downloadJson(`${roomId}-${today()}.json`, await exportRoom(roomId))}>
    export json
  </button>
  <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-blush" data-testid="reset-room"
          onclick={() => (confirming = 'reset')}>reset…</button>
  <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-blush" data-testid="delete-room"
          onclick={() => (confirming = 'delete')}>delete…</button>
</div>
{#if entry.private}<InviteEditor {roomId} />{/if}
{#if confirming === 'reset'}
  <ConfirmDialog label="Erase every message, reaction, and presence entry in “{entry.name}”? Meta and invites survive."
                 expected={roomId} onconfirm={() => resetRoom(roomId)} onclose={() => (confirming = null)} />
{:else if confirming === 'delete'}
  <ConfirmDialog label="Permanently delete “{entry.name}” and all its data?"
                 expected={roomId} onconfirm={() => deleteRoom(roomId)} onclose={() => (confirming = null)} />
{/if}
```

Script additions: `import { setRoomFlag, exportRoom, resetRoom, deleteRoom } from '../../lib/rooms.js'`, `import { downloadJson } from '../../lib/download.js'`, `import InviteEditor from './InviteEditor.svelte'`, `import ConfirmDialog from './ConfirmDialog.svelte'`, and `const today = () => new Date().toISOString().slice(0, 10)`.

- [ ] **Step 6: Header actions + admins box in `AdminApp.svelte`**

Between the header and the room table insert:

```svelte
<CreateRoomForm oncreated={() => {}} />

<details class="mt-4 rounded-xl bg-surface px-4 py-3">
  <summary class="cursor-pointer text-sm text-mist">admins & export</summary>
  <div class="mt-3 flex flex-wrap items-center gap-2">
    <button class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs" data-testid="export-all"
            onclick={async () => downloadJson(`cosanlab-chat-all-${new Date().toISOString().slice(0, 10)}.json`, await exportAll())}>
      export all rooms
    </button>
  </div>
  <form class="mt-3 flex gap-2" onsubmit={addAdminSubmit}>
    <input class="flex-1 rounded-lg bg-night border border-surface-2 px-3 py-2 text-white"
           type="email" placeholder="add admin email…" bind:value={adminDraft} data-testid="admin-email-input" />
    <button class="rounded-lg bg-accent px-3 py-2 text-white" type="submit" data-testid="admin-email-add">Add</button>
  </form>
  <ul class="mt-2 flex flex-wrap gap-2">
    {#each adminEmails as key (key)}
      <li class="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs">
        {decodeEmail(key)}
        {#if decodeEmail(key) !== user.email.toLowerCase()}
          <button class="text-blush" onclick={() => removeAdmin(decodeEmail(key))}>×</button>
        {/if}
      </li>
    {/each}
  </ul>
</details>
```

Script additions: `import CreateRoomForm from './CreateRoomForm.svelte'`; `import { exportAll, onAdminEmails, addAdmin, removeAdmin } from '../../lib/rooms.js'`; `import { downloadJson } from '../../lib/download.js'`; `import { decodeEmail } from '../../lib/keys.js'`; state `let adminEmails = $state([])`, `let adminDraft = $state('')`; `$effect(() => { if (isAdmin) return onAdminEmails((v) => (adminEmails = v)) })`; and:

```js
async function addAdminSubmit(e) {
  e.preventDefault()
  if (adminDraft.includes('@')) { await addAdmin(adminDraft); adminDraft = '' }
}
```

(The self-removal guard above is UI courtesy; an admin deleting themselves is recoverable via the seed script.)

- [ ] **Step 7: Verify** — `npm test && npm run build` — PASS. Manual emulator run: create public + private rooms, toggle flags, add invites, export downloads a JSON, reset requires typing the slug.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: admin actions — create, lock/private, invites, export/reset/delete, admins box"
```

---

### Task 15: E2E — emulator smoke, room isolation, admin flow

**Files:**
- Modify: `playwright.config.js`, `package.json` (scripts), `e2e/smoke.spec.js` (room-scoped port)
- Create: `e2e/helpers.js`, `e2e/rooms.spec.js`, `e2e/admin.spec.js`

**Interfaces:**
- Consumes: every testid defined in Tasks 8–14 (`room-code-input`, `gate-email-input`, `admin-google-signin`, `create-name`, `create-slug`, `create-submit`, `room-row-*`, `toggle-locked`, `composer-locked`, `meme-image`, …).

- [ ] **Step 1: Emulator seed helper (`e2e/helpers.js`)**

```js
// Talk straight to the emulators' REST APIs. 'Bearer owner' is the database
// emulator's bypass token; the auth emulator accepts unsigned requests.
const DB = 'http://127.0.0.1:9000'
const NS = 'ns=demo-cosanlab-default-rtdb'

export async function dbPut(path, value) {
  const res = await fetch(`${DB}/${path}.json?${NS}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer owner' },
    body: JSON.stringify(value),
  })
  if (!res.ok) throw new Error(`seed ${path}: ${res.status}`)
}

export async function wipeDb() {
  await fetch(`${DB}/.json?${NS}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } })
}

export async function seedRoom(roomId, { name = roomId, isPrivate = false, locked = false, invited = {} } = {}) {
  await dbPut(`rooms/${roomId}/meta`, { name, createdAt: 1, locked, private: isPrivate, ...(isPrivate && { invited }) })
  await dbPut(`roomsIndex/${roomId}`, { name, private: isPrivate, locked, createdAt: 1, lastActivityAt: 1 })
}

export async function seedAdmin(emailKey) {
  await dbPut(`config/adminEmails/${emailKey}`, true)
}

export async function join(page, path, name) {
  await page.goto(path)
  await page.getByTestId('name-input').fill(name)
  await page.getByTestId('join-button').click()
  await page.getByTestId('composer-input').waitFor()
}
```

- [ ] **Step 2: Playwright config + scripts**

`playwright.config.js` — set `use.baseURL = 'http://127.0.0.1:5173'` and:

```js
webServer: {
  command: 'VITE_USE_EMULATOR=true npm run dev -- --port 5173 --strictPort',
  url: 'http://127.0.0.1:5173',
  reuseExistingServer: true,
},
```

`package.json` script: `"e2e": "firebase emulators:exec --only database,auth --project demo-cosanlab 'playwright test'"`.

- [ ] **Step 3: Port `e2e/smoke.spec.js`**

Top of file: `import { seedRoom, wipeDb, join } from './helpers.js'` and

```js
test.beforeAll(async () => { await wipeDb(); await seedRoom('lobby', { name: 'Lobby' }) })
```

Change `join(page, name)` calls to `join(page, '/lobby', name)` (delete the old local `join` helper). Assertions are otherwise unchanged. The nonce-uniqueness comments can go — the DB is wiped per run.

- [ ] **Step 4: `e2e/rooms.spec.js` — isolation + memes + locking**

```js
import { test, expect } from '@playwright/test'
import { seedRoom, wipeDb, dbPut, join } from './helpers.js'

test.beforeEach(async () => {
  await wipeDb()
  await seedRoom('room-a', { name: 'Room A' })
  await seedRoom('room-b', { name: 'Room B' })
})

test('messages do not leak between rooms', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await join(a, '/room-a', 'Alice')
  await join(b, '/room-b', 'Bob')

  await a.getByTestId('composer-input').fill('only in A')
  await a.getByTestId('send-button').click()
  await expect(a.getByText('only in A')).toBeVisible()

  await b.getByTestId('composer-input').fill('only in B')
  await b.getByTestId('send-button').click()
  await expect(b.getByText('only in B')).toBeVisible()
  await expect(b.getByText('only in A')).not.toBeVisible()
})

test('image links unfurl below the bubble', async ({ page }) => {
  await join(page, '/room-a', 'Meme Lord')
  await page.getByTestId('composer-input').fill('behold https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg')
  await page.getByTestId('send-button').click()
  await expect(page.getByTestId('meme-image')).toBeVisible()
})

test('locked room shows banner and blocks composing', async ({ page }) => {
  await join(page, '/room-a', 'Early Bird') // join before it locks (name is stored)
  await dbPut('rooms/room-a/meta/locked', true)
  await dbPut('roomsIndex/room-a/locked', true)
  await page.reload()
  await expect(page.getByTestId('locked-banner')).toBeVisible()
  await expect(page.getByTestId('composer-locked')).toBeVisible()
  await expect(page.getByTestId('composer-input')).not.toBeVisible()
})

test('landing lists public rooms and navigates', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('public-room-list')).toContainText('Room A')
  await page.getByTestId('room-code-input').fill('room-b')
  await page.getByTestId('room-code-go').click()
  await page.getByTestId('name-input').waitFor()
})
```

- [ ] **Step 5: `e2e/admin.spec.js` — Google sign-in via emulator popup + admin actions**

```js
import { test, expect } from '@playwright/test'
import { wipeDb, seedAdmin, seedRoom } from './helpers.js'

const ADMIN_EMAIL = 'boss@cosanlab.test'

// The auth emulator serves a fake Google account chooser in the popup;
// "Add new account" fabricates a verified Google user with any email.
async function signInAsAdmin(page) {
  await page.goto('/admin')
  const popupPromise = page.waitForEvent('popup')
  await page.getByTestId('admin-google-signin').click()
  const popup = await popupPromise
  await popup.getByRole('button', { name: /add new account/i }).click()
  await popup.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await popup.getByLabel(/display name/i).fill('Boss')
  await popup.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByTestId('room-table')).toBeVisible()
}

test.beforeEach(async () => {
  await wipeDb()
  await seedAdmin('boss@cosanlab,test')
})

test('admin creates a room, locks it, participant is blocked', async ({ page, browser }) => {
  await signInAsAdmin(page)

  await page.getByTestId('create-name').fill('Lab Meeting')
  await page.getByTestId('create-slug').fill('lab-meeting')
  await page.getByTestId('create-submit').click()
  await expect(page.getByTestId('room-row-lab-meeting')).toBeVisible()

  // participant can chat
  const user = await (await browser.newContext()).newPage()
  await user.goto('/lab-meeting')
  await user.getByTestId('name-input').fill('Postdoc')
  await user.getByTestId('join-button').click()
  await user.getByTestId('composer-input').fill('hello lab')
  await user.getByTestId('send-button').click()
  await expect(user.getByText('hello lab')).toBeVisible()

  // admin locks it
  await page.getByTestId('room-row-lab-meeting').getByRole('button').first().click() // expand
  await page.getByTestId('toggle-locked').click()

  // participant sees the lock after reload
  await user.reload()
  await expect(user.getByTestId('locked-banner')).toBeVisible()
  await expect(user.getByTestId('composer-locked')).toBeVisible()
})

test('non-admin google user is refused', async ({ page }) => {
  await wipeDb() // no adminEmails at all
  await page.goto('/admin')
  const popupPromise = page.waitForEvent('popup')
  await page.getByTestId('admin-google-signin').click()
  const popup = await popupPromise
  await popup.getByRole('button', { name: /add new account/i }).click()
  await popup.getByLabel(/email/i).fill('rando@nowhere.test')
  await popup.getByLabel(/display name/i).fill('Rando')
  await popup.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByTestId('not-admin')).toBeVisible()
})
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test && npm run test:rules && npm run e2e`
Expected: all green. The emulator popup's exact labels can drift between firebase-tools versions — if a selector misses, inspect with `PWDEBUG=1 npm run e2e` and adjust the selector, not the flow.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "test: emulator-based e2e — smoke, room isolation, memes, locking, admin flow"
```

---

### Task 16: CLI scripts

**Files:**
- Create: `scripts/export_room.sh`, `scripts/export_all.sh`, `scripts/reset_room.sh`, `scripts/seed_admin.sh`
- Delete: `scripts/export_chat.sh`, `scripts/reset_chat.sh`

**Interfaces:**
- Consumes: nothing from the app — pure REST + `gcloud auth print-access-token` (owner OAuth bypasses rules), mirroring the deleted xoxowasita scripts.

- [ ] **Step 1: Write the four scripts** (all `chmod +x`; shared header shown once, repeat in each file)

```bash
#!/usr/bin/env bash
# scripts/export_room.sh — one room (messages, reactions, meta) to JSON.
# Usage: ./scripts/export_room.sh <roomId> [outfile]
set -euo pipefail
DB="https://cosanlab-chat-default-rtdb.firebaseio.com"
ROOM="${1:?usage: export_room.sh <roomId> [outfile]}"
OUT="${2:-${ROOM}-export-$(date +%Y%m%d-%H%M%S).json}"
curl -sf "$DB/rooms/$ROOM.json?access_token=$(gcloud auth print-access-token)&print=pretty" > "$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
```

```bash
#!/usr/bin/env bash
# scripts/export_all.sh — every room + index, one JSON snapshot.
set -euo pipefail
DB="https://cosanlab-chat-default-rtdb.firebaseio.com"
OUT="${1:-cosanlab-chat-export-$(date +%Y%m%d-%H%M%S).json}"
curl -sf "$DB/.json?access_token=$(gcloud auth print-access-token)&print=pretty" > "$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
```

```bash
#!/usr/bin/env bash
# scripts/reset_room.sh — clear a room's chatter; meta + invites survive.
# Usage: ./scripts/reset_room.sh <roomId>
set -euo pipefail
DB="https://cosanlab-chat-default-rtdb.firebaseio.com"
ROOM="${1:?usage: reset_room.sh <roomId>}"
TOKEN=$(gcloud auth print-access-token)
for node in messages reactions typing presence; do
  curl -sf -X DELETE "$DB/rooms/$ROOM/$node.json?access_token=$TOKEN" > /dev/null
  echo "cleared rooms/$ROOM/$node"
done
```

```bash
#!/usr/bin/env bash
# scripts/seed_admin.sh — bootstrap (or rescue) an admin email.
# Usage: ./scripts/seed_admin.sh someone@dartmouth.edu
set -euo pipefail
DB="https://cosanlab-chat-default-rtdb.firebaseio.com"
EMAIL="${1:?usage: seed_admin.sh <email>}"
KEY=$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | tr '.' ',')
curl -sf -X PUT -d 'true' "$DB/config/adminEmails/$KEY.json?access_token=$(gcloud auth print-access-token)" > /dev/null
echo "admin: $EMAIL (key: $KEY)"
```

- [ ] **Step 2: Verify** — `bash -n scripts/*.sh && shellcheck scripts/*.sh || true` (bash -n must pass; shellcheck advisory). Live verification happens in Task 17 after the project exists.

- [ ] **Step 3: Commit**

```bash
git add scripts && git rm scripts/export_chat.sh scripts/reset_chat.sh
git commit -m "feat: per-room export/reset scripts, seed_admin bootstrap"
```

---

### Task 17: README + deploy

**Files:**
- Modify: `README.md` (full rewrite), `.env.example` (same var names, new project comment)

**Interfaces:** none — documentation + operations.

- [ ] **Step 1: Rewrite README.md**

Cover, in xoxowasita's README voice: what it is (multi-room fork of xoxowasita for COSAN lab), features (rooms at `chat.cosanlab.com/{slug}`, public/private, magic-link invites, admin dashboard with live monitoring + export/reset buttons, URL memes), architecture (data model block from the spec), develop/test (`npm run dev` with emulators, `npm test`, `npm run test:rules`, `npm run e2e`), runbook (create room in dashboard → share link → lock after → export), scripts, custom-domain DNS table for `chat.cosanlab.com`, credit + link to xoxowasita as the origin, MIT license. State explicitly: Spark-plan only; image uploads and app-sent invites are documented future work behind a Blaze upgrade.

- [ ] **Step 2: Create the Firebase project (operator + CLI)**

```bash
npx firebase projects:create cosanlab-chat --display-name "cosanlab chat"
npx firebase apps:create web cosanlab-chat-web --project cosanlab-chat
npx firebase apps:sdkconfig web --project cosanlab-chat   # → values for .env.local
# RTDB instance: create via console or `npx firebase database:instances:create cosanlab-chat-default-rtdb --project cosanlab-chat --location us-central1`
```

Manual console steps (cannot be scripted on Spark): Authentication → Sign-in method → enable **Google** and **Email link (passwordless)**. Fill `.env.local` from sdkconfig.

- [ ] **Step 3: Deploy + seed + smoke**

```bash
npm run build
npx firebase deploy --project cosanlab-chat          # hosting + database rules
./scripts/seed_admin.sh luke.j.chang@dartmouth.edu   # bootstrap first admin
```

Smoke on `https://cosanlab-chat.web.app`: sign in at `/admin` with Google → create `test-room` → open it in a phone-sized window, send a message + a meme URL → lock it → verify banner → export JSON → delete room.

- [ ] **Step 4: Hand off DNS to Luke**

Provide the console's exact records (Hosting → Add custom domain → `chat.cosanlab.com`). After DNS verifies: Authentication → Settings → Authorized domains → add `chat.cosanlab.com`. Optional per spec: `gcloud projects add-iam-policy-binding cosanlab-chat --member="user:wasita.mahaphanit.gr@dartmouth.edu" --role="roles/editor"`.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example
git commit -m "docs: cosanlab-chat README and deploy runbook"
```

---

## Self-Review Notes (already applied)

- Spec coverage: rooms/URLs (T2, T5, T8), hybrid identity (T6, T8, T9), admin+allowlist (T7, T13), invites (T7, T9, T14), lock/public-private (T7, T10, T14), dashboard w/ activity sort + presence + export/reset buttons (T12–T14), URL memes (T4, T11), scripts (T16), rules matrix + emulator tests (T7), e2e incl. isolation + admin (T15), rebrand (T1), deploy/DNS (T17). Landing page (spec's `/` route) — T8.
- Type consistency: `sendMessage(roomId, {...})` matches all call sites listed in T5 Step 6; `sortRooms(index, presence)` signature identical in T12 test/impl and T13 usage; email keys always via `encodeEmail` (T3) and the rules' `.replace('.', ',')` — T7 tests both.
- Known judgment calls, intentional: private-room invitee can read the room's own invite list (RTDB read cascade, spec-accepted); `lastActivityAt` spoofable by anyone who can post (spec-accepted); admin e2e drives the auth-emulator popup rather than adding an app test seam.
