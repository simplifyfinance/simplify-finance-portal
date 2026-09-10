// WHY THIS LENDER AND NOT THE OTHERS.
//
// The options box asks the model to justify the recommendation against the
// cheaper options considered - and was given the other lenders as a list of
// NAMES. No rates, no fees, no features. So the one comparison the box exists to
// make was the one thing it could not make from the facts, and the system
// prompt forbids inventing. It either refused or waffled.
//
// Everything it needs is recorded on the Lending options tab already: each
// option's rates, every fee, whether it has an offset, and how long the lender
// takes. This turns that into a comparison, and states plainly where the
// recommended lender is NOT the cheapest - because that is the sentence a credit
// assessor is looking for.
//
// Fabio, 3 Sep 2026: "if it's a lower rate, compare the rates. If it's a lower
// fee, compare the fees. If he has more features, compare the features."

import { readMoney, money } from './money'

const txt = (v: any) => String(v ?? '').trim()
const rate = (v: any) => {
  const n = Number(txt(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
const fee = (v: any) => readMoney(v) ?? 0
// A BLANK FEE BOX IS NOT A FEE OF ZERO.
//
// 10 Sep 2026. A lender whose fee boxes were simply never filled in summed to
// $0 and was then declared the cheapest: "Lowest upfront fees: CBA at $0. ING
// charges $350, $350 more." Nobody had said CBA was free. That sentence was
// going into the facts behind a compliance note and telling a credit assessor
// the recommendation was beaten on price by a lender nobody had priced.
//
// Fabio, 10 Sep 2026: "make sure rules are in place and not compare things say
// this is cheaper when it isnt."
//
// So a figure is only comparable when somebody typed something into at least one
// of its boxes. "0" typed in is a real answer and stays comparable; empty is not.
const recorded = (v: any) => txt(v) !== ''
const pct = (n: number) => `${Number(n.toFixed(2))}%`

export type Option = {
  name: string
  product: string
  recommended: boolean
  rates: { label: string; rate: number }[]
  lowestRate: number | null
  upfront: number
  // False when every box making up that figure is empty. The number is still 0
  // so nothing downstream breaks, but it must not be compared.
  upfrontKnown: boolean
  ongoing: number
  ongoingKnown: boolean
  offset: boolean
  offsetAnswer: string
  approvalDays: number | null
  note: string
}

// Only the rate modules the broker actually switched on. A disabled module holds
// whatever was last typed into it, and quoting that would be quoting a rate this
// lender was never offered on.
const RATE_MODULES: [string, string][] = [
  ['variablePI', 'Variable P&I'], ['variableIO', 'Variable IO'],
  ['fixedPI', 'Fixed P&I'], ['fixedIO', 'Fixed IO'],
]

// Paid once, at the start.
const UPFRONT = ['applicationFee', 'establishmentFee', 'valuationFee', 'legalFee', 'docProcessingFee']
// Paid every year for the life of the loan.
const ONGOING = ['annualFee']

export function optionsOf(lo: any): Option[] {
  const recommended = txt(lo?.recommendedLender)
  return (lo?.lenders || [])
    .filter((l: any) => txt(l?.lenderName))
    .map((l: any) => {
      const rates = RATE_MODULES
        .filter(([k]) => l?.[k]?.enabled && rate(l[k]?.rate) !== null)
        .map(([k, label]) => ({ label, rate: rate(l[k].rate) as number }))
      const offsetAnswer = txt(l?.offsetAccount)
      return {
        name: txt(l.lenderName),
        product: txt(l.productName),
        recommended: txt(l.lenderName) === recommended,
        rates,
        lowestRate: rates.length ? Math.min(...rates.map(r => r.rate)) : null,
        upfront: UPFRONT.reduce((t, k) => t + fee(l?.[k]), 0),
        upfrontKnown: UPFRONT.some(k => recorded(l?.[k])),
        ongoing: ONGOING.reduce((t, k) => t + fee(l?.[k]), 0),
        ongoingKnown: ONGOING.some(k => recorded(l?.[k])),
        offset: !!offsetAnswer && !/^no$/i.test(offsetAnswer),
        offsetAnswer,
        approvalDays: rate(l?.approvalDays),
        note: txt(l?.specialNote),
      }
    })
}

export type Comparison = {
  // One line per option, everything recorded about it.
  options: Option[]
  // How they stack up, said plainly. Empty when there is only one option.
  lines: string[]
  // The points where the recommendation is NOT ahead. These are the ones the
  // credit assessor will ask about, so they are separated out and the prompt
  // makes the model address each one.
  against: string[]
  criteria: string[]
}

export function compareLenders(lo: any): Comparison {
  const options = optionsOf(lo)
  const criteria = (lo?.criteriaUsed || []).map(txt).filter(Boolean)
  const rec = options.find(o => o.recommended)
  const lines: string[] = []
  const against: string[] = []

  if (options.length < 2 || !rec) return { options, lines, against, criteria }
  const others = options.filter(o => !o.recommended)

  // --- rate ---------------------------------------------------------------
  const rated = options.filter(o => o.lowestRate !== null)
  if (rated.length > 1 && rec.lowestRate !== null) {
    const best = rated.reduce((a, b) => (b.lowestRate as number) < (a.lowestRate as number) ? b : a)
    if (best.recommended) {
      lines.push(`Lowest rate: ${rec.name} at ${pct(rec.lowestRate)} — the recommended lender is the cheapest on rate.`)
    } else {
      const gap = (rec.lowestRate as number) - (best.lowestRate as number)
      const l = `Lowest rate: ${best.name} at ${pct(best.lowestRate as number)}. `
              + `${rec.name} is ${pct(gap)} higher at ${pct(rec.lowestRate)}.`
      lines.push(l); against.push(l)
    }
  }

  // --- fees ---------------------------------------------------------------
  // Only the options somebody has actually priced, and only when the recommended
  // one is among them - otherwise there is no comparison to make.
  const pricedUp = options.filter(o => o.upfrontKnown)
  const missingUp = options.filter(o => !o.upfrontKnown).map(o => o.name)
  if (missingUp.length) {
    lines.push(`Upfront fees are not recorded for ${missingUp.join(' and ')}, so they have not been compared on cost to set up.`)
  }
  const cheapestUpfront = pricedUp.length ? pricedUp.reduce((a, b) => b.upfront < a.upfront ? b : a) : null
  if (cheapestUpfront && rec.upfrontKnown && pricedUp.length > 1
      && pricedUp.some(o => o.upfront !== cheapestUpfront.upfront)) {
    if (cheapestUpfront.recommended) {
      lines.push(`Lowest upfront fees: ${rec.name} at ${money(rec.upfront)} — the recommended lender is the cheapest to set up.`)
    } else {
      const l = `Lowest upfront fees: ${cheapestUpfront.name} at ${money(cheapestUpfront.upfront)}. `
              + `${rec.name} charges ${money(rec.upfront)}, ${money(rec.upfront - cheapestUpfront.upfront)} more.`
      lines.push(l); against.push(l)
    }
  }

  const pricedOn = options.filter(o => o.ongoingKnown)
  const missingOn = options.filter(o => !o.ongoingKnown).map(o => o.name)
  if (missingOn.length) {
    lines.push(`Ongoing fees are not recorded for ${missingOn.join(' and ')}, so they have not been compared on annual cost.`)
  }
  const cheapestOngoing = pricedOn.length ? pricedOn.reduce((a, b) => b.ongoing < a.ongoing ? b : a) : null
  if (cheapestOngoing && rec.ongoingKnown && pricedOn.length > 1
      && pricedOn.some(o => o.ongoing !== cheapestOngoing.ongoing)) {
    if (cheapestOngoing.recommended) {
      lines.push(`Lowest ongoing fees: ${rec.name} at ${money(rec.ongoing)} a year.`)
    } else {
      const l = `Lowest ongoing fees: ${cheapestOngoing.name} at ${money(cheapestOngoing.ongoing)} a year. `
              + `${rec.name} charges ${money(rec.ongoing)}, ${money(rec.ongoing - cheapestOngoing.ongoing)} more each year.`
      lines.push(l); against.push(l)
    }
  }

  // --- features -----------------------------------------------------------
  // An unanswered offset question is not a No. Only options with an answer are
  // compared, for the same reason as the fees.
  const offsetAnswered = options.filter(o => o.offsetAnswer !== '')
  const offsetUnknown = options.filter(o => o.offsetAnswer === '').map(o => o.name)
  if (offsetUnknown.length) {
    lines.push(`Whether an offset account is available is not recorded for ${offsetUnknown.join(' and ')}.`)
  }
  const withOffset = offsetAnswered.filter(o => o.offset).map(o => o.name)
  if (withOffset.length && rec.offsetAnswer !== '' && withOffset.length < offsetAnswered.length) {
    if (rec.offset) lines.push(`Offset account: available with ${withOffset.join(' and ')} — including the recommended lender.`)
    else {
      const l = `Offset account: available with ${withOffset.join(' and ')}, but NOT with ${rec.name}.`
      lines.push(l); against.push(l)
    }
  }

  // --- turnaround ---------------------------------------------------------
  const timed = options.filter(o => o.approvalDays !== null)
  if (timed.length > 1 && rec.approvalDays !== null) {
    const fastest = timed.reduce((a, b) => (b.approvalDays as number) < (a.approvalDays as number) ? b : a)
    if (fastest.recommended) {
      lines.push(`Fastest approval: ${rec.name} at ${rec.approvalDays} days.`)
    } else {
      const l = `Fastest approval: ${fastest.name} at ${fastest.approvalDays} days. `
              + `${rec.name} takes ${rec.approvalDays}.`
      lines.push(l); against.push(l)
    }
  }

  return { options, lines, against, criteria }
}

// The block that goes into the facts. Written out rather than handed over as
// data, because the model reads facts, not JSON.
export function comparisonBlock(lo: any): string[] {
  const c = compareLenders(lo)
  if (c.options.length === 0) return []
  const out: string[] = []

  for (const o of c.options) {
    out.push(`${o.name}${o.product ? ` — ${o.product}` : ''}${o.recommended ? '   [RECOMMENDED]' : ''}`)
    if (o.rates.length) out.push(...o.rates.map(r => `  ${r.label} ${pct(r.rate)}`))
    else out.push('  No rate recorded')
    out.push(`  Upfront fees ${money(o.upfront)}, annual fee ${money(o.ongoing)}`)
    out.push(`  Offset account: ${o.offsetAnswer || 'not recorded'}`)
    if (o.approvalDays !== null) out.push(`  Approval turnaround: ${o.approvalDays} days`)
    if (o.note) out.push(`  Note: ${o.note}`)
  }

  if (c.lines.length) { out.push('', 'HOW THEY COMPARE'); out.push(...c.lines) }

  if (c.against.length) {
    out.push('', 'WHERE THE RECOMMENDATION IS NOT THE CHEAPEST OR BEST — a credit assessor will ask about each of these, so each one must be addressed:')
    out.push(...c.against)
  }

  if (c.criteria.length) {
    out.push('', 'WHAT THE CLIENT SAID MATTERS (the research criteria ticked on the Lending options tab):')
    out.push(...c.criteria.map(x => `- ${x}`))
  }
  return out
}
