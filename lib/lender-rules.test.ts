// WHAT WE HAVE LEARNED ABOUT A LENDER, ASKED ONCE.
//
// Fabio, 29 Sep 2026: "dont worry about bank non bank lets build a rules based
// on each ledner to learn as we seelct if preapprovalc na extended etc".

import { describe, it, expect } from 'vitest'
import {
  RULES, ruleQuestion, optionLabel, rulesOf, answerTo, isAnswered,
  rememberedLine, notRecordedLine, unanswered, ruleWrite,
} from './lender-rules'

const BANKWEST = 'b1a2c3d4-0000-0000-0000-000000000001'

const rows = [
  { key: 'contracts_issued_by', value: 'online', set_by: 'Katie Amos',
    set_at: '2026-09-29T00:00:00Z', used: 12 },
  { key: 'preapproval_extensions', value: 'twice', set_by: 'Fabio de Castro',
    set_at: '2026-09-29T00:00:00Z', used: 3 },
]

describe('no answer means ask, never assume', () => {
  it('a lender nobody has answered for has nothing', () => {
    const r = rulesOf([])
    expect(isAnswered(r, 'postcode_restrictions')).toBe(false)
    expect(answerTo(r, 'postcode_restrictions')).toBe('')
  })

  it('says which question is unanswered, in the words it will ask', () => {
    expect(notRecordedLine(rulesOf([]), 'postcode_restrictions', 'Pepper'))
      .toBe('Not recorded for Pepper — do certain postcodes have lending restrictions with this lender?')
  })

  it('says nothing once it has been answered', () => {
    const r = rulesOf([{ key: 'postcode_restrictions', value: 'yes' }])
    expect(notRecordedLine(r, 'postcode_restrictions', 'Pepper')).toBe('')
  })

  it('lists everything still to ask, once rather than five times', () => {
    expect(unanswered(rulesOf(rows)).map(q => q.key))
      .toEqual(['postcode_restrictions', 'docusign_certificate', 'insurance_minimum'])
    expect(unanswered(rulesOf(rows), ['contracts_issued_by'])).toEqual([])
  })
})

describe('what has been answered', () => {
  it('reads the rows back', () => {
    const r = rulesOf(rows)
    expect(answerTo(r, 'contracts_issued_by')).toBe('online')
    expect(optionLabel('contracts_issued_by', 'online')).toBe('Through online banking')
  })

  it('names who is askable, and how much the rule has been leaned on', () => {
    expect(rememberedLine(rulesOf(rows), 'contracts_issued_by', 'Bankwest'))
      .toBe('Remembered for Bankwest · set by Katie Amos · used on 12 deals')
  })

  it('counts one deal without an s', () => {
    expect(rememberedLine(rulesOf([{ key: 'docusign_certificate', value: 'yes', set_by: 'Katie', used: 1 }]),
      'docusign_certificate', 'Pepper')).toBe('Remembered for Pepper · set by Katie · used on 1 deal')
  })

  it('drops a retired question rather than letting it steer an email', () => {
    const r = rulesOf([...rows, { key: 'something_we_removed', value: 'yes' }])
    expect(Object.keys(r).sort()).toEqual(['contracts_issued_by', 'preapproval_extensions'])
  })

  it('an empty answer is not an answer', () => {
    expect(isAnswered(rulesOf([{ key: 'docusign_certificate', value: '   ' }]), 'docusign_certificate'))
      .toBe(false)
  })

  it('survives rubbish', () => {
    expect(rulesOf(null)).toEqual({})
    expect(rulesOf('nope')).toEqual({})
    expect(rulesOf([null, {}])).toEqual({})
  })
})

describe('changing one is two different actions', () => {
  // One button doing both is how a rule quietly becomes wrong for everybody
  // because of one unusual file.
  it('this deal only writes nothing at all', () => {
    expect(ruleWrite(BANKWEST, 'contracts_issued_by', 'post', 'Katie', 'deal')).toBeNull()
  })

  it('for the lender writes the row', () => {
    expect(ruleWrite(BANKWEST, 'contracts_issued_by', 'post', 'Katie Amos', 'lender'))
      .toEqual({ lender_id: BANKWEST, key: 'contracts_issued_by', value: 'post', set_by: 'Katie Amos' })
  })

  it('refuses an answer that is not one of the options', () => {
    // A value the table would hold and nothing could read back.
    expect(ruleWrite(BANKWEST, 'contracts_issued_by', 'carrier pigeon', 'Katie', 'lender')).toBeNull()
    expect(ruleWrite(BANKWEST, 'preapproval_extensions', 'yes', 'Katie', 'lender')).toBeNull()
  })

  it('refuses an unknown question, a blank answer and a missing lender', () => {
    expect(ruleWrite(BANKWEST, 'not_a_question', 'yes', 'Katie', 'lender')).toBeNull()
    expect(ruleWrite(BANKWEST, 'docusign_certificate', '  ', 'Katie', 'lender')).toBeNull()
    expect(ruleWrite('', 'docusign_certificate', 'yes', 'Katie', 'lender')).toBeNull()
  })
})

describe('the catalogue itself', () => {
  it('has no duplicate keys', () => {
    const keys = RULES.map(r => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every question has at least two answers, and every answer a label', () => {
    for (const q of RULES) {
      expect(q.options.length).toBeGreaterThan(1)
      expect(q.ask.endsWith('?')).toBe(true)
      expect(q.short.length).toBeGreaterThan(0)
      for (const o of q.options) {
        expect(o.value.trim()).not.toBe('')
        expect(o.label.trim()).not.toBe('')
      }
      // Distinct values, or two options would be the same answer.
      expect(new Set(q.options.map(o => o.value)).size).toBe(q.options.length)
    }
  })

  it('covers the five things the templates need', () => {
    expect(RULES.map(r => r.key).sort()).toEqual([
      'contracts_issued_by', 'docusign_certificate', 'insurance_minimum',
      'postcode_restrictions', 'preapproval_extensions',
    ])
    expect(ruleQuestion('preapproval_extensions')!.options.map(o => o.value))
      .toEqual(['none', 'once', 'twice', 'more'])
  })
})
