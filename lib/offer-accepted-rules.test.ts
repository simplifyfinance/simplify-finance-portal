import { describe, it, expect } from 'vitest'
import { ruleFor, preapprovalAge, anzReductionEmail, needsAnzAcknowledgement, LENDER_RULES } from './offer-accepted-rules'

// Fabio's answers, 10 Sep 2026. These tests are the record of what he said, so
// that changing a rule means changing it here on purpose rather than by drift.
describe('what each lender was said to want', () => {
  it('gives every lender ninety days on the preapproval', () => {
    for (const r of LENDER_RULES) expect(r.preapprovalDays, r.names[0]).toBe(90)
  })

  it('knows which ones extend for another ninety', () => {
    for (const n of ['St George', 'Westpac', 'Ubank', 'ING', 'CBA', 'ANZ']) {
      expect(ruleFor(n)?.canExtend, n).toBe(true)
      expect(ruleFor(n)?.extendDays, n).toBe(90)
    }
  })

  it('charges the WLTH extension fee and nobody else', () => {
    expect(ruleFor('WLTH')?.extendFee).toBe(100)
    for (const n of ['CBA', 'ANZ', 'ING', 'Westpac']) {
      expect(ruleFor(n)?.extendFee, n).toBeUndefined()
    }
  })

  it('does not claim an extension for the ones that were not named', () => {
    // NAB, Macquarie and Bankwest were not on his extension list. Silence is not
    // a yes.
    for (const n of ['NAB', 'Macquarie', 'Bankwest']) {
      expect(ruleFor(n)?.canExtend, n).toBe(false)
    }
  })
})

describe('how each lender is told', () => {
  it('sends CBA, St George, NAB and Westpac back through AOL', () => {
    for (const n of ['CBA', 'St George', 'NAB', 'Westpac']) {
      expect(ruleFor(n)?.notify, n).toBe('aol')
      expect(ruleFor(n)?.notifyDetail, n).toMatch(/resubmit in AOL/)
    }
  })

  it('warns about the preapproval tick on every AOL lender', () => {
    // "need to make sure they untick preapproval" - the one that quietly sends
    // the whole thing back as another preapproval.
    for (const n of ['CBA', 'St George', 'NAB', 'Westpac']) {
      expect(ruleFor(n)?.watchOut, n).toMatch(/[Uu]ntick preapproval/)
    }
  })

  it('sends Macquarie through AOL but the documents through their own portal', () => {
    expect(ruleFor('Macquarie')?.notifyDetail).toMatch(/AOL.*Macquarie portal/)
  })

  it('sends Bankwest to their portal', () => {
    expect(ruleFor('Bankwest')?.notify).toBe('portal')
  })

  it('emails ING, ANZ, Ubank and WLTH', () => {
    for (const n of ['ING', 'ANZ', 'Ubank', 'WLTH']) {
      expect(ruleFor(n)?.notify, n).toBe('email')
    }
  })
})

describe('the names people actually type', () => {
  it('matches the abbreviations the team uses', () => {
    expect(ruleFor('STG')?.names).toContain('st george')
    expect(ruleFor('BOM')?.names).toContain('bank of melbourne')
    expect(ruleFor('BankSA')?.names).toContain('banksa')
    expect(ruleFor('Commonwealth Bank')?.names).toContain('cba')
  })

  it('is not upset by case or spacing', () => {
    expect(ruleFor('  anz  ')?.notify).toBe('email')
    expect(ruleFor('MACQUARIE BANK')?.notify).toBe('aol')
  })

  it('returns nothing for a lender nobody has told us about', () => {
    // Null is a real answer. The screen says so rather than falling back to the
    // most common rule and letting somebody act on it.
    expect(ruleFor('Pepper')).toBeNull()
    expect(ruleFor('')).toBeNull()
    expect(ruleFor(null)).toBeNull()
  })
})

describe('how long is left on the preapproval', () => {
  const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

  it('counts the days since it was given', () => {
    expect(preapprovalAge(at(30), ruleFor('CBA'))!.days).toBe(30)
  })

  it('is not expired at forty days', () => {
    const a = preapprovalAge(at(40), ruleFor('CBA'))!
    expect(a.expired).toBe(false)
    expect(a.soon).toBe(false)
  })

  it('says it is close inside the last fortnight', () => {
    const a = preapprovalAge(at(80), ruleFor('CBA'))!
    expect(a.soon).toBe(true)
    expect(a.expired).toBe(false)
  })

  it('says it has run out past ninety days', () => {
    expect(preapprovalAge(at(95), ruleFor('CBA'))!.expired).toBe(true)
  })

  it('carries whether it can be extended, and what that costs', () => {
    expect(preapprovalAge(at(80), ruleFor('CBA'))!.canExtend).toBe(true)
    expect(preapprovalAge(at(80), ruleFor('NAB'))!.canExtend).toBe(false)
    expect(preapprovalAge(at(80), ruleFor('WLTH'))!.extendFee).toBe(100)
  })

  it('says nothing rather than guessing when there is no date or no rule', () => {
    expect(preapprovalAge('', ruleFor('CBA'))).toBeNull()
    expect(preapprovalAge(at(10), null)).toBeNull()
    expect(preapprovalAge('not a date', ruleFor('CBA'))).toBeNull()
  })
})

// The trap Fabio named: a REDUCTION at ANZ needs the broker to acknowledge it,
// which is a different thing from telling them the number changed.
describe('the ANZ acknowledgement', () => {
  it('is needed when the loan goes down at ANZ', () => {
    expect(needsAnzAcknowledgement('ANZ', 800_000, 700_000)).toBe(true)
  })

  it('is not needed when the loan goes up', () => {
    expect(needsAnzAcknowledgement('ANZ', 700_000, 800_000)).toBe(false)
  })

  it('is not needed at any other lender', () => {
    for (const n of ['CBA', 'Westpac', 'ING', 'Macquarie']) {
      expect(needsAnzAcknowledgement(n, 800_000, 700_000), n).toBe(false)
    }
  })

  it('reproduces their wording exactly, and does not paraphrase it', () => {
    const t = anzReductionEmail({ applicationReference: 'A123', change: 'Loan reduced to $700,000',
                                  conversationDate: '10/09/2026', brokerName: 'Fabio De Castro' })
    expect(t).toContain('Application reference: A123')
    expect(t).toContain('Description of Change: Loan reduced to $700,000')
    expect(t).toContain('Date of customer conversation: 10/09/2026')
    expect(t).toContain('Acknowledgement by Broker')
    expect(t).toContain('I acknowledge that I have asked all the Interview Guide questions')
    expect(t).toContain('I confirm I have not provided the applicant(s) with tax or financial advice.')
    expect(t).toContain('Broker Name: Fabio De Castro')
  })

  it('puts the broker on the deal on it, not a name baked into the code', () => {
    expect(anzReductionEmail({ brokerName: 'Kylie Nguyen' })).toContain('Broker Name: Kylie Nguyen')
    expect(anzReductionEmail({})).not.toContain('Fabio')
  })

  it('leaves a blank blank rather than inventing a value', () => {
    const t = anzReductionEmail({})
    expect(t).toContain('Application reference:')
    expect(t).not.toMatch(/undefined|null/)
  })
})

// HOW FAR THE LOAN MOVED.
//
// Fabio, 27 Sep 2026: "10% is only a St George Westpac and Bank of Melbourne
// rule so in the document library complete that as you build the rule and leave
// all other lenders as N/A... changes always apply up or down just percentage
// no dollar figure".
import { repricingCheck, repricingLine } from './offer-accepted-rules'
import { readFileSync as read2 } from 'fs'

describe('how far the loan moved', () => {
  it('reads an increase', () => {
    const c = repricingCheck(800000, 880000, 10)!
    expect(c.movedPercent).toBe(10)
    expect(c.direction).toBe('up')
    expect(c.over).toBe(false)   // exactly on the limit is not over it
  })

  it('and a reduction, which counts the same', () => {
    const c = repricingCheck(800000, 700000, 10)!
    expect(c.movedPercent).toBe(12.5)
    expect(c.direction).toBe('down')
    expect(c.over).toBe(true)
  })

  it('reads money typed with commas and a dollar sign', () => {
    expect(repricingCheck('$847,500', '$881,500', 10)!.movedPercent).toBe(4)
  })

  it('rounds to one place rather than printing a computer number', () => {
    expect(repricingCheck(847500, 952000, 10)!.movedPercent).toBe(12.3)
  })

  it('says nothing when the loan has not moved, or there is no loan', () => {
    expect(repricingCheck(800000, 800000, 10)).toBeNull()
    expect(repricingCheck(0, 800000, 10)).toBeNull()
    expect(repricingCheck(800000, '', 10)).toBeNull()
    expect(repricingCheck(null, null, 10)).toBeNull()
  })
})

// N/A IS A REAL ANSWER. A lender nobody has recorded a rule for is never handed
// the common one - telling somebody the discount still holds when it does not is
// worse than telling them to check.
describe('a lender with no rule recorded', () => {
  it('is not treated as within the rule', () => {
    const c = repricingCheck(800000, 950000, null)!
    expect(c.threshold).toBeNull()
    expect(c.over).toBe(false)
    expect(c.movedPercent).toBe(18.8)
  })

  it('blank, undefined and nonsense are all N/A', () => {
    for (const v of ['', '   ', undefined, null, 'about ten']) {
      expect(repricingCheck(800000, 950000, v)!.threshold).toBeNull()
    }
  })

  // Somebody could genuinely mean "any movement at all needs repricing".
  it('but zero is a rule, not a blank', () => {
    const c = repricingCheck(800000, 800001, 0)!
    expect(c.threshold).toBe(0)
    expect(c.over).toBe(true)
  })
})

describe('what a person reads', () => {
  it('within the limit', () => {
    expect(repricingLine(repricingCheck(847500, 881500, 10), 'St George'))
      .toBe("The loan moves up 4%. Within St George's 10% limit, so the pricing stands.")
  })

  it('over the limit', () => {
    expect(repricingLine(repricingCheck(847500, 952000, 10), 'Westpac'))
      .toBe("The loan moves up 12.3%. Over Westpac's 10% limit — they will want the pricing redone.")
  })

  it('no rule recorded, said out loud', () => {
    expect(repricingLine(repricingCheck(847500, 952000, null), 'Macquarie'))
      .toBe('The loan moves up 12.3%. No repricing rule is recorded for Macquarie, so check before you submit.')
  })

  it('and nothing at all when the loan has not moved', () => {
    expect(repricingLine(repricingCheck(800000, 800000, 10), 'ING')).toBe('')
  })
})

describe('the rule is kept where it can be changed without a deploy', () => {
  const sql = read2(new URL('../docs/lender-reprice-schema.sql', import.meta.url), 'utf8')
  const lib = read2(new URL('../components/LenderLibrary.tsx', import.meta.url), 'utf8')

  it('the column exists and can be run twice', () => {
    expect(sql).toContain('add column if not exists reprice_over_percent')
    // Re-running must not undo a figure somebody has since typed by hand.
    expect(sql).toContain('where reprice_over_percent is null')
  })

  it('only the three banks Fabio named are filled in', () => {
    expect(sql).toContain("name ilike 'st george%'")
    expect(sql).toContain("name ilike 'bank of melbourne%'")
    expect(sql).toContain("name ilike 'westpac%'")
    // BankSA shares the St George rules elsewhere. It was not one of the three.
    expect(sql.toLowerCase()).not.toContain("name ilike 'bank sa")
    expect(sql.toLowerCase()).not.toContain("name ilike 'banksa")
  })

  it('the lender library has a box for it, showing N/A when empty', () => {
    expect(lib).toContain('reprice_over_percent')
    expect(lib).toContain('placeholder="N/A"')
    expect(lib).toContain('setRepriceOver')
  })

  it('and emptying it puts the lender back to N/A', () => {
    expect(lib).toContain("const value = clean === '' ? null : Number(clean)")
  })
})
