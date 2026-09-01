// One way to ask "did that write actually happen?".
//
// Postgres returns zero rows and NO error when a row level security policy
// blocks a write. So an update that is awaited and whose result is thrown away
// cannot tell success from total failure - the screen says it worked and
// nothing was saved. CLAUDE.md calls this the single most repeated failure in
// this codebase, and scripts/check-writes.sh only ever caught the version
// written as `.then(() => {})`. A bare `await supabase.from(x).update(y)` slid
// straight past it, twenty five times.
//
// Usage:
//   const problem = await checkedWrite(
//     supabase.from('deals').update({ deal_name: n }).eq('id', id), 'The deal name')
//   if (problem) { setMsg(problem); return }
//
// .select() with no arguments is deliberate: it returns the affected rows
// whatever the table's primary key is called, and it works for deletes too.

export async function checkedWrite(query: any, what: string): Promise<string | null> {
  const { data, error } = await query.select()
  if (error) return `${what} was not saved - ${error.message}`
  if (!data || data.length === 0) {
    return `${what} was not saved - the database refused the change. Nothing has been recorded.`
  }
  return null
}

// The same, for a write that is allowed to match nothing. Deleting a link that
// was already gone is not a failure; being refused permission still is.
export async function checkedWriteAllowingNone(query: any, what: string): Promise<string | null> {
  const { error } = await query.select()
  return error ? `${what} was not saved - ${error.message}` : null
}
