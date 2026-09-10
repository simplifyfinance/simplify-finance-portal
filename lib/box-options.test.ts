import { describe, it, expect } from 'vitest'
import { boxFive, cashbackOf, optionSentence } from './box-options'
import { optionsOf } from './lender-comparison'
import { DEAL } from './box-fixture'

const deal = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })
const lo = (over: any) => { const d = deal(); d.lo_data = { ...d.lo_data, ...over }; return d }
const cd = (over: any) => { const d = deal(); d.compliance_data = { ...d.compliance_data, ...over }; return d }

// Blank every fee box on the second lender.
const unpriced = () => {
  const d = deal()
  d.lo_data = { ...d.lo_data, lenders: d.lo_data.lenders.map((l: any, i: number) =>
    i === 1 ? { ...l, applicationFee: '', valuationFee: '', legalFee: '', annualFee: '' } : l) }
  return d
}

// IT NEVER CALLS SOMETHING CHEAPER WHEN IT IS NOT.
//
// Fabio, 10 Sep 2026: "make sure rules are in place and not compare things say
// this is cheaper when it isnt." A lender whose fee boxes were never filled in
// summed to $0 and was declared the cheapest - a sentence telling a credit
// assessor the recommendation was beaten on price by a lender nobody had priced.
describe('an unpriced option is never called cheap', () => {
  it('names it as unpriced instead of comparing it', () => {
    const t = boxFive(unpriced()).text
    expect(t).toContain('Upfront fees are not recorded for CBA, so they have not been compared on cost to set up.')
    expect(t).toContain('Ongoing fees are not recorded for CBA, so they have not been compared on annual cost.')
  })

  it('never quotes a fee of $0 against a lender nobody priced', () => {
    const t = boxFive(unpriced()).text
    expect(t).not.toMatch(/CBA at \$0/)
    expect(t).not.toMatch(/\$0 (in upfront fees|a year)/)
  })

  it('leaves the unpriced lender out of its own fee sentence', () => {
    const t = boxFive(unpriced()).text
    expect(t).toContain('CBA, on the Wealth Package product, at a variable P&I rate of 6.07%.')
  })

  it('still compares where both are priced', () => {
    const t = boxFive(deal()).text
    expect(t).toContain('Lowest upfront fees: CBA at $200. ING charges $350, $150 more.')
  })

  it('treats a typed zero as a real answer', () => {
    const o = optionsOf({ recommendedLender: 'X',
      lenders: [{ lenderName: 'X', applicationFee: '0', annualFee: '0' }] })[0]
    expect(o.upfrontKnown).toBe(true)
    expect(o.ongoingKnown).toBe(true)
  })
})

describe('it never argues the point away', () => {
  it('states where the recommendation is behind and stops', () => {
    const t = boxFive(deal()).text
    expect(t).toContain('ING charges $350, $150 more')
    // The judgement is the broker's, recorded in their note. Not this box's.
    expect(t).not.toMatch(/outweigh|justified by|more than offset|on balance|nonetheless|however this/i)
  })

  it('turns every point it is behind on into a gap', () => {
    const g = boxFive(deal()).gaps.map(x => x.what)
    expect(g.some(x => /behind on this/.test(x))).toBe(true)
  })

  it('quotes the broker reason and does not reword it', () => {
    const t = boxFive(deal()).text
    expect(t).toContain('They offer the most competitive variable rate (5.99% P&I) with annual fee.')
    expect(t).toContain('temporary visa holder')
  })
})

describe('the options themselves', () => {
  it('says how many were presented', () => {
    expect(boxFive(deal()).text).toMatch(/^Two lender options were presented to the clients\./)
  })

  it('keeps the capitals in P&I', () => {
    expect(boxFive(deal()).text).toContain('a variable P&I rate of 5.99%')
    expect(boxFive(deal()).text).not.toMatch(/p&i/)
  })

  it('reports an offset answer but never invents one', () => {
    expect(boxFive(deal()).text).toContain('The product has an offset account.')
    const none = lo({ lenders: DEAL.lo_data.lenders.map((l: any) => ({ ...l, offsetAccount: '' })) })
    expect(boxFive(none).text).not.toMatch(/offset account\./)
  })

  it('shouts for a lender with no rate recorded', () => {
    const d = lo({ lenders: [DEAL.lo_data.lenders[0],
      { ...DEAL.lo_data.lenders[1], variablePI: { enabled: false }, variableIO: { enabled: false },
        fixedPI: { enabled: false }, fixedIO: { enabled: false } }] })
    expect(boxFive(d).text).toMatch(/\*\* NOT RECORDED — no rate for CBA \*\*/)
  })

  it('quotes the note against an option as recorded', () => {
    expect(boxFive(deal()).text).toContain('Noted against this option: "One offset per loan account')
  })

  it('shouts when only one lender is on the deal', () => {
    const one = lo({ lenders: [DEAL.lo_data.lenders[0]] })
    const r = boxFive(one)
    expect(r.text).toMatch(/\*\* ONLY ONE LENDER RECORDED/)
    expect(r.gaps.map(g => g.what)).toContain('Only one lender option recorded')
  })

  it('says so when there are none at all', () => {
    const r = boxFive(lo({ lenders: [] }))
    expect(r.text).toMatch(/\*\* NOT RECORDED — no lender options have been recorded/)
    expect(r.gaps.map(g => g.what)).toContain('Lender options')
  })
})

describe('what the clients said mattered', () => {
  it('lists the criteria ticked on the Lending options tab', () => {
    expect(boxFive(deal()).text).toContain('competitive interest rate, good turnaround times')
  })

  it('shouts when none were ticked', () => {
    const r = boxFive(lo({ criteriaUsed: [] }))
    expect(r.text).toMatch(/\*\* NOT RECORDED — what the clients said mattered to them\. \*\*/)
    expect(r.gaps.map(g => g.what)).toContain('Research criteria')
  })
})

// Fabio, 10 Sep 2026: "if the cashback box was input with a figure in deal
// structure mention that."
describe('the cashback', () => {
  it('states it when a figure is recorded', () => {
    expect(boxFive(cd({ cashback: '$2,000' })).text)
      .toContain('A cashback of $2,000 has been recorded against this lending.')
  })

  it('quotes it as written when it is not a plain figure, and never re-reads it as a number', () => {
    // readMoney strips the letters and glues the digits together: "$2,000 after
    // 6 months" came back as 20006. 10 Sep 2026.
    const t = boxFive(cd({ cashback: '$2,000 after 6 months' })).text
    expect(t).toContain('A cashback has been recorded against this lending: $2,000 after 6 months.')
    expect(t).not.toContain('$20,006')
  })

  it('says nothing when the box is empty', () => {
    expect(boxFive(deal()).text).not.toMatch(/cashback/i)
  })

  it('says nothing when the box says none', () => {
    for (const v of ['none', 'None', 'nil', 'N/A', 'no', '0', '$0']) {
      expect(cashbackOf(cd({ cashback: v })), v).toBe('')
      expect(boxFive(cd({ cashback: v })).text).not.toMatch(/cashback/i)
    }
  })
})

// Fabio's rule, 10 Sep 2026, in three shapes.
describe('the turnaround, and what the difference means', () => {
  const withDays = (mine: string, theirs: string) => lo({
    lenders: [{ ...DEAL.lo_data.lenders[0], approvalDays: mine },
              { ...DEAL.lo_data.lenders[1], approvalDays: theirs }] })

  it('faster: the clients get the product recommended for them, sooner', () => {
    const t = boxFive(withDays('2', '10')).text
    expect(t).toContain('At 2 days, ING also has the shortest turnaround of the options presented, so the clients can have the product recommended for them and have it in place sooner.')
  })

  it('slower: the clients are willing to wait, features first', () => {
    const t = boxFive(withDays('15', '5')).text
    expect(t).toContain('ING takes 15 days against 5 for the quickest of the other options. The clients are willing to wait, as the timeframe is secondary to the features they said mattered to them.')
  })

  it('the same: it fits their timeframe', () => {
    expect(boxFive(withDays('12', '12')).text)
      .toContain("The turnaround time of 12 days fits in line with the clients' timeframe and expectations.")
  })

  it('says nothing at all when no turnaround is recorded', () => {
    // "good turnaround times" is one of the ticked criteria and "1 business day"
    // is inside a lender note, so the words appear legitimately. Only the
    // sentences this rule writes are checked for.
    const none = lo({ lenders: DEAL.lo_data.lenders.map((l: any) => ({ ...l, approvalDays: '' })) })
    const t = boxFive(none).text
    expect(t).not.toMatch(/Approval takes around|turnaround time of|shortest turnaround|days against/)
  })

  it('does not say it twice', () => {
    // The comparison library's own "Fastest approval:" line is dropped so the
    // rule above is the only place approval time is judged.
    const t = boxFive(deal()).text
    expect(t).not.toMatch(/Fastest approval:/)
    const judged = t.match(/turnaround time of|shortest turnaround|days against/g) || []
    expect(judged.length).toBe(1)
  })
})

describe('what the clients decided', () => {
  it('states it plainly when they agreed', () => {
    expect(boxFive(cd({ clientAgreedLender: 'Yes' })).text)
      .toContain('The clients agreed with the recommendation and proceeded with it.')
  })

  it('names the lender they chose instead, and their reason', () => {
    const t = boxFive(cd({ clientAgreedLender: 'No', clientChosenLender: 'CBA',
                           clientChosenLenderReason: 'Existing relationship' })).text
    expect(t).toContain('did not proceed with the recommendation and chose CBA')
    expect(t).toContain('"Existing relationship"')
  })

  it('reads the Other box when that is what was picked', () => {
    const t = boxFive(cd({ clientAgreedLender: 'No', clientChosenLender: '__other__',
                           clientChosenLenderOther: 'Bendigo' })).text
    expect(t).toContain('chose Bendigo')
    expect(t).not.toContain('__other__')
  })

  it('shouts when nobody has captured the answer', () => {
    const r = boxFive(deal())
    expect(r.text).toMatch(/\*\* NOT RECORDED — whether the clients agreed with the recommendation\. \*\*/)
    expect(r.gaps.map(g => g.what)).toContain("The clients' agreement to the recommendation")
  })
})

describe('it reads like a person wrote it', () => {
  it('leaves no raw key, placeholder or double punctuation', () => {
    for (const d of [deal(), unpriced(), cd({ clientAgreedLender: 'Yes', cashback: '$2,000' })]) {
      const t = boxFive(d).text
      expect(t).not.toMatch(/undefined|NaN|\[object|lenderName|variablePI|__other__/)
      expect(t).not.toMatch(/ {2}|\.\.|,,| ,|""/)
    }
  })

  it('is the same words every time for one deal', () => {
    expect(new Set(Array.from({ length: 20 }, () => boxFive(deal()).text)).size).toBe(1)
  })

  it('describes an option with nothing recorded but a name without falling apart', () => {
    const bare = optionSentence({ name: 'ANZ', product: '', recommended: false, rates: [],
      lowestRate: null, upfront: 0, upfrontKnown: false, ongoing: 0, ongoingKnown: false,
      offset: false, offsetAnswer: '', approvalDays: null, note: '' })
    expect(bare).toContain('ANZ')
    expect(bare).toMatch(/NOT RECORDED — no rate for ANZ/)
    expect(bare).not.toMatch(/\$0|undefined/)
  })
})
