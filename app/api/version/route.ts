import { NextResponse } from 'next/server'
import { BUILD } from '@/lib/new-version'

// WHICH VERSION IS LIVE RIGHT NOW.
//
// 6 Oct 2026. The page that asks carries the stamp it was built with; this
// answers with the stamp of whatever is deployed at this moment. A different
// answer means a newer version. See lib/new-version.ts.
//
// IT READS NOTHING AND WRITES NOTHING. No database, no session, no personal
// data - it is one word about the build, which is why it needs no sign-in and
// can leak nothing if a stranger calls it.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ build: BUILD }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
