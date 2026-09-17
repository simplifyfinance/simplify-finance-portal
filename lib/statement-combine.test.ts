import { describe, it, expect } from 'vitest'
import { combine, personOf, periodOf, peopleByAccount, removalCost, daysBetween } from './statement-combine'

// Fabio, 17 Sep 2026: one analysis across every set of statements on the deal,
// with every finding still saying whose account it came from.

const upload = (over: any = {}) => ({
  id: 'u1', file_name: 'Byrnes_Emma_CBA.xlsm', client_name: 'Emma Byrnes',
  uploaded_at: '2026-09-17T04:00:00Z',
  parsed_meta: {
    client: { firstName: 'Emma', lastName: 'Byrnes', email: '', mobile: '', externalId: '' },
    institutions: ['CBA'],
    accounts: [{ accountNumber: '4471', name: 'Everyday', institution: 'CBA',
                 available: 1200, currentBalance: 1200, from: '2026-03-01', to: '2026-08-31', txnCount: 2 }],
    periodFrom: '2026-03-01', periodTo: '2026-08-31', days: 184,
    balancesAvailable: true, warnings: ['one warning'],
  },
  ...over,
})

const joshua = upload({
  id: 'u2', file_name: 'Byrnes_Joshua_ubank.xlsm', client_name: 'Joshua Byrnes',
  parsed_meta: {
    client: { firstName: 'Joshua', lastName: 'Byrnes', email: '', mobile: '', externalId: '' },
    institutions: ['ubank'],
    accounts: [{ accountNumber: '3306', name: 'Spend', institution: 'ubank',
                 available: 400, currentBalance: 400, from: '2026-06-01', to: '2026-08-31', txnCount: 1 }],
    periodFrom: '2026-06-01', periodTo: '2026-08-31', days: 92,
    balancesAvailable: true, warnings: [],
  },
})

const txn = (over: any = {}) => ({
  upload_id: 'u1', external_id: 't1', txn_date: '2026-04-02', description: 'WOOLWORTHS',
  merchant: 'Woolworths', account_number: '4471', account_name: 'Everyday', institution: 'CBA',
  category: 'Groceries', summary_category: 'Living', category_type: 'Expense', amount: -84.2, ...over,
})

const TXNS = [
  txn(),
  txn({ external_id: 't2', txn_date: '2026-03-15', amount: 2400, category_type: 'Income' }),
  txn({ upload_id: 'u2', external_id: 't3', txn_date: '2026-07-04', account_number: '3306',
        account_name: 'Spend', institution: 'ubank', amount: -40 }),
]

describe('one ledger out of every set', () => {
  const c = combine([upload(), joshua], TXNS)

  it('carries every transaction, in date order', () => {
    expect(c.transactions).toHaveLength(3)
    expect(c.transactions.map(t => t.date)).toEqual(['2026-03-15', '2026-04-02', '2026-07-04'])
  })

  it('spans the earliest start to the latest end', () => {
    expect(c.periodFrom).toBe('2026-03-01')
    expect(c.periodTo).toBe('2026-08-31')
    expect(c.days).toBe(184)
  })

  it('keeps every account, so coverage is still judged per account', () => {
    expect(c.accounts.map(a => a.accountNumber)).toEqual(['4471', '3306'])
  })

  it('KEEPS THE BALANCES, which the conduct assessment depends on', () => {
    expect(c.accounts[0].currentBalance).toBe(1200)
    expect(c.balancesAvailable).toBe(true)
  })

  it('never counts the same account twice when it is in two workbooks', () => {
    const twice = combine([upload(), upload({ id: 'u3' })], TXNS)
    expect(twice.accounts).toHaveLength(1)
  })

  it('gathers the institutions and the warnings', () => {
    expect(c.institutions).toEqual(['CBA', 'ubank'])
    expect(c.warnings).toEqual(['one warning'])
  })

  it('survives a deal with nothing on it', () => {
    const empty = combine([], [])
    expect(empty.transactions).toEqual([])
    expect(empty.accounts).toEqual([])
    expect(empty.days).toBe(0)
  })
})

describe('whose statements are these', () => {
  it('reads the name off the workbook', () => {
    expect(personOf(upload())).toBe('Emma Byrnes')
  })

  it('falls back to the file name rather than an empty label', () => {
    expect(personOf({ id: 'x', file_name: 'a.xlsm' })).toBe('a.xlsm')
    expect(personOf(null)).toBe('Unnamed set')
  })

  it('says which person each account belongs to', () => {
    expect(peopleByAccount([upload(), joshua], TXNS)).toEqual({
      '4471': 'Emma Byrnes', '3306': 'Joshua Byrnes',
    })
  })
})

describe('what removing a set would cost', () => {
  const sets = [upload(), joshua]

  it('counts the transactions that would go, and names whose they are', () => {
    const cost = removalCost(sets, TXNS, 'u2')
    expect(cost.transactions).toBe(1)
    expect(cost.person).toBe('Joshua Byrnes')
    expect(cost.keptSets).toBe(1)
  })

  it('WARNS when it shortens the period being assessed', () => {
    // Emma's is the only set covering March to May.
    expect(removalCost(sets, TXNS, 'u1').leavesGap).toBe(true)
  })

  it('does not cry gap when the period is unchanged', () => {
    expect(removalCost(sets, TXNS, 'u2').leavesGap).toBe(false)
  })

  it('says nothing about a gap when it was the only set', () => {
    expect(removalCost([upload()], TXNS, 'u1').leavesGap).toBe(false)
  })
})

describe('the period arithmetic', () => {
  it('counts both end days', () => {
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(1)
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(31)
  })
  it('is zero rather than wrong on rubbish', () => {
    expect(daysBetween('', '')).toBe(0)
    expect(periodOf([]).days).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// AND THE REAL ANALYSIS RUNS OVER IT.
//
// The point of the shape above is that analyse() does not have to change: it is
// handed more transactions and more accounts and works everything out the same
// way. This proves that rather than assuming it.

import { analyse } from './statement-analysis'

describe('analyse() reads a combined ledger', () => {
  const combined = combine([upload(), joshua], TXNS)
  const a = analyse(combined, { applicants: [{ firstName: 'Emma', lastName: 'Byrnes' }] })

  it('judges coverage per account, across both people', () => {
    const accts = a.coverage.accounts.map(x => x.accountNumber)
    expect(accts).toContain('4471')
    expect(accts).toContain('3306')
  })

  it('marks the short account short, and leaves the full one alone', () => {
    const full = a.coverage.accounts.find(x => x.accountNumber === '4471')!
    const short = a.coverage.accounts.find(x => x.accountNumber === '3306')!
    expect(full.pct).toBeGreaterThanOrEqual(90)
    expect(short.pct, 'Joshua covers 92 of 184 days').toBeLessThan(90)
    expect(a.coverage.complete).toBe(false)
  })

  it('produces one score for the deal, not one per set', () => {
    expect(typeof a.score.total).toBe('number')
  })

  it('the short account can be named with its person', () => {
    const who = peopleByAccount([upload(), joshua], TXNS)
    const short = a.coverage.accounts.find(x => x.pct < 90)!
    expect(who[short.accountNumber]).toBe('Joshua Byrnes')
  })
})
