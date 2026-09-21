import { test, expect, type Page } from '@playwright/test'

// A BRAND NEW DEAL, WHICH IS WHERE IT ACTUALLY HAPPENS.
//
// 14 Sep 2026. Kylie filled in Purpose and Goals on a brand new deal, alone in
// it, and the two goals boxes were empty afterwards. The purpose survived.
//
// The database says they were never saved rather than saved and then wiped: the
// portal always keeps a copy when a save removes content, and no kept copy of
// that deal has the goals in it.
//
// Every other robot here drives a deal that already exists and has been saved
// hundreds of times. A NEW deal is a different animal - the Fact Find tidies
// itself as it opens, matching income lines to jobs and filling defaults, and
// saves each time. Her deal was saved 39 times in its first four minutes. None
// of our tests had ever been anywhere near that.
//
// IT MAKES ONE DEAL AND REUSES IT. Deleting is not something the portal does, so
// it looks for its own deal first and only creates one if it is not there. One
// extra row in the deals list, not one per run.

const ROBOT_FIRST = 'ZZROBOT'
const ROBOT_LAST = 'Testdeal'
const PURPOSE = 'Purpose typed by the robot on a brand new deal.'
const GOALS_2 = 'Two year goals typed by the robot.'
const GOALS_10 = 'Ten year goals typed by the robot.'

async function openOrCreate(page: Page): Promise<void> {
  await page.goto('/deals')
  await page.getByPlaceholder(/Search by name, client, purpose/i).fill(ROBOT_FIRST)

  // WHERE THE ROBOT'S OWN DEAL LIVES NOW.
  //
  // 21 Sep 2026: a deal can be marked as a test, and a test deal is hidden from
  // the deals list until somebody asks for it. The robot ticks that box on its
  // way in - see below - so from here on its deal is NOT in the normal list.
  //
  // A robot that cannot find its own deal makes another one, every single ship.
  // That is precisely the pile-up this function was written to stop, and it
  // would have come straight back. So it looks twice: the normal list first,
  // which is where the deals made before any of this still are, and then behind
  // the test filter. Either is a find.
  const lookFor = () => page.getByText(new RegExp(`${ROBOT_FIRST}`, 'i')).first()

  let existing = lookFor()
  let found = await existing.waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => true).catch(() => false)

  if (!found) {
    // Only drawn when there is at least one test deal, so its absence is normal
    // and means there is nothing behind it to find.
    const testFilter = page.getByRole('button', { name: /Test deals \(\d+\)/ })
    if (await testFilter.count() > 0) {
      await testFilter.first().click()
      existing = lookFor()
      found = await existing.waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true).catch(() => false)
    }
  }

  if (found) {
    await existing.click()
    await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })
    return
  }

  // Not there yet. Make it, the same way a person would.
  await page.getByRole('button', { name: /New deal/i }).click()

  // BY POSITION, NOT BY LABEL.
  //
  // The labels in this dialog are plain text next to their boxes - no htmlFor,
  // no id, no aria-label - so getByLabel finds nothing and waits until the test
  // times out. That has now cost four separate test failures across this repo
  // (the compliance boxes, the fact find, Settings, and this). It is worth
  // fixing in the app; until then this locates the boxes where they are.
  //
  // The New client pane holds, in order: first name, last name, email, phone.
  const dialog = page.locator('div.fixed.inset-0')
  await dialog.getByRole('button', { name: /^New client$/ }).click()
  const boxes = dialog.locator('input[type="text"]')
  await boxes.first().waitFor({ timeout: 20_000 })
  await boxes.nth(0).fill(ROBOT_FIRST)
  await boxes.nth(1).fill(ROBOT_LAST)

  // A BROKER HAS TO BE PICKED or Create stays disabled - unless the signed-in
  // account IS a broker, in which case the dropdown is not drawn at all and
  // their own key is used. Both are normal.
  //
  // The list is fetched after the dialog opens, so reading it straight away
  // finds only the "- select broker -" placeholder. Waited for.
  const broker = dialog.locator('select').first()
  if (await broker.count() > 0) {
    await expect(broker.locator('option'),
      'The broker list never loaded, so a deal cannot be created.')
      .not.toHaveCount(1, { timeout: 20_000 })
    const options = await broker.locator('option').evaluateAll(
      els => els.map(e => (e as HTMLOptionElement).value).filter(Boolean))
    await broker.selectOption(options[0])
  }


  // THE ROBOT MARKS ITS OWN.
  //
  // A deal left behind by a run that stopped halfway used to sit in the book
  // looking like a client - there were three of them on 21 September. Ticked
  // here, a leftover is counted nowhere, cannot email anybody and records no
  // lender rate, and clearing it is one click on the test filter.
  await dialog.getByText('This is a test deal').click()

  await page.getByRole('button', { name: /^Create deal$/ }).click()
  await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })
}

const purpose = (p: Page) => p.getByLabel('Purpose of loan / primary reason for finance')
const goals2 = (p: Page) => p.getByLabel('Goals — next 2 years')
const goals10 = (p: Page) => p.getByLabel('Goals — 2 to 10 years')

test.describe('a brand new deal', () => {
  test('Purpose and both Goals are still there after a reload', async ({ page }) => {
    await openOrCreate(page)

    await page.getByRole('button', { name: /^Fact Find$/ }).click()
    await purpose(page).waitFor({ timeout: 20_000 })

    // TYPED THE WAY SHE TYPED THEM: straight down the three boxes, no waiting
    // between them, on a deal that is still settling itself.
    await purpose(page).fill(PURPOSE)
    await goals2(page).fill(GOALS_2)
    await goals10(page).fill(GOALS_10)

    // Long enough for every autosave, tidy-up and late read to have happened.
    await page.waitForTimeout(8000)

    const onScreen = {
      purpose: await purpose(page).inputValue(),
      goals2: await goals2(page).inputValue(),
      goals10: await goals10(page).inputValue(),
    }

    await page.reload()
    await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: /^Fact Find$/ }).click()
    await purpose(page).waitFor({ timeout: 20_000 })

    const stored = {
      purpose: await purpose(page).inputValue(),
      goals2: await goals2(page).inputValue(),
      goals10: await goals10(page).inputValue(),
    }

    console.log('\n' + '='.repeat(70))
    console.log('BRAND NEW DEAL — Purpose and Goals')
    console.log(`  purpose   on screen: ${onScreen.purpose === PURPOSE ? 'kept' : 'LOST'}   after reload: ${stored.purpose === PURPOSE ? 'kept' : 'LOST'}`)
    console.log(`  2yr goals on screen: ${onScreen.goals2 === GOALS_2 ? 'kept' : 'LOST'}   after reload: ${stored.goals2 === GOALS_2 ? 'kept' : 'LOST'}`)
    console.log(`  10yr goals on screen: ${onScreen.goals10 === GOALS_10 ? 'kept' : 'LOST'}   after reload: ${stored.goals10 === GOALS_10 ? 'kept' : 'LOST'}`)
    console.log('='.repeat(70) + '\n')

    expect(onScreen.purpose, 'the purpose was taken off the screen').toBe(PURPOSE)
    expect(onScreen.goals2, 'the 2 year goals were taken off the screen').toBe(GOALS_2)
    expect(onScreen.goals10, 'the 10 year goals were taken off the screen').toBe(GOALS_10)

    expect(stored.purpose, 'the purpose never reached the database').toBe(PURPOSE)
    expect(stored.goals2, 'THE 2 YEAR GOALS NEVER REACHED THE DATABASE - this is Kylie, 14 Sep 2026').toBe(GOALS_2)
    expect(stored.goals10, 'THE 10 YEAR GOALS NEVER REACHED THE DATABASE - this is Kylie, 14 Sep 2026').toBe(GOALS_10)
  })
})
