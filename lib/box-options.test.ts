import { describe, it, expect } from 'vitest'
import { boxFive, cashbackOf, featureSentence } from './box-options'
import { optionsOf } from './lender-comparison'
import { DEAL } from './box-fixture'

// BOX FIVE — OPTIONS PRESENTED & RECOMMENDATION.
//
// Rewritten 15 Sep 2026. It used to write a sentence per option with every fee,
// offset answer and credit note, then compare them all again underneath: 228
// words on a two lender deal, most of it said twice. Fabio: "waaaay too long."
//
// Four sentences now, in his words:
//   1. what else was looked at — name, product, rate, nothing else
//   2. what was chosen, and the research criteria it was chosen on
//   3. how long that lender takes, and that it suits the clients — ALWAYS
//   4. the features of the chosen product ONLY
// then cashback if there is one, and what the clients decided.

const deal = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })
const lo = (over: any) => { const d = deal(); d.lo_data = { ...d.lo_data, ...over }; return d }
const cd = (over: any) => { const d = deal(); d.compliance_data = { ...d.compliance_data, ...over }; return d }

describe('sentence one — what else was looked at', () => {
  it('names the alternatives with their product and rate, and nothing else', () => {
    const t = boxFive(deal()).text
    expect(t).toContain('Lender options compared include CBA Wealth Package with an interest rate of 6.07%.')
  })

  it('LEAVES THE CHOSEN LENDER OUT of that list', () => {
    // Fabio's example: Suncorp and ANZ are compared, ME Bank is chosen. The list
    // is the alternatives.
    const t = boxFive(deal()).text
    const firstSentence = t.split('. ')[0]
    expect(firstSentence).not.toContain('ING')
  })

  it('says nothing about their fees, offset or notes', () => {
    const t = boxFive(deal()).text
    expect(t).not.toContain('CBA at $200')
    expect(t).not.toContain('Noted against this option')
    expect(t).not.toMatch(/Lowest (rate|upfront|ongoing)/)
  })

  it('shouts when an alternative has no rate recorded', () => {
    const d = lo({ lenders: DEAL.lo_data.lenders.map((l: any, i: number) =>
      i === 1 ? { ...l, variablePI: { enabled: false, rate: '' } } : l) })
    expect(boxFive(d).text).toMatch(/NOT RECORDED — no rate for CBA/)
  })
})

describe('only one lender option', () => {
  const single = () => lo({ lenders: [DEAL.lo_data.lenders[0]] })

  it('TELLS THE BROKER TO WRITE IT THEMSELVES', () => {
    // Fabio, 15 Sep 2026: "flag to broker only one product selected so THEY need
    // to elaborate that particular box as we dont have enough data to automate."
    const t = boxFive(single()).text
    expect(t).toMatch(/ONLY ONE LENDER OPTION RECORDED/)
    expect(t).toMatch(/Please write it yourself/)
  })

  it('raises it as a gap, not just a line of text', () => {
    expect(boxFive(single()).gaps.map(g => g.what).join(' '))
      .toMatch(/written by hand/)
  })

  it('still writes the rest of the box', () => {
    const t = boxFive(single()).text
    expect(t).toContain('Ultimately we selected ING Orange Advantage')
    expect(t).toContain("which is in line with the clients' goals and expectations")
  })
})

describe('sentence two — what was chosen and why', () => {
  it('names the lender and product, and the criteria it was chosen on', () => {
    expect(boxFive(deal()).text).toContain(
      'Ultimately we selected ING Orange Advantage based on a competitive interest rate')
  })

  it('does not quote the broker note any more', () => {
    // It used to reproduce recommendationNote word for word. The criteria say it.
    expect(boxFive(deal()).text).not.toContain('The reason recorded for the recommendation')
  })

  it('shouts when nobody recorded what mattered to the clients', () => {
    const t = boxFive(lo({ criteriaUsed: [] })).text
    expect(t).toContain('Ultimately we selected ING Orange Advantage.')
    expect(t).toMatch(/NOT RECORDED — what the clients said mattered/)
  })

  it('shouts when no lender is marked as recommended', () => {
    const t = boxFive(lo({ recommendedLender: '' })).text
    expect(t).toMatch(/NOT RECORDED — which lender was recommended/)
  })
})

describe('sentence three — the approval time', () => {
  it('ALWAYS says it is in line with their goals and expectations', () => {
    // 10 Sep had three wordings - faster, slower, the same. Replaced 15 Sep:
    // a recommendation is only made where it suits the client.
    expect(boxFive(deal()).text).toContain(
      "ING's approval time is 1-2 business days, which is in line with the clients' goals and expectations.")
  })

  it('says it even when the chosen lender is the slower one', () => {
    const d = lo({ lenders: DEAL.lo_data.lenders.map((l: any) =>
      l.lenderName === 'ING' ? { ...l, approvalDays: '30' } : { ...l, approvalDays: '5' }) })
    expect(boxFive(d).text).toContain("in line with the clients' goals and expectations")
  })

  it('QUOTES THE DROPDOWN WORD FOR WORD, IT DOES NOT INVENT A NUMBER', () => {
    // 15 Sep 2026. "Approval days" is a dropdown of ranges. Every one of its
    // choices was being read with the rate parser, which threw the words away
    // and glued the digits together, so every deal on "1-2 business days" said
    // "approval time is 12 days" and "7-10 business days" said "710 days".
    const t = boxFive(deal()).text
    expect(t).toContain('1-2 business days')
    expect(t).not.toMatch(/\b12 days\b/)
    for (const [picked, wrong] of [['3-5 business days', '35'], ['5-7 business days', '57'],
                                   ['7-10 business days', '710'], ['10+ business days', '10']]) {
      const d = lo({ lenders: DEAL.lo_data.lenders.map((l: any) =>
        l.lenderName === 'ING' ? { ...l, approvalDays: picked } : l) })
      const text = boxFive(d).text
      expect(text, picked).toContain(`approval time is ${picked}`)
      expect(text, picked).not.toContain(`${wrong} days,`)
    }
  })

  it('says "days" when somebody typed a bare number', () => {
    const d = lo({ lenders: DEAL.lo_data.lenders.map((l: any) =>
      l.lenderName === 'ING' ? { ...l, approvalDays: '5' } : l) })
    expect(boxFive(d).text).toContain("ING's approval time is 5 days")
  })

  it('shouts when the chosen lender has no turnaround recorded', () => {
    const d = lo({ lenders: DEAL.lo_data.lenders.map((l: any) =>
      l.lenderName === 'ING' ? { ...l, approvalDays: '' } : l) })
    expect(boxFive(d).text).toMatch(/NOT RECORDED — how long ING takes to approve/)
  })
})

describe('sentence four — the chosen product only', () => {
  it('lists its rate, offset, annual fee and upfront fees', () => {
    const t = boxFive(deal()).text
    expect(t).toContain('The product is variable P&I at 5.99%')
    expect(t).toContain('an offset account')
    expect(t).toContain('an annual fee of $299')
    expect(t).toContain('$350 in upfront fees')
  })

  it('says nothing about the other lender in that sentence', () => {
    const last = boxFive(deal()).text.split('The product is ')[1] || ''
    expect(last).not.toContain('CBA')
  })

  it('NEVER QUOTES A FEE NOBODY RECORDED', () => {
    // A blank fee box summed to $0 and was once printed as a real figure.
    const rec = optionsOf({ ...DEAL.lo_data, lenders: [{ ...DEAL.lo_data.lenders[0],
      applicationFee: '', establishmentFee: '', valuationFee: '', legalFee: '',
      docProcessingFee: '', annualFee: '' }] })[0]
    const s = featureSentence(rec)
    expect(s).not.toMatch(/\$0/)
    expect(s).not.toContain('annual fee')
    expect(s).not.toContain('upfront fees')
  })

  it('distinguishes "no offset" from nobody having answered', () => {
    const answered = optionsOf({ ...DEAL.lo_data,
      lenders: [{ ...DEAL.lo_data.lenders[0], offsetAccount: 'No' }] })[0]
    expect(featureSentence(answered)).toContain('no offset account')
    const blank = optionsOf({ ...DEAL.lo_data,
      lenders: [{ ...DEAL.lo_data.lenders[0], offsetAccount: '' }] })[0]
    expect(featureSentence(blank)).not.toContain('offset')
  })
})

describe('what is kept at the end', () => {
  it('mentions a cashback recorded in the deal structure', () => {
    const d = cd({ cashback: '2000' })
    expect(boxFive(d).text).toContain('A cashback of $2,000 has been recorded')
  })

  it('quotes a cashback carrying words exactly as typed', () => {
    const d = cd({ cashback: '$2,000 after 6 months' })
    expect(boxFive(d).text).toContain('$2,000 after 6 months')
    expect(boxFive(d).text).not.toContain('$20,006')
  })

  it('says when the clients agreed', () => {
    expect(boxFive(cd({ clientAgreedLender: 'Yes' })).text)
      .toContain('The clients agreed with the recommendation and proceeded with it.')
  })

  it('says when they chose somebody else, and why', () => {
    const t = boxFive(cd({ clientAgreedLender: 'No', clientChosenLender: 'NAB',
                           clientChosenLenderReason: 'They bank with NAB already' })).text
    expect(t).toContain('did not proceed with the recommendation and chose NAB')
    expect(t).toContain('"They bank with NAB already"')
  })

  it('shouts when nobody recorded whether they agreed', () => {
    expect(boxFive(cd({ clientAgreedLender: '' })).text)
      .toMatch(/NOT RECORDED — whether the clients agreed/)
  })
})

describe('sentence two — how a ticked criterion reads', () => {
  it('writes the seven checkboxes the way somebody would say them', () => {
    const t = boxFive(deal()).text
    expect(t).toContain('based on a competitive interest rate, good turnaround times, '
      + 'the ability to have an offset account and fully assessed pre-approval applications.')
  })

  it('uses a criterion the broker typed in exactly as they typed it', () => {
    const t = boxFive(lo({ criteriaUsed: ['Accepts our client\'s trust structure'] })).text
    expect(t).toContain("based on accepts our client's trust structure.")
  })
})

describe('it is short', () => {
  it('writes a fraction of what it used to', () => {
    // 228 words on this exact deal before 15 Sep 2026.
    const words = boxFive(deal()).text.split(/\s+/).length
    expect(words, `box five is ${words} words`).toBeLessThan(110)
  })
})

describe('cashback wording', () => {
  it('treats none, nil and a blank as no cashback', () => {
    for (const v of ['', 'none', 'Nil', 'n/a', '0', '$0']) {
      const d = cd({ cashback: v })
      expect(cashbackOf(d), v).toBe('')
    }
  })
})
