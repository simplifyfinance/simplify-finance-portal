// WHAT THE CLIENT SAID ABOUT THE LENDER, OFF THEIR OWN PAGE.
//
// Fabio, 18 Oct 2026: "It looks like though that the system is no longer asking
// the client to confirm if they are happy to proceed with the recommended
// lender." It never did. `git log -S clientAgreedLender -- lib/proceed-flow.ts
// app/proceed` comes back empty: the client's page has never named a lender and
// has never recorded one. The only place a lender agreement has ever lived is
// the box a broker fills in on the Lending Options tab, and that is the office
// recording it, not the client.
//
// So the Lending Options email now carries two buttons - go ahead with the
// recommended lender, or ask to talk it through first - and each lands on its
// own page. This file turns the link into one of those two answers, and works
// out what may honestly be printed in front of the client when they get there.
//
// IT DECIDES NOTHING ELSE. It writes nothing, it reads no database, and it
// never picks a lender. Where the recommendation is ambiguous - two options
// from the same bank and nothing recording which - it says so by returning
// null, and the caller falls back to the wording that names no lender. A guess
// here would put a real rate against the wrong product on the one page a client
// agrees to a loan on.

import { recommendedOption, type LoLike } from './recommended-option'

const txt = (v: any) => String(v ?? '').trim()

// WHICH BUTTON THEY PRESSED, OFF A URL ANYBODY CAN EDIT.
//
// Same shape as optionFromLink in lib/bc-scenarios.ts, and for the same reason:
// the value arrives in a query string, so it is checked into one of two words
// we chose before it is used for anything. It is never printed as text.
export type ClientChoice = 'proceed' | 'talk'

export function choiceFromLink(raw: any): ClientChoice | null {
  const v = txt(raw).toLowerCase()
  return v === 'proceed' ? 'proceed' : v === 'talk' ? 'talk' : null
}

// WHAT THE CLIENT IS LOOKING AT WHEN THEY AGREE.
//
// The bank, the product and the loan amount. Every field is optional except the
// name, because a field that is not recorded is left out rather than filled in.
//
// AND NOT THE RATE, THOUGH FABIO APPROVED ONE IN THE MOCK ON 19 OCT 2026.
//
// lib/rate-notice-everywhere.test.ts is the list of every surface that quotes a
// rate to a client, and each one carries the RBA notice - the warning that the
// bank quoting them has not passed the last move on yet. The whole mechanism is
// per-bank effective dates, so a page that NAMES a bank and prints its rate is
// squarely the case it was written for. Printing 6.09% here with no notice,
// when the email the client pressed to get here carries one, is the exact
// inconsistency Fabio asked to end on 30 Sep 2026: "I want to put a disclaimer
// in ALL temppaltes that go out".
//
// The rate is in that email, a scroll away, with its notice attached. This box
// confirms WHICH BANK, which is the thing no record held until today. Wiring
// the notice onto this page is a few lines if he wants the figure back.
export type LenderOnOffer = {
  name: string
  product: string
  amount: string
}

export function lenderOnOffer(lo: LoLike | null | undefined): LenderOnOffer | null {
  if (!lo) return null
  // Null where two options share a bank and nothing recorded which - see
  // recommendedOption. Not a guess, and not the first match.
  const rec = recommendedOption(lo)
  const name = txt(rec?.lenderName)
  if (!name) return null

  return {
    name,
    product: txt((rec as any)?.productName),
    amount: txt((lo as any)?.loanAmount),
  }
}

// WHAT THE DEAL RECORDS WHEN THE CLIENT CONFIRMS.
//
// The name only, and only when it is unambiguous. An ambiguous recommendation
// records nothing rather than a bank with two products behind it - the page
// still moves the deal on, because the client has agreed to proceed, but the
// compliance record will say the lender was not captured instead of naming one
// nobody chose.
export function lenderToRecord(lo: LoLike | null | undefined): string | null {
  return lenderOnOffer(lo)?.name || null
}
