import { NextResponse } from 'next/server'
import { createSupabaseServer } from './supabase-server'

// ONE QUESTION, ASKED THE RIGHT WAY ROUND.
//
// 23 Nov 2026. The audit found fourteen routes that asked nothing at all and
// four that asked "are you signed in?" - which is not the same question as "are
// you staff", and the difference is the whole fault found that morning:
//
//   A former staff member's record was deleted rather than archived. Deleting
//   the record takes somebody off the team screen and leaves the login working.
//   So a login existed with no staff record behind it, and every check in this
//   portal that asked only "signed in?" would have said yes to it.
//
// So there is one check and everything uses it. It asks for the staff record,
// not the login, and it refuses a record marked past.
//
// WHY THE REFUSAL IS A WHOLE RESPONSE. A check that returns true or false gets
// used as `if (!ok) return something` and the something drifts - one route says
// 401, the next says 403, a third says nothing and carries on. Handing back the
// finished answer means every route refuses in the same words.
//
// Fabio, 23 Nov 2026: "Security is the number one priority of this portal. I
// need you to understand the seriousness of that because I have financial
// information in here."
//
// See docs/the-security-audit.md.

export type Staff = { id: string; role: string | null; active: boolean }

/**
 * THE CALLER, IF THEY ARE AN ACTIVE STAFF MEMBER.
 *
 * Use it as the first two lines of a route:
 *
 *     const { refusal } = await onlyStaff()
 *     if (refusal) return refusal
 *
 * `me` carries the staff record for a route that needs the role as well.
 */
export async function onlyStaff(): Promise<
  { refusal: NextResponse; me: null } | { refusal: null; me: Staff }
> {
  const no = (error: string, status: number) =>
    ({ refusal: NextResponse.json({ error }, { status }), me: null as null })

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return no('Sign in first.', 401)

  // READ, THEN CHECK. A refused read returns no rows and no error, so "no row"
  // and "not allowed" arrive looking identical - which is the single most
  // repeated fault in this codebase. Both are refusals here, so either way
  // nobody gets through.
  const { data: me, error } = await supabase
    .from('user_profiles').select('id, role, active').eq('id', user.id).maybeSingle()

  if (error) return no('Your access could not be checked. Nothing has been recorded.', 500)
  if (!me) return no('This login is not on the team.', 403)
  if (!(me as any).active) return no('This login is no longer active.', 403)

  return { refusal: null, me: me as Staff }
}
