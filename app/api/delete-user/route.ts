import { NextResponse } from 'next/server'

// THIS ROUTE IS CLOSED. A LEAVER IS ARCHIVED, NEVER DELETED.
//
// 23 Nov 2026. The audit found a login that still worked for somebody who had
// left the business weeks earlier. Her staff record was gone from every screen,
// so she looked handled. The login was untouched, and no portal rule applied to
// her because she was not coming through the portal.
//
// THIS ROUTE IS HOW. It did two things in order:
//
//     1. delete the row from user_profiles
//     2. delete the login from auth
//
// If the second one failed - a network blip, a timeout, a permission - the
// first had already happened. The result is a login with no staff record
// behind it, which is invisible on the team screen and perfectly able to sign
// in. There was no check between the two steps and no way to notice.
//
// lib/nobody-is-deleted.test.ts had already taken the button off the team
// screen on 18 Nov. It did not take the route away, so the route still
// answered anybody who called it.
//
// ARCHIVING IS THE ONLY WAY OUT NOW, and it closes the login as its second
// step - see app/api/archive-user/route.ts. The database refuses a delete
// outright as well, through the nobody_is_deleted trigger on user_profiles, so
// this cannot come back through a different door.
//
// Fabio, 23 Nov 2026: "add a rule that it blocks and move on... just dont want
// to happen again so when we archive someone they can never log in."

const WHY =
  'Staff are archived, never deleted. Archiving marks them past AND closes their '
  + 'login; deleting left the login open. Use Settings then Team then Archive.'

export async function POST() {
  return NextResponse.json({ ok: false, error: WHY }, { status: 410 })
}

export async function DELETE() {
  return NextResponse.json({ ok: false, error: WHY }, { status: 410 })
}
