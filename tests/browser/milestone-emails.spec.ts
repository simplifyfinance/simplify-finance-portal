import { test, expect } from '@playwright/test'

// THE CLIENT EMAILS, LOOKED AT BY A ROBOT.
//
// READ ONLY, AND EMPHATICALLY SO. This spec opens the send screen, reads the
// preview and closes it. It never attaches anything and never presses Send -
// pressing Send emails a real person about a real loan, which is not something a
// robot gets to do. The one thing it does press is the tick on a block, because
// the whole promise of this screen is that the email underneath redraws when you
// do, and nothing but a real browser can prove that.
//
// WHAT IT IS ACTUALLY GUARDING. The three PDFs were unreachable on a lodged deal
// for a fortnight and nobody knew until Fabio tried to open one. The unit tests
// said the buttons existed. They did - underneath a disabled fieldset. Only a
// browser can tell you whether a person can press a thing.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.describe('the client emails', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('all three are listed, and the ready one opens and previews', async ({ page }) => {
    await page.goto(`/deals/${DEAL}`)
    await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })

    // THE EMAILS LIVE BEHIND ONE WORD IN THE HEADER NOW, not in a band across
    // the top - one-inside-the-deal-v4.html. So this opens the menu before
    // looking for them, rather than reading them off the page.
    const strip = page.getByRole('button', { name: /Client emails/ }).first()
    await expect(strip).toBeVisible({ timeout: 15_000 })
    await strip.click()
    await page.getByText('Send to the client').waitFor({ timeout: 10_000 })

    const body = await page.locator('body').innerText()

    // EVERY ONE IS LISTED, whether it can go or not. A button that has vanished
    // is a question somebody has to ask somebody else.
    for (const name of ['Pre-approval', 'Pre-approval extension', 'Formal approval']) {
      expect(body, `${name} is not on the deal at all`).toContain(name)
    }

    // The ones that can be pressed are real buttons; the ones that cannot are
    // plain text with the reason on them. Exact names, because "Pre-approval" is
    // inside "Pre-approval extension" and a loose match resolves to two.
    const pressable = page.getByRole('button', { name: /^(Pre-approval|Pre-approval extension|Formal approval)\b/ })
    const count = await pressable.count()

    console.log('\n' + '='.repeat(66))
    console.log(`CLIENT EMAILS — ${count} pressable on this deal`)
    console.log('='.repeat(66))
    for (let i = 0; i < count; i++) console.log('   ' + (await pressable.nth(i).innerText()).replace(/\n/g, ' '))

    if (count === 0) {
      // A deal that has reached no milestone yet. Nothing to open, and that is a
      // correct state rather than a failure - but say so, so a silent pass is
      // never mistaken for a tested one.
      console.log('   (this deal has reached no milestone yet - nothing to open)')
      expect(body).toMatch(/no pre-approval recorded|not formally approved yet/)
      return
    }

    await pressable.first().click()

    // The email itself, in an iframe, built by the server.
    const preview = page.locator('iframe[title="The email"]')
    await expect(preview).toBeVisible({ timeout: 20_000 })
    const frame = page.frameLocator('iframe[title="The email"]')
    await expect(frame.locator('body')).toContainText(/Hi |approved|pre-approval/i, { timeout: 20_000 })

    const before = await frame.locator('body').innerText()
    console.log(`   preview is ${before.length} characters`)
    expect(before.length).toBeGreaterThan(200)

    // THE LETTER IS COMPULSORY. Nothing is attached, so Send must be unpressable.
    // This is also what makes the rest of this spec safe.
    const send = page.getByRole('button', { name: /^Send$/ })
    await expect(send).toBeDisabled()

    // TICKING REDRAWS THE EMAIL. The one thing a unit test cannot say.
    const ticks = page.locator('button[aria-label^="Turn off"]')
    if (await ticks.count() > 0) {
      await ticks.first().click()
      await page.waitForTimeout(1200)
      const after = await frame.locator('body').innerText()
      expect(after, 'the email did not change when a block was turned off').not.toBe(before)
      console.log(`   turning one block off changed the email (${before.length} -> ${after.length})`)
    }

    // Still unpressable on the way out. Nothing was sent.
    await expect(send).toBeDisabled()
    await page.getByRole('button', { name: /^Close$/ }).click()
    await expect(preview).toBeHidden({ timeout: 10_000 })
  })
})
