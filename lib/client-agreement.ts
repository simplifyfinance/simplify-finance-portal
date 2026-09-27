// DID THE CLIENT TAKE THE RECOMMENDATION? ASKED IN ONE PLACE, ANSWERED IN ONE
// PLACE, AND NEVER GUESSED AT.
//
// Charles Mullins 2026, 25 Sep 2026. The lending options tab was changed from
// AMP to Bankwest. Every figure on the screen followed. One box did not: the
// compliance tab still read "Client chose a different lender: AMP", and the
// Best Interests wording in the pack still said "The clients did not proceed
// with the original recommendation and chose AMP."
//
// Fabio, about to send that pack to the compliance team: "why complianc eis not
// updating to Bank still says AMP".
//
// WHY IT SAID AMP. The answer is given on the lending options tab, in the box
// that opens when a deal is moved to compliance, and it is written to
// `lo_data`. The compliance tab holds a COPY of it for the pack to read - and
// that copy was taken with `prev.clientAgreedLender || loLive.clientAgreedLender`,
// which means "keep what I already have, and only look at the lending options
// tab if I have nothing". Once compliance had a value it never looked again.
// Not when the lender changed, not ever.
//
// So the compliance tab was showing an answer to a question that had been
// asked about a different lender.
//
// THE RULE HERE. `lo_data` is the answer. `compliance_data` holds a copy, and
// the copy is rebuilt from the answer every time - it is never a second opinion.
// Nothing in the compliance tab has ever been able to set these four fields;
// there is no box for it. So a compliance copy that disagrees with the lending
// options tab is always the older of the two, and is always the wrong one.
//
// A deal where the lending options tab holds nothing now reads as NOT CAPTURED,
// even if an old copy sits in compliance. That is the honest answer, the pack
// says so in capitals, and somebody goes and records it. A confident sentence
// naming the wrong lender on a regulated document is the worse outcome - see
// lib/notes-freshness.ts for the same argument about the prose.

const txt = (v: any) => String(v ?? '').trim()

export type Agreement = {
  // '' means nobody has answered it.
  agreed: '' | 'Yes' | 'No'
  // Only ever set when agreed === 'No'. '__other__' is already resolved to the
  // typed-in name, so nothing downstream has to know that code exists.
  chosen: string
  reason: string
}

// A lender picked from the list, or one typed in by hand. Everywhere that reads
// this used to repeat the `__other__` check, and the places that forgot it put
// the literal string "__other__" on screen.
export function chosenLenderName(src: any): string {
  return txt(src?.clientChosenLender) === '__other__'
    ? txt(src?.clientChosenLenderOther)
    : txt(src?.clientChosenLender)
}

// WHAT WAS ACTUALLY ANSWERED, read off the lending options tab and nowhere
// else. `cd` is accepted and ignored on purpose: every caller used to pass the
// compliance copy first, and this is the line that stops them.
export function clientAgreement(lo: any): Agreement {
  const agreed = txt(lo?.clientAgreedLender)
  if (agreed === 'Yes') return { agreed: 'Yes', chosen: '', reason: '' }
  if (agreed !== 'No') return { agreed: '', chosen: '', reason: '' }
  return { agreed: 'No', chosen: chosenLenderName(lo), reason: txt(lo?.clientChosenLenderReason) }
}

// The four fields as the compliance tab should be holding them right now.
//
// A 'Yes' clears the other three rather than leaving them be. Otherwise a deal
// that was once "No, they chose AMP" and is now "Yes" carries AMP along
// underneath, invisible until something reads it - which is exactly how the
// pack came to name a lender nobody had chosen.
export function agreementFields(lo: any): {
  clientAgreedLender: string
  clientChosenLender: string
  clientChosenLenderOther: string
  clientChosenLenderReason: string
} {
  const agreed = txt(lo?.clientAgreedLender)
  if (agreed !== 'No') {
    return {
      clientAgreedLender: agreed === 'Yes' ? 'Yes' : '',
      clientChosenLender: '', clientChosenLenderOther: '', clientChosenLenderReason: '',
    }
  }
  return {
    clientAgreedLender: 'No',
    clientChosenLender: txt(lo?.clientChosenLender),
    clientChosenLenderOther: txt(lo?.clientChosenLenderOther),
    clientChosenLenderReason: txt(lo?.clientChosenLenderReason),
  }
}

// THE LENDER THE NOTES ARE ABOUT, which is not always the one that was
// recommended.
//
// The second half of the same failure. The compliance notes are written by the
// model and stamped with what they were written from, so that changing the deal
// afterwards raises "written before the lender changed from X to Y" - see
// lib/notes-freshness.ts.
//
// The prose was built with the CLIENT'S lender ("Recommended lender: AMP") and
// stamped with the LENDING OPTIONS tab's ("Bankwest"). Two different lenders,
// one note. So the notes on Charles Mullins were written about AMP, stamped
// Bankwest, and reported as matching the deal - the warning could not have
// fired, because the stamp never knew what the prose said.
//
// One answer now, used to write the prose AND to stamp it.
export function lenderOnTheDeal(lo: any): string {
  const a = clientAgreement(lo)
  if (a.agreed === 'No' && a.chosen) return a.chosen
  return txt(lo?.recommendedLender)
}
