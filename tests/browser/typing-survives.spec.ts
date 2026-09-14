import { test, expect, type Page } from '@playwright/test'

// DOES WHAT YOU TYPE SURVIVE - ON EVERY TAB, NOT THE ONE SOMEBODY COMPLAINED ABOUT.
//
// 14 Sep 2026. Fabio: "why are we just fixing one box and not checking all?"
// Fair. Today went: the internal notes box was destroying notes, so it was
// fixed. Then a robot happened to trip over the same shape on Compliance. Then
// the same shape again on Lending Options. Three instances of one fault, found
// one at a time, by accident, over several hours - while the team kept losing
// work.
//
// This is the test that should have existed first. It does not know about any
// particular box. For every tab it opens it, types into a box IMMEDIATELY - the
// window where a late read from the database lands on top of you - waits, then
// RELOADS and checks the words are still there.
//
// A tab that fails this is losing somebody's work. It does not matter which box
// or why.
//
// IT PUTS EVERYTHING BACK. Each field's original value is recorded first and
// restored at the end, whatever happened in between. It only ever types into
// textareas - notes and comment boxes - never into a figure or a name.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''
const TABS = ['Fact Find', 'BC — Borrowing capacity', 'Lending options', 'Compliance']

async function openDeal(page: Page) {
  await page.goto(`/deals/${DEAL}`)
  await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })
}

test.describe('what you type survives, on every tab', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  for (const tab of TABS) {
    test(`${tab}: typing the moment it opens is not thrown away`, async ({ page }) => {
      const mark = `robot${Date.now()}`
      // Every box on the tab, not the first one. The first visible textarea on
      // every tab is the internal notes box, so testing only that would have
      // re-tested this morning's fix four times and told us nothing about
      // Purpose and Goals, the BC summary, or the nine compliance boxes.
      const MAX = 14
      let originals: string[] = []

      const openTab = async () => {
        await openDeal(page)
        const button = page.getByRole('button', { name: new RegExp(`^${tab.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}$`) })
        if (await button.count() === 0) test.skip(true, `No ${tab} tab on this deal.`)
        await button.first().click()
      }

      try {
        await openTab()

        // NO PAUSE. This is the whole point - a tab is usable the instant it
        // draws, and a read that started when it drew lands a moment later.
        const boxes = page.locator('textarea:visible')
        await boxes.first().waitFor({ timeout: 20_000 })
        const count = Math.min(await boxes.count(), MAX)
        expect(count, `No text boxes found on ${tab}.`).toBeGreaterThan(0)

        for (let i = 0; i < count; i++) {
          const b = boxes.nth(i)
          const was = await b.inputValue().catch(() => null)
          if (was === null || await b.isEditable().catch(() => false) === false) { originals.push('\u0000'); continue }
          originals.push(was)
          await b.fill(`${was}\n${mark}-${i}`)
        }

        // Long enough for any late read, any autosave and any live update.
        await page.waitForTimeout(6000)

        const onScreen: number[] = []
        for (let i = 0; i < count; i++) {
          if (originals[i] === '\u0000') continue
          const v = await boxes.nth(i).inputValue().catch(() => '')
          if (!v.includes(`${mark}-${i}`)) onScreen.push(i)
        }

        // AND IT IS ACTUALLY IN THE DATABASE. Surviving on screen and never
        // being written is the worse version of this fault: it looks saved.
        await openTab()
        const after = page.locator('textarea:visible')
        await after.first().waitFor({ timeout: 20_000 })
        const lost: number[] = []
        for (let i = 0; i < count; i++) {
          if (originals[i] === '\u0000') continue
          const v = await after.nth(i).inputValue().catch(() => '')
          if (!v.includes(`${mark}-${i}`)) lost.push(i)
        }

        console.log('\n' + '='.repeat(70))
        console.log(`${tab} - ${count} text box(es) typed into the moment the tab opened`)
        console.log(`  replaced on screen  : ${onScreen.length ? 'BOXES ' + onScreen.join(', ') : 'none'}`)
        console.log(`  never saved         : ${lost.length ? 'BOXES ' + lost.join(', ') : 'none'}`)
        console.log('='.repeat(70) + '\n')

        expect(onScreen, `${tab}: something put itself on top of boxes ${onScreen.join(', ')} while they were being typed in`).toEqual([])
        expect(lost, `${tab}: boxes ${lost.join(', ')} looked saved on screen and were never written`).toEqual([])
      } finally {
        // Put every box back exactly as it was found.
        try {
          await openTab()
          const back = page.locator('textarea:visible')
          await back.first().waitFor({ timeout: 10_000 })
          for (let i = 0; i < originals.length; i++) {
            if (originals[i] === '\u0000') continue
            await back.nth(i).fill(originals[i]).catch(() => {})
          }
          await page.waitForTimeout(5000)
        } catch { /* reported by the assertions above */ }
      }
    })
  }
})
