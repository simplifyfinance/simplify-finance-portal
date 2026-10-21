import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  openPass, sealPass, sessionVerdict, isRealVisit, shouldPush, enforcedFor,
  hashSecret, readPolicy, SESSION_COOKIE, DEVICE_COOKIE,
} from '@/lib/two-factor'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes - no auth needed.
  // /reset-password must be public: the Supabase reset link carries an auth
  // token in the URL that the page itself exchanges for a session client-side.
  // If this route required auth, the redirect to /login would happen first,
  // discarding the token before it's ever processed.
  // /ready is the client landing page for template emails. It must be public:
  // a past client has no login, and without this they are redirected to the
  // portal sign-in screen instead of seeing their next steps.
  if (pathname.startsWith('/proceed') || pathname.startsWith('/ready') || pathname.startsWith('/opportunity') || pathname.startsWith('/login') || pathname.startsWith('/reset-password')) {
    return supabaseResponse
  }

  // All other routes require auth
  if (!user) {
    // A ROUTE UNDER /api WITH NO SESSION IS LEFT ALONE. The client-facing
    // pages - proceed, ready, opportunity - call their own routes with nobody
    // signed in, and those routes check for themselves what they will do. A
    // redirect to /login here would hand a client a sign-in screen in place of
    // a confirmation.
    if (pathname.startsWith('/api')) return supabaseResponse
    const url = request.nextUrl.clone()
    const originalPath = url.pathname + url.search
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', originalPath)
    return NextResponse.redirect(url)
  }

  // =========================================================================
  // THE SECOND FACTOR, AND THE CLOCKS
  // =========================================================================
  //
  // 21 Oct 2026. Fabio: "we need to lock in the system... I don't want to be
  // in a position, which I had multiple times, that I leave the portal open
  // and it stays open overnight."
  //
  // THREE THINGS HAVE TO BE TRUE BEFORE ANY OF THIS RUNS AT ALL.
  //
  //   1. A signing secret is set. Without it nothing can be signed and the
  //      honest thing is to behave exactly as yesterday rather than to invent
  //      a lock with no key.
  //   2. This person's address is in TWO_FACTOR_EMAILS. Empty means nobody.
  //   3. They are signed in, which is already true by the time we are here.
  //
  // THAT LIST IS THE WAY OUT. Emptying TWO_FACTOR_EMAILS in Vercel puts the
  // whole business back to yesterday within a minute, with no deploy. It is
  // the reason this can ship the night before people need to work.
  const secret = process.env.AUTH_COOKIE_SECRET || ''
  const mustVerify = !!secret && enforcedFor(user.email, process.env.TWO_FACTOR_EMAILS)
  // The three numbers live in Vercel. readPolicy puts a floor and a ceiling on
  // each, so a typo cannot set idle to zero and sign the whole business out on
  // every click. Read here rather than inside the block below, because the
  // cookie helper at the bottom of this function needs it too.
  const policy = readPolicy(process.env as any)

  if (mustVerify && !pathname.startsWith('/verify') && !pathname.startsWith('/api/2fa')) {
    const now = new Date()
    const pass = await openPass(request.cookies.get(SESSION_COOKIE)?.value, secret)
    const verdict = sessionVerdict(pass, user.id, now, policy)

    // THE OVERNIGHT CASE, AND IT ENDS THE SESSION RATHER THAN PARKING IT.
    // Sending somebody to the code screen would leave them signed in behind
    // it; a laptop on a train has to be signed OUT, so the Supabase cookies go
    // with it and the next person needs the password.
    if (verdict === 'idle' || verdict === 'spent') {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Signed out.' }, { status: 401 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('out', verdict)
      // The sign-in screen cannot read a Vercel setting, so it is handed the
      // number rather than left to hard code one that would start lying the
      // first time this changes.
      url.searchParams.set('n', String(
        verdict === 'idle' ? policy.idleMinutes : policy.absoluteHours))
      const bye = NextResponse.redirect(url)
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-') || c.name === SESSION_COOKIE) bye.cookies.delete(c.name)
      }
      return bye
    }

    if (verdict !== 'ok') {
      // NO PASS YET. A browser this person has used in the last thirty days
      // carries a trust token, which skips the CODE - never the password, and
      // never the clocks above, which start again from here.
      // Zero trust days means a code every time, so the cookie is not even
      // looked at.
      const trusted = policy.trustDays > 0 && await trustedBrowser(request, user.id)
      if (!trusted) {
        if (pathname.startsWith('/api')) {
          return NextResponse.json({ error: 'Finish signing in.' }, { status: 401 })
        }
        const url = request.nextUrl.clone()
        const back = url.pathname + url.search
        url.pathname = '/verify'
        url.search = ''
        if (back && back !== '/') url.searchParams.set('next', back)
        return NextResponse.redirect(url)
      }
      supabaseResponse.cookies.set(SESSION_COOKIE,
        await sealPass({ u: user.id, v: now.getTime(), s: now.getTime() }, secret),
        passCookie())
      return supabaseResponse
    }

    // STILL HERE, AND THE CLOCK ONLY MOVES FOR A PERSON. A page somebody
    // navigated to counts. The autosave and the presence ping do not, or a
    // laptop left open would keep itself alive until morning and this whole
    // feature would do nothing. See isRealVisit in lib/two-factor.ts, and
    // app/api/2fa/touch for the beacon a real keystroke sends.
    if (pass && isRealVisit(request.headers) && shouldPush(pass, now)) {
      supabaseResponse.cookies.set(SESSION_COOKIE,
        await sealPass({ u: user.id, v: pass.v, s: now.getTime() }, secret),
        passCookie())
    }
  }

  return supabaseResponse

  function passCookie() {
    return {
      httpOnly: true as const,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: policy.absoluteHours * 3600,
    }
  }

  // IS THIS BROWSER ONE WE HAVE SEEN. The cookie carries a row id and a secret;
  // the row holds only a hash of that secret, so a copy of the table is not a
  // trusted browser. Read with the anon key would be refused by row level
  // security, so this asks the database through the service role - the same key
  // the routes use, which never reaches a browser.
  async function trustedBrowser(req: NextRequest, userId: string): Promise<boolean> {
    const raw = req.cookies.get(DEVICE_COOKIE)?.value || ''
    const dot = raw.indexOf('.')
    if (dot <= 0) return false
    const id = raw.slice(0, dot), token = raw.slice(dot + 1)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key || !token) return false
    try {
      const got = await fetch(
        `${url}/rest/v1/trusted_devices?id=eq.${encodeURIComponent(id)}`
        + `&user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null`
        + `&select=id,token_hash,salt,expires_at`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' })
      if (!got.ok) return false
      const rows = await got.json()
      const row = Array.isArray(rows) ? rows[0] : null
      if (!row) return false
      if (new Date(String(row.expires_at)).getTime() <= Date.now()) return false
      return (await hashSecret(token, String(row.salt || ''))) === String(row.token_hash || '')
    } catch {
      // A DATABASE THAT CANNOT BE REACHED IS NOT A TRUSTED BROWSER. It means a
      // code, which is an inconvenience. The other way round is a door that
      // opens whenever the network is poor.
      return false
    }
  }
}

export const config = {
  // /api IS IN THE LIST NOW. 21 Oct 2026 - it was excluded, so a password
  // thief who never loaded a page could have called the routes directly and
  // never met the code screen. A route reached with no session at all is still
  // waved through untouched above, which is how the client-facing pages keep
  // working.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
}
