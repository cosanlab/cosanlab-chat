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
  // Serve the image locally so the test never depends on outbound network;
  // the app's URL-detection + <img> unfurl path is exercised unchanged.
  const PNG_1PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page.route('**/Cat03.jpg', (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1PX }),
  )
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
