// WHAT SOMEBODY TYPES INTO "ANYTHING ELSE", AS SEPARATE ITEMS.
//
// 22 Oct 2026, Kylie, on a pre-approval letter for a construction deal. She
// typed three requirements into the box, separated by blank lines, exactly as
// anybody would:
//
//   Fixed Price Build Contract - to include building plans and specifications
//   (signed and dated). This is so that a full 'as if complete valuation' can
//   be ordered
//
//   The valuation will need to support the rental that we have estimated for
//   Moore Creek
//
//   Friendly reminder that any contribution ... before Orde will draw down the
//   construction loan
//
// The email put all three behind ONE tick, with the blank lines gone - so
// "ordered" ran into "The valuation" and "Moore Creek" ran into "Friendly
// reminder". Three things a client has to act on, printed as one sentence they
// cannot. Fabio: "every we add anything else make a tick box item on email to
// be in line wiht other docs required".
//
// WHY A BLANK LINE AND NOT EVERY LINE BREAK. A requirement runs over two lines
// all the time - the first one above is three. Splitting on every newline would
// have cut that into pieces and made it worse than it already was. A blank line
// is what a person types when they mean "and another thing", and it is the same
// rule the BC and the LO have always used for their own notes.

/**
 * One item per paragraph. Blank between them, never a single line break.
 *
 * A leading dash or bullet is taken off: somebody typing their own bullets into
 * a list that is already ticked would get a tick and a dash on the same line.
 */
export function anythingElseItems(raw: any): string[] {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    // Inside one item a line break is just how it was typed, so it becomes a
    // space rather than a second item.
    .map(part => part.split('\n').map(l => l.trim()).filter(Boolean).join(' '))
    .map(line => line.replace(/^[-*•·]+\s*/, '').trim())
    .filter(Boolean)
}
