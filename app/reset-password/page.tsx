'use client'
import { useState, useEffect, Suspense } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

function ResetForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery mode')
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
    <div style={{ backgroundColor: '#F2E8DB', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '360px', border: '1px solid #f0f0f0' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', background: '#343333', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ color: '#2DBEFF', fontWeight: 'bold', fontSize: '18px' }}>SF</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#343333', margin: '0 0 4px' }}>Set your password</h1>
          <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>Choose a password for your account</p>
        </div>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#16a34a', fontWeight: '500' }}>Password set successfully!</p>
            <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Redirecting to portal...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="Repeat password"
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {error && <p style={{ fontSize: '12px', color: '#ef4444', margin: 0 }}>{error}</p>}
            <button onClick={handleReset} disabled={loading}
              style={{ width: '100%', background: '#343333', color: '#fff', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
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
