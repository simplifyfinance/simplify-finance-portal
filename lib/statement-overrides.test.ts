import { describe, it, expect } from 'vitest'
import { signatureOf, resolveOverrides, upsertRule, removeRule, type Override, type PayerRule } from './statement-overrides'
import type { ParsedTxn } from './statement-parse'

let n = 0
const t = (o: Partial<ParsedTxn>): ParsedTxn => ({
  externalId: `t${++n}`, date: '2026-06-02', description: 'Fast Transfer From MALGORZATA ZABLOCKA',
  merchant: '', accountNumber: '1', accountName: 'Nela', institution: 'CBA',
  category: '', summaryCategory: '', categoryType: 'Income', amount: 2500, ...o,
})
const payerKeyOf = (x: ParsedTxn) => `${x.merchant} ${x.description}`
const ov = (o: Partial<Override>): Override => ({
  external_id: null, signature: null, treat_as: 'not_income',
  created_by: 'Fabio de Castro', created_at: '2026-08-31T09:00:00Z', ...o,
})

describe('overruling a line', () => {
  it('applies a correction made against the transaction id', () => {
    const x = t({})
    const r = resolveOverrides([x], [ov({ external_id: x.externalId })], [], payerKeyOf)
    expect(r.get(x.externalId)).toEqual({ treat: 'not_income', source: 'file', label: 'Not income — a transfer' })
  })

  it('survives a re-upload that renumbers the transactions', () => {
    const before = t({ externalId: 'old-1' })
    const after = { ...before, externalId: 'new-99' }
    const saved = ov({ external_id: 'old-1', signature: signatureOf(before) })
    expect(resolveOverrides([after], [saved], [], payerKeyOf).get('new-99')?.treat).toBe('not_income')
  })

  it('does not match a different line from the same payer on another day', () => {
    const first = t({ date: '2026-06-02' })
    const later = t({ date: '2026-07-02' })
    const saved = ov({ signature: signatureOf(first) })
    const r = resolveOverrides([first, later], [saved], [], payerKeyOf)
    expect(r.has(first.externalId)).toBe(true)
    expect(r.has(later.externalId)).toBe(false)
  })

  it('applies a standing rule to every line from that payer', () => {
    const a = t({ date: '2026-06-02' }), b = t({ date: '2026-07-02', amount: 400 })
    const rule: PayerRule = { match: 'Fast Transfer From MALGORZATA ZABLOCKA', label: 'Malgorzata Zablocka',
      treat_as: 'not_income', added_by: 'Fabio', added_at: '2026-08-31T09:00:00Z' }
    const r = resolveOverrides([a, b], [], [rule], payerKeyOf)
    expect(r.get(a.externalId)?.source).toBe('always')
    expect(r.get(b.externalId)?.source).toBe('always')
  })

  it('lets a correction on the file beat a standing rule', () => {
    const x = t({})
    const rule: PayerRule = { match: payerKeyOf(x), label: 'x', treat_as: 'not_income', added_by: null, added_at: '2026-08-01T00:00:00Z' }
    const r = resolveOverrides([x], [ov({ external_id: x.externalId, treat_as: 'salary' })], [rule], payerKeyOf)
    expect(r.get(x.externalId)).toMatchObject({ treat: 'salary', source: 'file' })
  })

  it('leaves everything else alone', () => {
    const x = t({}), y = t({ description: 'WOOLWORTHS', amount: -80 })
    expect(resolveOverrides([x, y], [ov({ external_id: x.externalId })], [], payerKeyOf).has(y.externalId)).toBe(false)
  })

  it('replaces a standing rule rather than stacking a second one on the same payer', () => {
    const base: PayerRule = { match: 'ACME PTY LTD', label: 'Acme', treat_as: 'salary', added_by: null, added_at: '2026-08-01T00:00:00Z' }
    const next: PayerRule = { ...base, treat_as: 'other_income', added_at: '2026-08-31T00:00:00Z' }
    const out = upsertRule([base], next)
    expect(out).toHaveLength(1)
    expect(out[0].treat_as).toBe('other_income')
  })

  it('removes a standing rule however it was capitalised or spaced', () => {
    const rules: PayerRule[] = [{ match: 'acmeptyltd', label: 'Acme', treat_as: 'salary', added_by: null, added_at: 'x' }]
    expect(removeRule(rules, 'ACME  Pty Ltd')).toHaveLength(0)
  })
})
