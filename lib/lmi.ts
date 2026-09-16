// IS THE LMI IN THE LOAN, OR ON TOP OF IT?
//
// Fabio, 16 Sep 2026, on William Welton: "it is saying LMI is $4K, it is
// confusing my staff that the loan amount is 460K PLUS LMI but the 460K is
// INCLUDING."
//
// Nothing in the portal recorded the answer, so nothing could state it. The BC
// works the loan amount and the LVR out from THE SPLITS ALONE - the LMI is never
// added to either - while lib/broker-notes.ts printed "(including capitalised
// LMI of $X)" against that same figure on every purchase. One of those two was
// always wrong, and on a refinance the sentence did not print at all, so the
// number simply sat there with nothing to say what it was.
//
// So the BC now asks once, and this file is the only place that answers.
//
// THE AMOUNT TYPED INTO A SPLIT IS THE BASE LOAN - what the bank lends before
// LMI. Fabio, 16 Sep 2026: "be clear we need to input BASE Loan when we click to
// be capitalised." The portal adds the premium; if somebody adds it too, the
// deal gains the premium twice, so the BC labels the box and warns when the
// figure looks like it has already been added.
//
// UNANSWERED IS ITS OWN ANSWER. Every deal already on the system has no answer
// recorded, and guessing one would rewrite figures on live files. So unanswered
// prints exactly what it printed before, and says so - on the internal notes
// only. Nothing a client reads changes until somebody chooses.

import { money, readMoney } from './money'

const txt = (v: any) => String(v ?? '').trim()

export type LmiTreatment = 'capitalised' | 'settlement' | 'unanswered'

// What the BC stores. Kept as words rather than a boolean so an unanswered deal
// is distinguishable from one answered "no".
export const LMI_CAPITALISED = 'Capitalised'
export const LMI_SETTLEMENT = 'Settlement'

export function lmiTreatment(bc: any): LmiTreatment {
  const v = txt(bc?.lmiTreatment).toLowerCase()
  if (v === 'capitalised') return 'capitalised'
  if (v === 'settlement') return 'settlement'
  return 'unanswered'
}

// An LMI figure only counts where LMI actually applies AND an amount is
// recorded. "Applicable" with no amount is a gap for lib/bc-ready.ts to raise,
// not a number to do arithmetic with.
export function lmiAmount(bc: any): number | null {
  if (txt(bc?.lmiApplicable) !== 'Applicable') return null
  const n = readMoney(bc?.lmi)
  return n && n > 0 ? n : null
}

// The loan as it will actually be drawn. `base` is whatever the caller already
// shows as the lending - this never changes which figure that is, only whether
// the premium is added to it.
export function totalLoan(bc: any, base: number | null): number | null {
  if (base === null) return null
  const amount = lmiAmount(bc)
  if (amount === null || lmiTreatment(bc) !== 'capitalised') return base
  return base + amount
}

// THE DOUBLE ENTRY, CAUGHT.
//
// When the LMI is capitalised the amount typed into a split is the BASE loan and
// the portal adds the premium. Somebody who types the already-capitalised figure
// gets the premium twice, and nothing about the result looks wrong.
//
// The fingerprint is exact rather than a guess: take the premium back off what
// was typed, and if the answer lands on a figure already recorded elsewhere on
// the deal, the premium was in there. A correctly typed base loan can never
// match, because it IS that figure with nothing added.
export function looksAlreadyCapitalised(bc: any, base: number | null): boolean {
  const amount = lmiAmount(bc)
  if (amount === null || base === null || lmiTreatment(bc) !== 'capitalised') return false

  const price = readMoney(bc?.purchasePrice) ?? readMoney(bc?.newPurchasePrice)
  const deposit = readMoney(bc?.deposit)
  const candidates: (number | null)[] = [
    readMoney(bc?.existingLoanBal),
    price !== null && deposit !== null ? price - deposit : null,
  ]
  // A dollar or two of rounding is still the same mistake.
  return candidates.some(c => c !== null && c > 0 && Math.abs((base - amount) - c) < 2)
}

export type FigureRow = [string, string]

// THE TAIL OF EVERY FIGURES BLOCK - the handover sheet, the summary PDF and the
// broker notes all print these same rows, in this order, so they cannot drift
// into describing the same deal differently.
export function loanFigureRows(bc: any, base: number | null, lvrText: string): FigureRow[] {
  const amount = lmiAmount(bc)
  const lvrRow: FigureRow[] = lvrText ? [['LVR', lvrText]] : []
  const baseText = base !== null ? money(base) : ''

  if (amount === null) {
    // No LMI, or waived, or applicable with nothing recorded. Exactly as before.
    return [['Loan amount', baseText], ...lvrRow,
            ...(txt(bc?.lmi) ? [['LMI', money(bc.lmi)] as FigureRow] : [])]
  }

  const how = lmiTreatment(bc)

  if (how === 'capitalised') {
    // It adds up on the page. Nobody has to ask.
    return [
      ['Lending', baseText],
      ['LMI (capitalised)', `+ ${money(amount)}`],
      ['Total loan', base !== null ? money(base + amount) : ''],
      // On the lending, not the total - the premium is worked out FROM this LVR,
      // so feeding it back in would chase its own tail.
      ...(lvrText ? [['LVR', `${lvrText} on the lending`] as FigureRow] : []),
    ]
  }

  if (how === 'settlement') {
    return [['Loan amount', baseText], ...lvrRow,
            ['LMI', `${money(amount)} - paid at settlement, not in the loan`]]
  }

  // UNANSWERED. Same figures as before, and the gap is named rather than filled.
  return [['Loan amount', baseText], ...lvrRow,
          ['LMI', `${money(amount)} - not yet said whether this is added to the loan`]]
}

// The one phrase the broker notes put after the loan figure, so an assessor
// reading the sentence on its own still knows which number they are looking at.
// Empty where there is nothing to say.
export function lmiLoanSuffix(bc: any, base: number | null): string {
  const amount = lmiAmount(bc)
  if (amount === null) {
    const applicable = txt(bc?.lmiApplicable)
    if (applicable === 'Waived') return ' (LMI waived)'
    if (applicable.toLowerCase().startsWith('n')) return ' (no LMI applicable)'
    return ''
  }
  const how = lmiTreatment(bc)
  if (how === 'capitalised') {
    return base !== null
      ? ` base, plus ${money(amount)} capitalised LMI - ${money(base + amount)} in total`
      : ` base, plus ${money(amount)} capitalised LMI`
  }
  if (how === 'settlement') return ` (${money(amount)} LMI is paid at settlement, not included)`
  return ` (${money(amount)} LMI recorded - not yet said whether it is added to this figure)`
}

// WHAT THE CLIENT READS. Returned as plain label/value pairs because the five
// places that build an email column each wrap them in their own markup - the
// wording is what has to be the same, not the HTML.
export type ClientLine = { label: string; value: string; strong?: boolean }

export function lmiClientLines(bc: any, base: number | null): ClientLine[] {
  const amount = lmiAmount(bc)
  if (amount === null) {
    if (txt(bc?.lmiApplicable) === 'Waived') return [{ label: '', value: 'LMI waived' }]
    return []
  }
  const how = lmiTreatment(bc)

  if (how === 'capitalised' && base !== null) {
    return [
      { label: 'Total loan', value: money(base + amount), strong: true },
      { label: '', value: `includes LMI of ${money(amount)}, added to the loan` },
    ]
  }
  if (how === 'settlement') {
    return [{ label: 'LMI (estimated)', value: `${money(amount)} - payable at settlement` }]
  }
  // Unanswered: word for word what went out before. A client is never told the
  // office has not filled a box in.
  return [{ label: 'LMI (estimated)', value: money(amount) }]
}
