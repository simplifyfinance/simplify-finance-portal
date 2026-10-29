const txt = (v: unknown) => String(v ?? '').trim()

// "IMPORTANT THINGS TO NOTE" ON A DEAL WITH TWO SCENARIOS.
//
// 29 Oct 2026. Fabio: "each template has its own pre determined items, can we
// merge both together in html email when this is being generated - otherwise
// the important things to note only shows based on where we are sitting in the
// template. THIS IS ONLY WHEN MULTIPLE SCENARIOS ARE BEING DONE."
//
// The list is pre-filled per template, and rightly so: a Buy / sell warns that
// the sale price is an estimate and that there may be capital gains tax to
// find, and an Equity release + purchase says none of that. Each scenario keeps
// its own.
//
// THE EMAIL IS WHERE THEY COME TOGETHER, because the client is being shown both
// options in one email and the caveats on either one apply to the option they
// pick. Printing only the live scenario's list means which tab the broker
// happened to be sitting on decided which warnings the client received.
//
// FIRST SCENARIO'S ORDER IS KEPT, and the second one adds only what is not
// already there - the shared lines ("this is your estimated borrowing capacity
// as of today") are on every template and would otherwise print twice.

/**
 * One scenario's note lines, from either shape it is held in.
 *
 * The live scenario arrives from the form as `additionalNotes`, already split
 * into lines. A parked one is a whole bc_data and holds the raw `templateNotes`
 * box, one note per line.
 */
export function notesOf(bc: any): string[] {
  const ready = bc?.additionalNotes
  if (Array.isArray(ready)) return ready.map(txt).filter(Boolean)
  return txt(bc?.templateNotes).split('\n').map(txt).filter(Boolean)
}

/** Both scenarios' lists, in order, with nothing said twice. */
export function mergedNotes(primary: any, second: any): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const line of [...notesOf(primary), ...notesOf(second)]) {
    const key = line.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
  }
  return out
}
