import { test, expect } from '@playwright/test'
import { seedRoom, wipeDb } from './helpers.js'

const AUTH = 'http://127.0.0.1:9099'
const INVITEE = 'vip@cosanlab.test'

// Pull the magic-link oob code the auth emulator recorded for this email.
// (The emulator "sends" no real mail; it exposes pending codes over REST.)
async function fetchSignInLink(email) {
  const res = await fetch(`${AUTH}/emulator/v1/projects/demo-cosanlab/oobCodes`)
  if (!res.ok) throw new Error(`oobCodes: ${res.status}`)
  const { oobCodes = [] } = await res.json()
  const entry = oobCodes.find((c) => c.requestType === 'EMAIL_SIGNIN' && c.email === email)
  if (!entry) throw new Error(`no EMAIL_SIGNIN oob code for ${email}`)
  return entry.oobLink
}

test.beforeEach(async () => {
  await wipeDb()
  await seedRoom('lab-secrets', {
    name: 'Lab Secrets',
    isPrivate: true,
    invited: { 'vip@cosanlab,test': true }, // ','-encoded key for vip@cosanlab.test
  })
})

test('denied visitor signs in via magic link and reaches the name-join screen', async ({ page }) => {
  // Unauthenticated visit to a private room → EmailGate
  await page.goto('/lab-secrets')
  await page.getByTestId('gate-email-input').waitFor()

  // Request the sign-in link (sendSignInLinkToEmail against the emulator)
  await page.getByTestId('gate-email-input').fill(INVITEE)
  await page.getByTestId('gate-email-send').click()
  await expect(page.getByTestId('link-sent')).toBeVisible()

  // "Open the email": grab the oob link and rewrite it onto the app origin,
  // keeping the query params (mode/oobCode/apiKey) that completeMagicLink
  // needs. localStorage still holds the pending email from the gate submit,
  // so the app finishes sign-in on boot — no manual reload afterwards.
  const oobLink = new URL(await fetchSignInLink(INVITEE))
  const target = new URL(oobLink.searchParams.get('continueUrl'))
  for (const [k, v] of oobLink.searchParams) {
    if (k !== 'continueUrl') target.searchParams.set(k, v)
  }
  await page.goto(target.toString())

  // Signed in + invited → the gate gives way to the name-join screen
  await expect(page.getByTestId('name-input')).toBeVisible()
  await expect(page.getByTestId('gate-email-input')).not.toBeVisible()
})
