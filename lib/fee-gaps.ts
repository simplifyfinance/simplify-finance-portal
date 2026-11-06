// WHICH FEES A CLIENT WILL NEVER BE TOLD ABOUT.
//
// 30 Oct 2026, Bankwest. Fabio put a $350 settlement fee on a product and it
// did not appear on the comparison. The cause was the screen holding a copy of
// the library from before the edit, and that is fixed - but the audit it set
// off found the worse half:
//
//   A FEE NOBODY HAS TYPED IN IS SILENT, NOT WRONG.
//
// The email prints the fees it was given. A product with its settlement fee
// recorded shows $350; the one beside it, where nobody has filled the box in,
// shows nothing at all - and a client reads nothing as nothing to pay. The
// cheaper-looking option is the one we know less about.
//
// Nothing on screen says so, because nothing knows: a blank box and a bank
// that genuinely charges nothing look exactly alike in the database. Only a
// person can tell them apart, which is why this is a list to work through
// rather than a rule to enforce.
//
// $0 IS AN ANSWER. "No application fee" is a real thing a lender says, and a
// recorded zero has to count as filled in - otherwise the list is full of
// products nobody needs to touch and nobody reads it twice.

export type FeeKey =
  | 'application_fee' | 'annual_fee' | 'monthly_fee' | 'valuation_fee'
  | 'legal_fee' | 'rate_lock_fee' | 'early_repayment_fee' | 'discharge_fee'

// THE EIGHT THE LENDING OPTIONS SCREEN COPIES OFF A PRODUCT. See
// selectProduct in LOForm: these are every library figure that can reach a
// client. A fee not on this list cannot be missing from an email.
export const FEES_THAT_REACH_A_CLIENT: { key: FeeKey; label: string }[] = [
  { key: 'application_fee', label: 'Application' },
  { key: 'annual_fee', label: 'Annual' },
  { key: 'monthly_fee', label: 'Monthly' },
  { key: 'valuation_fee', label: 'Valuation' },
  { key: 'legal_fee', label: 'Settlement' },
  { key: 'rate_lock_fee', label: 'Rate lock' },
  { key: 'early_repayment_fee', label: 'Early repayment' },
  { key: 'discharge_fee', label: 'Discharge' },
]

// THE COLUMNS ON THE SCREEN, from the mock Fabio approved on 30 Oct 2026, with
// Monthly added on 17 Aug 2026 when the table moved onto the lender library and
// its cells became editable. The remaining two - rate lock and early repayment
// - are counted and searched like the rest; they are off the table because
// eight columns of blanks is a wall, not a list, and they are two boxes down
// inside the product.
export const FEE_COLUMNS: FeeKey[] =
  ['application_fee', 'annual_fee', 'monthly_fee', 'valuation_fee', 'discharge_fee', 'legal_fee']

export type LibProduct = {
  id: string
  lender_id: string
  product_name?: string | null
  active?: boolean | null
} & Partial<Record<FeeKey, string | null>>

export type LibLender = {
  id: string
  name?: string | null
  active?: boolean | null
  legal_fee_label?: string | null
}

export type FeeRow = {
  id: string
  lenderId: string
  lender: string
  product: string
  deals: number
  fees: Record<FeeKey, string>   // '' when nobody has said
  missing: FeeKey[]
  firstOfLender: boolean
}

// SOMEBODY HAS ANSWERED. Not "there is a fee" - a typed zero is an answer, and
// a box of spaces is not.
export function recorded(v?: string | null): boolean {
  return String(v ?? '').trim() !== ''
}

export function gapsOn(p: LibProduct): FeeKey[] {
  return FEES_THAT_REACH_A_CLIENT
    .map(f => f.key)
    .filter(k => !recorded(p[k]))
}

// ONLY WHAT A BROKER CAN STILL PICK. An archived product, or any product of an
// archived lender, is off the dropdown - see getProductsForLender in LOForm -
// so a gap on one cannot reach a client and has no business on this list.
export function quotable(products: LibProduct[], lenders: LibLender[]): LibProduct[] {
  const live = new Set(lenders.filter(l => l.active !== false).map(l => l.id))
  return products.filter(p => p.active !== false && live.has(p.lender_id))
}

// HOW OFTEN WE ACTUALLY SEND THIS BANK. Counted off the recommended lender on
// real deals, because "the lenders we use" is not a list anybody maintains and
// a list nobody maintains goes stale in a month.
export function lenderUse(deals: { lender_id?: string | null }[]): Record<string, number> {
  const n: Record<string, number> = {}
  for (const d of deals) {
    const id = String(d.lender_id ?? '').trim()
    if (id) n[id] = (n[id] || 0) + 1
  }
  return n
}

export function feeRows(
  products: LibProduct[], lenders: LibLender[], use: Record<string, number>,
): FeeRow[] {
  const name: Record<string, string> = {}
  lenders.forEach(l => { name[l.id] = String(l.name ?? '').trim() })

  const rows: FeeRow[] = quotable(products, lenders).map(p => {
    const fees = {} as Record<FeeKey, string>
    FEES_THAT_REACH_A_CLIENT.forEach(f => {
      fees[f.key] = recorded(p[f.key]) ? String(p[f.key]).trim() : ''
    })
    return {
      id: p.id,
      lenderId: p.lender_id,
      lender: name[p.lender_id] || 'Lender not named',
      product: String(p.product_name ?? '').trim() || 'Product not named',
      deals: use[p.lender_id] || 0,
      fees,
      missing: gapsOn(p),
      firstOfLender: false,
    }
  })

  // MOST USED FIRST, because the product that goes out twenty times this year
  // is worth filling in before the one nobody has quoted since March.
  rows.sort((a, b) =>
    (b.deals - a.deals) ||
    a.lender.localeCompare(b.lender) ||
    a.product.localeCompare(b.product))

  let last = ''
  rows.forEach(r => { r.firstOfLender = r.lender !== last; last = r.lender })
  return rows
}

export type Filter = 'used' | 'all' | 'gaps'

export function shown(rows: FeeRow[], filter: Filter, find = ''): FeeRow[] {
  const needle = find.trim().toLowerCase()
  const kept = rows.filter(r => {
    if (filter === 'used' && r.deals === 0) return false
    if (filter === 'gaps' && r.missing.length === 0) return false
    if (needle && !`${r.lender} ${r.product}`.toLowerCase().includes(needle)) return false
    return true
  })
  let last = ''
  return kept.map(r => {
    const first = r.lender !== last
    last = r.lender
    return { ...r, firstOfLender: first }
  })
}

export type Counts = {
  products: number
  lenders: number
  missing: Record<FeeKey, number>
  noWording: number
}

export function counts(
  products: LibProduct[], lenders: LibLender[],
): Counts {
  const live = quotable(products, lenders)
  const missing = {} as Record<FeeKey, number>
  FEES_THAT_REACH_A_CLIENT.forEach(f => {
    missing[f.key] = live.filter(p => !recorded(p[f.key])).length
  })
  return {
    products: live.length,
    lenders: new Set(live.map(p => p.lender_id)).size,
    missing,
    // THE SETTLEMENT FEE HAS A DIFFERENT NAME AT EVERY BANK, and the email
    // prints whatever the lender record says. Bankwest's was unset on 30 Oct,
    // so a recorded $350 came out under a heading nobody at that bank uses.
    noWording: lenders.filter(l =>
      l.active !== false && !recorded(l.legal_fee_label)).length,
  }
}
