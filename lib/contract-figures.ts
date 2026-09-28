// WHAT THE CLIENTS ACTUALLY SIGNED, WHEN IT DIFFERS FROM WHAT THEY WERE
// ASSESSED ON.
//
// Fabio, 28 Sep 2026, asked what should happen to the figures once an accepted
// offer comes in at a different price: "Keep the BC, hold the contract beside
// it."
//
// WHY THAT IS THE RIGHT ANSWER AND NOT JUST THE CAUTIOUS ONE. The borrowing
// capacity is what the clients were assessed against and what the compliance
// pack was written from. Rewriting it months later to match a contract makes the
// file disagree with itself: the pack says one price, the deal says another, and
// nothing records that anything moved. So the BC is left exactly as it was, and
// the contracted position sits alongside it.
//
// The portal already works this way at the other end. When a deal lodges it
// keeps lodged_total rather than overwriting loan_amount, and every reader
// prefers it - which is why what was lodged cannot be erased by a later stage.
// See the note in DealSettlement.confirmIt. This is the same idea one stage
// earlier.
//
// EVERYTHING THAT MATTERS FROM HERE READS THESE. Three functions in
// lib/funds-to-complete.ts are the only places the price and the loan are read
// from - fundsToComplete, loanAmount and securityValue - so LVR, LMI and funds
// to complete all follow from this one file without twenty call sites having to
// remember.

const num = (v: any): number => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// The price on the contract of sale. Zero means nobody has recorded one, and
// every reader falls back to the BC - a deal with no accepted offer behaves
// exactly as it did before any of this existed.
export function contractPrice(deal: any): number {
  return num(deal?.contract_price)
}

// The loan the clients settled on once the price moved, recorded when somebody
// answered how the difference is funded. Zero until they do: recording a price
// does not by itself decide the lending, and guessing that the loan absorbs the
// difference is the guess this whole panel exists to avoid.
export function contractLoan(deal: any): number {
  return num(deal?.contract_loan_amount)
}

// Is there a contracted position at all? Used to say on screen which figures are
// being shown, so nobody has to work out whether a number came from the BC or
// the contract.
export function onTheContract(deal: any): boolean {
  return contractPrice(deal) > 0 || contractLoan(deal) > 0
}
