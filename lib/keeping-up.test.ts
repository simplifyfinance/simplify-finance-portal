// KEEPING THE WRITE-UP AND THE FILED DOCUMENTS UP WITH THE DEAL.
//
// Fabio, 30 Sep 2026: "I want to be automatic and save on documents tab".
//
// Automatic on a regulated file only works because of one rule, and most of
// these tests are that rule: a box rebuilds itself ONLY if it is composed from
// the deal AND nobody has touched it since. Everything else is left alone.

import { describe, it, expect } from 'vitest'
import {
  wasComposed, untouchedSinceComposed, safeToRecompose, boxesToRebuild, rebuiltLine,
  builtFrom, documentsBehind, behindLine, documentsAreCurrent,
} from './keeping-up'
import { fingerprint } from './notes-freshness'

const COMPOSED = 'Lucy and Andrew are borrowing $1,060,000 over thirty years.'
const stampFor = (text: string, over: any = {}) => ({
  source: 'Composed from the deal - fact find, BC and lending options',
  at: '2026-09-29T00:00:00Z',
  textHash: fingerprint(text),
  ...over,
} as any)

describe('a box may only rebuild itself if nobody has touched it', () => {
  it('rebuilds one that still reads exactly as it was composed', () => {
    expect(safeToRecompose(COMPOSED, stampFor(COMPOSED))).toBe(true)
  })

  it('never rebuilds one somebody has edited', () => {
    const edited = COMPOSED + ' The clients also asked about an offset.'
    expect(untouchedSinceComposed(edited, stampFor(COMPOSED))).toBe(false)
    expect(safeToRecompose(edited, stampFor(COMPOSED))).toBe(false)
  })

  it('notices an edit as small as one word', () => {
    expect(untouchedSinceComposed(COMPOSED.replace('thirty', 'twenty-five'),
      stampFor(COMPOSED))).toBe(false)
  })

  it('never rebuilds something the model wrote', () => {
    const ai = stampFor(COMPOSED, { source: 'Generated with AI from the deal' })
    expect(wasComposed(ai)).toBe(false)
    expect(safeToRecompose(COMPOSED, ai)).toBe(false)
  })

  it('leaves every note written before today alone', () => {
    // No textHash means there is no way to know whether it was edited, and not
    // knowing is a reason to leave somebody's paragraph where it is.
    const old = stampFor(COMPOSED); delete (old as any).textHash
    expect(untouchedSinceComposed(COMPOSED, old)).toBe(false)
    expect(safeToRecompose(COMPOSED, old)).toBe(false)
  })

  it('leaves an empty box and an unstamped box alone', () => {
    expect(safeToRecompose('', stampFor(''))).toBe(false)
    expect(safeToRecompose(COMPOSED, undefined)).toBe(false)
  })
})

describe('which boxes get rebuilt on a deal', () => {
  const fields = [
    { field: 'needsPrimary', text: COMPOSED },
    { field: 'analysisComment', text: COMPOSED + ' edited by hand' },
    { field: 'optionsComment', text: COMPOSED },
  ]
  const stamps: any = {
    needsPrimary: stampFor(COMPOSED),
    analysisComment: stampFor(COMPOSED),
    optionsComment: stampFor(COMPOSED),
  }

  it('only the stale ones, and only the untouched ones', () => {
    expect(boxesToRebuild(fields, stamps, () => true)).toEqual(['needsPrimary', 'optionsComment'])
  })

  it('nothing at all when nothing is stale', () => {
    expect(boxesToRebuild(fields, stamps, () => false)).toEqual([])
  })

  it('says which ones, because a document that rewrote itself should say so', () => {
    expect(rebuiltLine(['needsPrimary', 'optionsComment'],
      { needsPrimary: 'Primary reasons', optionsComment: 'Options presented' }))
      .toBe('Rebuilt from the deal: Primary reasons and Options presented. Nothing you had edited was changed.')
    expect(rebuiltLine([], {})).toBe('')
  })
})

describe('whether the filed documents are behind the deal', () => {
  const deal = {
    lo_data: { recommendedLender: 'Macquarie', recommendedOptionId: 'm1',
               lenders: [{ id: 'm1', lenderName: 'Macquarie', productName: 'Offset Home Loan' }],
               loanAmount: '1060000' },
    bc_data: { splits: [{ id: 's1', amount: '1060000' }] },
    compliance_data: { preApproval: true, analysisComment: 'As written.' },
  }

  it('nothing filed is not the same as out of date', () => {
    expect(documentsBehind(deal)).toEqual([])
    expect(behindLine(deal)).toBe('')
    expect(documentsAreCurrent(deal)).toBe(false)
  })

  it('filed from this exact deal is current', () => {
    const filed = { ...deal, documents_built_from: builtFrom(deal) }
    expect(documentsBehind(filed)).toEqual([])
    expect(documentsAreCurrent(filed)).toBe(true)
  })

  it('notices the lender changing, and says so in one sentence', () => {
    const filed: any = { ...deal, documents_built_from: builtFrom(deal) }
    filed.lo_data = { ...deal.lo_data, clientAgreedLender: 'No', clientChosenLender: 'ubank' }
    expect(behindLine(filed)).toContain('the lender changed from Macquarie to ubank')
    expect(documentsAreCurrent(filed)).toBe(false)
  })

  it('notices the write-up being corrected, because the documents print it', () => {
    const filed: any = { ...deal, documents_built_from: builtFrom(deal) }
    filed.compliance_data = { ...deal.compliance_data, analysisComment: 'Corrected.' }
    expect(documentsBehind(filed)).toEqual(['the compliance write-up was edited'])
  })

  it('notices the loan moving', () => {
    const filed: any = { ...deal, documents_built_from: builtFrom(deal) }
    filed.contract_loan_amount = 748000
    expect(behindLine(filed)).toContain('the loan amount changed')
  })

  it('does not fire on a typo somewhere else in the deal', () => {
    // A warning that goes off on everything stops being read.
    const filed: any = { ...deal, documents_built_from: builtFrom(deal) }
    filed.clients = { first_name: 'Lucie' }
    filed.fact_find_data = { applicants: [{ phone: '0400 000 001' }] }
    expect(documentsBehind(filed)).toEqual([])
  })

  it('reads several changes as one sentence', () => {
    const filed: any = { ...deal, documents_built_from: builtFrom(deal) }
    filed.lo_data = { ...deal.lo_data, clientAgreedLender: 'No', clientChosenLender: 'ubank' }
    filed.contract_loan_amount = 748000
    const line = behindLine(filed)
    expect(line.startsWith('The filed copies are older than the deal —')).toBe(true)
    expect(line.endsWith('.')).toBe(true)
    // Three things moved here, not two: the clients went to ubank, which has no
    // lending option of its own on this deal, so the PRODUCT drops out as well.
    // Counting the word "and" was the first version of this assertion and it
    // failed on exactly that - "the product was Offset Home Loan and is no
    // longer recorded" carries its own "and". The substance is what matters.
    const parts = documentsBehind(filed)
    expect(parts).toHaveLength(3)
    for (const p of parts) expect(line).toContain(p)
    // Joined as a list, not stacked as three warnings.
    expect(line.split('The filed copies')).toHaveLength(2)
  })

  it('survives rubbish in the column', () => {
    expect(documentsBehind({ ...deal, documents_built_from: 'nonsense' })).toEqual([])
    expect(documentsBehind({ ...deal, documents_built_from: null })).toEqual([])
  })
})
