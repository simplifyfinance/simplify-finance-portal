'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { todayYmd } from '@/lib/periods'
import { splitAtLine } from '@/lib/the-days-plan'
import { settlementDraft, draftOrder } from '@/lib/the-settlement-day'
import { useSettlementSettings } from '@/lib/use-settlement-settings'
import { OFFICE } from '@/lib/same-date-everywhere'
import MyDay from '@/components/MyDay'

// THE SETTLEMENT TEAM SAYS WHAT TODAY IS.
//
// 18 Nov 2026. Credit has done this every morning since 23 October and brokers
// since the week after. Settlements had the work on screen - the morning list -
// and no way to say which of it was theirs today. So management could see the
// month and could not see the day.
//
// ONE PRESS, NOT THREE. A credit assessor's morning is three: yesterday, today,
// and tell management. Belle and Julian are not reporting on yesterday to
// anybody, so saying what today is IS telling management - one button, and the
// admin band reads the same row.
//
// THE DRAFT IS THE MORNING LIST. Same screen, same order, deduplicated to one
// row per file - see lib/the-settlement-day.ts. Nothing here decides what is
// owed; it decides which of it is being done today.
export default function SettlementDay({ deals }: { deals: any[] }) {
  const supabase = createSupabaseBrowser()
  // THE SAME SETTINGS THE LIST BELOW READS, asked the same way, so the day and
  // the list cannot disagree about what is owed this morning.
  const settings = useSettlementSettings()
  const today = todayYmd()

  const [me, setMe] = useState<{ id: string; name: string } | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [onItNow, setOnItNow] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const draft = useMemo(
    () => settlementDraft(deals || [], settings), [deals, settings])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !alive) return
      const { data: profile } = await supabase.from('user_profiles')
        .select('full_name').eq('id', user.id).maybeSingle()
      const { data: plan } = await supabase.from('daily_plans')
        .select('deal_ids, notes, on_it_now, confirmed_at')
        .eq('user_id', user.id).eq('plan_date', today).maybeSingle()
      if (!alive) return
      setMe({ id: user.id, name: (profile as any)?.full_name || '' })
      setNotes(((plan as any)?.notes as any) || {})
      setOnItNow((plan as any)?.on_it_now || null)
      setSaved((plan as any)?.confirmed_at || null)
      setOrder(draftOrder(
        settlementDraft(deals || [], settings),
        ((plan as any)?.deal_ids || []).map(String)))
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  // A DEAL THAT ARRIVED SINCE THE PAGE LOADED still has to be orderable, so the
  // draft is folded in rather than replacing what the person has already moved.
  const items = useMemo(() => {
    if (!order) return []
    const known = new Set(order)
    const extra = draft.map(d => d.id).filter(id => !known.has(id))
    return extra.length ? [...order, ...extra] : order
  }, [order, draft])

  if (!me || !order) return null

  const { today: todayIds } = splitAtLine(items)

  // AND THIS IS MY DAY. One row, keyed by the person - see
  // docs/settlement-staff-plan-their-day.sql.
  async function confirm() {
    const when = new Date().toISOString()
    setBusy(true); setErr('')
    const trouble = await checkedWrite(
      supabase.from('daily_plans').upsert({
        user_id: me!.id,
        plan_date: today,
        deal_ids: todayIds,
        notes,
        on_it_now: onItNow,
        confirmed_at: when,
        // MANAGEMENT HEARS IT IN THE SAME PRESS. The admin band reads
        // informed_at for the credit team, so settlements writes the same
        // column rather than a second idea of the same thing.
        informed_at: when,
        updated_at: when,
      }, { onConflict: 'user_id,plan_date' }),
      'Your day')
    setBusy(false)
    if (trouble) { setErr(trouble); return }
    setSaved(when)
  }

  const said = saved
    ? `Said at ${new Date(saved).toLocaleTimeString('en-AU',
        { timeZone: OFFICE, hour: 'numeric', minute: '2-digit' })}`
    : 'Not said yet'

  return (
    <div className="mb-3">
      <MyDay
        deals={draft.map(d => ({
          id: d.id,
          name: d.name,
          stage: d.jobs > 1 ? `${d.stage} · ${d.jobs} jobs` : d.stage,
          since: null,
          days: null,
        }))}
        order={items}
        setOrder={setOrder}
        notes={notes}
        setNote={(dealId, text) => setNotes(n => ({ ...n, [dealId]: text }))}
        onItNow={onItNow}
        setOnItNow={setOnItNow}
        saved={saved}
        busy={busy}
        onConfirm={confirm}
        heading="My day"
      />
      <div className="flex items-center gap-3 flex-wrap -mt-1">
        <button type="button" onClick={confirm} disabled={busy}
          className="rounded-[9px] bg-ink px-[15px] py-[7px] text-[13px] font-semibold
                     text-page disabled:opacity-40">
          {busy ? 'Saving…' : saved ? 'Change my day' : 'This is my day'}
        </button>
        <span className="text-[11.5px] text-faint">
          {said} · management sees it on their Today
        </span>
        {err && <span className="text-[12px] text-chase">{err}</span>}
      </div>
    </div>
  )
}
