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
// AND THE DATABASE HAS THE LAST WORD. The write carries "only if the record is
// still on the version I read", so if somebody saves in the gap between the read
// and the write, Postgres refuses it and the whole thing is done again against
// what the record now holds. Nothing is lost and nobody is told anything - the
// tick simply takes a few more milliseconds. See docs/deal-row-version.sql.
//
// If that column has not been added yet the write goes ahead unpinned, which is
// how this behaved before it existed.

export type PatchResult = { next: any; problem: string | null }

// Each go round is a fresh read and a fresh apply. Using all four up needs
// somebody saving the same record continuously in a fraction of a second.
const RETRIES = 4

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
  let next: any = fallback

  for (let go = 0; go < RETRIES; go++) {
    const { data, error: readError } = await supabase
      .from('deals').select(`${column},row_version`).eq('id', dealId).single()

    const current = (!readError && data?.[column]) ? data[column] : fallback
    const seenVersion: number | undefined =
      typeof data?.row_version === 'number' ? data.row_version : undefined
    next = apply(current ?? {})

    const fields: any = { [column]: next }
    if (seenVersion !== undefined) fields.row_version = seenVersion + 1

    let write = supabase.from('deals').update(fields).eq('id', dealId)
    if (seenVersion !== undefined) write = write.eq('row_version', seenVersion)

    const { data: rows, error } = await write.select('id')

    if (error) return { next, problem: `That change was not saved - ${error.message}` }
    if (rows && rows.length > 0) return { next, problem: null }

    // Zero rows: either somebody saved in the gap, or row level security refused
    // us. Those need completely different answers, so ask which it was.
    if (seenVersion !== undefined) {
      const { data: now } = await supabase.from('deals').select('row_version').eq('id', dealId).single()
      if (typeof now?.row_version === 'number' && now.row_version !== seenVersion) continue
    }
    return { next, problem: 'That change was not saved - the database refused it. Nothing has been recorded.' }
  }

  return { next, problem: 'That change was not saved - somebody else is saving this deal. Try again in a moment.' }
}
