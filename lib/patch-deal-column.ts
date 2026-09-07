// CHANGING ONE THING INSIDE A COLUMN THAT HOLDS EVERYTHING.
//
// The four deal tabs each own a whole jsonb column. Other bits of the portal
// need to change ONE field inside one of those columns - the Deal structure
// block ticks pre-approval, sets a security address, records a cashback - and
// the only way to do that in Postgres is to write the whole column back.
//
// Which means the record you build the new version from matters enormously. The
// obvious thing is to use the copy the page was rendered with, and every place
// that has done so has eventually lost somebody's work:
//
//   type the compliance notes on the Compliance tab      saved
//   switch tab, tick something in Deal structure          writes the copy of
//                                                         compliance_data the
//                                                         page was BORN with
//   the notes are gone                                    no error, nothing on
//                                                         screen
//
// So: read what the database holds right now, apply the change to THAT, write it
// back, and check the write landed. `apply` is a function rather than a value on
// purpose - a caller handed the old record cannot help but build from it.
//
// NOT A GUARANTEE. There is a gap of milliseconds between the read and the
// write. See lib/save-conflict.ts; the real fix for the whole class is a version
// column on the row, and it is not built yet. This turns a certainty into a
// rarity, which is worth having today.

export type PatchResult = { next: any; problem: string | null }

export async function patchDealColumn(
  supabase: any,
  dealId: string,
  column: string,
  apply: (current: any) => any,
  // What to build from if the record cannot be read. Never nothing: refusing a
  // tick because the network hiccuped is worse than the problem being solved,
  // and this is the behaviour every one of these call sites had before.
  fallback: any,
): Promise<PatchResult> {
  const { data, error: readError } = await supabase
    .from('deals').select(column).eq('id', dealId).single()

  const current = (!readError && data?.[column]) ? data[column] : fallback
  const next = apply(current ?? {})

  const { data: rows, error } = await supabase
    .from('deals').update({ [column]: next }).eq('id', dealId).select('id')

  if (error) return { next, problem: `That change was not saved - ${error.message}` }
  // A write refused by row level security returns zero rows and NO error.
  if (!rows || rows.length === 0) {
    return { next, problem: 'That change was not saved - the database refused it. Nothing has been recorded.' }
  }
  return { next, problem: null }
}
