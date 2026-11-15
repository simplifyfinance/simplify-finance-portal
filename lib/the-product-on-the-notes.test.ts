// THE PRODUCT, ON THE BROKER SUBMISSION NOTES.
//
// 16 Nov 2026. The sheet a bank reads carried a column headed PRODUCT TYPE
// printing "Prime" - the category, not the product. Fabio: "I want to show the
// actual product, which is what we're ticking on lending options... if it's
// P&I, the interest rates, I want all those details."
//
// And, asked straight about fixed loans: "I want the fixed term. I don't need
// a revert rate... if it's IO, how many years IO?"
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  moduleOn, rateTypeLine, repaymentsLine, productLines, hasProduct, NOTHING_TICKED,
} from './the-product-on-the-notes'

const mod = (over: any = {}) =>
  ({ enabled: true, rate: '6.54', repayment: '', loanTerm: '30', ...over })

const chosen = (over: any = {}) => ({
  lenderName: 'Bankwest',
  productName: 'Complete Home Loan',
  comparison: '6.61',
  annualFee: '395',
  offsetAccount: true,
  ...over,
})

describe('which module the notes print', () => {
  it('the enabled one', () => {
    expect(moduleOn(chosen({ variablePI: mod() }))?.fixed).toBe(false)
    expect(moduleOn(chosen({ fixedPI: mod() }))?.fixed).toBe(true)
    expect(moduleOn(chosen({ variableIO: mod() }))?.io).toBe(true)
  })

  // A module that was filled in and then switched off is not the answer.
  it('never a module that is switched off', () => {
    expect(moduleOn(chosen({ variablePI: mod({ enabled: false }) }))).toBe(null)
  })

  // Where two are on, fixed is what the bank is being asked for.
  it('and fixed wins over variable when both are on', () => {
    const both = chosen({ variablePI: mod({ rate: '6.9' }), fixedPI: mod({ rate: '5.8' }) })
    expect(moduleOn(both)?.fixed).toBe(true)
    expect(productLines(both).rate).toBe('5.8% p.a.')
  })

  it('nothing ticked is null, not a guess', () => {
    expect(moduleOn(chosen())).toBe(null)
    expect(moduleOn(null)).toBe(null)
  })
})

// 16 Nov 2026: "I want the fixed term. I don't need a revert rate."
describe('fixed says how long it is fixed for', () => {
  it('and never a revert rate', () => {
    const l = productLines(chosen({ fixedPI: mod({ rate: '5.49', fixedYears: '2' }) }))
    expect(l.rateType).toBe('Fixed — 2 years')
    expect(l.rate).toBe('5.49% p.a.')
    expect(JSON.stringify(l).toLowerCase()).not.toContain('revert')
  })

  it('one year is a year, not 1 years', () => {
    expect(rateTypeLine(chosen({ fixedPI: mod({ fixedYears: '1' }) }))).toBe('Fixed — 1 year')
  })

  it('a fixed loan with no term recorded still says it is fixed', () => {
    expect(rateTypeLine(chosen({ fixedPI: mod({ fixedYears: '' }) }))).toBe('Fixed')
  })

  it('and a variable loan says variable, with no years attached', () => {
    expect(rateTypeLine(chosen({ variablePI: mod({ fixedYears: '2' }) }))).toBe('Variable')
  })
})

// "IO" on its own told a credit assessor nothing - one year and ten years
// printed identically. Same fault repaymentLine() fixed on the splits table.
describe('interest only says how long it is interest only for', () => {
  it('with the years', () => {
    expect(repaymentsLine(chosen({ variableIO: mod({ ioYears: '5' }) })))
      .toBe('Interest only — 5 years')
  })

  it('fixed and interest only carries both numbers', () => {
    const l = productLines(chosen({ fixedIO: mod({ rate: '6.1', fixedYears: '3', ioYears: '5' }) }))
    expect(l.rateType).toBe('Fixed — 3 years')
    expect(l.repayments).toBe('Interest only — 5 years')
  })

  it('and principal and interest says so plainly', () => {
    expect(repaymentsLine(chosen({ fixedPI: mod() }))).toBe('Principal & interest')
  })
})

describe('the rest of the section', () => {
  const l = productLines(chosen({ fixedPI: mod({ rate: '5.49', fixedYears: '2', loanTerm: '30' }) }))

  it('names the lender and the product together', () => {
    expect(l.product).toBe('Bankwest — Complete Home Loan')
  })

  it('and carries the comparison rate, term and fee', () => {
    expect(l.comparison).toBe('6.61% p.a.')
    expect(l.term).toBe('30 years')
    expect(l.annualFee).toBe('$395')
  })

  // A BLANK IS NOT A NO. Printing "No" on a product that has an offset is
  // worse than printing nothing at all.
  it('an offset nobody answered prints nothing, not No', () => {
    expect(productLines(chosen({ fixedPI: mod(), offsetAccount: undefined })).offset).toBe('')
    expect(productLines(chosen({ fixedPI: mod(), offsetAccount: true })).offset).toBe('Yes')
    expect(productLines(chosen({ fixedPI: mod(), offsetAccount: false })).offset).toBe('No')
  })

  it('and a figure nobody recorded is empty, never a zero', () => {
    const bare = productLines({ fixedPI: mod({ rate: '', loanTerm: '' }), annualFee: '', comparison: '' })
    expect(bare.rate).toBe('')
    expect(bare.comparison).toBe('')
    expect(bare.term).toBe('')
    expect(bare.annualFee).toBe('')
  })
})

// 15-16 Nov 2026: "if it's blank, it's blank, but the boxes are there."
describe('when nothing was ticked on lending options', () => {
  it('the section says so rather than vanishing', () => {
    expect(hasProduct(null)).toBe(false)
    expect(hasProduct({})).toBe(false)
    expect(NOTHING_TICKED).toBe('No product recorded on Lending options.')
  })

  // A PRODUCT NAME WITH NO RATE IS STILL A PRODUCT. Somebody ticked the option
  // and did not fill the rate in; printing the name and leaving the rate blank
  // tells a credit assessor exactly that. Printing nothing hides it.
  it('and a name with no rate still prints, with the rate left blank', () => {
    expect(hasProduct(chosen())).toBe(true)
    const l = productLines(chosen())
    expect(l.product).toBe('Bankwest — Complete Home Loan')
    expect(l.rate).toBe('')
    expect(l.rateType).toBe('')
  })

  it('and it points at where to go and fix it', () => {
    expect(NOTHING_TICKED.toLowerCase()).toContain('lending options')
  })

  it('a ticked option is a product', () => {
    expect(hasProduct(chosen({ fixedPI: mod() }))).toBe(true)
  })
})

describe('nothing is invented', () => {
  // BLOCK COMMENTS TOO. 16 Nov 2026: this failed on its own file because a
  // JSDoc line shows the shape of a rate - /** "6.54% p.a." */ - and the check
  // was reading prose as if it were code. Sixth time this week.
  const SRC = readFileSync('lib/the-product-on-the-notes.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('no default rate, term or fee is written into this file', () => {
    for (const never of ['6.5', '30 years"', "'30'", 'Prime']) {
      expect(SRC, `${never} would print a figure nobody recorded`).not.toContain(never)
    }
  })
})
