import { describe, it, expect } from 'vitest'
import { totalCost, totalLending, fundsToContribute, constructionLvr,
         repaymentDuringConstruction, num, DRAWDOWN_NOTE } from './construction'

// Fabio's own scenario, 2 Sep 2026. Every number below is one he checked.
const deal = { landValue: '1,000,000', constructionCost: '1,000,000', stampDuty: '40,000',
               asIfCompleteValue: '2,000,000' }
const splits = [
  { label: 'Land loan',         amount: '800,000', rate: '6.14', type: 'P&I',           repayment: '4,872' },
  { label: 'Construction loan', amount: '800,000', rate: '6.39', type: 'Interest only', repayment: '4,260' },
]

describe('a construction deal counts every split, not the first one', () => {
  it('adds land, build and duty into the total cost', () => {
    expect(totalCost(deal)).toBe(2040000)
  })

  it('counts BOTH loans as lending', () => {
    expect(totalLending(splits)).toBe(1600000)
    // The bug: reading the first split alone.
    expect(totalLending([splits[0]])).toBe(800000)
  })

  it('asks the client for $440,000, not $1,240,000', () => {
    expect(fundsToContribute(deal, splits)).toBe(440000)
    // What it used to say, and the reason this file exists.
    expect(fundsToContribute(deal, [splits[0]])).toBe(1240000)
  })

  it('puts the LVR at 80%, not 40%', () => {
    expect(constructionLvr(deal.asIfCompleteValue, splits)).toBe(80)
    expect(constructionLvr(deal.asIfCompleteValue, [splits[0]])).toBe(40)
  })

  it('rounds the LVR up, so a hair over 80 is not rounded into "no LMI"', () => {
    expect(constructionLvr('2,000,000', [{ amount: '1,600,100' }])).toBeGreaterThan(80)
  })

  it('adds the typed repayments rather than calculating anything', () => {
    // Fabio: "dont calcualte repoayments alwasy once completed by the team".
    expect(repaymentDuringConstruction(splits)).toBe(9132)
  })
})

describe('it does not invent numbers when the form is half filled', () => {
  it('never asks for a negative contribution', () => {
    const overLent = [{ amount: '3,000,000' }]
    expect(fundsToContribute(deal, overLent)).toBe(0)
  })

  it('gives zero rather than a divide by nothing when there is no valuation', () => {
    expect(constructionLvr('', splits)).toBe(0)
    expect(constructionLvr('0', splits)).toBe(0)
  })

  it('gives zero repayment when nobody has typed one, so the row can be left out', () => {
    expect(repaymentDuringConstruction([{ amount: '800,000' }])).toBe(0)
    expect(repaymentDuringConstruction([])).toBe(0)
    expect(repaymentDuringConstruction(null)).toBe(0)
  })

  it('survives an empty deal', () => {
    expect(totalCost({})).toBe(0)
    expect(totalLending(undefined)).toBe(0)
    expect(fundsToContribute({}, undefined)).toBe(0)
  })

  it('reads a number however it was typed', () => {
    expect(num('$1,000,000')).toBe(1000000)
    expect(num('1000000')).toBe(1000000)
    expect(num('')).toBe(0)
    expect(num(null)).toBe(0)
  })
})

describe('the drawdown note', () => {
  it('says the figure is the ceiling, not the starting point', () => {
    expect(DRAWDOWN_NOTE).toMatch(/interest only/i)
    expect(DRAWDOWN_NOTE).toMatch(/full drawdown/i)
    expect(DRAWDOWN_NOTE).toMatch(/progress payment/i)
  })
})

// ---------------------------------------------------------------------------
// The carry-forward. Fabio, 2 Sep 2026: "when i am chagin the BC are you making
// sure these issues are not carrying forward to LO correcT?"
//
// They were carrying forward. The Lending Options form seeded its loan amount
// from bc.splits[0], and that field is written to deals.loan_amount - which the
// board, the pipeline, the settlements screen and the commission panel all read.
// So a multi-split BC became half a deal everywhere downstream.
import { splitsTotal } from './deal-phase'

describe('what the BC hands to Lending Options', () => {
  const refiEquity = [{ amount: '500,000' }, { amount: '200,000' }]
  const construction = [{ amount: '800,000' }, { amount: '800,000' }]

  it('hands over the whole loan, not the first split', () => {
    expect(splitsTotal(refiEquity)).toBe(700000)
    expect(splitsTotal(construction)).toBe(1600000)
  })

  it('is the same number the BC email now shows', () => {
    expect(splitsTotal(construction)).toBe(totalLending(construction))
    expect(splitsTotal(refiEquity)).toBe(totalLending(refiEquity))
  })

  it('leaves a single-split deal exactly as it was', () => {
    expect(splitsTotal([{ amount: '650,000' }])).toBe(650000)
  })

  it('hands over nothing rather than a zero when the BC has no splits', () => {
    // The LO field stays empty and the broker fills it in, which is what
    // happened before. A "0" would be written onto the deal as its loan amount.
    expect(splitsTotal([])).toBe(null)
    expect(splitsTotal(undefined)).toBe(null)
    expect(splitsTotal([{ amount: '' }])).toBe(null)
  })
})
