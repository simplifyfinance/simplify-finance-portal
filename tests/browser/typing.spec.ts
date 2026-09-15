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

  // A SECOND WINDOW THAT ACTUALLY SAVES.
  //
  // 15 Sep 2026. The test below opens a second window and leaves it sitting
  // there, which is why it has passed all week while Kylie lost letters. A
  // window that only LOOKS at a deal never saves, so the merge that rewrites
  // the box being typed in never runs.
  //
  // This one types into a different box in the second window, over and over,
  // while the first window types a long note. That is Kylie and Melissa in
  // Jacob Joson: two people, different boxes, one record saved whole.
  test('a second window SAVING costs no letters', async ({ page, context }) => {
    const second = await context.newPage()
    await second.goto(`/deals/${DEAL}`)
    await second.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await second.getByRole('button', { name: /BC — Borrowing capacity/ }).click()
    const other = second.getByLabel(/Important things to note/i)
    await expect(other).toBeVisible({ timeout: 20_000 })
    const originalOther = await other.inputValue()

    const box = await openBcNotes(page)
    await box.click()
    await box.press('Meta+a')
    await box.press('Delete')

    try {
      // Type the note in the first window while the second keeps saving. Every
      // burst in the second window is over the 700ms debounce, so a save lands
      // in the middle of the first window's sentence - repeatedly.
      const typing = box.pressSequentially(NOTE, { delay: 25 })
      for (let i = 0; i < 4; i++) {
        await other.click()
        await other.pressSequentially(` robot ${i}`, { delay: 20 })
        await second.waitForTimeout(900)
      }
      await typing

      // The letters test, on the window that was being typed in.
      expect(await box.inputValue(), 'characters were lost while the other window saved').toBe(NOTE)

      // And it is the database's answer that counts.
      await page.waitForTimeout(5_000)
      await page.reload()
      await expect(page.getByLabel(/Broker summary notes/i)).toHaveValue(NOTE, { timeout: 20_000 })
    } finally {
      // Put the other box back however this went.
      await other.click()
      await other.press('Meta+a')
      await other.press('Delete')
      if (originalOther) await other.fill(originalOther)
      await second.waitForTimeout(2_000)
      await second.close()
    }
  })

  // THE SAME THING ON THE FACT FIND.
  //
  // 15 Sep 2026. The rule now covers every free typing box on all four tabs,
  // not just the two on BC. This proves it where the tab holds everything in
  // ONE object and replaces it wholesale - a different mechanism from BC's
  // separate setters, and the one that needed keepOwned().
  //
  // TWO THINGS THIS GOT WRONG FIRST TIME, 15 Sep 2026:
  //
  //   1. IT ASSUMED A RELOAD COMES BACK ON THE SAME TAB. It does not - the deal
  //      page draws whichever tab it draws, and the screenshot from the failure
  //      shows BC. So the box being checked was not on screen at all, and the
  //      test sat waiting for it until its time ran out. The tab is clicked
  //      again after the reload now.
  //   2. IT DID NOT FIT IN SIXTY SECONDS. Two windows, a long sentence typed a
  //      character at a time, four bursts in the other window, a wait for the
  //      database and a reload does not fit in the default budget. It gets its
  //      own.
  test('Fact Find: a second window SAVING costs no letters', async ({ page, context }) => {
    test.setTimeout(150_000)
    const GOALS = "Richard and Letitia want to be in the new place before the "
      + "school year starts, and to keep the offset topped up."

    const second = await context.newPage()
    await second.goto(`/deals/${DEAL}`)
    await second.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await second.getByRole('button', { name: /^Fact Find$/ }).click()
    const other = second.getByLabel(/Goals — 2 to 10 years/i)
    await expect(other).toBeVisible({ timeout: 20_000 })
    const originalOther = await other.inputValue()

    await page.goto(`/deals/${DEAL}`)
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: /^Fact Find$/ }).click()
    const box = page.getByLabel(/Goals — next 2 years/i)
    await expect(box).toBeVisible({ timeout: 20_000 })
    const originalMine = await box.inputValue()

    try {
      await box.click()
      await box.press('Meta+a')
      await box.press('Delete')

      const typing = box.pressSequentially(GOALS, { delay: 25 })
      for (let i = 0; i < 3; i++) {
        await other.click()
        await other.pressSequentially(` robot ${i}`, { delay: 20 })
        await second.waitForTimeout(900)
      }
      await typing

      // THE LETTERS TEST. This is the one that matters and it happens before
      // anything is reloaded.
      expect(await box.inputValue(), 'characters were lost while the other window saved').toBe(GOALS)

      // BACK TO THE FRONT BEFORE ASKING THE DATABASE.
      //
      // 15 Sep 2026, and this cost a run to find. Clicking into the second
      // window puts this one in the BACKGROUND, and Chrome throttles a
      // background tab's timers - so the 600ms autosave simply does not run.
      // The first version of this test typed the rest of the sentence into a
      // backgrounded tab and then asked the database for it: it held the 33
      // characters written when the tab was hidden and nothing after.
      //
      // That is not what Kylie does. She types in the window she is looking at.
      await page.bringToFront()
      await box.click()
      await page.waitForTimeout(5_000)

      // WHAT THE PAGE ITSELF SAYS.
      //
      // 15 Sep 2026. This has now failed twice with the sentence perfect on
      // screen and the database holding only the first 33 characters, and I
      // have been wrong twice about why. So it reports rather than guesses:
      // what is in the box, what the page says about saving it, and what comes
      // back after the reload. Read the three lines together.
      const said = await page.locator('body').innerText()
      const stamp = (said.match(/Autosaved[^\n]*/) || ['(no Autosaved stamp)'])[0]
      const failed = (said.match(/NOT SAVED[^\n]*/) || ['(no save error)'])[0]
      console.log('\n=== FACT FIND, TWO WINDOWS ===')
      console.log('  typed          : ' + GOALS.length + ' characters')
      console.log('  in the box     : ' + (await box.inputValue()).length + ' characters')
      console.log('  the page says  : ' + stamp)
      console.log('                 : ' + failed)
      await page.reload()
      await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
      await page.getByRole('button', { name: /^Fact Find$/ }).click()
      const after = page.getByLabel(/Goals — next 2 years/i)
      await after.waitFor({ timeout: 20_000 })
      console.log('  after reload   : ' + (await after.inputValue()).length + ' characters')
      console.log('==============================\n')
      await expect(after).toHaveValue(GOALS, { timeout: 20_000 })
    } finally {
      // Put both boxes back however this went. Cleanup must never be the thing
      // that reports a failure - the real one would be hidden behind it.
      try {
        await other.click(); await other.press('Meta+a'); await other.press('Delete')
        if (originalOther) await other.fill(originalOther)
        await second.waitForTimeout(1_500)
      } catch { /* the window may already be gone */ }
      await second.close().catch(() => {})
      try {
        await page.getByRole('button', { name: /^Fact Find$/ }).click({ timeout: 10_000 })
        const mine = page.getByLabel(/Goals — next 2 years/i)
        await mine.click({ timeout: 10_000 })
        await mine.press('Meta+a'); await mine.press('Delete')
        if (originalMine) await mine.fill(originalMine)
        await page.waitForTimeout(1_500)
      } catch { /* nothing typed is left behind that the next run cannot clear */ }
    }
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
