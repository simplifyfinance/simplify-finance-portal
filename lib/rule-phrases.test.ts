import { describe, it, expect } from 'vitest'
import { RULES, PHRASE_TABLES, contractsByPhrase, insuredPartyName,
         type LenderRule } from '@/lib/lender-rules'

const rule = (key: string, value: string): Record<string, LenderRule> => ({
  [key]: { key, value, setBy: 'Katie', setAt: '2026-09-29', used: 3 },
})

describe('a rule answer in the words a client reads', () => {
  // THE GUARD. A new option added to the catalogue with no wording beside it
  // would tick a block and print a blank into the middle of a sentence. This
  // fails the moment that happens, in the file where it happened.
  for (const key of Object.keys(PHRASE_TABLES)) {
    it(`every option of ${key} has words`, () => {
      const q = RULES.find(r => r.key === key)
      expect(q, `${key} is in PHRASE_TABLES but not in RULES`).toBeTruthy()
      for (const o of q!.options) {
        expect(PHRASE_TABLES[key][o.value], `no wording for ${key}=${o.value}`).toBeTruthy()
      }
    })

    it(`${key} has no wording for an option that no longer exists`, () => {
      const q = RULES.find(r => r.key === key)!
      for (const value of Object.keys(PHRASE_TABLES[key])) {
        expect(q.options.some(o => o.value === value), `${key}=${value} is worded but not offered`).toBe(true)
      }
    })
  }

  it('reads the answer, not the value', () => {
    expect(contractsByPhrase(rule('contracts_issued_by', 'post'))).toBe('by express post')
  })

  it('says nothing at all for a lender nobody has answered for', () => {
    expect(contractsByPhrase({})).toBe('')
    expect(insuredPartyName({})).toBe('')
  })

  // THE TYPED ONE IS NOT PHRASED AT ALL. It is the bank's own wording, and
  // anything this file did to it would be this file deciding what a bank is
  // called. 30 Sep 2026, Fabio: "lenders are very specific for the name".
  it('hands back the insurance name exactly as it was typed', () => {
    const name = 'Bankwest, a division of Commonwealth Bank of Australia'
    expect(insuredPartyName(rule('insurance_interested_party', name))).toBe(name)
    expect(PHRASE_TABLES.insurance_interested_party).toBeUndefined()
  })

  it('says nothing for an answer that is not one of the options', () => {
    expect(contractsByPhrase(rule('contracts_issued_by', 'carrier pigeon'))).toBe('')
  })
})
