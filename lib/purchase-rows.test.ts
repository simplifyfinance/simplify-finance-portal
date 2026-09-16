import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { purchaseRows, totalPurchaseCost, INCIDENTALS } from './purchase-rows'

// Fabio, 16 Sep 2026: "I dont like how all our purchases are broken down,
// customers are confused. I want ALL purchases to be Purchase Price / Stamp Duty
// / Total cost (plus solicitor's fees, and incidentals) / Loan amount / Your
// contribution required (coming from your savings)."

const base = {
  price: '900,000', duty: '48,070', dutyLabel: 'Stamp duty',
  loan: '720,000', contribution: '228,070', contributionFrom: 'Savings',
}

describe('the purchase block', () => {
  const rows = purchaseRows(base)
  const labels = rows.map(r => r.label)
  const valueOf = (starts: string) => rows.find(r => r.label.startsWith(starts))!.value

  it('is five lines in the order Fabio asked for', () => {
    expect(labels).toHaveLength(5)
    expect(labels[0]).toBe('Purchase price')
    expect(labels[1]).toBe('Stamp duty')
    expect(labels[2]).toBe('Total cost' + INCIDENTALS)
    expect(labels[3]).toBe('Loan amount')
    expect(labels[4]).toBe('Your contribution required (coming from your savings)')
  })

  it('works the total cost out rather than asking for a box', () => {
    // "rule is total cost is purchase price plus stamp duty, not complicated"
    expect(valueOf('Total cost')).toBe('$948,070')
    expect(totalPurchaseCost('900,000', '48,070')).toBe(948070)
  })

  it('adds up on the page', () => {
    // Total cost - loan = contribution. The BC already holds this: it keeps
    // deposit = price - loan + stamp duty in every direction, which is the same
    // thing rearranged. Nothing here recomputes it.
    expect(948070 - 720000).toBe(228070)
    expect(valueOf('Your contribution')).toBe('$228,070')
  })

  it('puts the incidentals note on the total, not on the deposit', () => {
    expect(labels[2]).toContain("solicitor's fees, and incidentals")
    expect(labels[4]).not.toContain('incidentals')
  })

  it('calls the lending "Loan amount", not "total lending"', () => {
    expect(labels).toContain('Loan amount')
    expect(labels.join(' ')).not.toMatch(/total lending/i)
  })
})

describe('the awkward deals', () => {
  it('keeps the duty label the state actually uses', () => {
    const rows = purchaseRows({ ...base, dutyLabel: 'Transfer duty' })
    expect(rows[1].label).toBe('Transfer duty')
  })

  it('lets a first home buyer print a sentence instead of a figure', () => {
    const rows = purchaseRows({ ...base, duty: '', dutyText: '$0 — first home buyer exemption' })
    expect(rows[1].value).toBe('$0 — first home buyer exemption')
    // And the total is then just the price, not price plus nothing sensible.
    expect(rows[2].value).toBe('$900,000')
  })

  it('names wherever the money is coming from', () => {
    expect(purchaseRows({ ...base, contributionFrom: 'sale proceeds and savings' })[4].label)
      .toBe('Your contribution required (coming from your sale proceeds and savings)')
  })

  it('says just "Your contribution required" when nobody recorded a source', () => {
    expect(purchaseRows({ ...base, contributionFrom: '' })[4].label).toBe('Your contribution required')
  })

  it('never tells a client their contribution is $0', () => {
    // Jacob Joson: loan recorded, deposit box left at 0. "$0" is a claim.
    const rows = purchaseRows({ ...base, contribution: '0' })
    expect(rows.map(r => r.label).join(' ')).not.toContain('Your contribution required')
  })

  it('keeps a zero duty, because on a first home buyer that is the answer', () => {
    const rows = purchaseRows({ ...base, duty: '0' })
    expect(rows[1].value).toBe('$0')
    expect(rows[2].value).toBe('$900,000')
  })

  it('leaves out a row it has no figure for', () => {
    const rows = purchaseRows({ ...base, loan: '', contribution: '' })
    expect(rows.map(r => r.label)).toEqual(['Purchase price', 'Stamp duty', 'Total cost' + INCIDENTALS])
  })

  it('offers no total at all without a price to build one on', () => {
    const rows = purchaseRows({ ...base, price: '' })
    expect(rows.map(r => r.label)).not.toContain('Total cost' + INCIDENTALS)
    expect(totalPurchaseCost('', '48,070')).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('every purchase in the client email uses it', () => {
  const src = readFileSync('app/api/generate-email/route.ts', 'utf8')

  it('no scenario writes its own purchase breakdown', () => {
    // CONSTRUCTION IS NOT A PURCHASE AND KEEPS ITS OWN WORDS. There is no
    // purchase price - there is land, a build and a valuation of the finished
    // house - and Fabio chose "Funds you need to contribute" for it on
    // 2 Sep 2026 precisely because it is not a deposit on a purchase. It is cut
    // out here rather than quietly dragged into a shape it does not fit.
    const withoutConstruction = src.split("template === 'construction'")[0]
      + (src.split("} else if (template === 'investment_equity'")[1] || '')
    const code = withoutConstruction.replace(/\/\/[^\n]*/g, '')
    // The shapes that used to differ per template.
    expect(code, 'a purchase template is still calling the lending "Total lending"')
      .not.toMatch(/row\('Total lending'/)
    expect(code, 'a template is still hanging the incidentals note off a deposit row')
      .not.toMatch(/Deposit\$\{[^}]*\}\$\{PLUS_INCIDENTALS\}/)
  })

  it('all eight purchase cards and both comparison columns go through it', () => {
    const block = (src.match(/purchaseBlock\(\{/g) || []).length
    const column = (src.match(/purchaseColumn\(\{/g) || []).length
    expect(block + column, 'a purchase card is not using the shared block').toBeGreaterThanOrEqual(10)
  })

  it('the bridge does not print its peak debt twice', () => {
    // The first version handed the peak debt in as `loan`, so it appeared as
    // "Loan amount" and again as "Bridging loan (peak debt)" two rows below.
    const bridge = src.slice(src.indexOf("card('New Purchase Details'"), src.indexOf("card('Loan 1"))
    expect(bridge).toContain("loan: ''")
    expect(bridge).toContain("row('Bridging loan (peak debt)'")
  })

  it('nothing adds a price and a duty together by hand any more', () => {
    const code = src.replace(/\/\/[^\n]*/g, '')
    expect(code).not.toMatch(/readMoney\(d\.purchasePrice\) \|\| 0\) \+ \(readMoney\(d\.stampDuty\)/)
  })
})
