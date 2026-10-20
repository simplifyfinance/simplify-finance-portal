import { describe, it, expect } from 'vitest'
import { loTemplateFor, isRefinanceScenario } from './lo-template'
import {
  existingLenderOn, recommendExistingLender, whyTheExistingLender,
  financeSought, whatEachPropertyIsDoing, limitDisagreement,
} from './top-up'
import { brokerNotes } from './broker-notes'
import { readFileSync } from 'fs'

// THE HALF WHERE IT HAS GONE WRONG BEFORE.
//
// Fabio, 20 Oct 2026: "very important to make sure we get the lending options
// and the compliance all in line." The borrowing capacity being right is not
// the same as the pack being right - a scenario can be correct on the BC and
// still tell a lender something untrue two tabs later.

const HARTLEY = 'p1'
const BERKELEY = 'p2'

const bc = (over: any = {}) => ({
  template: 'top_up',
  securityIds: [HARTLEY, BERKELEY],
  securityBalances: { [HARTLEY]: '500,000', [BERKELEY]: '400,000' },
  securityIncreases: { [HARTLEY]: '300,000', [BERKELEY]: '160,000' },
  securityDollarForDollar: {},
  splits: [
    { label: 'Existing loan', amount: '500,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: HARTLEY, purpose: 'investment' },
    { label: 'Loan increase', amount: '300,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: HARTLEY, purpose: 'investment' },
    { label: 'Existing loan', amount: '400,000', rate: '6.14', type: 'Interest only', ioYears: '3', securityId: BERKELEY, purpose: 'investment' },
    { label: 'Loan increase', amount: '160,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: BERKELEY, purpose: 'investment' },
  ],
  ...over,
})

const ff = {
  applicants: [{ firstName: 'Dan', lastName: 'Hartley' }],
  properties: [
    { id: HARTLEY, address: '14 Hartley St, Marrickville NSW 2204', value: '1,000,000',
      ownershipType: 'Investment', loans: [{ lenderName: 'St George', balance: '500,000' }] },
    { id: BERKELEY, address: '9 Berkeley St, Speers Point NSW 2284', value: '800,000',
      ownershipType: 'Investment', loans: [{ lenderName: 'St George', balance: '400,000' }] },
  ],
}

describe('the lending options page a top up wears', () => {
  // A top up buys nothing, so the purchase boxes would ask for a price nobody
  // has - and the page would work an LVR out from it. That is the exact fault
  // lib/lo-template.ts was written about, one template later.
  it('is the refinance page, with no purchase boxes', () => {
    expect(loTemplateFor('top_up')).toBe('lo_refinance')
    expect(isRefinanceScenario('top_up')).toBe(true)
  })

  it('is the purchase page on a top up that actually buys', () => {
    expect(loTemplateFor('top_up_purchase')).toBe('lo_purchase')
  })
})

describe('the recommendation starts where the loan already is', () => {
  // Fabio, 20 Oct 2026: "we still need to compare lenders but recommended
  // product is always existing lender."
  it('reads the lender off the fact find rather than asking again', () => {
    expect(existingLenderOn(bc(), ff)).toBe('St George')
    expect(recommendExistingLender({}, bc(), ff)).toBe('St George')
  })

  // A broker who has starred somebody is never overruled by a reload - the
  // same line this portal draws for the loan amount and the email template.
  it('says nothing once somebody has chosen', () => {
    expect(recommendExistingLender({ recommendedOptionId: 'opt-9' }, bc(), ff)).toBe('')
  })

  // Two lenders is a conversation, not a default. Picking the first would
  // recommend a bank half the lending is not with.
  it('says nothing when the loans are with two different lenders', () => {
    const split = { ...ff, properties: [
      ff.properties[0],
      { ...ff.properties[1], loans: [{ lenderName: 'Macquarie', balance: '400,000' }] },
    ] }
    expect(existingLenderOn(bc(), split)).toBe('')
  })

  // A ticked security is MOVING. The lender it is with today is the one being
  // left, not the one to recommend.
  it('ignores a security being refinanced away', () => {
    const mixed = bc({ securityDollarForDollar: { [BERKELEY]: true } })
    const split = { ...ff, properties: [
      ff.properties[0],
      { ...ff.properties[1], loans: [{ lenderName: 'Macquarie', balance: '400,000' }] },
    ] }
    expect(existingLenderOn(mixed, split)).toBe('St George')
  })

  it('never fires on a scenario that is not a top up', () => {
    expect(recommendExistingLender({}, bc({ template: 'refinance_equity' }), ff)).toBe('')
  })

  it('has a reason a compliance pack can use', () => {
    expect(whyTheExistingLender('St George')).toContain('already with St George')
    expect(whyTheExistingLender('St George')).toContain('not being moved')
    expect(whyTheExistingLender('')).toBe('')
  })
})

describe('what the submission notes tell a lender', () => {
  // THE TRAP. The existing loan is a split so the LVR counts it, so the splits
  // total $800,000 + $560,000. The client is asking for the increases.
  it('asks for the increases, not the splits', () => {
    expect(financeSought(bc())).toBe(460000)
  })

  it('counts a dollar for dollar in full, because that whole facility is new', () => {
    expect(financeSought(bc({ securityDollarForDollar: { [BERKELEY]: true } }))).toBe(700000)
  })

  // Fabio's standing complaint: a deal gets one label and the pack says every
  // property is doing the same thing.
  it('says what each property is doing, by name', () => {
    expect(whatEachPropertyIsDoing(bc(), ff)).toEqual([
      '$300,000 increases the existing lending against 14 Hartley St, Marrickville NSW 2204',
      '$160,000 increases the existing lending against 9 Berkeley St, Speers Point NSW 2284',
    ])
  })

  it('says increase and refinance in the same breath on a mixed deal', () => {
    const parts = whatEachPropertyIsDoing(bc({ securityDollarForDollar: { [BERKELEY]: true } }), ff)
    expect(parts[0]).toContain('increases the existing lending against 14 Hartley St')
    expect(parts[1]).toContain('refinances the existing lending against 9 Berkeley St, Speers Point NSW 2284, dollar for dollar')
  })
})

describe('the paragraph that actually goes in the box', () => {
  const notesFor = (over: any = {}) =>
    brokerNotes({ bc_data: bc(over), fact_find_data: ff, lo_data: {} } as any)
      .paragraphs.map(p => p.lines.join(' ')).join('\n')

  it('names the figure being asked for, not the splits added up', () => {
    const text = notesFor()
    expect(text).toContain('seeking finance of $460,000')
    expect(text).not.toContain('$1,360,000')
  })

  // The sentence that would have been untrue. A top up does not refinance.
  it('says the lending stays where it is, and never calls it a refinance', () => {
    const text = notesFor()
    expect(text).toContain('stays with its current lender and is not being refinanced')
  })

  it('drops that sentence the moment one security is being refinanced', () => {
    const text = notesFor({ securityDollarForDollar: { [BERKELEY]: true } })
    expect(text).not.toContain('is not being refinanced')
    expect(text).toContain('dollar for dollar')
  })
})

describe('the three figures on a security row that cannot all be true', () => {
  // Fabio's own screen, 20 Oct 2026: owes $942,441, increasing by $200,000, new
  // limit $1,599,941. The LVR read 80% off the typed limit while the splits
  // added to $1,142,441, which is 57%. Nothing said so.
  const HIS = bc({
    securityIds: [HARTLEY],
    securityBalances: { [HARTLEY]: '942,441' },
    securityIncreases: { [HARTLEY]: '200,000' },
    securityLimits: { [HARTLEY]: '1,599,941' },
  })

  it('says the limit is above what is owed plus the increase, and by how much', () => {
    const said = limitDisagreement(HIS, HARTLEY)
    expect(said).toContain('$457,500 above')
    expect(said).toContain('$1,142,441')
  })

  // A lender CAN approve a limit above what is drawn, and recording that is a
  // real thing to do. This warns; it does not refuse.
  it('explains when that is fine rather than calling it an error', () => {
    expect(limitDisagreement(HIS, HARTLEY)).toContain('undrawn facility')
  })

  it('says so the other way too, where the limit does not cover the lending', () => {
    const short = bc({
      securityIds: [HARTLEY],
      securityBalances: { [HARTLEY]: '942,441' },
      securityIncreases: { [HARTLEY]: '200,000' },
      securityLimits: { [HARTLEY]: '1,000,000' },
    })
    expect(limitDisagreement(short, HARTLEY)).toContain('does not cover the lending')
  })

  it('stays quiet when they agree', () => {
    const agrees = bc({
      securityIds: [HARTLEY],
      securityBalances: { [HARTLEY]: '942,441' },
      securityIncreases: { [HARTLEY]: '200,000' },
      securityLimits: { [HARTLEY]: '1,142,441' },
    })
    expect(limitDisagreement(agrees, HARTLEY)).toBe('')
  })

  it('stays quiet when nobody has typed a limit', () => {
    expect(limitDisagreement(bc(), HARTLEY)).toBe('')
  })

  it('says nothing at all on a scenario that is not a top up', () => {
    const other = bc({ template: 'refinance_equity', securityLimits: { [HARTLEY]: '9,000,000' } })
    expect(limitDisagreement(other, HARTLEY)).toBe('')
  })
})

describe('the increasing-by box and the split are one figure', () => {
  const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  // Fabio, 20 Oct 2026, with 200,000 in the split and the box empty: "is the
  // increasing box suppose to say something?" It was. And an empty box is not
  // cosmetic - financeSought reads the securities, so the submission notes
  // would have told a lender this deal was asking for nothing.
  it('typing in the box writes the split', () => {
    expect(form).toContain('function setIncreaseOn(')
    expect(form).toContain('onChange={(v: string) => setIncreaseOn(String(p.id), v)}')
  })

  it('and a figure already in the split fills the empty box', () => {
    expect(form).toContain('AND THE OTHER WAY ROUND, ONCE.')
  })

  // A figure in the box is somebody's answer and is never overwritten by a
  // split - the line this form draws everywhere between what a person typed
  // and what the portal worked out.
  it('never overwrites a box that already has something in it', () => {
    expect(form).toContain('if (String(next[id] || \'\').trim()) continue')
  })
})
