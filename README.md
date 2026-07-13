# cosanlab chat 💬

Real-time chat rooms for the [COSAN lab](https://cosanlab.com). Anyone with a
room link goes to **chat.cosanlab.com/{room}** on their phone, types a name
(no account for public rooms), and comments, emoji-reacts, and threads in real
time. Everything persists, so every room's chat is also data — one JSON export
away.

This is the multi-room descendant of
**[xoxowasita](https://xoxowasita.com)**, the live audience chat built for
[Wasita Mahaphanit](https://wasita.space)'s public dissertation defense. Same
stack, same message bubbles, same append-only philosophy — generalized from
one defense to a lab full of courses, events, and experiments. Credit where
it's due: Wasita called the original shot, and her Svelte-on-Firebase chat
apps ([shared-reality-chat](https://github.com/cosanlab/shared-reality-chat),
[survivor-chat](https://github.com/cosanlab/survivor-chat)) are the design
language everything here inherits.

## Features

**New in the multi-room fork:**

- **Rooms at a URL** — `chat.cosanlab.com/psych53-f2026` (fallback:
  `cosanlab-chat.web.app`). Slugs are `[a-z0-9-]`, normalized to lowercase.
  The landing page at `/` lists public unlocked rooms plus an
  "enter room code" box.
- **Public and private rooms** — public rooms are name-only, zero friction.
  Private rooms gate on an email magic link: an admin adds invitee emails and
  shares the room link; the visitor types their email and Firebase sends the
  sign-in link (no password, no app-sent email). Session persists per device.
- **Admin dashboard at `/admin`** — Google sign-in checked against an
  `adminEmails` allowlist. One live page: rooms auto-sorted by who's present
  now (🟢 counts) then by last activity, with create / lock / public-private /
  invite-list controls per room, plus export, reset, and delete buttons —
  destructive ones behind typed confirmation. Admins can add more admins from
  the dashboard, no redeploy.
- **Memes** — paste a direct `https://` image link (`.png .jpg .jpeg .gif
  .webp`, query strings fine, so Imgur/Giphy work) and it unfurls below the
  bubble; broken images fall back to a plain link.

**Inherited from xoxowasita:**

- Slack-style threads, emoji reactions, `:emoji:` autocomplete, @mentions
- Typing indicators scoped per room *and* per thread
- Feels instant — optimistic sends, streamed updates, pinned autoscroll with
  a "↓ new messages" pill, reconnect indicator, iOS safe-area aware composer
- Serverless — the browser talks straight to Firebase Realtime Database;
  security is enforced by database rules, not a backend

## Architecture

Svelte 5 (runes) + Vite + Tailwind CSS v4, deployed on Firebase Hosting.

```
/rooms/{roomId}/
  meta: {
    name, createdAt,
    locked: bool,                    # locked ⇒ no writes; archive stays readable
    private: bool,
    invited/{encodedEmail}: true     # private rooms only
  }
  messages/{pushId}: { name, text, ts, parentId? }   # parentId ⇒ thread reply
  reactions/{msgId}/{emoji}/{clientId}: name
  typing/{scope}/{clientId}: { name, ts }            # scope = "main" | msgId
  presence/{clientId}: { name, ts }

/roomsIndex/{roomId}: { name, private, locked, createdAt, lastActivityAt }
/config/adminEmails/{encodedEmail}: true
```

Messages stay **append-only** with shape validation (name ≤ 30 chars, text
≤ 500, no extra fields) — nobody can edit or delete anyone's words. Private
rooms require a verified email in `meta/invited`; locked rooms deny all
writes but invited readers keep the archive. `meta`, `roomsIndex`, and
`/config` are admin-writable only. Email keys encode `.` as `,` (RTDB keys
can't contain dots).

Two accepted trade-offs, on purpose (see the spec in `docs/superpowers/`):
`roomsIndex` is world-readable, so the **names and existence of private rooms
are publicly visible** — only room contents and invite lists are protected.
And `lastActivityAt` is writable by anyone who can post, so the worst-case
abuse is cosmetic sort vandalism on the dashboard.

## Develop / test

```bash
npm install

# Option A: dev against production (needs .env.local, see below)
npm run dev

# Option B: fully offline against the emulators — no live traffic
npx firebase emulators:start --only database,auth --project demo-cosanlab
VITE_USE_EMULATOR=true npm run dev

npm test             # Vitest unit tests (65): routing, keys, media, derive, …
npm run test:rules   # security-rules matrix (24) against the RTDB emulator (needs Java)
npm run e2e          # Playwright (8): smoke, room isolation, private rooms, admin —
                     # entirely emulator-based; magic links print to the emulator log
```

Firebase web config goes in `.env.local` (see `.env.example`; values from
`npx firebase apps:sdkconfig web --project cosanlab-chat`). It's not secret —
security lives in `database.rules.json` — it's just kept out of the repo so
forks can point at their own project.

## Deploy

```bash
npm run build && npx firebase deploy --project cosanlab-chat   # hosting + rules
./scripts/seed_admin.sh you@dartmouth.edu                      # bootstrap the first admin
```

One-time console setup on a fresh project: enable Realtime Database and, under
Authentication → Sign-in method, **Google** and **Email link (passwordless)**.

## Room runbook

1. Sign in at **/admin** and **create the room** (name, auto-suggested slug,
   private toggle).
2. Private room? **Add invitee emails first** — the magic link only works for
   emails already on the list.
3. **Share the link** — click-to-copy in the dashboard table.
4. When it's over, **lock the room** — writes stop, the archive stays
   readable to whoever could read it before.
5. **Export** — per-room or everything, from the dashboard buttons or the
   scripts below.

## Scripts

CLI twins of the dashboard buttons, for automation; all authenticate via
`gcloud` as the project owner.

```bash
./scripts/export_room.sh <roomId> [outfile]   # one room → dated JSON
./scripts/export_all.sh  [outfile]            # full database snapshot
./scripts/reset_room.sh  <roomId>             # clear chatter; meta + invites survive
./scripts/seed_admin.sh  <email>              # bootstrap (or rescue) an admin
```

## Custom domain

`chat.cosanlab.com` registers with Firebase Hosting (console → Hosting → Add
custom domain). DNS at the registrar follows this pattern — **copy the exact
records the console gives you**:

| Type | Host   | Value |
|------|--------|-------|
| TXT  | `chat` | `hosting-site=cosanlab-chat` |
| A    | `chat` | `199.36.158.100` |

No CNAME needed — `chat` is a subdomain, not a `www` alias. TLS provisions
automatically once DNS propagates, and https://cosanlab-chat.web.app always
works as a fallback. After the domain verifies, add `chat.cosanlab.com` to
**Authentication → Settings → Authorized domains**, or magic links won't send
for it.

## Spark plan, and what waits for Blaze

This app runs entirely on Firebase's free **Spark plan** — no Functions, no
Storage, no billing surprises. Two features are documented future work behind
a Blaze upgrade: **image uploads** (Firebase Storage) and **app-sent
invitation emails** (right now Firebase sends the sign-in link, but only after
the invitee visits the room and types their email — the app never emails
anyone unprompted).

## License

[MIT](LICENSE) — grown with love from
[Wasita's defense chat](https://xoxowasita.com). 🐙

Design specs and implementation plans live in `docs/superpowers/`.
