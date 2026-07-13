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
// Multi-dot email — proves rules `.replace('.', ',')` covers ALL dots (RTDB
// rules `replace` is global, unlike JS String.prototype.replace), matching
// the client's `encodeEmail` (which uses `replaceAll`).
const MULTI_DOT_INVITEE = { email: 'first.last.gr@dartmouth.edu', email_verified: true }

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
            invited: { 'student@dartmouth,edu': true, 'first,last,gr@dartmouth,edu': true },
          },
          messages: { m1: { name: 'A', text: 'hi', ts: 1 } },
        },
        'secret-two': {
          meta: {
            name: 'Secret Two', createdAt: 1, locked: false, private: true,
            invited: { 'other@dartmouth,edu': true },
          },
        },
      },
      roomsIndex: {
        'open-room': { name: 'Open', private: false, locked: false, createdAt: 1, lastActivityAt: 1 },
        'locked-room': { name: 'Done', private: false, locked: true, createdAt: 1, lastActivityAt: 1 },
        'secret-room': { name: 'Secret', private: true, locked: false, createdAt: 1, lastActivityAt: 1 },
        'secret-two': { name: 'Secret Two', private: true, locked: false, createdAt: 1, lastActivityAt: 1 },
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
  it('no writes to a nonexistent (ghost) room', () =>
    assertFails(set(ref(dbAs(null), 'rooms/ghost-room/messages/mG'), msg)))
  it('locked room rejects reactions and typing too', async () => {
    await assertFails(set(ref(dbAs(null), 'rooms/locked-room/reactions/m1/1F600/c1'), 'Anon'))
    await assertFails(set(ref(dbAs(null), 'rooms/locked-room/typing/main/c1'), { name: 'Anon', ts: 1 }))
  })
  it('rejects junk shapes: presence missing name, typing with extra field', async () => {
    await assertFails(set(ref(dbAs(null), 'rooms/open-room/presence/c1'), { ts: 1 }))
    await assertFails(set(ref(dbAs(null), 'rooms/open-room/typing/main/c1'), { name: 'Anon', ts: 1, evil: 1 }))
  })
})

describe('private rooms', () => {
  it('unauthenticated cannot read', () =>
    assertFails(get(ref(dbAs(null), 'rooms/secret-room/messages'))))
  it('uninvited (but signed-in) cannot read', () =>
    assertFails(get(ref(dbAs({ email: 'rando@x.com', email_verified: true }), 'rooms/secret-room/messages'))))
  it('invitee reads and posts (multi-path send shape bumps lastActivityAt)', async () => {
    await assertSucceeds(get(ref(dbAs(INVITEE), 'rooms/secret-room/messages')))
    await assertSucceeds(
      update(ref(dbAs(INVITEE)), {
        'rooms/secret-room/messages/mE': msg,
        'roomsIndex/secret-room/lastActivityAt': 333,
      }),
    )
  })
  it('unverified email is not enough', () =>
    assertFails(get(ref(dbAs({ email: 'student@dartmouth.edu', email_verified: false }), 'rooms/secret-room/messages'))))
  it('multi-dot invitee email reads (rules replace() matches ALL dots, like client encodeEmail)', () =>
    assertSucceeds(get(ref(dbAs(MULTI_DOT_INVITEE), 'rooms/secret-room/messages'))))
  it('unauthenticated cannot write messages or reactions', async () => {
    await assertFails(set(ref(dbAs(null), 'rooms/secret-room/messages/mF'), msg))
    await assertFails(set(ref(dbAs(null), 'rooms/secret-room/reactions/m1/1F600/c1'), 'Anon'))
  })
  it('uninvited (but signed-in) cannot write messages or reactions', async () => {
    const rando = { email: 'rando@x.com', email_verified: true }
    await assertFails(set(ref(dbAs(rando), 'rooms/secret-room/messages/mF'), msg))
    await assertFails(set(ref(dbAs(rando), 'rooms/secret-room/reactions/m1/1F600/c1'), 'Rando'))
  })
  it('cross-room isolation: secret-room invitee cannot write in secret-two', () =>
    assertFails(set(ref(dbAs(INVITEE), 'rooms/secret-two/messages/mX'), msg)))
  it('outsiders cannot bump a private room lastActivityAt', () =>
    assertFails(set(ref(dbAs(null), 'roomsIndex/secret-room/lastActivityAt'), 999)))
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
