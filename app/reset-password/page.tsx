'use client'
import { useState, useEffect, Suspense } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Supabase puts the token in the URL hash — handle it
    const supabase = createSupabaseBrowser()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User is now in password recovery state
      }
    })
  }, [])

  async function handleReset() {
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/'), 2000)
    }
  }

  return (
    <div style={{ backgroundColor: "#F2E8DB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="bg-white rounded-2xl p-10 w-full max-w-sm border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#343333] rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-[#2DBEFF] font-bold text-lg">SF</span>
          </div>
          <h1 className="text-xl font-semibold text-[#343333]">Set your password</h1>
          <p className="text-sm text-gray-400
mkdir -p ~/simplify-finance-portal/app/reset-password

cat > /tmp/reset-page.tsx << 'ENDOFFILE'
'use client'
import { useState, useEffect, Suspense } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Supabase puts the token in the URL hash — handle it
    const supabase = createSupabaseBrowser()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User is now in password recovery state
      }
    })
  }, [])

  async function handleReset() {
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/'), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#F2E8DB] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 w-full max-w-sm border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#343333] rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-[#2DBEFF] font-bold text-lg">SF</span>
          </div>
          <h1 className="text-xl font-semibold text-[#343333]">Set your password</h1>
          <p className="text-sm text-gray-400 mt-1">Choose a password for your account</p>
        </div>

        {success ? (
          <div className="text-center">
            <p className="text-sm text-green-600 font-medium">Password set successfully!</p>
            <p className="text-xs text-gray-400 mt-1">Redirecting to portal...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2DBEFF]" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="Repeat password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2DBEFF]" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button onClick={handleReset} disabled={loading}
              className="w-full bg-[#343333] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#2a2a2a] transition disabled:opacity-50">
              {loading ? 'Setting password...' : 'Set password'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}
