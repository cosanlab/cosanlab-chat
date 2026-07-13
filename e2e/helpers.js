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
