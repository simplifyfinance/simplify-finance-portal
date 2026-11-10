import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { buysNothing } from './buying'

// FIVE BOXES ABOUT A PURCHASE, ON A DEAL WITH NO PURCHASE.
//
// 12 Oct 2026. A complex refinance drew Purchase price, Deposit, Deposit source,
// Stamp duty and a duty State, and the box at the top of the card said "State"
// when it is the Suburb box - so one screen had two different boxes both called
// State, and neither of them was the one you wanted.
//
// WHY. Every one of those boxes is hidden by its own hand-written list of
// templates, one list per box. Complex refinance was added as a template and
// never added to any of the lists. The lists are still there, because they say
// things buysNothing() does not - a build on land somebody already owns pays no
// duty either. What is new is one rule in front of all of them, so the next
// scenario anybody adds is not on a sixth list to forget.
//
// AND IT WAS NOT COSMETIC. See lib/a-refinance-buys-nothing.test.ts: a figure in
// that Purchase price box put a purchase into the compliance pack.
const FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

const fieldLine = (label: string) => {
  const hit = FORM.split('\n').findIndex(l => l.includes(`<Field label="${label}">`))
  expect(hit, `the ${label} box is gone from the form entirely`).toBeGreaterThan(-1)
  // The condition can sit on the line before, where two of them do.
  return FORM.split('\n').slice(Math.max(0, hit - 3), hit + 1).join('\n')
}

describe('the boxes a scenario with no purchase is not asked', () => {
  it.each([
    ['Purchase price'],
    ['Deposit'],
    ['Deposit source'],
    ['Stamp duty'],
  ])('%s is behind the one rule', (label) => {
    expect(fieldLine(label)).toContain('buysNothing(template)')
  })

  // THE STATE BOX IS NO LONGER ONE OF THEM, AND THAT IS DELIBERATE.
  //
  // 29 Oct 2026, Fabio: "State dropdown to choose - all templates." A property
  // sits in a state whether or not duty is payable on it, and sharing stamp
  // duty's condition meant a refinance had nowhere to record one - the second
  // half of the fault lib/duty-state.ts was written for on 30 Sep.
  //
  // So this now asserts the opposite of what it used to: the box is still
  // beside Stamp duty, and it is NOT behind the purchase rule.
  it('the duty State sits beside Stamp duty, on every template', () => {
    const i = FORM.indexOf('<Field label="Stamp duty">')
    const after = FORM.slice(i, i + 1600)
    const j = after.indexOf('<Field label="State">')
    expect(j, 'the duty State box moved away from Stamp duty').toBeGreaterThan(-1)
    expect(after.slice(0, j),
      'the State box is behind the purchase rule again - a refinance cannot record one')
      .not.toContain('buysNothing(template)')
  })
})

describe('the box at the top of the card says what it is', () => {
  // 29 Oct 2026. This used to require the ternary - Suburb where the scenario
  // buys nothing, "State" everywhere else. That was the 12 Oct halfway house,
  // and the half it left alone is where most suburbs come from: a purchase
  // deal collected "WA" into its suburb, and the broker notes, the security
  // address and the pre-approval printed a state code where a suburb belongs.
  //
  // It writes into `suburb`. It is read as the suburb. It is the suburb box on
  // every template, and there is no longer a condition that can get it wrong.
  it('it is the Suburb box, on every scenario that still asks', () => {
    // 10 Nov 2026. The box is no longer one fixed string, because "Suburb" on a
    // refinance and "Suburb" on a purchase are two different questions - and it
    // is not drawn at all where ticked securities already carry the address.
    // What has not changed, and is the whole point of this test, is that it
    // never says State. See lib/duty-state.ts for what that cost.
    expect(FORM).not.toContain("buysNothing(template) ? 'Suburb' : 'State'")
    // Written without the apostrophe, which is a \u2019 escape in the source and
    // would have to be escaped twice over to be matched here.
    for (const label of ["'Suburb of the property'", "re buying in'"]) {
      expect(FORM, `the suburb box no longer offers ${label}`).toContain(label)
    }
    // Both ends of the one ternary that is left begin with the word.
    for (const m of FORM.matchAll(/'(Suburb[^']*)'/g)) {
      expect(m[1].startsWith('Suburb'), `${m[1]} does not begin with Suburb`).toBe(true)
    }
  })

  // AND IT IS NOT ASKED WHERE THE DEAL ALREADY KNOWS.
  //
  // 10 Nov 2026. Fabio, on an Equity release + purchase whose ticked security
  // reads "28 Jarvis St, Oura NSW 2650": "what is the point of the suburb
  // question here really." None. The email heading has read the ticked
  // addresses since 16 Oct and bc-ready stopped asking for it on 15 Oct - it
  // was a box nobody read, sitting underneath the answer.
  it('and it is not drawn once a security carries the address', () => {
    expect(FORM).toContain('securityIdsOf({ template, securityIds }).length === 0')
  })

  it('and the ternary that made it say State is gone', () => {
    expect(FORM).not.toContain("buysNothing(template) ? 'Suburb' : 'State'")
  })

  it('and the hand-written pair it replaced is gone', () => {
    expect(FORM).not.toContain("['refinance_equity', 'refinance_only'].includes(template) ? 'Suburb'")
  })

  // The readiness check has always called it Suburb on these scenarios. The
  // form now agrees with it, which it did not on two of them.
  it.each([['complex_refinance'], ['debt_recycling'], ['refinance_only'], ['refinance_equity']])(
    'including %s', (t) => { expect(buysNothing(t)).toBe(true) })
})

describe('the securities are chosen before anything is split against them', () => {
  it('the securities block is above the property details, not inside Loan splits', () => {
    // 15 Oct 2026: that heading now reads "Property being refinanced" on a
    // refinancing scenario and "Scenario details" on the rest, so the anchor is
    // the line that renders either one. 29 Oct 2026 it gained "Sale and
    // purchase" for a buy and sell and moved into a named function, so the
    // anchor is the call rather than the ternary.
    const sec = FORM.indexOf('Securities for this loan')
    const scenario = FORM.indexOf('scenarioBoxHeading(template, manySecurities)')
    const splits = FORM.indexOf('"Loan splits"')
    expect(sec).toBeGreaterThan(-1)
    expect(sec).toBeLessThan(scenario)
    expect(sec).toBeLessThan(splits)
  })
})
