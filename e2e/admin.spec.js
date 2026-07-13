import { test, expect } from '@playwright/test'
import { wipeDb, seedAdmin } from './helpers.js'

const ADMIN_EMAIL = 'boss@cosanlab.test'

// The auth emulator serves a fake Google account chooser in the popup;
// "Add new account" fabricates a verified Google user with any email.
async function signInWithGooglePopup(page, email, displayName) {
  const popupPromise = page.waitForEvent('popup')
  await page.getByTestId('admin-google-signin').click()
  const popup = await popupPromise
  // The chooser's markup paints before its JS attaches handlers; a fast click
  // can land in that gap and silently do nothing (the add-user form — present
  // but display:none — then never opens). Re-click until the form is visible.
  const addAccount = popup.getByRole('button', { name: /add new account/i })
  const form = popup.locator('#main-form')
  await expect(async () => {
    await addAccount.click()
    await form.waitFor({ state: 'visible', timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await popup.getByLabel(/email/i).fill(email)
  await popup.getByLabel(/display name/i).fill(displayName)
  await popup.getByRole('button', { name: /sign in/i }).click()
}

async function signInAsAdmin(page) {
  await page.goto('/admin')
  await signInWithGooglePopup(page, ADMIN_EMAIL, 'Boss')
  await expect(page.getByTestId('room-table')).toBeVisible()
}

test.beforeEach(async () => {
  await wipeDb()
  await seedAdmin('boss@cosanlab,test') // ','-encoded key for boss@cosanlab.test
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
  // wait for the lock to land (row status flips to "locked") before reloading
  await expect(page.getByTestId('room-row-lab-meeting')).toContainText('locked')

  // participant sees the lock after reload
  await user.reload()
  await expect(user.getByTestId('locked-banner')).toBeVisible()
  await expect(user.getByTestId('composer-locked')).toBeVisible()
})

test('non-admin google user is refused', async ({ page }) => {
  await wipeDb() // no adminEmails at all
  await page.goto('/admin')
  await signInWithGooglePopup(page, 'rando@nowhere.test', 'Rando')
  await expect(page.getByTestId('not-admin')).toBeVisible()
})
