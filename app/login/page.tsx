'use client'
import { useState, useEffect, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { safeNextPath } from '@/lib/safe-next-path'

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
      redirectTo: 'https://simplify-finance-portal.vercel.app/reset-password'
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#F2E8DB] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 w-full max-w-sm border border-gray-100">
        <div className="text-center mb-8">
          <img src="/login-icon.png" alt="Simplify Finance" className="w-12 h-12 rounded-xl mx-auto mb-4 object-cover" />
          <h1 className="text-xl font-semibold text-[#343333]">Simplify Finance</h1>
          <p className="text-sm text-gray-400 mt-1">{mode === 'login' ? 'Sign in to your portal' : 'Reset your password'}</p>
        </div>

        {mode === 'login' ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="you@simplifyfinance.com.au"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2DBEFF]" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-gray-500">Password</label>
                <button onClick={() => { setMode('forgot'); setError('') }}
                  className="text-xs text-[#2DBEFF] hover:underline">Forgot password?</button>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2DBEFF]" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button onClick={handleLogin} disabled={loading}
              className="w-full bg-[#343333] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#2a2a2a] transition disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        ) : resetSent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-green-600 font-medium">Reset link sent!</p>
            <p className="text-xs text-gray-400">Check your email for a password reset link. Click it to set a new password.</p>
            <button onClick={() => { setMode('login'); setResetSent(false) }}
              className="text-xs text-[#2DBEFF] hover:underline">Back to sign in</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleForgot()}
                placeholder="you@simplifyfinance.com.au"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2DBEFF]" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button onClick={handleForgot} disabled={loading}
              className="w-full bg-[#343333] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#2a2a2a] transition disabled:opacity-50">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <button onClick={() => { setMode('login'); setError('') }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center">
              Back to sign in
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          Access is by invitation only. Contact your administrator.
        </p>
      </div>
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
