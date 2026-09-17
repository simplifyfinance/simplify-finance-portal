// ONE SET OF LIVING EXPENSES PER HOUSEHOLD.
//
// 17 Sep 2026. See lib/households.ts for why there is more than one.
//
// WHERE HOUSEHOLD 1 LIVES, AND WHY IT IS NOT MOVED.
//
// compliance_data.expenses is household 1 and stays exactly where it is. Every
// deal ever assessed has its expenses in that field; the handover reads it, the
// HEM totals read it, the compliance wording reads it. Moving them into a map
// keyed by household would mean rewriting every record in the book to gain
// nothing, and a migration is a thing that can go wrong at three in the morning.
//
// So households two and three go in compliance_data.expensesByHousehold, keyed
// '2' and '3'. A deal with one household never grows the field at all, and reads
// byte for byte the way it reads today.

import { HOUSEHOLD_IDS, type HouseholdId } from './households'

export type ExpenseEntry = {
  monthlyAmount: string
  splits: Record<string, string>
  comment: string
  hem?: string
}
export type ExpenseRecord = Record<string, ExpenseEntry>

const isRecord = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v)

// What to show for a household. Household 1 is the record that has always been
// there; a household nobody has typed into yet comes back empty rather than
// undefined, so a screen can draw it without checking.
export function expensesFor(compliance: any, id: HouseholdId): ExpenseRecord {
  if (id === '1') {
    const own = compliance?.expensesByHousehold?.['1']
    return isRecord(own) ? own : (isRecord(compliance?.expenses) ? compliance.expenses : {})
  }
  const own = compliance?.expensesByHousehold?.[id]
  return isRecord(own) ? own : {}
}

// The patch to write after changing one household's expenses. Household 1 keeps
// writing to the field it has always written to, so a one-household deal never
// changes shape and nothing has to be migrated.
export function writeExpenses(compliance: any, id: HouseholdId, next: ExpenseRecord):
    { expenses?: ExpenseRecord; expensesByHousehold?: Record<string, ExpenseRecord> } {
  if (id === '1' && !isRecord(compliance?.expensesByHousehold?.['1'])) {
    return { expenses: next }
  }
  return { expensesByHousehold: { ...(compliance?.expensesByHousehold || {}), [id]: next } }
}

// Every household's expenses, in order, for anything that has to print or add up
// all of them - the handover, the broker notes, the compliance wording.
export function everyHousehold(compliance: any, ids: HouseholdId[]):
    { id: HouseholdId; expenses: ExpenseRecord }[] {
  const wanted = ids.length ? ids : (['1'] as HouseholdId[])
  return HOUSEHOLD_IDS.filter(id => wanted.includes(id))
    .map(id => ({ id, expenses: expensesFor(compliance, id) }))
}

// MOVING SOMEBODY BETWEEN HOUSEHOLDS NEVER DELETES WHAT WAS TYPED.
//
// Their percentage column follows them: it is removed from the household they
// left and appears, blank, in the one they joined. The monthly amounts on both
// sides are untouched - those are the household's, not the person's, and a
// figure somebody typed is not something to throw away because a dropdown moved.
export function movePerson(record: ExpenseRecord, name: string, take: boolean): ExpenseRecord {
  const out: ExpenseRecord = {}
  for (const [key, entry] of Object.entries(record || {})) {
    const splits = { ...(entry?.splits || {}) }
    if (take) delete splits[name]
    else if (!(name in splits)) splits[name] = ''
    out[key] = { ...entry, splits }
  }
  return out
}
