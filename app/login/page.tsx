'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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

  return (
    <div className="min-h-screen bg-[#F2E8DB] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 w-full max-w-sm border border-gray-100">
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#343333] rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-[#2DBEFF] font-bold text-lg">SF</span>
          </div>
          <h1 className="text-xl font-semibold text-[#343333]">Simplify Finance</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to your portal</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="you@simplifyfinance.com.au"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2DBEFF]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2DBEFF]"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#343333] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#2a2a2a] transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Access is by invitation only. Contact your administrator.
        </p>
      </div>
    </div>
  )
}
