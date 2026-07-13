# cosanlab-chat — design spec

**Date:** 2026-07-13
**Status:** approved pending user review
**Origin:** fork of xoxowasita (Wasita Mahaphanit's defense chat),
generalized into a multi-room chat platform for the COSAN lab.

## Goal

A general-purpose, serverless, real-time chat app for lab events and courses.
Admins open rooms (e.g. `chat.cosanlab.com/psych53-f2026`), make them public or
private, lock them when done, and monitor/export them from a dashboard.
Participants keep xoxowasita's zero-friction join in public rooms. Everything
runs on the Firebase **Spark (free) plan** — no backend, no billing.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Participant identity | **Hybrid** — public rooms are name-only (no account); private rooms require email magic-link sign-in |
| Admin auth | **Google sign-in + email allowlist** stored in the database |
| Private-room invitations | **Admin shares the room link** out-of-band; the app never sends invitation email. Firebase Auth emails the sign-in link at join time |
| Meme sharing | **Image-URL unfurl only** (Approach B). No uploads — Firebase Storage requires the Blaze plan. Revisit if the project upgrades |
| Billing | **Spark (free) plan**, hard requirement |
| Hosting | New Firebase project `cosanlab-chat`; custom domain `chat.cosanlab.com` (user configures DNS after first deploy) |

## Fork mechanics and branding

- New repo `cosanlab-chat` created as a **git clone of xoxowasita** so history
  is preserved and upstream fixes remain cherry-pickable.
- De-branding: app name/wordmark → neutral cosanlab theme; the room header
  shows the **room's display name** (from `meta/name`), not a fixed brand.
  Replace the violet/fuchsia palette with a cosanlab-neutral palette; keep the
  dark theme and message-bubble design language.
- Message/reaction/typing/presence **schemas are unchanged**; components port
  with path changes only.

## URL scheme and routing

No router library — a small `route()` helper on `location.pathname` + History API.

| Path | View |
|---|---|
| `/` | Landing: list of public unlocked rooms (from `roomsIndex`) + "enter room code" box |
| `/{roomId}` | Chat room |
| `/admin` | Admin dashboard |

- Room slugs: `[a-z0-9-]{3,40}`, normalized to lowercase (`/PSYCH53-F2026` → `psych53-f2026`).
- Reserved slugs: `admin`, `login`, and a short blocklist for future routes.
- Firebase Hosting already rewrites all paths to `index.html` (SPA).

## Data model

```
/rooms/{roomId}/
  meta: {
    name,               # display name
    createdAt,
    locked: bool,       # locked ⇒ no writes; archive stays readable
    private: bool,
    invited/{encodedEmail}: true    # private rooms only
  }
  messages/{pushId}: { name, text, ts, parentId? }    # unchanged from xoxowasita
  reactions/{msgId}/{emoji}/{clientId}: name          # unchanged
  typing/{scope}/{clientId}: { name, ts }             # unchanged
  presence/{clientId}: { name, ts }                   # unchanged

/roomsIndex/{roomId}: { name, private, locked, createdAt, lastActivityAt }
/config/adminEmails/{encodedEmail}: true
```

- `roomsIndex` is a small world-readable summary so the landing page and
  dashboard list rooms without touching message data. Invite lists live only
  under `meta` (not readable for non-invitees), so they never leak.
  **Accepted trade-off:** because the index is world-readable, the *names and
  existence* of private rooms are publicly visible (the landing page filters
  them out, but a curious client can see them). Only room contents and invite
  lists are access-controlled. Acceptable for lab/course rooms; revisit if a
  room name would itself be sensitive.
- **Email key encoding:** RTDB keys cannot contain `.`, so emails are encoded
  `.` → `,` (standard RTDB idiom). Pure function + unit tests.
- **Activity tracking:** every message send is a multi-path update that also
  writes `roomsIndex/{roomId}/lastActivityAt = serverTimestamp()`. This powers
  dashboard sorting. Known trade-off: anyone who can post can bump the
  timestamp; validated as a number, worst case is cosmetic sort vandalism.

## Identity and auth

Three tiers:

1. **Public-room participants** — unchanged: type a display name, stored in
   `localStorage`. No Firebase Auth involved.
2. **Private-room participants** — email gate → Firebase Auth
   `sendSignInLinkToEmail` (magic link, no password) → link returns to the
   room URL and completes sign-in → rules check `auth.token.email` against
   `meta/invited`. Then they pick a display name like anyone else. Session
   persists per device.
3. **Admins** — Google sign-in at `/admin`; rules check `auth.token.email`
   against `/config/adminEmails`. First admin (Luke) seeded at setup; more
   admins added from the dashboard, no redeploy.

Auth providers: **Google** + **Email link**. Authorized domains:
`cosanlab-chat.web.app`, `chat.cosanlab.com` (added once DNS is live —
magic links only send to authorized domains).

## Security rules (enforcement lives here, UI is courtesy)

- **Public room:** world-readable. Message/reaction/typing/presence writes
  allowed only while `meta/locked == false`, with xoxowasita's existing shape
  validation (append-only messages, name ≤ 30, text ≤ 500, no extra fields).
- **Private room:** reads and writes require `auth != null` AND
  (`auth.token.email` in `meta/invited` OR admin). Locked ⇒ writes denied,
  invited users can still read the archive.
- **`meta`, `roomsIndex`, `/config`:** admin-writable only. Room creation =
  one admin-only multi-path update (meta + index entry).
- Admins can read/write everything (needed for dashboard export/reset/delete).

## Admin dashboard (`/admin`)

Single live-updating page; subscribes to `roomsIndex` + each room's `presence`.

- **Room table auto-sorted by activity:** rooms with people present float to
  the top (live 🟢 count), then by `lastActivityAt`. Columns: name,
  click-to-copy link, public/private, locked/open, present count, last activity.
- **Row actions:** lock/unlock; public/private toggle; manage invite emails
  (private rooms); **export room** (SDK read of `rooms/{roomId}` → browser
  JSON download); **reset room** (multi-path delete of
  messages/reactions/typing/presence, keeps meta + invites; typed
  confirmation); delete room (typed confirmation).
- **Header actions:** create room (name + auto-suggested slug + private
  toggle; private rooms drop into the invite editor); **export all** (full
  `/rooms` download); admins box (add/remove admin emails).
- **Who's here:** expanding a row lists display names currently present.
  (No global user registry exists with anonymous participants; presence is
  the user view. A real registry is Blaze-era future work.)

## Meme rendering (URL unfurl)

- `extractImageUrls(text)` — pure, unit-tested — matches `https://` URLs
  ending in `.png .jpg .jpeg .gif .webp` (query strings allowed, so Imgur/
  Giphy direct links work).
- Matches render below the message text as constrained-height
  `<img loading="lazy">`; on load error, fall back to a plain link.
  `http://` URLs stay plain links (mixed content).
- No schema change — the URL lives in `text`; append-only rules untouched.
- Composer placeholder hints: "paste an image link to share memes".

## Scripts (CLI, authenticate via gcloud like xoxowasita's)

- `scripts/export_room.sh <roomId> [outfile]` — `rooms/{roomId}` → dated JSON.
- `scripts/export_all.sh` — full database snapshot.
- `scripts/reset_room.sh <roomId>` — clears a room's
  messages/reactions/typing/presence; keeps meta + index.

(Same operations exist as dashboard buttons; scripts are for automation.)

## Testing

- **Unit (Vitest):** existing suites port (derive, identity, mentions, emoji).
  New: route parsing, slug normalization + reserved names, email key
  encoding, `extractImageUrls`.
- **E2E (Playwright) against the Firebase emulator suite (RTDB + Auth):**
  1. Two-user public-room smoke test (send, react, thread, typing) — ported.
  2. Room isolation — message in room A must not appear in room B.
  3. Admin flow — sign in, create room, lock it, verify participant send is
     rejected.
  Emulators run on Spark; magic links appear in the emulator log (no real
  email); production data untouched.

## Deploy

1. Create Firebase project `cosanlab-chat` (Spark). Enable RTDB, Hosting,
   Auth (Google + Email link).
2. `.env.local` from the new project's SDK config (pattern unchanged).
3. Deploy rules + hosting → `cosanlab-chat.web.app`.
4. Seed `/config/adminEmails` with Luke's email; verify admin sign-in.
5. User adds DNS for `chat.cosanlab.com` (TXT/A/CNAME per Firebase console);
   once verified, add the domain to Auth authorized domains.
6. Optionally add Wasita as project Editor (same gcloud one-liner as before).

## Future work (explicitly out of scope)

- **Image uploads** via Firebase Storage — requires Blaze; slots in as an
  additive composer feature (Approach A from brainstorming).
- **App-sent invitation emails** — requires Blaze (Functions/Trigger Email).
- **User registry / profiles** — only meaningful once most rooms require auth.
