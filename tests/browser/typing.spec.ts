import { test, expect, type Page } from '@playwright/test'

// WHAT A PERSON DOES ALL DAY, DONE BY A ROBOT.
//
// These are not clever. They type a sentence and check the sentence is there.
// That is exactly the check nobody was doing, and it is the one that would have
// caught every visible fault of the last week.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

// The exact shape of thing Kylie writes: long, apostrophes, full stops,
// percentages. The faults all showed up late in a long run, never in a word or
// two, which is why a short test would have passed all week.
const NOTE =
  "Hi Dylan and Megan, further to our conversation last week, we've finalised " +
  "your borrowing capacity. We've assumed a minimum rental yield of 4% p.a. and " +
  "used your latest payslips. The figures below are indicative only and subject " +
  "to a full assessment. Please don't hesitate to call if anything looks wrong."


async function openBcNotes(page: Page) {
  await page.goto(`/deals/${DEAL}`)
    // The page is HTML before it is a page. See data-ready in DealPageClient -
    // a click before this appears goes nowhere, which is a race, not a bug in
    // whatever was clicked.
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
  await page.getByRole('button', { name: /BC — Borrowing capacity/ }).click()
  const box = page.getByLabel(/Broker summary notes/i)
  await expect(box).toBeVisible({ timeout: 20_000 })
  return box
}

test.describe('typing into a deal', () => {
  // Signed in once, by hand, by ./scripts/portal-login.sh. Nothing here knows a
  // password, so there is nothing here to leak. Inside the describe, because
  // Playwright will not take a skip at the top of a file.
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local, and run ./scripts/portal-login.sh once.')

  // THE ONE THAT MATTERS. Kylie, 9 Sep 2026: "it is deleting letters, and
  // spaces, and dots." Typed straight through, exactly as she does it.
  //
  // Typed, saved and reloaded inside ONE test on purpose. Split across two, the
  // second depends on the first having run, and a test that only passes in
  // company is a test that lies the first time somebody runs it alone.
  test('a long note keeps every character, and survives a reload', async ({ page }) => {
    const box = await openBcNotes(page)
    await box.click()
    await box.press('Meta+a')
    await box.press('Delete')
    // Roughly a fast typist. The faults only ever appeared under a sustained
    // run, never on a slow one.
    await box.pressSequentially(NOTE, { delay: 25 })

    // Every character, before anything is saved. This is the letters test.
    expect(await box.inputValue()).toBe(NOTE)

    // WAIT FOR THE DATABASE, NOT FOR A STAMP ON THE SCREEN.
    //
    // This used to wait for the "Autosaved" line in the header. On 10 Sep it
    // never appeared, and the run failed there - with the whole note sitting
    // correctly in the box, which is the thing the test is actually for. A
    // proxy for the save was standing in front of the save itself.
    //
    // The autosave debounce is 700ms. This waits several times that and then
    // asks the database, which is the only answer that counts. Whether the
    // stamp appears is a separate question, and it gets its own test below.
    await page.waitForTimeout(5_000)

    // And now the database's answer, not the screen's.
    await page.reload()
    await expect(page.getByLabel(/Broker summary notes/i)).toHaveValue(NOTE, { timeout: 20_000 })
  })

  // THE STAMP THAT DID NOT APPEAR.
  //
  // Separate from the letters test on purpose. On 10 Sep the note typed and held
  // perfectly and no "Autosaved" line ever showed - so somebody typing has no
  // confirmation their work went in. Whether that is the stamp failing or the
  // save failing, this is the test that says which.
  test('the page says it saved', async ({ page }) => {
    const box = await openBcNotes(page)
    await box.click()
    await box.pressSequentially(' Checking the save stamp.', { delay: 25 })
    await expect(page.getByText(/Autosaved/)).toBeVisible({ timeout: 20_000 })
  })

  // The deal page used to shove the form down the screen whenever a notice
  // appeared or vanished - three of them, on three different timers.
  test('the box does not move while somebody is typing in it', async ({ page }) => {
    const box = await openBcNotes(page)
    await box.click()
    const before = await box.boundingBox()
    await box.pressSequentially(' Still here.', { delay: 25 })
    // Long enough for a save to land and any notice to come and go.
    await page.waitForTimeout(6000)
    const after = await box.boundingBox()
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    // A pixel or two of rounding is fine. Sixty is a banner.
    expect(Math.abs((after!.y) - (before!.y))).toBeLessThan(4)
  })

  // Two windows on one deal is the case that broke twice. Same person is
  // enough to prove nothing is eaten - the portal cannot tell it is a robot.
  test('a second window open on the same deal costs no letters', async ({ page, context }) => {
    const second = await context.newPage()
    await second.goto(`/deals/${DEAL}`)
    await second.waitForTimeout(3000)

    const box = await openBcNotes(page)
    await box.click()
    await box.press('Meta+a')
    await box.press('Delete')
    await box.pressSequentially(NOTE, { delay: 25 })
    await page.waitForTimeout(2500)
    expect(await box.inputValue()).toBe(NOTE)
    await second.close()
  })
})
