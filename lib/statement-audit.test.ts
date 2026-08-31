import { describe, it, expect } from 'vitest'
import { buildAudit, auditSummary, type AuditCard } from './statement-audit'
import type { ParsedTxn } from './statement-parse'

let n = 0
const t = (o: Partial<ParsedTxn>): ParsedTxn => ({
  externalId: `t${++n}`, date: '2026-07-14', description: '', merchant: '',
  accountNumber: '1', accountName: 'Nela', institution: 'CBA',
  category: '', summaryCategory: '', categoryType: '', amount: 100, ...o,
})
const card = (key: string, title: string, txnIds: string[]): AuditCard => ({ key, title, txnIds })

describe('the audit', () => {
  it('flags a line CashDeck called wages that no income figure uses', () => {
    // The eight interest credits on the Viragova file.
    const x = t({ description: 'Interest Credit', category: 'Wages', amount: 916.45 })
    const [row] = buildAudit([x], [card('salary', 'Net salary credits', [])])
    expect(row.flag).toBe('differ')
    expect(row.why).toContain('No figure on this screen uses it')
  })

  it('agrees when the card actually counted it', () => {
    const x = t({ description: 'Salary SWISS RE ASIA PT', category: 'Wages', amount: 7721.27 })
    const [row] = buildAudit([x], [card('salary', 'Net salary credits', [x.externalId])])
    expect(row.flag).toBe('agree')
    expect(row.ours).toEqual(['Net salary credits'])
  })

  it('says where a line went when we disagreed with CashDeck about it', () => {
    const x = t({ description: 'ATM WDL', category: 'Wages', amount: 400 })
    const [row] = buildAudit([x], [card('cash', 'Large cash movements', [x.externalId])])
    expect(row.flag).toBe('differ')
    expect(row.why).toContain('We counted it under Large cash movements')
  })

  it('does not count a fact find figure as having claimed anything', () => {
    // declaredSalary repeats what the client told us. It proves nothing about a line.
    const x = t({ category: 'Wages', amount: 5000 })
    const [row] = buildAudit([x], [card('declaredSalary', 'Declared on fact find', [x.externalId])])
    expect(row.flag).toBe('differ')
  })

  it('raises money in that nothing counts, and stays quiet about money out', () => {
    const credit = t({ description: 'FAST TRANSFER FROM M ZABLOCKA', amount: 2500 })
    const debit = t({ description: 'WOOLWORTHS METRO', amount: -84.20 })
    const rows = buildAudit([credit, debit], [])
    expect(rows.find(r => r.externalId === credit.externalId)!.flag).toBe('uncounted')
    expect(rows.find(r => r.externalId === debit.externalId)!.flag).toBe('expected')
  })

  it('puts the disagreements at the top and the biggest unexplained credit next', () => {
    const rows = buildAudit([
      t({ description: 'WOOLWORTHS', amount: -50 }),
      t({ description: 'SMALL IN', amount: 100 }),
      t({ description: 'BIG IN', amount: 9000 }),
      t({ description: 'Interest Credit', category: 'Wages', amount: 916 }),
    ], [])
    expect(rows.map(r => r.flag)).toEqual(['differ', 'uncounted', 'uncounted', 'expected'])
    expect(rows[1].description).toBe('BIG IN')
  })

  it('counts up what needs looking at', () => {
    const s = auditSummary(buildAudit([
      t({ description: 'Interest Credit', category: 'Wages', amount: 916.45 }),
      t({ description: 'Interest Credit', category: 'Wages', amount: 941.97 }),
      t({ description: 'TFR IN', amount: 2500 }),
      t({ description: 'COLES', amount: -60 }),
    ], []))
    expect(s.differ).toBe(2)
    expect(s.differValue).toBeCloseTo(1858.42, 2)
    expect(s.uncounted).toBe(1)
    expect(s.uncountedValue).toBe(2500)
    expect(s.total).toBe(4)
  })

  it('never claims a transaction twice in the same breath', () => {
    const x = t({ description: 'Salary', category: 'Wages', amount: 5000 })
    const [row] = buildAudit([x], [
      card('salary', 'Net salary credits', [x.externalId]),
      card('gross', 'Net salary credits', [x.externalId]),
    ])
    expect(row.ours).toEqual(['Net salary credits'])
  })
})
