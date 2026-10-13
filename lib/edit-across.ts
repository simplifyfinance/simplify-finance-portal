// CHANGING A FIGURE FROM WHEREVER YOU ARE STANDING.
//
// 13 Oct 2026. The day before this, the lending options stopped asking for
// anything the borrowing capacity owns - it prints those answers and sends you
// to the tab that owns them. Right and unpleasant: six splits in, "set on the
// BC" means leaving the page, finding the right split, changing it, coming back.
//
// Fabio: "I want an edit button next to loan amount property value and rates in
// the LO and that allow changes accross".
//
// THE RULE IS NOT BROKEN BY THIS, and it is worth being exact about why. The
// fault we spent that day removing was TWO COPIES of one figure, drifting.
// It was never two places to type. A figure edited here is written where it
// lives - the BC's splits, the fact find's property - and the lending options
// goes on reading it. There is still one copy.
//
// What the box must do is say where the change lands BEFORE it is saved, and
// say what else moves. A split amount is not only a split amount: it changes
// the total the client sees and the LVR on a house.
import { splitsOf } from './deal-structure'
import { bcSplitsTotal } from './funds-to-complete'
import { securitiesOf } from './securities'

const num = (v: any): number => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0
const money = (n: number): string => n > 0 ? `$${Math.round(n).toLocaleString('en-AU')}` : '—'
const pct = (n: number | null): string => n === null ? '—' : `${Math.round(n * 10) / 10}%`

/** Which record actually holds this figure. The dialog is coloured by it. */
export type Lands = 'bc' | 'factfind' | 'lo'

export const LANDS_SAY: Record<Lands, string> = {
  bc: 'This changes the borrowing capacity',
  factfind: 'This changes the fact find',
  lo: 'This stays on the lending options',
}

// --- a split amount ---------------------------------------------------------

/** bc_data with one split's amount changed. Nothing else is touched. */
export function withSplitAmount(bc: any, index: number, value: string): any {
  const b = bc && typeof bc === 'object' ? bc : {}
  const splits = Array.isArray(b.splits) ? b.splits : []
  if (index < 0 || index >= splits.length) return b
  const next = splits.map((s: any, i: number) => i === index ? { ...s, amount: value } : s)
  return { ...b, splits: next }
}

/**
 * What else moves, said before it is saved.
 *
 * The total is the one that matters: it is the loan amount now - see
 * loanAmount() - so it is what the client sees and what the compliance wording
 * uses. Said in those words, because that is the sentence that makes somebody
 * stop and check.
 */
export function splitAmountEffect(deal: any, index: number, value: string): string[] {
  const out: string[] = []
  const was = bcSplitsTotal(deal)
  const after = bcSplitsTotal({ ...deal, bc_data: withSplitAmount(deal?.bc_data, index, value) })
  if (after !== was) {
    out.push(`The borrowing capacity total becomes ${money(after)}.`)
    out.push('That is the figure the client sees and the one the compliance wording uses.')
  }

  // The house this split sits against, if it names one.
  const split = splitsOf(deal)[index]
  const secId = String(split?.securityId || '')
  if (secId) {
    const house = securitiesOf(deal?.bc_data, deal?.fact_find_data).find(x => x.id === secId)
    if (house) {
      // BOTH SIDES WORKED OUT THE SAME WAY. The first version compared against
      // lvrOf(house), which reads the limit typed on the BC - almost never
      // filled in - so a change that moved nothing still announced an LVR.
      // An LVR here is the splits secured on the house over its value, before
      // and after alike.
      const against = (d: any) => splitsOf(d)
        .filter(s => String(s.securityId || '') === secId)
        .reduce((t, s) => t + num(s.amount), 0)
      const val = num(house.value)
      const lvr = (lending: number) => val > 0 && lending > 0 ? (lending / val) * 100 : null
      const before = lvr(against(deal))
      const now = lvr(against({ ...deal, bc_data: withSplitAmount(deal?.bc_data, index, value) }))
      if (now !== null && pct(now) !== pct(before)) {
        out.push(`${house.address} goes to ${pct(now)}.`)
      }
    }
  }
  return out
}

// --- a property value -------------------------------------------------------

/** fact_find_data with one property's value changed. */
export function withPropertyValue(ff: any, id: string, value: string): any {
  const f = ff && typeof ff === 'object' ? ff : {}
  const props = Array.isArray(f.properties) ? f.properties : []
  const next = props.map((p: any) => String(p?.id) === String(id) ? { ...p, value } : p)
  return { ...f, properties: next }
}

export function propertyValueEffect(deal: any, id: string, value: string): string[] {
  const out: string[] = []
  const after = { ...deal, fact_find_data: withPropertyValue(deal?.fact_find_data, id, value) }
  const house = securitiesOf(after?.bc_data, after?.fact_find_data).find(x => x.id === id)
  if (!house) return out

  const lending = splitsOf(after)
    .filter(s => String(s.securityId || '') === id)
    .reduce((t, s) => t + num(s.amount), 0)
  const val = num(value)
  const now = val > 0 && lending > 0 ? (lending / val) * 100 : null
  if (now !== null) out.push(`This property's LVR becomes ${pct(now)}.`)
  out.push("It is the client's own estimate on the fact find, and every LVR on the deal is worked out from it.")
  return out
}

// --- a rate -----------------------------------------------------------------
//
// The one of the three that goes nowhere. A rate IS the product, which is the
// lending options' whole job, and it belongs to one lender option - changing it
// on one lender does not touch the others in the comparison.
export function rateEffect(): string[] {
  return [
    'The rate is the product, so it belongs to this lender option and goes no further.',
    'Nothing on the borrowing capacity or the fact find changes.',
  ]
}

/** The column a change of this kind is written to. */
export function columnFor(lands: Lands): 'bc_data' | 'fact_find_data' | 'lo_data' {
  return lands === 'bc' ? 'bc_data' : lands === 'factfind' ? 'fact_find_data' : 'lo_data'
}
