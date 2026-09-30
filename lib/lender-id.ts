// WHICH LENDER ROW A NAME ON A DEAL MEANS.
//
// A deal carries a lender by NAME, typed or picked months ago. Everything keyed
// on lenders.id - the rules table, commissions, the reprice threshold - has to
// get from one to the other, and app/api/commission-import already did it with
// a normalise-and-aliases map written inline.
//
// This is that map, on its own, because the milestone emails are the second
// caller and two inline copies of a matcher is how two screens start disagreeing
// about which bank a deal is with.
//
// NO FUZZY MATCH. An exact name or a recorded alias, and otherwise nothing. A
// near-miss here would load ANOTHER lender's answers and put them in a client's
// email under this lender's name, which is the same class of bug as the
// recommendation showing under the client's chosen lender.

const txt = (v: any) => String(v ?? '').trim()

export function norm(v: any): string {
  return txt(v).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export type LenderRow = { id: string; name: string; aliases?: string[] | null }

export function lenderIdFrom(rows: LenderRow[] | null | undefined, name: any): string {
  const want = norm(name)
  if (!want) return ''
  const list = (rows || []).filter(l => txt(l?.id))

  // A NAME OF ITS OWN ALWAYS BEATS SOMEBODY ELSE'S ALIAS, so every real name is
  // laid down before any alias is. One pass would let a row that happens to come
  // first claim another lender's name as its alias.
  const byName = new Map<string, string>()
  for (const l of list) {
    const key = norm(l.name)
    if (key && !byName.has(key)) byName.set(key, txt(l.id))
  }
  for (const l of list) {
    for (const a of (l.aliases || [])) {
      const alias = norm(a)
      if (alias && !byName.has(alias)) byName.set(alias, txt(l.id))
    }
  }
  return byName.get(want) || ''
}
