import { test, expect, type Page, type BrowserContext } from '@playwright/test'

// TWO PEOPLE, ONE DEAL, ONE FACT FIND.
//
// 14 Sep 2026. Kylie, with Melissa in the same deal card:
//
//   "If I tick the box after a few seconds - it unticks it."
//   "If I remove a data - it goes back."
//
// Every other robot here drives ONE window. This is the first that opens two on
// the same deal at once, because that is the only place this fault lives - and
// it is the fault that has cost the team the most.
//
// IT TYPES INTO INTERNAL NOTES AND TICKS NOTHING ELSE. Internal notes are not
// client facing and not read by any rule, so a robot may safely write in them.
// Both windows put back what they found.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''
const MARK = () => `robot ${Date.now()}`

async function openFactFind(page: Page) {
  await page.goto(`/deals/${DEAL}`)
  await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /^Fact Find$/ }).click()
  await page.getByText('INTERNAL NOTES').waitFor({ timeout: 20_000 })
}

const notes = (page: Page) => page.locator('textarea').first()

test.describe('two people in the same deal', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('what one person types does not disappear when the other saves', async ({ browser }) => {
    // Two contexts, one signed-in session. Not two people strictly - but two
    // independent browsers with their own state, their own autosave timers and
    // their own live subscription, which is the mechanism under test.
    const a: BrowserContext = await browser.newContext({ storageState: '.auth/portal.json' })
    const b: BrowserContext = await browser.newContext({ storageState: '.auth/portal.json' })
    const kylie = await a.newPage()
    const melissa = await b.newPage()

    try {
      await openFactFind(kylie)
      await openFactFind(melissa)

      const original = await notes(kylie).inputValue()
      const mine = `${original}\n${MARK()} — KYLIE`

      // KYLIE TYPES. Then waits long enough for her own save to land.
      await notes(kylie).fill(mine)
      await kylie.waitForTimeout(4000)

      // MELISSA, whose screen was loaded BEFORE any of that, now saves. Her
      // browser holds the record as it was when she opened it.
      await notes(melissa).click()
      await notes(melissa).press('End')
      await notes(melissa).type(' ')
      await melissa.waitForTimeout(4000)

      // AND KYLIE'S SCREEN, A MOMENT LATER.
      await kylie.waitForTimeout(4000)
      const after = await notes(kylie).inputValue()

      console.log('\n' + '='.repeat(70))
      console.log('WHAT KYLIE TYPED IS STILL THERE: ' + (after.includes('KYLIE') ? 'yes' : 'NO — IT WAS LOST'))
      console.log('='.repeat(70) + '\n')

      expect(after, 'the other window saving wiped what this one typed').toContain('KYLIE')

      // And it is in the database, not just on the screen.
      await kylie.reload()
      await kylie.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })
      await kylie.getByRole('button', { name: /^Fact Find$/ }).click()
      await kylie.getByText('INTERNAL NOTES').waitFor({ timeout: 20_000 })
      expect(await notes(kylie).inputValue(),
        'it survived on screen but never reached the database').toContain('KYLIE')
    } finally {
      // Put the notes back exactly as they were found.
      try {
        await openFactFind(kylie)
        const back = (await notes(kylie).inputValue()).replace(/\n?robot \d+ — KYLIE ?/g, '')
        await notes(kylie).fill(back.trimEnd())
        await kylie.waitForTimeout(4000)
      } catch { /* reported by the assertions above */ }
      await a.close(); await b.close()
    }
  })

  test('a tick box does not untick itself when the other window saves', async ({ browser }) => {
    // THE EXACT REPORT. Kylie, 14 Sep 2026: "If I tick the box after a few
    // seconds - it unticks it."
    //
    // A tick produces no keydown, so until 14 Sep the "wait until they stop"
    // protection did not cover it at all - an update landing a second after the
    // click went straight over the top.
    //
    // IT LOOKS FOR A TICK BOX WHEREVER ONE LIVES. The first version went
    // straight to Other assets and found none, because that deal has no assets -
    // and a test that cannot find its control is a test that proves nothing.
    // Ownership boxes appear on assets, properties and liabilities, and there are
    // yes/no boxes on the personal and employment panes, so it walks the panes
    // until it finds one.
    const PANES = ['Personal & address', 'Employment', 'Income', 'Other assets', 'Properties', 'Liabilities']

    const a = await browser.newContext({ storageState: '.auth/portal.json' })
    const b = await browser.newContext({ storageState: '.auth/portal.json' })
    const kylie = await a.newPage()
    const melissa = await b.newPage()
    // Held out here so the restore below puts it back to what it ACTUALLY was.
    let was: boolean | null = null
    let usedPane = ''
    // What the other window's text box held, so it goes back exactly as found.
    let fieldWas: string | null = null
    let restoreField: (() => Promise<void>) | null = null

    try {
      await openFactFind(kylie)
      await openFactFind(melissa)

      let boxes = kylie.locator('input[type="checkbox"]')
      let count = 0
      for (const pane of PANES) {
        const tab = kylie.getByRole('button', { name: new RegExp(`^${pane.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })
        if (await tab.count() === 0) continue
        await tab.first().click()
        await kylie.waitForTimeout(800)
        boxes = kylie.locator('input[type="checkbox"]')
        count = await boxes.count()
        console.log(`  ${pane}: ${count} tick box(es)`)
        if (count > 0) { usedPane = pane; break }
      }

      expect(count,
        'No tick box anywhere in the Fact Find on this deal, so there is nothing to check. '
        + 'Point PORTAL_TEST_DEAL_ID at a deal with an applicant, an asset or a liability on it.')
        .toBeGreaterThan(0)

      console.log(`\nUsing the first tick box on: ${usedPane}`)
      const box = boxes.first()
      was = await box.isChecked()
      if (was) await box.uncheck(); else await box.check()
      const wanted = !was
      expect(await box.isChecked()).toBe(wanted)
      console.log(`Set it to: ${wanted ? 'ticked' : 'unticked'} (it was ${was ? 'ticked' : 'unticked'})`)

      // MELISSA SAVES THE FACT FIND - NOT THE NOTES.
      //
      // The first version of this test had her type into internal notes, which
      // is a different column entirely: her save never produced a Fact Find
      // update for Kylie's screen to mishandle, so the test passed with the fix
      // and passed without it. It proved nothing. She edits the same record
      // Kylie is ticking in now.
      await melissa.getByRole('button', { name: new RegExp(`^${usedPane.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click()
      await melissa.waitForTimeout(800)
      const field = melissa.locator('input[type="text"]:visible, input:not([type]):visible').first()
      expect(await field.count(),
        'No text box on this pane for the other window to edit, so this test cannot '
        + 'make the two screens disagree.').toBeGreaterThan(0)
      fieldWas = await field.inputValue()
      await field.fill(`${fieldWas} `)
      await melissa.waitForTimeout(4000)
      restoreField = async () => { await field.fill(fieldWas as string); await melissa.waitForTimeout(3000) }

      // Kylie waits, doing nothing - which is precisely when it used to flip back.
      await kylie.waitForTimeout(5000)

      const still = await box.isChecked()
      console.log('\n' + '='.repeat(70))
      console.log('THE BOX IS STILL AS KYLIE LEFT IT: ' + (still === wanted ? 'yes' : 'NO - IT WENT BACK BY ITSELF'))
      console.log('='.repeat(70) + '\n')

      expect(still, 'the box went back to what the other window thought it was').toBe(wanted)
    } finally {
      try { if (restoreField) await restoreField() } catch { /* reported above */ }
      try {
        if (was !== null && usedPane) {
          const tab = kylie.getByRole('button', { name: new RegExp(`^${usedPane.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })
          await tab.first().click()
          await kylie.waitForTimeout(500)
          const box = kylie.locator('input[type="checkbox"]').first()
          if (was) await box.check(); else await box.uncheck()
          await kylie.waitForTimeout(3000)
        }
      } catch { /* reported by the assertions above */ }
      await a.close(); await b.close()
    }
  })
})
