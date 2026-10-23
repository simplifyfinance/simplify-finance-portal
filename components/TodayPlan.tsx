'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { dayMonth } from '@/lib/same-date-everywhere'
import { whoHasIt } from '@/lib/who-has-it'
import {
  draftDay, finishedOn, planBoard, notTold, stageWaitingOn, dayBefore,
  type PlanDeal, type Plan,
} from '@/lib/the-days-plan'

// THE MORNING, WITHOUT THE EMAIL.
//
// 22 Oct 2026. What this replaces: the credit team write an email every
// morning listing yesterday's work and today's, brokers reply with an order of
// priority, and everybody copies names between an inbox and the portal by
// hand. Every one of those names is already on a deal here.
//
// Fabio: "We have a portal, we have an ability to make these a lot easier."
//
// NOBODY TYPES A PLAN. The portal drafts it from the queue. The only thing a
// person does is agree with it, or change it and then agree.
//
// AND NOTHING BLOCKS. A locked screen gets worked around by lunchtime. What
// makes it stick is one line nobody wants beside their name: "You have not
// told the brokers your day yet." See notTold() in lib/the-days-plan.ts.

type Officer = { id: string; name: string }

const SOFT = 'text-[12px] text-muted'

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5 py-2 border-b border-line-soft last:border-b-0 text-[13.5px]">{children}</div>
}

export default function TodayPlan({ deals, officers, plans, meOfficerId, meName, today }: {
  deals: any[]
  officers: Officer[]
  plans: Plan[]
  /** Set when the person looking is a credit assessor. */
  meOfficerId: string | null
  meName: string
  /** ISO date, from the server, so the browser's clock cannot disagree. */
  today: string
}) {
  const supabase = createSupabaseBrowser()
  const [saved, setSaved] = useState<string | null>(plans.find(p => p.officerId === meOfficerId)?.confirmedAt || null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [dropped, setDropped] = useState<string[]>([])
  const now = new Date()

  // MINE, DRAFTED. Only the deals where somebody here has to do something -
  // a deal sitting with a client is not today's work, and the column on the
  // right is where it goes instead.
  const mine = useMemo<PlanDeal[]>(() => {
    if (!meOfficerId) return []
    return draftDay(deals
      .filter(d => d.assigned_credit_officer === meOfficerId)
      .filter(d => d.status !== 'completed' && d.status !== 'lost')
      .map(d => ({ id: d.id, name: d.deal_name, stage: stageWaitingOn(d) || '', since: d.credit_assigned_at || d.created_at }))
      .filter(x => x.stage))
      .filter(x => !dropped.includes(x.id))
  }, [deals, meOfficerId, dropped])

  // Calendar arithmetic, not clock arithmetic - see dayBefore().
  const yesterdayDate = useMemo(() => dayBefore(today), [today])
  const yesterday = useMemo(
    () => meOfficerId ? finishedOn(deals, meOfficerId, yesterdayDate) : [],
    [deals, meOfficerId, yesterdayDate])

  const elsewhere = useMemo(() => deals
    .filter(d => d.assigned_credit_officer === meOfficerId)
    .filter(d => d.status !== 'completed' && d.status !== 'lost')
    .map(d => ({ deal: d, has: whoHasIt(d) }))
    .filter(x => x.has && x.has.holder !== 'us'), [deals, meOfficerId])

  const board = planBoard(plans)
  const late = notTold(plans, now)
  const mineLate = late.find(l => l.officerId === meOfficerId)

  async function confirm() {
    if (!meOfficerId || busy) return
    setBusy(true); setErr('')
    const when = new Date().toISOString()
    // A blocked policy returns no rows and no error, so the row is the proof.
    const { data, error } = await supabase.from('daily_plans').upsert({
      officer_id: meOfficerId, plan_date: today,
      deal_ids: mine.map(d => d.id), confirmed_at: when, updated_at: when,
    }, { onConflict: 'officer_id,plan_date' }).select('id')
    setBusy(false)
    if (error || !data?.length) {
      setErr(error?.message || 'That was not saved — nothing reached the database.')
      return
    }
    setSaved(when)
  }

  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-[22px] font-semibold">Good morning{meName ? ` ${meName.split(' ')[0]}` : ''}</h1>
        <span className={SOFT}>{dayMonth(today)}</span>
      </div>

      {/* WHAT THE PERSON THEMSELVES READS. Pointed on purpose: "not planned
          yet" sounds like untidiness, and this is about somebody waiting. */}
      {meOfficerId && !saved && mineLate && mineLate.level !== 'quiet' && (
        <div className={`mb-3 rounded-xl px-4 py-3 text-[13.5px] border ${
          mineLate.level === 'flag' ? 'bg-chase-bg border-chase-edge text-chase' : 'bg-info-bg border-info-edge text-info'}`}>
          <b>{mineLate.mine}</b>
        </div>
      )}
      {err && <div className="mb-3 rounded-xl px-4 py-3 text-[13.5px] bg-chase-bg border border-chase-edge text-chase">{err}</div>}

      <div className="flex gap-4 items-start flex-wrap lg:flex-nowrap">
        <div className="flex-1 min-w-[420px]">
          {meOfficerId && (
            <div className={`bg-card rounded-xl px-5 py-4 mb-3 ${saved ? 'border border-card-line' : 'border-2 border-ink'}`}>
              <div className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                Today, in this order
              </div>
              {mine.length === 0 ? (
                <div className={SOFT}>Nothing is sitting with you. Enjoy it.</div>
              ) : mine.map((d, i) => (
                <Row key={d.id}>
                  <span className="w-5 h-5 rounded-md bg-ink text-page text-[11px] font-bold flex items-center justify-center flex-none">{i + 1}</span>
                  <Link href={`/deals/${d.id}`} className="flex-1 font-semibold hover:underline">{d.name}</Link>
                  {d.priority && (
                    <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-chase-bg text-chase border border-chase-edge whitespace-nowrap">
                      {d.priority.by.toUpperCase()}&rsquo;S NEXT
                    </span>
                  )}
                  <span className={SOFT}>{d.stage}</span>
                  {!saved && (
                    <button onClick={() => setDropped(x => [...x, d.id])}
                      title="Put it back in the queue" className="text-faint text-[12px] hover:text-chase">&#10005;</button>
                  )}
                </Row>
              ))}

              <div className="flex gap-2.5 items-center mt-4 flex-wrap">
                {saved ? (
                  <span className="text-[13.5px] font-semibold text-done bg-done-bg border border-done-edge rounded-[10px] px-4 py-2.5">
                    &#10003; Told the brokers &mdash; {new Date(saved).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                ) : (
                  <button onClick={confirm} disabled={busy}
                    className="text-[14px] rounded-[10px] px-5 py-2.5 font-semibold bg-ink text-page disabled:opacity-40">
                    {busy ? 'Telling them...' : 'Yes — this is my day'}
                  </button>
                )}
                {!saved && <span className="text-[12px] text-faint">cross one off to send it back to the queue</span>}
              </div>
            </div>
          )}

          {meOfficerId && (
            <div className="bg-card border border-card-line rounded-xl px-5 py-4">
              <div className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                Yesterday you finished &mdash; written from what moved
              </div>
              {yesterday.length === 0
                ? <div className={SOFT}>Nothing closed yesterday.</div>
                : yesterday.map((y, i) => (
                  <Row key={i}>
                    <span className="text-done">&#10003;</span>
                    <Link href={`/deals/${y.id}`} className="flex-1 font-semibold hover:underline">{y.name}</Link>
                    <span className={SOFT}>{y.what}{y.days !== null ? ` · ${y.days} days on you` : ''}</span>
                  </Row>
                ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-[330px] lg:flex-none">
          <div className="bg-card border border-card-line rounded-xl px-5 py-4 mb-3">
            <div className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted mb-3">The team today</div>
            {board.length === 0 ? <div className={SOFT}>No credit assessors set up.</div> : board.map(r => {
              const l = late.find(x => x.officerId === r.officerId)
              return (
                <div key={r.officerId}
                  className={`rounded-lg px-3 py-2.5 mb-1.5 last:mb-0 border-l-4 ${
                    r.confirmedAt ? 'bg-done-bg border-done' : l?.level === 'flag' ? 'bg-chase-bg border-chase' : 'bg-line-soft border-faint'}`}>
                  <div className="text-[13.5px] font-semibold">{r.name}{r.officerId === meOfficerId ? ' — you' : ''}</div>
                  <div className="text-[11.5px] text-muted leading-snug">
                    {r.confirmedAt
                      ? `Told the brokers ${new Date(r.confirmedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} · ${r.count} deals`
                      : l?.theirs || `${r.name} has not started yet`}
                  </div>
                </div>
              )
            })}
          </div>

          {meOfficerId && elsewhere.length > 0 && (
            <div className="bg-card border border-card-line rounded-xl px-5 py-4">
              <div className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                Waiting on someone else &mdash; {elsewhere.length}
              </div>
              {elsewhere.slice(0, 6).map(({ deal, has }) => (
                <Row key={deal.id}>
                  <Link href={`/deals/${deal.id}`} className="flex-1 font-semibold hover:underline">{deal.deal_name}</Link>
                  <span className={`text-[10.5px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${has!.style}`}>{has!.label}</span>
                </Row>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
