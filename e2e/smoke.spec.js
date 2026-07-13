import { test, expect } from '@playwright/test'
import { seedRoom, wipeDb, join } from './helpers.js'

const nameA = 'TestA'
const nameB = 'TestB'
const msgText = 'hello from A'
// Not a substring of the panel header "Thread replying to …" (strict mode)
const replyText = 'a reply from B'

test.beforeAll(async () => {
  await wipeDb()
  await seedRoom('lobby', { name: 'Lobby' })
})

test('two users chat, react, thread, and see typing', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()

  await join(a, '/lobby', nameA)
  await join(b, '/lobby', nameB)

  // A sends; both sides see it
  await a.getByTestId('composer-input').fill(msgText)
  await a.getByTestId('send-button').click()
  await expect(a.getByText(msgText)).toBeVisible()
  await expect(b.getByText(msgText)).toBeVisible()

  const bubbleOnB = b.locator('[data-testid^="message-"]', { hasText: msgText }).first()
  const bubbleOnA = a.locator('[data-testid^="message-"]', { hasText: msgText }).first()

  // B reacts 💜 → A sees the chip with count 1 (actions appear on hover)
  await bubbleOnB.hover()
  await bubbleOnB.getByTestId('add-reaction').click()
  await bubbleOnB.getByTestId('pick-💜').click()
  await expect(bubbleOnA.getByTestId('reaction-chip-💜')).toContainText('1')

  // B replies in thread → A sees the reply count
  await bubbleOnB.hover()
  await bubbleOnB.locator('[data-testid^="open-thread-"]').click()
  const panel = b.getByTestId('thread-panel')
  await expect(panel).toBeVisible()
  await panel.getByTestId('composer-input').fill(replyText)
  await panel.getByTestId('send-button').click()
  await expect(panel.getByText(replyText)).toBeVisible()
  await b.getByTestId('close-thread').click()
  await expect(bubbleOnA.locator('[data-testid^="thread-count-"]')).toContainText('1 reply')

  // A types → B sees the typing indicator with A's name
  await a.getByTestId('composer-input').pressSequentially('thinking…', { delay: 80 })
  await expect(b.getByText(`${nameA} is typing`)).toBeVisible()

  // :emoji: autocomplete — ':fir' suggests 🔥, Enter inserts it
  await a.getByTestId('composer-input').pressSequentially(' :fir', { delay: 40 })
  await expect(a.getByTestId('suggest-fire')).toBeVisible()
  await a.keyboard.press('Enter')
  await expect(a.getByTestId('composer-input')).toHaveValue('thinking… 🔥')

  await ctxA.close()
  await ctxB.close()
})
