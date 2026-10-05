'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// WHO IS DOING THE BORROWING CAPACITY.
//
// Fabio, 27 Sep 2026: "Move the BC allocation button to somewhere here - maybe
// highlighted. Right now its on BC - Borrowing Capacity - then hit preview &
// Share and then hit the button."
//
// It is the first decision on a deal and it was three clicks deep, behind the
// one tab nobody opens unless they are emailing a client. The same thing
// happened to "Client agreed - move to LO" on 2 September, for the same reason,
// and the fix was the same: the action that moves a deal on belongs on the deal.
//
// IT IS NOT A PERMANENT ROW OF BUTTONS. It is a question, and it disappears the
// moment it is answered - the credit officer chip in the header carries it from
// then on. A deal that is finished never shows it at all.

export default function WhoIsDoingTheBc({ deal, onUpdated }: {
  deal: any
  onUpdated?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const answered = !!deal?.assigned_credit_officer || !!deal?.bc_self_assigned
  const finished = deal?.status === 'completed' || !!deal?.settled_at
  if (answered || finished) return null

  // Ellie makes the SalesTrekker card off the back of either answer. The route
  // claims the send atomically, so pressing twice can never make two cards.
  async function tellSalesTrekker(): Promise<string> {
    try {
      const res = await fetch('/api/notify-salestrekker', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, trigger: 'bc_action' }),
      })
      if (!res.ok) {
        console.error('[notify-salestrekker] responded', res.status, await res.text())
        return 'the SalesTrekker notification did not send. Tell Fabio.'
      }
    } catch (e) {
      console.error('[notify-salestrekker] request failed', e)
      return 'the SalesTrekker notification did not send. Tell Fabio.'
    }
    return ''
  }

  async function takeItMyself() {
    setSending(true); setErr(''); setMsg('')
    const { data: rows, error } = await supabase.from('deals')
      .update({ bc_self_assigned: true }).eq('id', deal.id).select('id')
    // Zero rows with no error means the write was refused. Never fail silently.
    if (error || !rows || rows.length === 0) {
      setErr(error ? `Not saved: ${error.message}` : 'Not saved - nothing was written. Please tell Fabio.')
      setSending(false); return
    }
    const warn = await tellSalesTrekker()
    if (warn) setErr(`Saved, but ${warn}`)
    onUpdated?.({ bc_self_assigned: true })
    setSending(false)
  }

  async function sendToCreditTeam() {
    setSending(true); setErr(''); setMsg('')
    try {
      const res = await fetch('/api/allocate-credit-officer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      })
      const data = await res.json()
      if (!data.ok) { setErr(data.error || 'Failed to allocate'); setSending(false); return }
      if (data.alreadyAssigned) {
        setMsg('This deal is already assigned to a credit officer.')
      } else {
        setMsg(`Assigned to ${data.assignedTo}${data.emailSent ? ' — notified by email' : ''}`)
        const warn = await tellSalesTrekker()
        if (warn) setErr(`Assigned, but ${warn}`)
        onUpdated?.({ assigned_credit_officer: data.assignedTo || true })
      }
    } catch (e: any) {
      setErr(e.message)
    }
    setSending(false)
  }

  return (
    <div className="bg-chase-bg border border-chase-edge rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[13px] font-semibold text-chase">Who is doing the borrowing capacity?</span>
        <button onClick={takeItMyself} disabled={sending}
          className="px-3 py-1.5 text-xs rounded-lg border border-[#E3E6E8] bg-card text-[#4A5158] hover:bg-gray-50 disabled:opacity-50">
          I&apos;ll do this myself
        </button>
        <button onClick={sendToCreditTeam} disabled={sending}
          className="px-3 py-1.5 text-xs rounded-lg bg-ink text-page font-semibold hover:opacity-90 disabled:opacity-50">
          {sending ? 'Sending...' : 'Send to credit team'}
        </button>
        <span className="text-[11.5px] text-chase">Nobody is on it yet.</span>
      </div>
      {msg && <p className="m-0 mt-2 text-[12px] text-done">{msg}</p>}
      {err && <p className="m-0 mt-2 text-[12px] text-chase">{err}</p>}
    </div>
  )
}
