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

// THE USE RECORDED AGAINST THE HOUSE THE SPLIT SITS ON.
//
// 16 Oct 2026. Fabio, on an Equity release + purchase whose compliance notes
// refused to compose: "did we remove the purpose of the loan? also you know
// from BC that equity is being used to purchase the property, why do you ask?"
//
// Nothing had been removed. The BC's own Purpose dropdown is drawn on Debt
// recycling and Complex refinance only, and the deal structure's one is
// read-only on the Compliance tab - so on that template the question was asked
// where it could not be answered, about something the deal already knew. Both
// his securities are recorded on the fact find as Investment.
//
// THIS IS NOT A DEFAULT AND IT IS NOT AN INFERENCE FROM THE SCENARIO'S NAME.
// lib/debt-recycling.ts refuses both, for good reason: "a default here would be
// the portal deciding, silently, that a split nobody has labelled is private
// borrowing - and printing that to a client." This reads a box a person filled
// in, about the specific house this specific split is secured by. A split with
// no security still comes back blank, and an answer typed anywhere wins.
const BEING_PURCHASED_ID = 'being-purchased'

function useToPurpose(v: any): 'OO' | 'INV' | '' {
  const s = txt(v).toLowerCase()
  if (!s) return ''
  if (s.includes('invest')) return 'INV'
  if (s.includes('owner') || s.includes('occupi')) return 'OO'
  return ''
}

export function purposeFromTheProperty(deal: any, securityId: any): 'OO' | 'INV' | '' {
  const id = txt(securityId)
  if (!id) return ''
  const bc = deal?.bc_data || {}
  // The house nobody owns yet is not on the fact find. What it will be is
  // recorded on the BC, in the same words.
  if (id === BEING_PURCHASED_ID) {
    return useToPurpose(bc.newPurchasePropertyType) || useToPurpose(bc.propertyType)
  }
  const list = Array.isArray(deal?.fact_find_data?.properties) ? deal.fact_find_data.properties : []
  const hit = list.find((x: any) => txt(x?.id) === id)
  return useToPurpose(hit?.ownershipType)
}
