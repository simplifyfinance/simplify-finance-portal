import { test, expect } from '@playwright/test'

// THE SETTINGS THAT DECIDE WHO GETS EMAILED.
//
// 10 Sep 2026. Requesting documents got its own recipient, separate from the
// person who renames and files them when they come back. Fabio: "I want a
// separate one to request documents from the portal as I want flexibility."
//
// That needed a new column, and the save is written to survive it not being
// there: everything else saves and an alert names what is missing. Which means
// a portal where the SQL was never run looks completely normal until somebody
// tries to set it. This is what catches that.
//
// IT CHANGES NOTHING. It presses Save with every value exactly as it found them,
// which writes back what is already there. These settings decide who gets real
// emails, so a robot does not get to pick a different person.

test.describe('notification routing', () => {
  test('the request recipient can be set, and the column it needs exists', async ({ page }) => {
    // Any alert blocks the page until it is dismissed, so it is captured rather
    // than left to hang the run.
    const alerts: string[] = []
    page.on('dialog', async d => { alerts.push(d.message()); await d.dismiss() })

    await page.goto('/settings')

    // SETTINGS IS ADMIN ONLY, and the robot may not be one.
    //
    // app/(app)/settings/page.tsx redirects anybody whose role is not admin
    // straight to /deals. The robot signs in as whoever .auth/portal.json holds,
    // so on a non-admin account it lands on the deals list and every locator
    // here fails with "element(s) not found" - which reads like a broken page
    // and is not one.
    //
    // 10 Sep 2026: I chased that for three ships, first blaming the labels.
    // It skips with a reason now, rather than failing the ship every time.
    await page.waitForLoadState('domcontentloaded')
    if (!/\/settings/.test(page.url())) {
      test.skip(true, 'The signed-in robot account is not an admin, so Settings cannot be opened. '
        + 'Sign in as an admin with ./scripts/portal-login.sh to run this.')
    }

    // The four rows, in the order they read on the screen.
    const requestRow = page.getByLabel('When documents are requested — who raises them on SalesTrekker')
    const fileRow = page.getByLabel('When documents are received — who renames and files them')
    await expect(requestRow).toBeVisible({ timeout: 20_000 })
    await expect(fileRow).toBeVisible()

    // It offers the team, not an empty dropdown.
    const options = await requestRow.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(1)
    expect(options[0]).toContain('same as the person below')

    // What it is set to right now, so it can be put back exactly.
    const before = await requestRow.inputValue()

    // SAVE WITH NOTHING CHANGED. If the column is missing the save falls back,
    // strips it, and alerts - which is the only way to tell from the outside
    // that the SQL was never run.
    await page.getByRole('button', { name: /^Save settings$/ }).click()
    await page.waitForTimeout(2500)

    const complaint = alerts.find(a => /docs_request_notification_user_id|database is missing/i.test(a))
    expect(complaint,
      `Settings could not save the request recipient. The column is missing — run the ALTER TABLE on settings. Alert was: ${complaint}`)
      .toBeUndefined()

    // Nothing was changed, and nothing is left changed.
    expect(await requestRow.inputValue()).toBe(before)
    expect(alerts.filter(a => /error/i.test(a))).toHaveLength(0)
  })
})
