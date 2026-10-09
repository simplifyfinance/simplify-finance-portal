// OWNER OCCUPIED OR INVESTMENT, HOWEVER IT WAS WRITTEN DOWN.
//
// 9 Oct 2026. This answer is recorded in two places with two vocabularies, and
// neither knew about the other:
//
//   the BC's split dropdown        'owner_occupied' | 'investment'
//   the deal strip's dropdown      'OO' | 'INV'
//
// Both land in the same field, split.purpose. lib/deal-structure.ts cast it to
// its own type instead of checking it, so the BC's spelling read as "nobody has
// answered" - on debt recycling and complex refinance, the two scenarios that
// exist BECAUSE each split holds one purpose.
//
// NOT A MIGRATION. Deals carry each spelling today and neither is wrong. A
// script rewriting live records to fix a reading fault is a bigger risk than
// the fault. This reads both, forever.
//
// BLANK IS STILL BLANK. lib/debt-recycling.ts says why and it has not changed:
// "A default here would be the portal deciding, silently, that a split nobody
// has labelled is private borrowing - and printing that to a client."
const txt = (v: any) => String(v ?? '').trim()

export function normalisePurpose(v: any): 'OO' | 'INV' | '' {
  const p = txt(v).toLowerCase()
  if (p === 'oo' || p === 'owner_occupied') return 'OO'
  if (p === 'inv' || p === 'investment') return 'INV'
  return ''
}
