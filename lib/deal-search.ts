// FINDING A DEAL BY TYPING PART OF ITS NAME.
//
// Searching "Alexis" found three deals. Searching "Janes" found none, on deals
// literally called Alexis_Janes_Refinance_2026. Fabio, 7 Sep 2026: "What the
// fuck is going on?"
//
// The old test was one plain `includes` against three fields. That fails for
// more reasons than it looks:
//
//   * an underscore is not a space, so "Alexis Janes" never matched
//     "Alexis_Janes_..." even though they read the same
//   * two words only matched if they appeared in that order with exactly that
//     punctuation between them
//   * a name carrying a stray accent, a non breaking space or a look alike
//     character - the kind that arrives with copy and paste - matched nothing at
//     all, while a different part of the same name matched fine
//
// So both sides are flattened first: accents removed, every run of anything that
// is not a letter or a digit turned into a single space. Then every word typed
// has to appear somewhere. "janes" finds it. So does "janes refinance", and
// "refinance janes", and "alexis janes".

const flatten = (v: any): string =>
  String(v ?? '')
    .normalize('NFKD')                 // é becomes e + accent
    .replace(/[̀-ͯ]/g, '')   // and the accent goes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')       // underscores, dots, dashes, odd spaces
    .trim()

export function searchWords(term: string): string[] {
  return flatten(term).split(' ').filter(Boolean)
}

// Everything about a deal worth typing into a search box.
export function dealHaystack(deal: any): string {
  return flatten([
    deal?.deal_name,
    deal?.clients?.first_name,
    deal?.clients?.last_name,
    deal?.deal_type,
    deal?.assigned_broker,
  ].filter(Boolean).join(' '))
}

export function dealMatches(deal: any, term: string): boolean {
  const words = searchWords(term)
  if (words.length === 0) return true
  const hay = dealHaystack(deal)
  // Every word, anywhere. Not in order, and not necessarily adjacent - people
  // type the two things they remember, not the name as filed.
  return words.every(w => hay.includes(w))
}
