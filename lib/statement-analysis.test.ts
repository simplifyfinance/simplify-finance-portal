import { describe, it, expect } from 'vitest'
import type { ParsedStatements, ParsedTxn } from './statement-parse'
import {
  analyse, cleanName, displayName, payerKey, cadenceOf, matchesDeclared,
  readDeclaredIncome, readDeclaredLiabilities, deriveBalances, annualiseFreq,
  isGovernment, benefitType, isRebate, bnplProvider, isDishonour, isGambling,
} from './statement-analysis'

const CBA = '062-000 11112222'
const ING = '923-100 33334444'

let seq = 0
function t(date: string, description: string, amount: number, opts: Partial<ParsedTxn> = {}): ParsedTxn {
  return {
    externalId: `t${++seq}`, date, description, merchant: opts.merchant ?? '',
    accountNumber: opts.accountNumber ?? CBA, accountName: opts.accountName ?? 'Smart Access',
    institution: opts.institution ?? 'Commonwealth Bank',
    category: opts.category ?? '', summaryCategory: opts.summaryCategory ?? '',
    categoryType: amount > 0 ? 'Income' : 'Expense', amount, ...opts,
  }
}

const FORTNIGHTS = ['2026-06-05', '2026-06-19', '2026-07-03', '2026-07-17', '2026-07-31', '2026-08-14']
const MONTHS = ['2026-06-05', '2026-07-05', '2026-08-05']

function build(extra: ParsedTxn[] = []): ParsedStatements {
  seq = 0
  const txns: ParsedTxn[] = [
    ...FORTNIGHTS.map(d => t(d, 'ACME LOGISTICS PTY LTD PAYROLL', 4237)),
    ...FORTNIGHTS.map(d => t(d, 'CENTRELINK FAMILY TAX BENE', 329.05)),
    ...MONTHS.map(d => t(d, 'LJ HOOKER LANE COVE RENT', -1950, { category: 'Rent' })),
    ...MONTHS.map(d => t(d, 'TOYOTA FINANCE AUST DD', -585, { category: 'Non SACC Loans' })),
    ...MONTHS.map(d => t(d, 'NOW FINANCE DIRECT DEBIT', -412, { category: 'Non SACC Loans' })),
    ...FORTNIGHTS.map(d => t(d, 'AFTERPAY', -38.05, { category: 'Buy Now, Pay Later' })),
    ...MONTHS.map(d => t(d, 'ZIP PAY REPAYMENT', -60, { category: 'Buy Now, Pay Later' })),
    ...extra,
  ]
  const dates = txns.map(x => x.date).sort()
  return {
    source: 'cashdeck',
    client: { firstName: 'Jo', lastName: 'Sample', email: '', mobile: '', externalId: '1' },
    accounts: [
      { accountNumber: CBA, name: 'Smart Access', institution: 'Commonwealth Bank', available: 20000, currentBalance: 20000, from: dates[0], to: dates[dates.length - 1], txnCount: txns.filter(x => x.accountNumber === CBA).length },
      { accountNumber: ING, name: 'Savings Maximiser', institution: 'ING', available: 18000, currentBalance: 18000, from: dates[0], to: dates[dates.length - 1], txnCount: txns.filter(x => x.accountNumber === ING).length },
    ],
    institutions: ['Commonwealth Bank', 'ING'],
    transactions: txns,
    periodFrom: dates[0], periodTo: dates[dates.length - 1],
    days: 71, balancesAvailable: true, warnings: [],
  }
}

const FACT_FIND = {
  applicants: [{ firstName: 'Jo', lastName: 'Sample', income: [{ grossSalary: '210000', grossSalaryFrequency: 'Annually' }] }],
  properties: [],
  liabilities: [{ liabilityType: 'Car loan', lenderName: 'Toyota Finance', repaymentAmount: '585', repaymentFrequency: 'Monthly', status: 'Remain open' }],
}
const card = (a: any, k: string) => a.cards.find((c: any) => c.key === k)

describe('reading the statement line', () => {
  it('strips the plumbing off a transfer description', () => {
    expect(cleanName('Savings - Transfer to AFG Home Loan - Receipt 862882 To 806007 731858')).toBe('AFG Home Loan')
    expect(cleanName('DIRECT DEBIT NOW FINANCE')).toBe('NOW FINANCE')
    expect(cleanName('From TAL Life Limited - 7151865')).toBe('TAL Life Limited')
  })
  it('keeps the bank line rather than showing a generic word', () => {
    expect(displayName('Payment', 'PAYMENT TO SOMEONE 4471')).toBe('PAYMENT TO SOMEONE 4471')
    expect(displayName('AFTERPAY', 'x')).toBe('AFTERPAY')
  })
  it('treats one employer with different reference numbers as one payer', () => {
    expect(payerKey(t('2026-06-05', 'ACME LOGISTICS PAYROLL 88213', 100)))
      .toBe(payerKey(t('2026-06-19', 'ACME LOGISTICS PAYROLL 88422', 100)))
  })
  it('reads a pay cycle from the dates', () => {
    expect(cadenceOf(FORTNIGHTS).kind).toBe('fortnightly')
    expect(cadenceOf(MONTHS).kind).toBe('monthly')
    expect(cadenceOf(['2026-06-01']).kind).toBe('once')
    expect(cadenceOf(['2026-06-01', '2026-06-03', '2026-08-20']).kind).toBe('irregular')
  })
})

describe('what a short code must not match', () => {
  // "ppl" lives inside "apple" and "ing" inside almost everything. Both produced
  // wrong findings on a real file before short codes required a whole word.
  it('does not read a paid parental leave payment out of Apple', () => {
    expect(isGovernment(t('2026-06-05', 'APPLE PTY LTD PAYMENT', 50))).toBe(false)
  })
  it('still reads a real Centrelink credit', () => {
    const c = t('2026-06-05', 'CENTRELINK FAMILY TAX BENE', 329.05)
    expect(isGovernment(c)).toBe(true)
    expect(benefitType(c).name).toBe('Family Tax Benefit')
  })
})

describe('classifying a transaction', () => {
  it('knows money coming back is not money earned', () => {
    expect(isRebate(t('2026-06-05', 'MEDICARE BENEFIT', 42))).toBe(true)
    expect(isRebate(t('2026-06-05', 'ACME PAYROLL', 4237))).toBe(false)
  })
  it('names the buy now pay later provider', () => {
    expect(bnplProvider(t('2026-06-05', 'AFTERPAY *ORDER 44', -38))).toBe('Afterpay')
    expect(bnplProvider(t('2026-06-05', 'ZIP PAY REPAYMENT', -60))).toBe('Zip Pay')
    expect(bnplProvider(t('2026-06-05', 'WOOLWORTHS', -60))).toBe(null)
  })
  it('spots a dishonour and a bet', () => {
    expect(isDishonour(t('2026-06-05', 'ORIGIN DD RETURNED UNPAID', -186))).toBe(true)
    expect(isGambling(t('2026-06-05', 'SPORTSBET', -25))).toBe(true)
    expect(isGambling(t('2026-06-05', 'SPORTS STORE', -25))).toBe(false)
  })
})

describe('reading the fact find', () => {
  it('annualises whatever frequency the form used', () => {
    expect(annualiseFreq(650, 'Weekly')).toBe(33800)
    expect(annualiseFreq(1000, 'Fortnightly')).toBe(26000)
    expect(annualiseFreq(500, 'Monthly')).toBe(6000)
    expect(annualiseFreq(90000, 'Annually')).toBe(90000)
  })
  it('adds bonus and overtime to base salary', () => {
    const d = readDeclaredIncome({ applicants: [{ firstName: 'Jo', lastName: 'S', income: [
      { grossSalary: '150000', grossSalaryFrequency: 'Annually', bonusAmount: '1000', bonusFrequency: 'Monthly' },
    ] }] })
    expect(d.employmentAnnual).toBe(162000)
    expect(d.components).toHaveLength(2)
  })
  it('matches a lender by name, not by amount', () => {
    const declared = readDeclaredLiabilities(FACT_FIND)
    expect(matchesDeclared('Toyota Finance', 'Car loan', declared)).not.toBeNull()
    expect(matchesDeclared('Now Finance', 'Personal loan', declared)).toBeNull()
  })
  it('counts a card debiting more than declared as still declared', () => {
    const declared = readDeclaredLiabilities({ liabilities: [
      { liabilityType: 'Credit card', lenderName: 'CBA', repaymentAmount: '80', repaymentFrequency: 'Monthly' },
    ] })
    expect(matchesDeclared('Commonwealth Bank', 'Credit Card', declared)).not.toBeNull()
  })
})

describe('the salary check', () => {
  const a = analyse(build(), FACT_FIND)
  it('finds the six fortnightly credits and nothing else', () => {
    expect(card(a, 'salary').txnIds).toHaveLength(6)
    expect(card(a, 'salary').detail.sources[0].cadence).toBe('fortnightly')
  })
  it('grosses the net credits up and flags the gap against the fact find', () => {
    const g = card(a, 'gross')
    expect(g.valueNumber).toBeGreaterThan(100000)
    const v = card(a, 'salaryVariance')
    expect(v.valueNumber).toBeLessThan(0)
    expect(['query', 'action']).toContain(v.flag)
  })
  it('grosses up under every financial year the period touches', () => {
    expect(card(a, 'gross').detail.byFy.length).toBeGreaterThanOrEqual(1)
    expect(card(a, 'gross').detail.byFy.filter((f: any) => f.headline)).toHaveLength(1)
  })
  it('passes every stability test on an unbroken cycle', () => {
    expect(card(a, 'stability').detail.tests.every((x: any) => x.pass)).toBe(true)
  })
})

describe('income the client did not declare', () => {
  const a = analyse(build(), FACT_FIND)
  it('counts the family payments and names the benefit', () => {
    expect(card(a, 'govt').detail.types[0].name).toBe('Family Tax Benefit')
    expect(card(a, 'incomeNotDeclared').valueNumber).toBeGreaterThan(0)
  })
  it('reads a find in the client’s favour, not against them', () => {
    expect(card(a, 'incomeNotDeclared').flag).toBe('favourable')
  })
  it('never annualises a single credit', () => {
    const one = analyse(build([t('2026-07-02', 'VANGUARD DISTRIBUTION', 755.69, { accountNumber: ING })]), FACT_FIND)
    const other = card(one, 'other')
    expect(other.detail.oneOff.some((g: any) => /VANGUARD/i.test(g.payer))).toBe(true)
    expect(other.detail.recurring.some((g: any) => /VANGUARD/i.test(g.payer))).toBe(false)
  })
  it('sets aside credits carrying the client’s own name', () => {
    const a2 = analyse(build([t('2026-07-02', 'FROM J SAMPLE SAVINGS', 2000, { accountNumber: ING })]), FACT_FIND)
    expect(card(a2, 'other').detail.ownTransfers.count).toBe(1)
    expect(card(a2, 'other').txnIds).not.toContain(card(a2, 'other').detail.ownTransfers.ids[0])
  })
  it('ignores money moved between the client’s own accounts', () => {
    const a3 = analyse(build([
      t('2026-07-02', 'TRANSFER TO SAVINGS', -500, { accountNumber: CBA }),
      t('2026-07-02', 'TRANSFER FROM SMART ACCESS', 500, { accountNumber: ING }),
    ]), FACT_FIND)
    expect(card(a3, 'other').detail.internalTransfers.count).toBeGreaterThanOrEqual(2)
  })
})

describe('commitments against the fact find', () => {
  const a = analyse(build(), FACT_FIND)
  it('lists every recurring obligation it can see', () => {
    const p = card(a, 'commitments').detail.providers
    expect(p.map((x: any) => x.provider).sort()).toEqual(['Afterpay', 'NOW FINANCE', 'TOYOTA FINANCE AUST', 'Zip Pay'])
  })
  it('flags the ones missing from the fact find and leaves the declared one alone', () => {
    const u = card(a, 'undisclosed')
    expect(u.flag).toBe('action')
    expect(u.detail.providers.map((x: any) => x.provider)).not.toContain('TOYOTA FINANCE AUST')
    expect(u.detail.providers).toHaveLength(3)
  })
  it('names both buy now pay later providers separately', () => {
    const b = card(a, 'bnpl')
    expect(b.detail.providers.map((x: any) => x.provider).sort()).toEqual(['Afterpay', 'Zip Pay'])
    expect(b.detail.providers.every((x: any) => !x.declared)).toBe(true)
  })
  it('does not treat a single debit to a lender as a commitment', () => {
    const a2 = analyse(build([t('2026-07-09', 'PEPPER MONEY DD', -300, { category: 'Non SACC Loans' })]), FACT_FIND)
    expect(card(a2, 'commitments').detail.providers.map((x: any) => x.provider)).not.toContain('PEPPER MONEY')
    expect(card(a2, 'commitments').detail.oneOff.some((g: any) => /PEPPER/i.test(g.payer))).toBe(true)
  })
})

describe('conduct', () => {
  it('counts a returned item and its fee as one event, and knows it was not repaid', () => {
    const a = analyse(build([
      t('2026-07-02', 'ORIGIN ENERGY DD RETURNED UNPAID', -186.42, { category: 'Dishonour Fees' }),
      t('2026-07-02', 'DISHONOUR FEE', -15, { category: 'Dishonour Fees' }),
    ]), FACT_FIND)
    const d = card(a, 'dishonours')
    expect(d.valueNumber).toBe(1)
    expect(d.detail.unrepaid).toBe(1)
    expect(d.flag).toBe('action')
  })
  it('treats a dishonour represented and paid within a fortnight as repaid', () => {
    const a = analyse(build([
      t('2026-07-02', 'ORIGIN ENERGY DD RETURNED UNPAID', -186.42, { category: 'Dishonour Fees' }),
      t('2026-07-06', 'ORIGIN ENERGY DIRECT DEBIT', -186.42),
    ]), FACT_FIND)
    expect(card(a, 'dishonours').detail.unrepaid).toBe(0)
  })
  it('asks about a cash deposit with nothing behind it, and not about one with', () => {
    const a = analyse(build([t('2026-07-03', 'CASH DEPOSIT BRANCH', 1500)]), FACT_FIND)
    expect(card(a, 'cash').detail.unexplainedDeposits).toHaveLength(1)
    const b = analyse(build([
      t('2026-06-30', 'ATM WDL CBA', -1500, { category: 'ATM Withdrawals' }),
      t('2026-07-03', 'CASH DEPOSIT BRANCH', 1500),
    ]), FACT_FIND)
    expect(card(b, 'cash').detail.unexplainedDeposits).toHaveLength(0)
  })
  it('reports gambling as a share of credits', () => {
    const a = analyse(build([t('2026-07-05', 'SPORTSBET', -250, { category: 'Gambling' })]), FACT_FIND)
    expect(card(a, 'gambling').detail.pctOfCredits).toBeGreaterThan(0)
    expect(card(a, 'gambling').txnIds).toHaveLength(1)
  })
})

describe('balances', () => {
  it('walks the closing balance backwards and finds no overdrawn days', () => {
    const b = deriveBalances(build())
    expect(b.available).toBe(true)
    expect(b.daysOverdrawn).toBe(0)
    expect(b.closingTotal).toBe(38000)
    expect(b.lowest).not.toBeNull()
  })
  it('withholds every balance figure rather than showing zero when none were supplied', () => {
    const p = build()
    p.accounts = p.accounts.map(a => ({ ...a, available: 0, currentBalance: 0 }))
    const b = deriveBalances(p)
    expect(b.available).toBe(false)
    expect(b.lowest).toBeNull()
    expect(b.trendPerMonth).toBeNull()
    const a = analyse(p, FACT_FIND)
    expect(card(a, 'genuineSavings').flag).toBe('unavailable')
    expect(card(a, 'genuineSavings').value).toBe('—')
    expect(card(a, 'overdrawn').value).toBe('—')
  })
  it('leaves an account with no balance out instead of counting it as zero', () => {
    const p = build()
    p.accounts = p.accounts.map(a => a.accountNumber === ING ? { ...a, available: 0, currentBalance: 0 } : a)
    const b = deriveBalances(p)
    expect(b.accounts).toHaveLength(1)
    expect(b.reason).toMatch(/left out of every balance figure/)
  })
})

describe('rent paid', () => {
  const a = analyse(build(), FACT_FIND)
  it('reads three payments on the same day of the month as on time', () => {
    expect(card(a, 'rentPaid').flagLabel).toBe('On time')
    expect(card(a, 'rentPaid').txnIds).toHaveLength(3)
  })
})

describe('settings actually change what is flagged', () => {
  it('shows a smaller cash movement once the threshold drops', () => {
    const txns = [t('2026-07-03', 'CASH DEPOSIT BRANCH', 600)]
    const atDefault = analyse(build(txns), FACT_FIND)
    expect(card(atDefault, 'cash').txnIds).toHaveLength(0)
    const atFiveHundred = analyse(build(txns), FACT_FIND, { cashThreshold: 500 })
    expect(card(atFiveHundred, 'cash').txnIds).toHaveLength(1)
  })
  it('turns the salary variance amber or red depending on the tolerance', () => {
    const strict = analyse(build(), FACT_FIND, { salaryQueryPct: 1, salaryActionPct: 2 })
    expect(card(strict, 'salaryVariance').flag).toBe('action')
    const loose = analyse(build(), FACT_FIND, { salaryQueryPct: 60, salaryActionPct: 80 })
    expect(card(loose, 'salaryVariance').flag).toBe('ok')
  })
  it('recognises a provider added to the buy now pay later list', () => {
    const txns = MONTHS.map(d => t(d, 'SEZZLE INSTALMENT', -45))
    const before = analyse(build(txns), FACT_FIND)
    expect(card(before, 'bnpl').detail.providers.map((p: any) => p.provider)).not.toContain('Sezzle')
    const after = analyse(build(txns), FACT_FIND, {
      bnpl: [{ name: 'Sezzle', terms: ['sezzle'] }],
    })
    expect(card(after, 'bnpl').detail.providers.map((p: any) => p.provider)).toContain('Sezzle')
  })
  it('records the rules it ran under, so a stored analysis can be compared later', () => {
    const a = analyse(build(), FACT_FIND, { cashThreshold: 750 })
    expect(a.rules.cashThreshold).toBe(750)
    expect(a.rules.bnpl.length).toBeGreaterThan(0)
  })
})

describe('the file score', () => {
  it('scores the file, and every card carries the ids it was reading', () => {
    const a = analyse(build(), FACT_FIND)
    expect(a.score.total).toBeGreaterThan(0)
    expect(a.score.total).toBeLessThanOrEqual(100)
    expect(a.score.components.map(c => c.weight).reduce((x, y) => x + y, 0)).toBe(100)
    for (const c of a.cards) expect(Array.isArray(c.txnIds)).toBe(true)
  })
  it('rises when the missing commitments are added to the fact find', () => {
    const before = analyse(build(), FACT_FIND)
    const after = analyse(build(), { ...FACT_FIND, liabilities: [
      ...FACT_FIND.liabilities,
      { liabilityType: 'Personal loan', lenderName: 'Now Finance', repaymentAmount: '412', repaymentFrequency: 'Monthly' },
      { liabilityType: 'Other', lenderName: 'Afterpay', repaymentAmount: '82', repaymentFrequency: 'Monthly' },
      { liabilityType: 'Other', lenderName: 'Zip Pay', repaymentAmount: '60', repaymentFrequency: 'Monthly' },
    ] })
    expect(after.score.total).toBeGreaterThan(before.score.total)
    expect(card(after, 'undisclosed').flag).toBe('ok')
  })
  it('puts the action items at the top of the worklist', () => {
    const a = analyse(build(), FACT_FIND)
    expect(a.worklist.length).toBeGreaterThan(0)
    expect(a.worklist[0].flag).toBe('action')
  })
})

// ---------------------------------------------------------------------------
// CashDeck's own category is read before we guess from the narration.
//
// Kornelia Viragova, 31 Aug 2026: $28,559 of wages across 11 credits, filed in
// the workbook under the category "Wages", and none of it counted as income —
// the employer pays under its own name and the bank narration carries no
// pay-word. The answer was in the file.
import { isSalaryLike, isGovernment, isRebate } from './statement-analysis'

const txn = (o: any) => ({
  externalId: 'x', date: '2026-08-15', description: '', merchant: '',
  accountNumber: '1', accountName: 'a', institution: 'CBA',
  category: '', summaryCategory: '', categoryType: '', amount: 100, ...o,
})

describe('income is read from the category, not just the narration', () => {
  it('counts a wages credit with nothing recognisable in the narration', () => {
    // The real shape of the Viragova lines.
    expect(isSalaryLike(txn({ category: 'Wages', categoryType: 'Income',
      description: 'SWISS ASIA', merchant: '', amount: 7721.27 }))).toBe(true)
  })

  it('counts a wages credit with no name on it at all', () => {
    // The "(blank)" rows in the pivot — $5,423.71 of them.
    expect(isSalaryLike(txn({ category: 'Wages', categoryType: 'Income',
      description: '', merchant: '', amount: 991.03 }))).toBe(true)
  })

  it('still ignores a credit CashDeck did not call wages', () => {
    expect(isSalaryLike(txn({ category: 'Other Credit', categoryType: 'Income',
      description: 'TFR FROM J SMITH', amount: 8000 }))).toBe(false)
  })

  it('never treats money going out as income', () => {
    expect(isSalaryLike(txn({ category: 'Wages', amount: -500 }))).toBe(false)
  })

  it('reads a government category the same way', () => {
    expect(isGovernment(txn({ category: 'Government Benefits', amount: 220 }))).toBe(true)
    expect(isGovernment(txn({ category: 'Other Credit', amount: 220 }))).toBe(false)
  })

  it('does not let a pay run be written off as a rebate', () => {
    // "reimbursement" in the narration of a line CashDeck called Wages.
    const t = txn({ category: 'Wages', description: 'PAYRUN REIMBURSEMENT', amount: 1200 })
    expect(isRebate(t)).toBe(false)
    expect(isSalaryLike(t)).toBe(true)
  })

  it('still catches a rebate CashDeck filed as one', () => {
    expect(isRebate(txn({ category: 'Refunds', description: 'MCARE BENEFIT', amount: 87 }))).toBe(true)
  })
})
