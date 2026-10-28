// WHAT A LOAN IS FOR.
//
// 28 Oct 2026. Nader Gharsa's file: an investment property with two Pepper
// loans against it, and both printed "Owner occupied" on the sheet that went to
// the compliance team. Nobody chose that - every loan was born carrying it, the
// fact find had no box to change it with, and the documents printed it as an
// answer.
//
// THE FIRST FIX WAS TO ASK THE PROPERTY. A loan secured against an investment
// property is an investment loan, and the property's use is an answer somebody
// actually gave. That got every deal already in the book printing correctly.
//
// THIS IS THE SECOND HALF. Fabio's credit team: "unable to select between
// INV/OO for each loan which would be ideal." Two loans on one property can
// genuinely be for different things, and until today there was no way to say
// so. Fabio, 28 Oct 2026: "each loan should have a selection of the purpose of
// the loan then. So then it's on my credit team to make sure they're selecting
// the right box."
//
// SO THE LOAN'S OWN ANSWER WINS, AND BLANK IS NOT AN ANSWER. An empty box means
// "nobody has been asked", which is true of every loan recorded before today
// and of every new one until somebody picks. Those follow the property, exactly
// as they did this morning. Nothing changes on any existing deal.
//
// Anywhere this is printed, it is printed through here - the fact find sheet,
// the handover, the copy page and the broker notes - so four documents cannot
// give four answers about the same loan.

// THE CHOICE IS KEPT IN A NEW BOX, AND THIS IS THE WHOLE REASON WHY.
//
// Every loan recorded before today carries mortgageType: 'Owner occupied'. Not
// because anybody chose it - because that was the value every loan was born
// with, and there was no box to change it with. There is no way to tell one of
// those apart from a deliberate answer, because they are the same string.
//
// So a deliberate answer goes somewhere the old default could never reach:
// `purpose`. Empty on every loan in the book, and empty on a new one until
// somebody picks. mortgageType is never read again by anything - it is not
// evidence of anything and it never was.
//
// Caught by lib/a-default-is-not-an-answer.test.ts the moment this file read
// mortgageType, which is exactly what that test is for.
const txt = (v: any) => String(v ?? '').trim()

export const LOAN_PURPOSES = ['Owner occupied', 'Investment'] as const

/** What the dropdown calls "no answer yet". */
export const SAME_AS_PROPERTY = ''

/**
 * The purpose to print for this loan. '' only when the property has no use
 * recorded either, in which case nobody anywhere has said what this is and the
 * document leaves it blank rather than inventing it.
 */
export function loanPurpose(property: any, loan: any): string {
  return txt(loan?.purpose) || txt(property?.ownershipType)
}

/**
 * True where the loan carries its own answer rather than following its
 * property. The screen uses it to show which loans a person has actually been
 * through.
 */
export function purposeWasChosen(loan: any): boolean {
  return txt(loan?.purpose) !== ''
}

/** What the dropdown's blank option should read as, given the property. */
export function sameAsPropertyLabel(property: any): string {
  const use = txt(property?.ownershipType)
  return use ? `Same as the property (${use})` : 'Same as the property'
}
