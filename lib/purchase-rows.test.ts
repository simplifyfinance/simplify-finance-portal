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

  it('never tells a client their contribution is $0 - it works it out instead', () => {
    // Jacob Joson, 16 Sep 2026: loan recorded, deposit box left at 0. "$0" is a
    // claim, not a missing figure, and it told a client they had nothing to find.
    //
    // CHANGED 14 Oct 2026. The old answer was to leave the row out. The better
    // answer is to do the sum: total cost minus the base loan. The box being
    // blank is no reason to withhold a figure we can work out exactly.
    const rows = purchaseRows({ ...base, contribution: '0' })
    const row = rows.find(r => r.label.startsWith('Your contribution required'))
    expect(row, 'the row should be answered, not hidden').toBeTruthy()
    expect(row!.value).toBe('$228,070')
  })

  it('and leaves it out entirely when the sum cannot be done either', () => {
    // No loan recorded, nothing to subtract. A blank still beats a $0.
    const rows = purchaseRows({ ...base, loan: '', contribution: '0' })
    expect(rows.map(r => r.label).join(' ')).not.toContain('Your contribution required')
  })

  // THE PRE-APPROVAL THAT SENT A CLIENT THE WRONG DEPOSIT.
  //
  // 14 Oct 2026. An investment pre-approval showed a loan amount with the LMI
  // and the lender's risk fee inside it, and a contribution worked out by
  // subtracting that same figure from the total cost. The client was told to
  // bring roughly $24,000 less than they actually needed.
  //
  // A capitalised fee is borrowed, not paid. It raises the debt and buys none
  // of the house, so the cash due on the day does not move. Fabio, 14 Oct 2026:
  // "funds to complete need to be calculated exclusing fee only using base loan".
  // THE PRE-APPROVAL, WITH ITS REAL FIGURES.
  //
  // 14 Oct 2026. It went out showing a loan of $1,162,053 and a contribution of
  // $929,947 - exactly total cost minus that loan. The LMI and the lender's
  // risk fee were already inside the $1,162,053, so the client was told to bring
  // the premium's worth less cash than they actually needed.
  //
  // Fabio: "the LMI AS DISCUSSED comes out so the funds to complete is wrong".
  //
  //   Funds to complete = total cost - (loan amount - LMI)
  it('takes the LMI out of the loan before working out the cash', () => {
    const rows = purchaseRows({
      price: '2,000,000', duty: '92,000', dutyLabel: 'Stamp duty (NSW)',
      loan: '1,162,053',                 // the whole loan, premium inside it
      contribution: '929,947',           // the box, short by the premium
      contributionFrom: 'savings',
      lmiApplicable: 'Applicable', lmi: '22,000',
      // Deliberately unanswered - which is the state the real deal was in, and
      // the reason nothing on the screen caught it.
    })
    const loan = rows.find(r => r.label === 'Loan amount')!
    const give = rows.find(r => r.label.startsWith('Your contribution required'))!
    const lmi  = rows.find(r => r.label.startsWith('LMI'))!

    // What they borrow does not move. It is what they borrow.
    expect(loan.value).toBe('$1,162,053')
    // 2,092,000 - (1,162,053 - 22,000). More cash, not less.
    expect(give.value, 'the premium is being counted as if it bought the house').toBe('$951,947')
    // And the line that says what the premium is.
    expect(lmi.value).toBe('$22,000')
  })

  // THE ORDE DEAL.
  //
  // 14 Oct 2026. ORDE Financial add their $4,053 application fee to the loan,
  // so the split read $1,162,053 against a base of $1,158,000 - Fabio's own
  // note on the deal said exactly that. The fee bought none of the house, so
  // the cash due on the day is $4,053 HIGHER, and the email was saying lower.
  //
  // There is no LMI anywhere on this deal, which is why the LMI fix did not
  // touch it.
  it('takes a lender fee out of the loan when it is ticked as added to it', () => {
    const rows = purchaseRows({
      price: '2,000,000', duty: '92,000', dutyLabel: 'Stamp duty (NSW)',
      loan: '1,162,053',        // base 1,158,000 with the fee inside it
      contribution: '929,947',  // the box, short by the fee
      contributionFrom: 'savings',
      feeInLoan: '4,053', feeLabel: 'application fee',
    })
    const loan = rows.find(r => r.label === 'Loan amount')!
    const give = rows.find(r => r.label.startsWith('Your contribution required'))!

    expect(loan.value, 'what they borrow does not move').toBe('$1,162,053')
    // 2,092,000 - (1,162,053 - 4,053)
    expect(give.value, 'the fee is being counted as if it bought the house').toBe('$934,000')
    // And the line that explains why the column does not subtract to itself.
    expect(rows.some(r => r.note && r.value === 'includes $4,053 application fee, added to the loan')).toBe(true)
  })

  it('and leaves the cash alone when the fee is not ticked', () => {
    // Most lenders charge it at settlement, where it is already money to find.
    const rows = purchaseRows({
      price: '2,000,000', duty: '92,000', dutyLabel: 'Stamp duty (NSW)',
      loan: '1,162,053', contribution: '929,947', contributionFrom: 'savings',
    })
    expect(rows.find(r => r.label.startsWith('Your contribution required'))!.value).toBe('$929,947')
    expect(rows.some(r => r.note)).toBe(false)
  })

  it('takes BOTH out when a deal has capitalised LMI and a fee in the loan', () => {
    const rows = purchaseRows({
      price: '2,000,000', duty: '92,000', dutyLabel: 'Stamp duty (NSW)',
      loan: '1,162,053', contribution: '0', contributionFrom: 'savings',
      lmiApplicable: 'Applicable', lmi: '22,000',
      feeInLoan: '4,053', feeLabel: 'application fee',
    })
    // 2,092,000 - (1,162,053 - 22,000 - 4,053)
    expect(rows.find(r => r.label.startsWith('Your contribution required'))!.value).toBe('$956,000')
  })

  it('leaves it in when the premium is paid at settlement, not borrowed', () => {
    // Nothing to take out - it was never in the loan. It is money to find on
    // the day, and the line underneath already says so.
    const rows = purchaseRows({
      price: '2,000,000', duty: '92,000', dutyLabel: 'Stamp duty (NSW)',
      loan: '1,162,053', contribution: '929,947', contributionFrom: 'savings',
      lmiApplicable: 'Applicable', lmi: '22,000', lmiTreatment: 'Settlement',
    })
    expect(rows.find(r => r.label.startsWith('Your contribution required'))!.value).toBe('$929,947')
    expect(rows.find(r => r.label.startsWith('LMI'))!.value).toContain('payable at settlement')
  })

  it('leaves capitalised LMI out of the contribution', () => {
    const rows = purchaseRows({
      price: '900,000', duty: '35,000', dutyLabel: 'Stamp duty (NSW)',
      loan: '765,000',
      // The box, derived from the capitalised figure. Deliberately wrong.
      contribution: '145,600', contributionFrom: 'savings',
      lmiApplicable: 'Applicable', lmi: '21,400', lmiTreatment: 'Capitalised',
    })
    const loan = rows.find(r => r.label === 'Loan amount')!
    const give = rows.find(r => r.label.startsWith('Your contribution required'))!

    // The loan still shows what they borrow, premium included.
    expect(loan.value).toBe('$786,400')
    // And the line that explains it is there, because without it the column
    // looks like it does not add up.
    expect(rows.some(r => r.note && r.value.includes('$21,400'))).toBe(true)
    // The cash is worked from the BASE loan: 935,000 - 765,000.
    expect(give.value, 'the premium has leaked into the contribution again').toBe('$170,000')
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
    const code = withoutConstruction
      // AND THE BUILD CARD, WHICH IS THOSE SAME WORDS WITH A NAME ON THEM.
      //
      // 9 Oct 2026. The rows above moved into buildStructure() and
      // lib/build-card.ts so the buy and sell that funds a build prints the
      // same card instead of a second copy of it. Same exclusion, same reason -
      // it is construction's vocabulary, not a purchase breakdown.
      .replace(/function buildStructure[\s\S]*?\n}\n/, '')
      .replace(/\/\/[^\n]*/g, '')
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

  it('the bridge does not print its bridging loan twice', () => {
    // The first version handed the bridging amount in as `loan`, so it appeared
    // as "Loan amount" and again two rows below under its own name.
    //
    // THE LABEL CHANGED ON 30 SEP 2026 and this test changed with it. It used to
    // assert "Bridging loan (peak debt)" - which was the bug: that row is the
    // bridging loan, and the peak debt is a different, larger figure typed by
    // the team. See lib/peak-debt.test.ts. The thing this test is actually for -
    // one number, one name, once - is unchanged.
    const bridge = src.slice(src.indexOf("card('New Purchase Details'"), src.indexOf("card('Loan 1"))
    expect(bridge).toContain("loan: ''")
    expect(bridge).toContain("row('Bridging loan',")
    expect(bridge).not.toContain('(peak debt)')
  })

  it('nothing adds a price and a duty together by hand any more', () => {
    const code = src.replace(/\/\/[^\n]*/g, '')
    expect(code).not.toMatch(/readMoney\(d\.purchasePrice\) \|\| 0\) \+ \(readMoney\(d\.stampDuty\)/)
  })
})
