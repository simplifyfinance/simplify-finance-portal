import { describe, it, expect } from 'vitest'
import {
  lenderForCode, banksSeen, accountsPerBank, coveredRows, shortOfPeriod,
  salaryAccounts, expensesAccount, undeclaredBanks,
} from './statement-cover'

const LENDERS = [
  { name: 'Commonwealth Bank', statement_codes: 'CBA, CommBank' },
  { name: 'ING', statement_codes: 'ING' },
  { name: 'NAB', statement_codes: 'NAB, National Australia Bank' },
  { name: 'Macquarie', statement_codes: null },
]

const upload = (institutions: string[], days = 180) => ({
  institutions, period_from: '2026-03-05', period_to: '2026-08-31', days,
})

describe('turning a statement code into a lender', () => {
  it('translates the short code the statements actually use', () => {
    expect(lenderForCode('CBA', LENDERS)).toBe('Commonwealth Bank')
    expect(lenderForCode('CommBank', LENDERS)).toBe('Commonwealth Bank')
  })

  it('does not care about case or punctuation', () => {
    expect(lenderForCode('cba', LENDERS)).toBe('Commonwealth Bank')
    expect(lenderForCode('C.B.A.', LENDERS)).toBe('Commonwealth Bank')
    expect(lenderForCode(' national australia bank ', LENDERS)).toBe('NAB')
  })

  it('matches the lender name itself, so a bank with no codes still works', () => {
    expect(lenderForCode('Macquarie', LENDERS)).toBe('Macquarie')
  })

  it('says nothing rather than guessing', () => {
    expect(lenderForCode('Latitude', LENDERS)).toBeNull()
    expect(lenderForCode('', LENDERS)).toBeNull()
  })
})

describe('what arrived', () => {
  it('reports the banks, translated', () => {
    const seen = banksSeen([upload(['CBA', 'ING'])], LENDERS)
    expect(seen.known.sort()).toEqual(['Commonwealth Bank', 'ING'])
    expect(seen.unrecognised).toEqual([])
    expect(seen.days).toBe(180)
  })

  // An unknown code must never fail silently - it is how the library learns.
  it('holds up a code nothing recognises', () => {
    const seen = banksSeen([upload(['CBA', 'XYZ Bank'])], LENDERS)
    expect(seen.known).toEqual(['Commonwealth Bank'])
    expect(seen.unrecognised).toEqual(['XYZ Bank'])
  })

  it('spans every upload, widest period wins', () => {
    const seen = banksSeen([
      { institutions: ['CBA'], period_from: '2026-05-01', period_to: '2026-07-31', days: 90 },
      { institutions: ['ING'], period_from: '2026-03-05', period_to: '2026-08-31', days: 180 },
    ], LENDERS)
    expect(seen.from).toBe('2026-03-05')
    expect(seen.to).toBe('2026-08-31')
    expect(seen.days).toBe(180)
  })

  it('copes with nothing loaded', () => {
    const seen = banksSeen([], LENDERS)
    expect(seen.known).toEqual([])
    expect(seen.days).toBe(0)
  })

  it('counts the accounts per bank without trying to match them', () => {
    const txns = [
      { institution: 'CBA', account_number: '111' },
      { institution: 'CBA', account_number: '111' },
      { institution: 'CBA', account_number: '222' },
      { institution: 'CBA', account_number: '333' },
      { institution: 'ING', account_number: '999' },
    ]
    expect(accountsPerBank(txns, LENDERS)).toEqual({ 'Commonwealth Bank': 3, ING: 1 })
  })
})

describe('crossing rows off', () => {
  const seen = banksSeen([upload(['CBA', 'ING'])], LENDERS)

  it('crosses off a row whose bank arrived', () => {
    const rows = [
      { key: 'home-loan-statement:ln1', coveredByBank: 'Commonwealth Bank' },
      { key: 'cc-statement:l1', coveredByBank: 'NAB' },
    ]
    expect(coveredRows(rows, seen).map(c => c.key)).toEqual(['home-loan-statement:ln1'])
  })

  // Splits are the reason this is bank level. Three CBA loans, one CBA
  // statement bundle, all three covered - nothing to reconcile.
  it('covers every row from the same bank at once', () => {
    const rows = [
      { key: 'a', coveredByBank: 'Commonwealth Bank' },
      { key: 'b', coveredByBank: 'Commonwealth Bank' },
      { key: 'c', coveredByBank: 'Commonwealth Bank' },
    ]
    expect(coveredRows(rows, seen)).toHaveLength(3)
  })

  it('never crosses off a row that names no bank', () => {
    const rows = [{ key: 'id:a1' }, { key: 'rates:p1', coveredByBank: '' }]
    expect(coveredRows(rows, seen)).toHaveLength(0)
  })

  it('crosses off nothing when no statements arrived', () => {
    const none = banksSeen([], LENDERS)
    expect(coveredRows([{ key: 'a', coveredByBank: 'Commonwealth Bank' }], none)).toHaveLength(0)
  })
})

describe('a period that is too short to be any use', () => {
  it('spots six months wanted against three months arrived', () => {
    expect(shortOfPeriod('last 6 months', 92)).toBe(180)
  })

  it('is happy when enough arrived', () => {
    expect(shortOfPeriod('last 6 months', 180)).toBeNull()
    expect(shortOfPeriod('last 3 months', 92)).toBeNull()
  })

  it('allows a few days of slack rather than crying about 179', () => {
    expect(shortOfPeriod('last 6 months', 175)).toBeNull()
  })

  it('says nothing about a document with no period', () => {
    expect(shortOfPeriod('most recent', 30)).toBeNull()
    expect(shortOfPeriod(undefined, 30)).toBeNull()
  })
})

describe('the account the salary lands in', () => {
  const txns = [
    { institution: 'ING', account_name: 'Orange Everyday', category: 'Salary', amount: 4200 },
    { institution: 'ING', account_name: 'Orange Everyday', category: 'Salary', amount: 4200 },
    { institution: 'CBA', account_name: 'Smart Access', category: 'Wages', amount: 3100 },
    { institution: 'CBA', account_name: 'Smart Access', category: 'Groceries', amount: -180 },
    { institution: 'CBA', account_name: 'Smart Access', category: 'Utilities', amount: -95 },
    { institution: 'CBA', account_name: 'Smart Access', category: 'Fuel', amount: -70 },
  ]

  it('reads it from what CashDeck already classified', () => {
    const found = salaryAccounts(txns, LENDERS)
    expect(found.map(f => f.bank)).toEqual(['ING', 'Commonwealth Bank'])
    expect(found[0].account).toBe('Orange Everyday')
  })

  it('ignores money going out', () => {
    const out = salaryAccounts([{ institution: 'ING', category: 'Salary', amount: -4200 }], LENDERS)
    expect(out).toHaveLength(0)
  })

  it('picks the account most of the spending leaves from', () => {
    const acct = expensesAccount(txns, LENDERS)
    expect(acct!.bank).toBe('Commonwealth Bank')
    expect(acct!.count).toBe(3)
  })

  it('says nothing when there is nothing to read', () => {
    expect(salaryAccounts([], LENDERS)).toEqual([])
    expect(expensesAccount([], LENDERS)).toBeNull()
  })
})

describe('a bank the fact find has never heard of', () => {
  const deal = { fact_find_data: {
    liabilities: [{ liabilityType: 'Credit card', lenderName: 'NAB' }],
    assets: [{ assetType: 'Bank account', description: 'ING' }],
    properties: [{ loans: [{ lenderName: 'Commonwealth Bank' }] }],
  } }

  it('says nothing when everything lines up', () => {
    const seen = banksSeen([upload(['CBA', 'ING', 'NAB'])], LENDERS)
    expect(undeclaredBanks(seen, deal, LENDERS)).toEqual([])
  })

  // THE ONE FABIO ASKED FOR: "if the statement arrived for an account that
  // there's nowhere to be seen on the fact find, I want that to be flagged
  // absolutely."
  it('flags a bank that appears nowhere on the deal', () => {
    const withMacq = banksSeen([upload(['CBA', 'Macquarie'])], LENDERS)
    expect(undeclaredBanks(withMacq, deal, LENDERS)).toEqual(['Macquarie'])
  })

  it('is not fooled by the fact find and the statements spelling it differently', () => {
    const spelled = { fact_find_data: { liabilities: [{ lenderName: 'Commonwealth Bank' }] } }
    const seen = banksSeen([upload(['CBA'])], LENDERS)
    expect(undeclaredBanks(seen, spelled, LENDERS)).toEqual([])
  })

  it('says nothing about a code it could not translate — that is its own question', () => {
    const seen = banksSeen([upload(['Latitude'])], LENDERS)
    expect(undeclaredBanks(seen, deal, LENDERS)).toEqual([])
    expect(seen.unrecognised).toEqual(['Latitude'])
  })

  it('copes with an empty deal', () => {
    const seen = banksSeen([upload(['CBA'])], LENDERS)
    expect(undeclaredBanks(seen, {}, LENDERS)).toEqual(['Commonwealth Bank'])
    expect(() => undeclaredBanks(seen, null, LENDERS)).not.toThrow()
  })
})
