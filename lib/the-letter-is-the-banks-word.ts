// WHAT TO DO WHEN THE LETTER AND THE DEAL DISAGREE.
//
// Belle, 14 Nov 2026: "Handover and broker notes: to be updated once loan hits
// formal as we will always base our checking with rates, amounts here — and
// mostly I've noticed that these details are often incorrect."
//
// The letter is the bank's own word, so when the two disagree the deal is
// almost always the one that is wrong. The portal still does not change it.
//
// WHY NOT, WHEN IT COULD. The figures recorded at formal approval are what the
// loan contracts, the signed pack and everything else is then measured against.
// Writing a PDF's numbers into that, automatically, with nobody's name on it,
// would mean the next three weeks of checks are measured against something no
// person ever agreed to - and the first anybody would know is a contract check
// that passes when it should not.
//
// The portal already has a door for this. Marking the deal formally approved
// writes the snapshot from the deal, and the write is an upsert on
// (deal_id, stage), so doing it again overwrites the row rather than making a
// second one. Fix the deal, mark it formally approved again, and every later
// check is measured against the right figures.
const txt = (v: any) => String(v ?? '').trim()

export const REFRESH_AT_FORMAL =
  'The letter is the bank’s own word. Where it is right, correct the deal and mark it formally '
  + 'approved again — that rewrites the figures every later check is measured against. '
  + 'Nothing here changes the deal on its own.'

/** "The letter is from ING and the deal records Bankwest." */
export function lenderLine(said: any, recorded: any): string {
  const a = txt(said)
  const b = txt(recorded)
  if (!a || !b) return ''
  return `The letter is from ${a} and the deal records ${b}. `
    + 'That is a different lender, not a different figure, so check this is the right letter for this deal.'
}
