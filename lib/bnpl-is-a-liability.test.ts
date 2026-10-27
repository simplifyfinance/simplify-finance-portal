// BUY NOW PAY LATER IS A LIABILITY OF ITS OWN.
//
// 27 Oct 2026. Catherine, Operations Manager, item 7 of nine: "BNPL as a
// liability type".
//
// It was being recorded as "Other", which told a lender nothing and told the
// document list nothing either - an Afterpay account with a $3,000 limit
// produced no document to chase and no line a credit assessor could read.
//
// SHAPED LIKE A CREDIT CARD, NOT LIKE A PERSONAL LOAN. Fabio's call, asked
// directly: a lender assesses the LIMIT the way it does a card, so there has
// to be somewhere to put it. Three months of statements, same as a card.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { documentsFor } from './document-rules'

const BNPL = 'Buy now pay later'

const dealWith = (liabilities: any[]) => ({
  id: 'd1',
  fact_find_data: { applicants: [{ id: 'a1', firstName: 'A', lastName: 'B' }], liabilities,
                    properties: [], assets: [] },
})

describe('the fact find knows what it is', () => {
  const form = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

  it('offers it in the liability list', () => {
    expect(form).toContain(`<option>${BNPL}</option>`)
  })

  it('and it sits beside the credit card, not at the bottom with Other', () => {
    // Where a thing sits in a list is a claim about what it is like.
    const list = form.slice(form.indexOf('<option>Credit card</option>'))
    expect(list.slice(0, 120)).toContain(BNPL)
  })

  it('asks for the limit, because that is what gets assessed', () => {
    const block = form.slice(form.indexOf(`liab.liabilityType === '${BNPL}'`))
    expect(block.slice(0, 1800)).toContain('Account limit')
    expect(block.slice(0, 1800)).toContain('Current balance')
    expect(block.slice(0, 1800)).toContain('Repayment')
  })

  it('and names the provider rather than offering a bank list', () => {
    // Afterpay and Zip are not on the lender register, and a BankSelect that
    // cannot find them is a box somebody cannot fill in.
    const block = form.slice(form.indexOf(`liab.liabilityType === '${BNPL}'`), form.indexOf(`liab.liabilityType === 'Car loan'`))
    expect(block).toContain('Provider (Afterpay, Zip...)')
    expect(block).not.toContain('<BankSelect')
  })
})

describe('it reaches the document list', () => {
  it('three months of statements, the same as a card', () => {
    const docs = documentsFor(dealWith([
      { id: 'l1', liabilityType: BNPL, lenderName: 'Afterpay', limitAmount: '3000' },
    ]))
    const all = [...(docs as any).items || (docs as any)]
    const bnpl = all.find((x: any) => String(x.key).startsWith('bnpl-statement'))
    expect(bnpl, 'a BNPL account produced no document to chase').toBeTruthy()
    expect(bnpl.label).toContain('Afterpay')
    expect(bnpl.detail).toBe('last 3 months')
  })

  it('and it is asked for automatically, so offshore can chase it', () => {
    const docs = documentsFor(dealWith([{ id: 'l1', liabilityType: BNPL }]))
    const all = [...(docs as any).items || (docs as any)]
    const bnpl = all.find((x: any) => String(x.key).startsWith('bnpl-statement'))
    expect(bnpl.auto).toBe(true)
    expect(bnpl.round).toBe('proceed')
  })

  it('which is what it never did while it was recorded as Other', () => {
    const docs = documentsFor(dealWith([{ id: 'l1', liabilityType: 'Other', lenderName: 'Afterpay' }]))
    const all = [...(docs as any).items || (docs as any)]
    expect(all.some((x: any) => String(x.key).startsWith('bnpl-statement'))).toBe(false)
  })
})

describe('and the compliance checklist reads it properly', () => {
  const src = readFileSync('lib/property-checklist.ts', 'utf8')

  it('shows the limit, not just a repayment', () => {
    const block = src.slice(src.indexOf(`type === '${BNPL}'`))
    expect(block.slice(0, 400)).toContain('Limit')
    expect(block.slice(0, 400)).toContain('Balance')
  })
})
