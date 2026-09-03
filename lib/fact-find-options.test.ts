import { describe, it, expect } from 'vitest'
import {
  SELF_EMPLOYED_STRUCTURES, RESIDENCY_STATUSES, OTHER_INCOME_TYPES, ASSET_TYPES, DEPOSIT_SOURCES,
  keptValue, optionsFor, isSoleTrader, needsCompanyFinancials, structureAnswered,
} from './fact-find-options'

describe('a value already on a deal is never lost', () => {
  it('leaves a listed value alone', () => {
    expect(keptValue('Company', SELF_EMPLOYED_STRUCTURES)).toBeNull()
    expect(keptValue('Bank account', ASSET_TYPES)).toBeNull()
  })

  it('keeps a value nobody would pick today', () => {
    // Typed into the old free-text box. It stays, spelled exactly as typed.
    expect(keptValue('Centrelink parenting payment', OTHER_INCOME_TYPES))
      .toBe('Centrelink parenting payment')
  })

  it('ignores blanks and whitespace', () => {
    expect(keptValue('', OTHER_INCOME_TYPES)).toBeNull()
    expect(keptValue('   ', OTHER_INCOME_TYPES)).toBeNull()
    expect(keptValue(null, OTHER_INCOME_TYPES)).toBeNull()
    expect(keptValue(undefined, OTHER_INCOME_TYPES)).toBeNull()
  })

  it('offers the saved value as an extra choice, at the end', () => {
    const opts = optionsFor('Centrelink parenting payment', OTHER_INCOME_TYPES)
    expect(opts).toHaveLength(OTHER_INCOME_TYPES.length + 1)
    expect(opts[opts.length - 1]).toBe('Centrelink parenting payment')
  })

  it('offers the plain list when nothing unusual is saved', () => {
    expect(optionsFor('Dividends', OTHER_INCOME_TYPES)).toEqual([...OTHER_INCOME_TYPES])
    expect(optionsFor('', DEPOSIT_SOURCES)).toEqual([...DEPOSIT_SOURCES])
  })
})

describe('the lists themselves', () => {
  it('has Shares, which is the whole reason a share statement could never be asked for', () => {
    expect(ASSET_TYPES).toContain('Shares')
  })

  it('keeps Home Contents, because deals already carry it', () => {
    expect(ASSET_TYPES).toContain('Home Contents')
  })

  it('does not offer rental income as an other-income type', () => {
    // It belongs to the property that earns it. Two homes for one answer means
    // two answers that disagree.
    expect(OTHER_INCOME_TYPES).not.toContain('Rental income')
  })

  it('offers a gift as a deposit source, which is what the gift letter hangs off', () => {
    expect(DEPOSIT_SOURCES).toContain('Gift')
  })

  it('has no duplicates in any list', () => {
    for (const list of [SELF_EMPLOYED_STRUCTURES, RESIDENCY_STATUSES, OTHER_INCOME_TYPES, ASSET_TYPES, DEPOSIT_SOURCES]) {
      expect(new Set(list).size).toBe(list.length)
    }
  })
})

describe('what the document checklist will ask about a self-employed applicant', () => {
  it('knows a sole trader needs no company paperwork', () => {
    const emp = { selfEmployedStructure: 'Sole trader' }
    expect(isSoleTrader(emp)).toBe(true)
    expect(needsCompanyFinancials(emp)).toBe(false)
    expect(structureAnswered(emp)).toBe(true)
  })

  it('knows a company does', () => {
    const emp = { selfEmployedStructure: 'Company' }
    expect(isSoleTrader(emp)).toBe(false)
    expect(needsCompanyFinancials(emp)).toBe(true)
  })

  it('treats partnerships and trusts like a company', () => {
    expect(needsCompanyFinancials({ selfEmployedStructure: 'Partnership' })).toBe(true)
    expect(needsCompanyFinancials({ selfEmployedStructure: 'Trust' })).toBe(true)
  })

  // THE ONE THAT MATTERS. An unanswered question must not quietly become five
  // documents, and must not quietly become none either - the checklist has to be
  // able to say "nobody has said which".
  it('does not guess when nobody has answered', () => {
    for (const emp of [{}, { selfEmployedStructure: '' }, { selfEmployedStructure: '  ' }, null, undefined]) {
      expect(structureAnswered(emp)).toBe(false)
      expect(isSoleTrader(emp)).toBe(false)
      expect(needsCompanyFinancials(emp)).toBe(false)
    }
  })

  it('does not treat a free-typed structure as answered', () => {
    expect(structureAnswered({ selfEmployedStructure: 'Pty Ltd' })).toBe(false)
  })
})
