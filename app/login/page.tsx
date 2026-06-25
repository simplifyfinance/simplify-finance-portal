'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/')
        router.refresh()
      }
    })
  }, [router])

  async function handleLogin() {
    setLoading(true)
    setError('')
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  async function handleForgot() {
    if (!email) { setError('Please enter your email address'); return }
    setLoading(true)
    setError('')
    const supabase = createSupabaseBrowser()
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
          <div className="w-12 h-12 bg-[#343333] rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-[#2DBEFF] font-bold text-lg">SF</span>
          </div>
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
