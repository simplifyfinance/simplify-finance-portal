// A NAME IS WRITTEN DOWN THE WAY IT IS SAID.
//
// 3 Nov 2026, found while reading a list of deals:
//
//   " Kathleen  Kathleen Stone"      first "Kathleen", last "Kathleen Stone"
//   " Matthew Clements"              a leading space
//   "Aaron ."                        a full stop where a surname should be
//   "Hameed  Abdul Jabbar"           two spaces
//
// Nothing here is a typo somebody made twice. They are what happens when a
// name is taken from one place and put in another without being looked at: a
// box filled in with a space in front, a book row whose "surname" is the whole
// name, an import that wrote a dot rather than leave a column empty.
//
// It matters because a client's name is not decoration. It goes on the deal
// card, into the email that greets them, onto the Fact Find PDF and into the
// lender's portal. "Dear Kathleen Kathleen" is the kind of mistake a client
// remembers.
//
// SO IT IS TIDIED WHERE IT IS WRITTEN, not where it is shown. Fixing it on the
// way out would leave the record wrong and every other screen - and every PDF
// built from it - still saying the wrong thing.
//
// NOTHING IS GUESSED. This only removes what is not a name: space that should
// not be there, a repeat of the first name at the front of the surname, and a
// surname that is a single piece of punctuation. A name it does not recognise
// is left exactly as typed, because a client called "de la Cruz" is not a
// mistake and a portal that corrects people is worse than one that does not.

const squash = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim()

/** Space tidied, and a surname that is only punctuation dropped. */
export function tidyName(v: any): string {
  const s = squash(v)
  // "Aaron ." - an import that would not leave a column empty. A name is never
  // one piece of punctuation, so there is nothing to lose here.
  if (/^[.,\-_/\\]+$/.test(s)) return ''
  return s
}

/**
 * THE FIRST NAME SAID TWICE.
 *
 * "Kathleen" + "Kathleen Stone" is one person whose full name was written into
 * the surname box. Only when the surname STARTS with the first name and has
 * more after it - "Stone" is kept, and a genuine "James James" is untouched
 * because there is nothing left over.
 */
export function unDoubled(first: any, last: any): { first: string; last: string } {
  const f = tidyName(first)
  const l = tidyName(last)
  if (!f || !l) return { first: f, last: l }
  const lead = f.toLowerCase() + ' '
  if (l.toLowerCase().startsWith(lead)) {
    const rest = l.slice(lead.length).trim()
    if (rest) return { first: f, last: rest }
  }
  return { first: f, last: l }
}

/** What a client row should hold, given what somebody typed or imported. */
export function clientName(first: any, last: any): { first_name: string; last_name: string } {
  const { first: f, last: l } = unDoubled(first, last)
  return { first_name: f, last_name: l }
}
