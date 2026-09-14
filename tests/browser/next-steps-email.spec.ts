import { test, expect } from '@playwright/test'

// THE EMAIL THE CLIENT GETS WHEN THEY AGREE TO PROCEED.
//
// 11 Sep 2026. Two faults were fixed and this is the fence around both:
//
//   1. The subject was `${deal.deal_name} — what happens next`, which put our
//      internal file reference (Kylie_Searle_Purchase_2026) in front of the
//      client, and sent the IDENTICAL subject twice - once when they agree to
//      proceed, again weeks later when they pick a lender.
//   2. The whole "share your bank statements" step, button and all, vanished
//      whenever the WealthDesk link in Settings was blank. A two-step email looks
//      completely normal, so nobody would ever have found out.
//
// IT SENDS NOTHING AND MOVES NOTHING. Pressing the real button emails a real
// client and moves their deal a stage, so the robot reads the preview instead -
// a GET on the same route that builds the subject and the HTML through the same
// two functions the send uses. It never presses "Client agreed" and never
// presses "Yes, let's proceed".

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

// What the client must see, in the words they see them in.
const BC_SUBJECT = 'Next steps — your client portal and bank statements'
const LO_SUBJECT = 'Next steps — documents to sign and submission'
const BUTTON = 'Click here to share your bank statements'

test.describe('the next-steps email', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('the email that goes out when the client agrees', async ({ page }) => {
    const res = await page.request.get(`/api/send-next-steps-email?dealId=${DEAL}&stage=BC`)
    expect(res.status(), 'the preview refused - is the robot signed in? run scripts/portal-login.sh').toBe(200)
    const e = await res.json()

    console.log('\n' + '='.repeat(70))
    console.log('SUBJECT:  ' + e.subject)
    console.log('STAGE:    ' + e.stage + '   STEPS: ' + e.stepCount)
    console.log('LINK:     ' + (e.wealthDeskLink || '(BLANK)'))
    console.log('RECIPIENT ON FILE: ' + (e.hasClientEmail ? 'yes' : 'NO - nothing would be sent'))
    console.log('='.repeat(70) + '\n')

    // THE SUBJECT LINE.
    expect(e.subject, 'the subject is not the agreed wording').toBe(BC_SUBJECT)
    expect(e.subject, 'the internal file name is back in the subject').not.toMatch(/_/)
    expect(e.subject).not.toMatch(/undefined|null|\$\{/)

    // THE LINK. It is one static setting, and it is the only way a client can
    // send us their statements.
    expect(e.wealthDeskLink, 'the WealthDesk link in Settings is BLANK').toBeTruthy()
    expect(e.wealthDeskLink, 'the WealthDesk link is not an https link').toMatch(/^https:\/\//)

    // THE LINK IS ACTUALLY IN THE EMAIL, on the button, not just in the settings.
    expect(e.html, 'the button is missing from the email').toContain(BUTTON)
    expect(e.html, 'the button does not point at the WealthDesk link')
      .toContain(`href="${e.wealthDeskLink}"`)

    // THE STEP CANNOT VANISH.
    expect(e.stepCount, 'the bank statements step has gone missing again').toBe(3)
    expect(e.html).toContain('Share your bank statements')
    expect(e.html).toContain("You'll be invited to our client portal")
    expect(e.html).toContain('Your lending options presented')

    // Nothing half-rendered reaches a client.
    expect(e.html, 'an empty value rendered into the email').not.toMatch(/undefined|null<|\$\{/)
    expect(e.html, 'the greeting fell back to "there" - no first name on the client')
      .not.toContain('Great news, there!')

    // WOULD IT ACTUALLY GO ANYWHERE?
    //
    // Reported, not asserted. No address on the client means the route returns
    // "No email on file for this client" and sends nothing - which is correct
    // behaviour, and is a fact about whichever deal PORTAL_TEST_DEAL_ID happens
    // to point at rather than a fault in the code. Failing the ship over the
    // fixture's own gaps is how a gate gets ignored.
    if (!e.hasClientEmail) {
      console.log('  !! This test deal has no client email address. The subject and the link')
      console.log('     are still checked above, but a real send would go nowhere.')
    }
    expect(typeof e.hasClientEmail, 'the route stopped saying whether it has a recipient').toBe('boolean')
  })

  test('the second email, weeks later, is not the first one again', async ({ page }) => {
    const res = await page.request.get(`/api/send-next-steps-email?dealId=${DEAL}&stage=LO`)
    expect(res.status()).toBe(200)
    const e = await res.json()

    console.log('\nLO SUBJECT: ' + e.subject + '   STEPS: ' + e.stepCount + '\n')

    expect(e.subject).toBe(LO_SUBJECT)
    expect(e.subject, 'both emails carry the same subject again').not.toBe(BC_SUBJECT)
    expect(e.subject).not.toMatch(/_/)

    // This one is about signing and submission. It has no statements button.
    expect(e.stepCount).toBe(4)
    expect(e.html).toContain('Documents to review and sign')
    expect(e.html).toContain('Lender submission')
    expect(e.html, 'the statements button is on the wrong email').not.toContain(BUTTON)
  })

  test("the client's own page shows the same step and the same link", async ({ page }) => {
    // READ ONLY. The page has a "Yes, let's proceed" button on it that moves the
    // deal and emails people. It is not pressed.
    await page.goto(`/proceed/${DEAL}?from=BC`)

    // By role, not by text. "Share your bank statements" is the step's heading AND
    // a substring of the button's own label, and getByText matches substrings
    // case-insensitively - so it finds two things and Playwright refuses to guess.
    const button = page.getByRole('link', { name: BUTTON })
    await expect(button, 'the statements button is missing from the client page')
      .toBeVisible({ timeout: 20_000 })

    const body = await page.locator('body').innerText()
    expect(body, 'the bank statements step is not on the client page').toContain('Share your bank statements')
    expect(body).toContain("You'll be invited to our client portal")

    const href = await button.getAttribute('href')
    console.log('\nBUTTON ON THE PAGE POINTS AT: ' + href + '\n')
    expect(href, 'the button on the client page points nowhere').toBeTruthy()
    expect(href).toMatch(/^https:\/\//)

    await page.screenshot({ path: 'test-results/proceed-page.png', fullPage: true })
  })
})

// The link can only be blank if somebody saves it blank, so that is where it is
// stopped. This clears the box, presses Save, and expects to be refused - the
// guard returns before the upsert, so nothing is written either way. The value is
// typed back in afterwards regardless.
test('Settings refuses to save the WealthDesk link blank', async ({ page }) => {
  const alerts: string[] = []
  page.on('dialog', async d => { alerts.push(d.message()); await d.dismiss() })

  // The box lives on the Connections pane, and the pane is read from the hash.
  await page.goto('/settings#connections')

  // SETTINGS IS ADMIN ONLY, and the robot may not be one - page.tsx redirects
  // anybody else to /deals, where every locator below fails with "element(s) not
  // found", which reads like a broken page and is not one. Chased that for three
  // ships on 10 Sep 2026. It skips with a reason instead.
  await page.waitForLoadState('domcontentloaded')
  if (!/\/settings/.test(page.url())) {
    test.skip(true, 'The signed-in robot account is not an admin, so Settings cannot be opened. '
      + 'Sign in as an admin with ./scripts/portal-login.sh to run this.')
  }

  const box = page.locator('input[placeholder^="https://simplify.wealthdesk"]')
  await expect(box, 'the WealthDesk box is not on the Connections pane').toBeVisible({ timeout: 20_000 })

  const before = await box.inputValue()
  expect(before, 'the WealthDesk link is already blank in Settings').toBeTruthy()

  try {
    await box.fill('')
    await page.getByRole('button', { name: /^Save settings$/ }).click()
    await page.waitForTimeout(1500)

    const refused = alerts.find(a => /cannot be blank/i.test(a))
    expect(refused, 'Settings SAVED a blank WealthDesk link').toBeTruthy()
  } finally {
    // Put it back whatever happened above. The guard returns before the upsert,
    // so nothing was written either way - this is belt and braces.
    await page.goto('/settings#connections')
    const again = page.locator('input[placeholder^="https://simplify.wealthdesk"]')
    await again.waitFor({ timeout: 20_000 })
    await again.fill(before)
    await page.getByRole('button', { name: /^Save settings$/ }).click()
    await page.waitForTimeout(2000)
  }

  await page.goto('/settings#connections')
  const box2 = page.locator('input[placeholder^="https://simplify.wealthdesk"]')
  await expect(box2).toBeVisible({ timeout: 20_000 })
  expect(await box2.inputValue(), 'the link was not put back').toBe(before)
})
