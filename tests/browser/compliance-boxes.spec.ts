import { test, expect, type Page } from '@playwright/test'

// THE NINE BOXES NOBODY HAS EVER OPENED.
//
// Every one of the 42 browser checks runs against fields that are already on
// screen. The compliance write-up is not: it is split across five stages, only
// one of which is drawn at a time, and six of the nine regulated notes live
// behind a stage button nothing automated has ever pressed.
//
// Those nine boxes are the regulated wording. They are what the credit team
// reads, what goes in the handover PDF, and the one part of this portal where a
// screen that quietly fails to draw is a compliance problem rather than an
// annoyance.
//
// On 16 Sep 2026 the Lending Options tab failed to draw for exactly that kind of
// reason - a value read before it existed - and no test noticed, because no test
// opened it either. That fault is one line of code away from any of these.
//
// WHAT THIS DOES NOT DO, ON PURPOSE. It does not press "Write from the deal" on
// each box. That composes regulated wording from the live record and deserves
// its own test with its own assertions; bolting it on here would make one test
// that fails for nine unrelated reasons. This one answers a narrower question,
// and it is the question nobody has ever asked: can a person actually get to all
// nine, and is each one still a box they can write in?

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

// Named here the way the screen names them. The code's own list is AI_FIELDS in
// ComplianceForm - if a label changes there and not here, this fails, which is
// the point: these nine are the regulated set and they are not to drift quietly.
const NINE: { stage: string; label: RegExp; name: string }[] = [
  { stage: 'Needs & objectives', name: 'box 1 — primary reasons',   label: /^Primary reasons for seeking credit/ },
  { stage: 'Needs & objectives', name: 'box 2 — immediate needs',   label: /^Immediate needs & objectives/ },
  { stage: 'Needs & objectives', name: 'box 3 — longer term',       label: /^Longer term/ },
  { stage: 'Broker comments',    name: 'box 4 — analysis',          label: /^Analysis, assessment & applicant education/ },
  { stage: 'Broker comments',    name: 'box 5 — options presented', label: /^Options presented & recommendation/ },
  { stage: 'Broker comments',    name: 'box 6 — borrowing power',   label: /^Borrowing power/ },
  { stage: 'Broker comments',    name: 'box 7 — deposit / equity',  label: /^Deposit \/ equity/ },
  { stage: 'Broker comments',    name: 'box 8 — credit history',    label: /^Credit history/ },
  { stage: 'Broker comments',    name: 'box 9 — security comments', label: /^Security comments/ },
]

async function openCompliance(page: Page) {
  await page.goto(`/deals/${DEAL}`)
  await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /^Compliance$/ }).click()
  // A deal whose compliance has already gone to the credit team draws the
  // write-up collapsed behind this. On a deal that has not, the button is not
  // there and there is nothing to open.
  const show = page.getByRole('button', { name: /Show the write-up/ })
  if (await show.count() > 0) await show.first().click()
}

test.describe('every regulated box can actually be reached', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('all nine open, and every one of them is still a box you can write in', async ({ page }) => {
    test.setTimeout(120_000)
    await openCompliance(page)

    const found: string[] = []
    const missing: string[] = []
    let stageOpen = ''

    for (const box of NINE) {
      if (box.stage !== stageOpen) {
        // Loose, the way compliance-reads-the-record.spec.ts already does it.
        // Anchoring to the exact string breaks the day somebody adds a count to
        // the stage button, and that is not what this test is about.
        const tab = page.getByRole('button', { name: new RegExp(box.stage) })
        await expect(tab, `the "${box.stage}" stage button has gone from Compliance`)
          .toBeVisible({ timeout: 20_000 })
        await tab.first().click()
        stageOpen = box.stage
      }

      const field = page.getByLabel(box.label).first()
      if (await field.count() === 0) { missing.push(`${box.name}  (${box.stage})`); continue }

      // Visible, and a real box rather than a heading that happens to match.
      await expect(field, `${box.name} is on the page but not visible`)
        .toBeVisible({ timeout: 20_000 })
      const editable = await field.evaluate(el =>
        el.tagName === 'TEXTAREA' || (el as HTMLInputElement).type === 'text')
      if (!editable) { missing.push(`${box.name}  (not a box you can type in)`); continue }

      found.push(`${box.name}  (${box.stage})`)
    }

    console.log('\n' + '='.repeat(70))
    console.log('THE NINE REGULATED BOXES')
    for (const f of found) console.log(`  reached : ${f}`)
    for (const m of missing) console.log(`  MISSING : ${m}`)
    console.log('='.repeat(70) + '\n')

    expect(missing,
      'A regulated compliance box could not be reached. Either the stage it lives on '
      + 'is not drawing, or its label has changed. Both are the kind of fault that '
      + 'reaches the credit team before it reaches a test.').toEqual([])
    expect(found).toHaveLength(NINE.length)
  })

  // The nine each have a button that writes them from the deal. Not pressed here
  // - see the note at the top - but a box whose button has lost its composer
  // says "Generate with AI" instead, and that is a silent change of what the
  // regulated wording is built from.
  test('each of them still writes from the deal, not from a model', async ({ page }) => {
    test.setTimeout(120_000)
    await openCompliance(page)

    for (const stage of ['Needs & objectives', 'Broker comments']) {
      await page.getByRole('button', { name: new RegExp(stage) }).first().click()
      const fromTheDeal = page.getByRole('button', { name: /Write from the deal/ })
      await expect(fromTheDeal.first(),
        `no "Write from the deal" button on the ${stage} stage`).toBeVisible({ timeout: 20_000 })
      const n = await fromTheDeal.count()
      const expected = NINE.filter(b => b.stage === stage).length
      console.log(`  ${stage}: ${n} "Write from the deal" button(s), ${expected} regulated box(es)`)
      expect(n,
        `${stage} has ${n} "Write from the deal" buttons for ${expected} regulated boxes. `
        + 'A box that has lost its composer falls back to the model, which is not where '
        + 'regulated wording comes from.').toBeGreaterThanOrEqual(expected)
    }
  })
})
