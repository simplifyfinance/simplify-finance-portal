'use client'
import { useState, useEffect, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { safeNextPath } from '@/lib/safe-next-path'
import { siteUrl } from '@/lib/site-url'
import OneMark, { MARK_WIDTH } from '@/components/OneMark'
import ThemeSwitch from '@/components/ThemeSwitch'

// STUCK ON "SIGNING IN...".
//
// Fabio and Kylie, 7 Sep 2026: the button sat there and the only way into the
// portal was to reload the address bar by hand.
//
// The sign-in itself always worked. What did not was getting off this page. It
// used router.push(), which asks Next to fetch the next page in the background
// while this one stays on screen. Every one of those requests goes through the
// middleware, which asks Supabase who you are - and at that instant the session
// cookie the browser has only just been handed may not be on the request yet. So
// the middleware sees nobody, redirects to /login, and we are already on /login,
// so NOTHING VISIBLE HAPPENS. The button is still disabled, still says "Signing
// in...", and stays that way forever. Reloading by hand works because by then
// the cookie is certainly written.
//
// A full page load fixes it outright: the browser sends the cookies it now has,
// the middleware sees the session, and the portal opens. It is a fraction slower
// than a client-side push and it cannot get into that state.
//
// The second half of the bug was that nothing ever put the button back. Even now
// that this should not happen, it says so and lets them try again rather than
// leaving somebody looking at a dead screen.
const STUCK_AFTER_MS = 8000

// THIS PAGE IS PAINT ONLY, 2 Oct 2026.
//
// Everything above and below about how signing in works is untouched - same
// fields, same Forgot password, same full page load, same stuck-timer. What
// changed is what it looks like: the SF bracket icon and the company name are
// now the ONE mark, the cream background is the off-white, and the tagline and
// the licence line are back.
//
// THE TAGLINE LIVES HERE AND ON THE CLIENT OVERVIEW, NOWHERE ELSE. A promise
// you read twice a day stops being read.
//
// "One view." is the brand blue in spirit, but #4FBBEA on a white card reads at
// 2.2 to 1 and cannot be read at all. So it takes the blue's text step - the
// same blue, darkened until it is legible. Same rule as everywhere else in the
// portal, which is why it is brand-ink rather than a one-off.
//
// IT OPENS THE WAY YOU LEFT IT. The choice is remembered in the browser and is
// the same choice the rest of the portal will read when the other screens are
// migrated - see lib/theme.ts. Until then the switch changes this screen only,
// which is a gap of days and was a deliberate decision rather than an oversight.
//
// THE MARK IS DRAWN TWICE AND CSS SHOWS ONE. Its lettering is artwork in two
// tones, which is not something a stylesheet can swap, and choosing the tone in
// JavaScript would mean the first paint showing the wrong one and correcting
// itself. Two SVGs, one hidden, nothing flickers.

// One field, styled once. Three modes used to each spell the same classes out,
// which is how two of them ended up with a different focus colour.
const FIELD =
  'w-full border border-field-line rounded-[10px] px-3 py-2.5 text-[13px] text-ink ' +
  'bg-card placeholder:text-faint focus:outline-none focus:border-brand'

const LABEL = 'text-[11px] font-semibold text-muted block mb-1.5'

const BUTTON =
  'w-full bg-brand text-on-brand rounded-[10px] py-[11px] text-[13.5px] font-semibold ' +
  'mt-[18px] transition hover:brightness-[1.04] disabled:opacity-50'

const LINK = 'text-[11.5px] text-brand-ink hover:underline'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)
  const searchParams = useSearchParams()
  // Checked, not trusted - it arrives in the URL. See lib/safe-next-path.ts.
  const nextPath = safeNextPath(searchParams.get('next'))

  // One client for this page. Creating a second one gives the browser two things
  // both trying to own the session.
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowser> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowser()
  const supabase = supabaseRef.current

  const leavingRef = useRef(false)
  const stuckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function goIn() {
    // Only once, however many things notice the sign-in.
    if (leavingRef.current) return
    leavingRef.current = true
    if (stuckTimer.current) clearTimeout(stuckTimer.current)
    stuckTimer.current = setTimeout(() => {
      leavingRef.current = false
      setLoading(false)
      setError('Signed in, but the portal did not open. Press Sign in again.')
    }, STUCK_AFTER_MS)
    // A real page load, so the browser sends the session cookie it has just been
    // given. This is the whole fix.
    window.location.assign(nextPath)
  }

  // Already signed in - somebody with a live session who landed here, or the
  // session arriving a moment after the button was pressed.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data?.session) goIn() })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) goIn()
    })
    return () => {
      sub?.subscription?.unsubscribe()
      if (stuckTimer.current) clearTimeout(stuckTimer.current)
    }
  }, [])

  async function handleLogin() {
    if (loading) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }
    goIn()
  }

  async function handleForgot() {
    if (!email) { setError('Please enter your email address'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}/reset-password`
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center gap-4 p-6">
      <div className="bg-card rounded-[18px] px-9 py-10 w-full max-w-[360px] border border-card-line">

        <div className="flex justify-center">
          <OneMark width={MARK_WIDTH.login} tone="light" className="block dark:hidden" />
          <OneMark width={MARK_WIDTH.login} tone="dark" className="hidden dark:block" />
        </div>

        <p className="text-[14.5px] font-semibold text-ink text-center mt-[18px] leading-[1.5] tracking-[-0.005em]">
          One client. One platform. <span className="text-brand-ink">One view.</span>
        </p>

        {mode === 'login' ? (
          <div className="mt-[30px]">
            <div>
              <label className={LABEL}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="you@simplifyfinance.com.au"
                className={FIELD} />
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="text-[11px] font-semibold text-muted">Password</label>
                <button onClick={() => { setMode('forgot'); setError('') }}
                  className={LINK}>Forgot password?</button>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className={FIELD} />
            </div>
            {error && <p className="text-[11.5px] text-chase mt-3">{error}</p>}
            <button onClick={handleLogin} disabled={loading} className={BUTTON}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        ) : resetSent ? (
          <div className="mt-[30px] text-center">
            <p className="text-[13px] text-done font-semibold">Reset link sent</p>
            <p className="text-[11.5px] text-muted mt-2 leading-[1.6]">
              Check your email for a password reset link. Click it to set a new password.
            </p>
            <button onClick={() => { setMode('login'); setResetSent(false) }}
              className={`${LINK} mt-4 inline-block`}>Back to sign in</button>
          </div>
        ) : (
          <div className="mt-[30px]">
            <p className="text-[11.5px] text-muted mb-4 leading-[1.6]">
              Enter your email address and we will send you a link to set a new password.
            </p>
            <div>
              <label className={LABEL}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleForgot()}
                placeholder="you@simplifyfinance.com.au"
                className={FIELD} />
            </div>
            {error && <p className="text-[11.5px] text-chase mt-3">{error}</p>}
            <button onClick={handleForgot} disabled={loading} className={BUTTON}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <button onClick={() => { setMode('login'); setError('') }}
              className="w-full text-[11.5px] text-muted hover:text-body text-center mt-3">
              Back to sign in
            </button>
          </div>
        )}

        <p className="text-[11px] text-faint text-center mt-[22px] leading-[1.6]">
          Access is by invitation only.<br />Contact your administrator.
        </p>

        {/* ONE is the platform name. Mortgage Specialists Pty Ltd is who holds
            the licence, and that does not move. */}
        <p className="text-[10.5px] text-faint text-center mt-4 leading-[1.6]">
          Mortgage Specialists Pty Ltd<br />Australian Credit Licence 387025
        </p>
      </div>

      {/* Outside the card on purpose. The card is the form; this is a setting
          about the screen, and putting it inside would have it read as one more
          thing to fill in before signing in. */}
      <ThemeSwitch />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
