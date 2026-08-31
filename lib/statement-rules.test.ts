import { describe, it, expect } from 'vitest'
import { DEFAULT_RULES, normaliseRules, rulesChanged } from './statement-rules'

describe('rules that were never saved', () => {
  it('falls back to the shipped defaults', () => {
    expect(normaliseRules(null)).toEqual(DEFAULT_RULES)
    expect(normaliseRules({})).toEqual(DEFAULT_RULES)
    expect(normaliseRules('nonsense')).toEqual(DEFAULT_RULES)
  })
  it('fills in a field added after the settings were last saved', () => {
    const old = { cashThreshold: 500 }
    const r = normaliseRules(old)
    expect(r.cashThreshold).toBe(500)
    expect(r.savingsWindowDays).toBe(DEFAULT_RULES.savingsWindowDays)
    expect(r.bnpl.length).toBe(DEFAULT_RULES.bnpl.length)
  })
})

describe('rules that were saved badly', () => {
  it('reads a number out of whatever the box contained', () => {
    expect(normaliseRules({ cashThreshold: '$2,500' }).cashThreshold).toBe(2500)
    expect(normaliseRules({ cashThreshold: '' }).cashThreshold).toBe(DEFAULT_RULES.cashThreshold)
    expect(normaliseRules({ cashThreshold: 'abc' }).cashThreshold).toBe(DEFAULT_RULES.cashThreshold)
  })
  it('will not let the serious threshold sit below the question one', () => {
    // Otherwise a variance could be red and amber at once and the card would
    // contradict itself.
    const r = normaliseRules({ salaryQueryPct: 20, salaryActionPct: 5 })
    expect(r.salaryActionPct).toBe(20)
  })
  it('keeps a threshold inside a range that means something', () => {
    expect(normaliseRules({ cashThreshold: -50 }).cashThreshold).toBe(1)
    expect(normaliseRules({ gamblingPct: 900 }).gamblingPct).toBe(100)
    expect(normaliseRules({ savingsWindowDays: 0 }).savingsWindowDays).toBe(1)
  })
  it('drops a provider with a name but nothing to match on', () => {
    const r = normaliseRules({ bnpl: [
      { name: 'Afterpay', terms: ['afterpay'] },
      { name: 'Typed the name and stopped', terms: [] },
      { name: '', terms: ['orphan'] },
    ] })
    expect(r.bnpl).toEqual([{ name: 'Afterpay', terms: ['afterpay'] }])
  })
  it('accepts terms typed as one comma separated line', () => {
    const r = normaliseRules({ bnpl: [{ name: 'Zip Pay', terms: 'zippay, zipmoney , zipco' }] })
    expect(r.bnpl[0].terms).toEqual(['zippay', 'zipmoney', 'zipco'])
  })
  it('falls back rather than leaving a list empty', () => {
    expect(normaliseRules({ gambling: [] }).gambling).toEqual(DEFAULT_RULES.gambling)
    expect(normaliseRules({ bnpl: [] }).bnpl.length).toBe(DEFAULT_RULES.bnpl.length)
  })
  it('only accepts a servicing use it knows', () => {
    const r = normaliseRules({ benefits: [{ name: 'X', terms: ['x'], servicingUse: 'always' }] })
    expect(r.benefits[0].servicingUse).toBe('sometimes')
  })
})

describe('telling someone what changed', () => {
  it('names the rules in plain words', () => {
    expect(rulesChanged(DEFAULT_RULES, DEFAULT_RULES)).toEqual([])
    expect(rulesChanged(DEFAULT_RULES, { ...DEFAULT_RULES, cashThreshold: 500 }))
      .toEqual(['Large cash movement'])
    const changed = rulesChanged(DEFAULT_RULES, {
      ...DEFAULT_RULES, cashThreshold: 500,
      bnpl: [...DEFAULT_RULES.bnpl, { name: 'Sezzle', terms: ['sezzle'] }],
    })
    expect(changed).toEqual(['Large cash movement', 'Buy now pay later providers'])
  })
  it('treats rules never saved as the defaults, so nothing reads as changed', () => {
    expect(rulesChanged(null, DEFAULT_RULES)).toEqual([])
    expect(rulesChanged({}, {})).toEqual([])
  })
})
