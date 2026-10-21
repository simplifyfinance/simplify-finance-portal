"use client"
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { safeNextPath } from '@/lib/safe-next-path'
import OneMark, { MARK_WIDTH } from '@/components/OneMark'
import { DEFAULTS } from '@/lib/two-factor'

// THE SECOND FACTOR, ON SCREEN.
//
// 21 Oct 2026. Fabio: "I don't want an authenticator app. I'd rather emails."
// Six digits to the address on the account, good for ten minutes.
//
// A FULL PAGE LOAD WHEN IT WORKS, not a router push. The same reason the
// sign-in screen beside this one does it: the middleware has to see the cookie
// that was set a moment ago, and a background fetch can race it. That bug left
// people looking at a dead "Signing in..." button for a week in September.

const FIELD = 'w-full bg-page border border-card-line rounded-[10px] px-3 py-2.5 text-[13px] '
  + 'text-ink placeholder:text-faint focus:outline-none focus:border-brand'

function Verify() {
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'))
  const [code, setCode] = useState('')
  const [trust, setTrust] = useState(true)
  const [why, setWhy] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [again, setAgain] = useState(0)
  // HOW LONG A CODE LASTS AND HOW LONG A BROWSER IS TRUSTED ARE SETTINGS IN
  // VERCEL. A browser component cannot read one, so the send route tells us
  // and the defaults stand in until it answers.
  const [rules, setRules] = useState({ minutes: 0, trustDays: DEFAULTS.trustDays })
  const asked = useRef(false)

  // ONE CODE ON ARRIVAL, AND ONLY ONE. React runs an effect twice in
  // development, and without this guard everybody would get two emails and
  // burn two of their three an hour on one visit.
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    send()
  }, [])

  useEffect(() => {
    if (again <= 0) return
    const t = setTimeout(() => setAgain(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [again])

  async function send() {
    setWhy(''); setNote('')
    try {
      const res = await fetch('/api/2fa/send', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setWhy(body?.error || 'The code could not be sent.'); return }
      if (body?.notNeeded) { window.location.href = nextPath || '/'; return }
      if (typeof body?.minutes === 'number' || typeof body?.trustDays === 'number') {
        setRules(r => ({
          minutes: typeof body.minutes === 'number' ? body.minutes : r.minutes,
          trustDays: typeof body.trustDays === 'number' ? body.trustDays : r.trustDays,
        }))
      }
      setNote(body?.minutes ? `Sent. It works for ${body.minutes} minutes.` : 'Sent.')
      setAgain(60)
    } catch {
      setWhy('The code could not be sent. Check your connection.')
    }
  }

  async function verify() {
    if (busy) return
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) { setWhy('Type the six digits.'); return }
    setBusy(true); setWhy(''); setNote('')
    try {
      const res = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: digits, trust }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWhy(body?.error || 'That code is not right.')
        if (typeof body?.left === 'number') {
          setWhy(`${body.error} ${body.left} ${body.left === 1 ? 'try' : 'tries'} left.`)
        }
        setBusy(false)
        return
      }
      window.location.href = nextPath || '/'
    } catch {
      setWhy('That could not be checked. Try again.')
      setBusy(false)
    }
  }

  async function notMe() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut().catch(() => {})
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center gap-4 p-6">
      <div className="bg-card rounded-[18px] px-9 py-10 w-full max-w-[360px] border border-card-line">
        <div className="flex justify-center">
          <OneMark width={MARK_WIDTH.login} tone="light" className="block dark:hidden" />
          <OneMark width={MARK_WIDTH.login} tone="dark" className="hidden dark:block" />
        </div>

        <p className="text-[15px] font-semibold text-ink text-center mt-[18px]">Check your email</p>
        <p className="text-[12px] text-muted text-center mt-1 leading-relaxed">
          We sent a six digit code to the address on your account.
        </p>

        <div className="mt-6">
          <label className="text-[11px] font-semibold text-muted">Code</label>
          <input value={code} inputMode="numeric" autoComplete="one-time-code" autoFocus
            maxLength={7}
            onChange={e => setCode(e.target.value.replace(/[^0-9 ]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && verify()}
            placeholder="000000"
            className={`${FIELD} mt-1.5 text-center text-[20px] tracking-[8px] font-semibold`} />
        </div>

        {/* NOT OFFERED WHEN IT IS TURNED OFF. Trust days of zero means a code
            every single time, and a tick box that does nothing is worse than
            no tick box. */}
        {rules.trustDays > 0 && (
          <label className="flex gap-2 items-start mt-4 cursor-pointer">
            <input type="checkbox" checked={trust} onChange={e => setTrust(e.target.checked)}
              className="mt-[3px] accent-ink" />
            <span className="text-[12px] text-body leading-relaxed">
              Trust this browser for {rules.trustDays} days
              <span className="block text-[11px] text-faint">You will still type your password each time.</span>
            </span>
          </label>
        )}

        {why && <p className="text-[11.5px] text-chase mt-3">{why}</p>}
        {note && !why && <p className="text-[11.5px] text-done mt-3">{note}</p>}

        <button onClick={verify} disabled={busy}
          className="w-full bg-ink text-page rounded-[10px] py-2.5 text-[13px] font-semibold mt-4 disabled:opacity-50">
          {busy ? 'Checking…' : 'Verify'}
        </button>

        <button onClick={send} disabled={again > 0}
          className="w-full text-[11.5px] text-muted hover:text-body text-center mt-3 disabled:opacity-50">
          {again > 0 ? `Send it again · ${again}s` : 'Send it again'}
        </button>

        {/* A WAY OUT THAT IS NOT THE BACK BUTTON. Somebody who cannot reach
            their email on this machine is otherwise stuck on this screen with
            a live session behind it. */}
        <button onClick={notMe}
          className="w-full text-[11.5px] text-faint hover:text-body text-center mt-2">
          Sign out instead
        </button>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return <Suspense fallback={null}><Verify /></Suspense>
}
