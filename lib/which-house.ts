
// WHICH HOUSE. ONE ANSWER, ONE PLACE.
//
// 25 Nov 2026. Kylie, on Thomas and Sally Isherwood: "Ive put in the correct
// sec address but the Handover seemed to copy the client's selling property."
//
// She had. 16 Bergonia Street, Mona Vale, typed into "The property being
// bought" at the offer accepted step, which is the one field on a deal that
// means exactly that. The Actual Purchase Handover printed U4 26 Richmond
// Avenue, Dee Why - the unit the Isherwoods are SELLING - because it never
// read that field. It asked compliance for a typed address, found none, and
// took the first property on the fact find.
//
// THIS IS THE SECOND TIME. The milestone emails did the same thing and it was
// fixed on 24 November - lib/milestone-send.ts still carries the note: a client
// was congratulated on the home she already owned, with the price of the one
// she was buying underneath it. That fix went into the file where it was
// reported, not into the idea, so the handover and the board's quick look kept
// the fault.
//
// Fabio, 25 Nov: "we fixed something yesterday in offer accepted that is now a
// problem in settlements. So how can we avoid that?"
//
// By there being one answer. Four functions used to answer "which house" with
// three different orders of preference and none of them knew the others
// existed. Now they all come here, and lib/one-house-one-answer.test.ts fails
// the build if a fifth one appears.
//
// ----------------------------------------------------------------------------
//
// TWO QUESTIONS, NOT ONE, AND COLLAPSING THEM WOULD BE WRONG.
//
//   theHouseBeingBought   the single property this deal is buying. A refinance
//                         has none and says so.
//   securityAddressOf     every property the lender holds, which on a refinance
//                         of three houses is three houses. Lives in
//                         lib/security-address.ts and is unchanged.
//
// A purchase handover wants the first. A compliance pack wants the second.

const txt = (v: any) => String(v ?? '').trim()

/** "TBA - Mona Vale" is a placeholder the pre-approval writes, not an address. */
const isPlaceholder = (v: string) => /^TBA\b/i.test(v)

/**
 * THE HOUSE THIS DEAL IS BUYING, or '' when there genuinely is not one.
 *
 * THE ORDER, AND WHY IT IS THIS ORDER.
 *
 * 1. `deals.purchase_address` - typed at the offer accepted step, which is the
 *    moment somebody holds the contract. It is the only field on the whole deal
 *    whose meaning is "the house being bought" and nothing else, and it is the
 *    newest thing anybody has typed about the property.
 *
 * 2. `compliance_data.securityAddress` - what secures the loan, typed earlier.
 *    True on most purchases and the answer before the offer was accepted. A
 *    "TBA" from a pre-approval is skipped: it is a placeholder, not an address.
 *
 * 3. The fact find, LAST and only because something is better than nothing on a
 *    deal where nobody has typed either of the above. This is where the fault
 *    came from: a client's existing properties live here, including the one
 *    they are selling to buy this one, and it has no idea which is which.
 */
export function theHouseBeingBought(deal: any): string {
  const bought = txt(deal?.purchase_address)
  if (bought && !isPlaceholder(bought)) return bought

  const secured = txt(deal?.compliance_data?.securityAddress)
  if (secured && !isPlaceholder(secured)) return secured

  const guess = txt(securityOf(deal)?.address)
  return isPlaceholder(guess) ? '' : guess
}

// The security is whichever property the loan is actually against. The fact find
// can hold several - the family home, an investment, one being sold - so the one
// being bought or borrowed against comes first, and the rest are counted rather
// than listed. A panel that lists four addresses answers nothing at a glance.
export function securityOf(deal: any): { address: string; detail: string; more: number } {
  const props: any[] = deal?.fact_find_data?.properties || []
  const withAddress = props.filter(p => String(p?.address || '').trim())
  const primary = withAddress.find(p => /purchas|security|new/i.test(String(p?.futureUse || ''))) || withAddress[0]
  if (!primary) {
    // Before a fact find has a property on it, the BC at least knows the suburb.
    const suburb = String(deal?.bc_data?.suburb || '').trim()
    return { address: suburb || '', detail: String(deal?.bc_data?.propertyType || '').trim(), more: 0 }
  }
  const detail = [primary.propertySubtype, primary.ownershipType].map((x: any) => String(x || '').trim()).filter(Boolean).join(' · ')
  return { address: String(primary.address).trim(), detail, more: Math.max(0, withAddress.length - 1) }
}
