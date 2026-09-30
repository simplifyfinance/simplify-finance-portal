// WHICH STATE THE DUTY WAS WORKED OUT IN.
//
// 30 Sep 2026, Fabio, on an equity-release-plus-purchase email: "refinance and
// purchase template the State is not coming accross?"
//
// It was not, and there were two reasons, both in components the client never
// sees.
//
// ONE: THE BOX WAS LABELLED WRONG. The New purchase block on the
// investment_equity template had a field labelled "State" that wrote into
// newPurchaseSuburb - the SUBURB. So somebody typing NSW into a box marked
// State filled the suburb with "NSW", and the broker notes and the pre-approval
// security address have been saying the property is in the suburb of NSW ever
// since. Nothing complained, because a suburb is free text and free text takes
// whatever it is given.
//
// TWO: THERE WAS NOWHERE TO PUT THE REAL ANSWER. dutyState - the field every
// stamp duty label in this codebase reads - is hidden on refinance_equity,
// refinance_only and investment_equity. So on exactly the templates that have a
// purchase with duty on it, the state could not be recorded at all.
//
// THE READ-TIME REPAIR. Fixing the form fixes deals from today. It does not fix
// the ones already written, and reaching into the database to move values
// between fields on live deals is not something to do on a hunch. So this reads
// the answer where it is: the real field first, and failing that the suburb
// field IF what is in it is one of the eight state codes and nothing else.
//
// That last condition is what keeps it honest. "Cronulla" stays a suburb. "NSW"
// in a suburb field was never a suburb, whatever the form said at the time.

const txt = (v: any) => String(v ?? '').trim()

export const STATE_CODES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const

export function isStateCode(v: any): boolean {
  return (STATE_CODES as readonly string[]).includes(txt(v).toUpperCase())
}

// THE ONE ANSWER. Everything that prints a duty figure, decides whether an
// original mortgage document is needed, or names where a property is must ask
// this rather than reading bc.dutyState itself - see lib/one-duty-state.test.ts,
// which fails the build if a new reader goes round it.
export function dutyStateOf(bc: any): string {
  const real = txt(bc?.dutyState)
  if (real) return real.toUpperCase()
  // The mislabelled box. Only when what it holds is unmistakably a state.
  const stray = txt(bc?.newPurchaseSuburb)
  return isStateCode(stray) ? stray.toUpperCase() : ''
}

export function dutyLabel(bc: any): string {
  const st = dutyStateOf(bc)
  return st ? `Stamp duty (${st})` : 'Stamp duty'
}

// AND THE OTHER HALF OF THE SAME MISTAKE. A suburb field holding "NSW" is not a
// suburb, so nothing prints it as one - the broker notes stop saying a property
// is in the suburb of NSW, and a pre-approval security address stops reading
// "TBA - NSW".
export function purchaseSuburbOf(bc: any): string {
  const s = txt(bc?.newPurchaseSuburb)
  return isStateCode(s) ? '' : s
}
