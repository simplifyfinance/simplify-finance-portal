import { phaseOf } from './deal-phase'

// THE ONE BUTTON IN THE DEAL'S HEAD, AND WHAT IT SAYS TODAY.
//
// docs/approved-looks/deal-page-stages.html draws the same blue outlined
// button on every stage, and it changes its name: Open BC while the borrowing
// capacity is the work, Open compliance once it is, Open settlement after
// that. Fabio, 16 Nov 2026, with the mock beside the real page: "every icon,
// every colour, every line - COPY IT."
//
// It is a SHORTCUT, not a rule about what anybody may open. Every one of the
// six tabs is one click away underneath it, on the tab cards, exactly as it
// always was. This only decides which one the button offers.
//
// It reads the phase the board already works the deal out from - see
// lib/deal-phase.ts - so the button and the board can never disagree about
// where a deal is.

export type TheWork = { tab: string; label: string }

export function whereTheWorkIs(deal: any): TheWork {
  const phase = phaseOf(deal)

  // Settled, booked, contracts, formal, offer, preapproved, lodged: the file
  // is with the bank or on its way to settling, and the settlement panel is
  // the screen anybody opening this deal actually wants.
  if (['settled', 'settlement_booked', 'contracts_returned', 'formal',
       'offer_accepted', 'preapproved', 'lodged', 'outstanding'].includes(String(phase))) {
    return { tab: 'Compliance', label: 'Open compliance' }
  }

  if (['compliance', 'compliance_sent'].includes(String(phase))) {
    return { tab: 'Compliance', label: 'Open compliance' }
  }

  if (['lo', 'lo_sent'].includes(String(phase))) {
    return { tab: 'LO', label: 'Open lending options' }
  }

  // Everything earlier - a lead, a fact find, a borrowing capacity being
  // written or sitting with the client. The BC is the work.
  return { tab: 'BC', label: 'Open BC' }
}

// IS THE BANK DECIDED YET?
//
// Fabio, 16 Nov 2026: "that line only shows after we move to compliance, so we
// know which lender the customer is going with. Obvious. And before compliance
// it never shows."
//
// He is right and it is the whole reason the row exists. Up to and including
// the lending options, a bank on the deal is a SHORTLIST - the client has not
// picked one, and printing one at the top of the page as though they had is
// worse than printing nothing. Compliance is the first stage that exists
// because a client said yes to a particular bank.
//
// 'lost' is not on the list: a dead deal's bank is not a fact anybody acts on.
const BANK_IS_DECIDED = new Set([
  'compliance', 'compliance_sent',
  'lodged', 'outstanding', 'preapproved', 'offer_accepted', 'formal',
  'contracts_returned', 'settlement_booked', 'settled',
])

export function theBankIsDecided(deal: any): boolean {
  return BANK_IS_DECIDED.has(String(phaseOf(deal)))
}

// AND WHEN THE BANK'S OWN REFERENCE CAN BE TYPED IN.
//
// Fabio, 16 Nov 2026: "after lodged we can add a ref number, remember we need
// space for that."
//
// Not before. A reference is the number the BANK gives an application, and
// there is no application until it is lodged. A box to type one into before
// that is a box somebody fills with a guess.
const REF_CAN_BE_TYPED = new Set([
  'lodged', 'outstanding', 'preapproved', 'offer_accepted', 'formal',
  'contracts_returned', 'settlement_booked', 'settled',
])

export function theRefCanBeTyped(deal: any): boolean {
  return REF_CAN_BE_TYPED.has(String(phaseOf(deal)))
}
