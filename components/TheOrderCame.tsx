"use client"
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { whatSheIsTold } from '@/lib/the-order-from-above'

// MANAGEMENT CHANGED YOUR ORDER.
//
// 12 Nov 2026. Fabio: "Credit never disagrees with the order... if I give the
// order, they follow the order."
//
// SO THERE IS NOTHING TO AGREE TO. 14 Nov, when I offered him a version where
// her confirmed day was reopened and she answered again: "I don't want her to
// have to agree to it... she does confirm that she understands the changes."
//
// Got it means SEEN. Not accepted, not agreed, not re-confirmed. Her day keeps
// whatever tick it already had. The one question this whole loop asks is
// whether she has looked at it, and that is the question her pill answers on
// management's screen.
//
// IT ARRIVES INSIDE THE DAY SHE WAS ALREADY GOING TO ANSWER. Not an email and
// not a notification - a line above the three presses she opens anyway.
export default function TheOrderCame({ plan, hers, officerId, now = new Date(), onSeen }: {
  /** Her daily_plans row for today. */
  plan: any
  /** The deal ids already on her own day, so the line can say what was added. */
  hers: string[]
  officerId: string
  now?: Date
  onSeen?: () => void
}) {
  const supabase = createSupabaseBrowser()
  const [gone, setGone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  const told = whatSheIsTold(plan, hers, now)
  if (!told || gone) return null

  async function gotIt() {
    setBusy(true); setProblem('')
    const trouble = await checkedWrite(
      supabase.from('daily_plans')
        .update({ seen_at: new Date().toISOString() })
        .eq('officer_id', officerId).eq('plan_date', plan?.plan_date),
      'That you have seen the order')
    setBusy(false)
    if (trouble) { setProblem(trouble); return }
    setGone(true)
    onSeen?.()
  }

  return (
    <div className="mb-3 rounded-[11px] border border-info-edge bg-info-bg px-3.5 py-3">
      <p className="text-[13px] font-bold text-brand-ink">{told.line}</p>

      {told.note && (
        <p className="mt-1.5 text-[12.5px] italic leading-relaxed text-body">
          &ldquo;{told.note}&rdquo;
        </p>
      )}

      {told.added.length > 0 && (
        <p className="mt-1.5 text-[12px] text-muted">
          {told.added.length} added to your day.
        </p>
      )}

      {problem && (
        <p className="mt-2 rounded-lg border border-chase-edge bg-chase-bg px-3 py-1.5
                      text-[12.5px] text-chase">{problem}</p>
      )}

      {/* SEEN, NOT AGREED. There is deliberately no second button beside this. */}
      <button type="button" disabled={busy} onClick={gotIt}
              className="mt-2.5 rounded-lg bg-brand-ink px-[13px] py-[5px] text-[12px]
                         font-semibold text-page disabled:opacity-50">
        {busy ? 'Saving…' : 'Got it'}
      </button>
    </div>
  )
}
