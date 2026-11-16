'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { todayYmd } from '@/lib/periods'
import { monthOf, monthName, money } from '@/lib/the-month-so-far'
import {
  sliceFor, businessMonths, againstTarget, bucketOf, type MonthSlice,
} from '@/lib/the-settlements-month'
import { stepOf, isOverdue, daysOnStep, STEP_LABEL, workdaysBetween } from '@/lib/the-seven-steps'
import { settlementSettings, SETTLEMENT_DEFAULTS } from '@/lib/settlement-settings'
import { amountOf } from '@/lib/deal-phase'
import { howManyPlanned, plannedWords } from '@/lib/the-settlement-day'

// THE SETTLEMENT MONTH, ON THE SCREEN MANAGEMENT ALREADY OPENS.
//
// 17 Nov 2026. A second chapter under the lodging one: its own black bar, its
// own boxes. Fabio: "lodgement... everything that is on the screenshot now can
// be rearranged... and then the black bar for settlements and all the boxes for
// settlements under it."
//
// TWO QUESTIONS AND NOTHING ELSE. Will the month land, and is anybody stuck.
// Three admin panels came off this page on 12 November because none of them was
// a thing anybody could act on at 9am - "it's just a waste of time" - so every
// row here is a name, a number of days, or a date running out.
//
// THE FIGURES ARE NOT WORKED OUT HERE. lib/the-settlements-month.ts does it, and
// the settlements screen reads the same columns and the same target row, so the
// two cannot disagree about the month.

const CAP = 'text-[10px] font-extrabold tracking-[.08em] uppercase text-muted flex items-center gap-2 mb-2.5'

function Bars({ s }: { s: MonthSlice }) {
  const top = Math.max(s.onTrack, s.target || 0) || 1
  const w = (n: number) => `${Math.max(0, Math.min(100, (n / top) * 100))}%`
  return (
    <div className="h-[8px] rounded-full bg-[#33332F] overflow-hidden flex mt-2">
      <div className="bg-[#64E8BB]" style={{ width: w(s.settled) }} />
      <div className="bg-[#6FD3FF]" style={{ width: w(s.booked) }} />
      <div className="bg-[#6B6B64]" style={{ width: w(s.expected) }} />
    </div>
  )
}

export default function SettlementsBand({ deals, brokerRows }: {
  deals: any[]
  brokerRows: any[]
}) {
  const supabase = createSupabaseBrowser()
  const [targets, setTargets] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [chase, setChase] = useState(SETTLEMENT_DEFAULTS)
  const [who, setWho] = useState<string | null>(null)   // null is both businesses
  // WHO HAS SAID WHAT TODAY IS. 18 Nov 2026 - the band could see the month and
  // not the day. See components/SettlementDay.tsx, which writes these rows.
  const [staff, setStaff] = useState<any[]>([])
  const [dayPlans, setDayPlans] = useState<any[]>([])

  const month = useMemo(() => monthOf(todayYmd()), [])

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('pipeline_targets').select('metric, month, broker_key, amount'),
      supabase.from('settings').select('brands, settlements').eq('id', 'singleton').maybeSingle(),
      // THE TEAM, AND THEIR DAY. Admins are left out: management is who this
      // box reports TO, not somebody who owes it a plan.
      supabase.from('user_profiles').select('id, full_name, role, sees_settlements')
        .eq('sees_settlements', true),
      supabase.from('daily_plans').select('user_id, confirmed_at, deal_ids, on_it_now')
        .eq('plan_date', todayYmd()).not('user_id', 'is', null),
    ]).then(([t, s, u, p]: any[]) => {
      if (!alive) return
      setTargets(t?.data || [])
      setBrands(Array.isArray(s?.data?.brands) ? s.data.brands : [])
      setChase(settlementSettings(s?.data?.settlements))
      setStaff((u?.data || []).filter((x: any) => x.role !== 'admin' && (x.full_name || '').trim()))
      setDayPlans(p?.data || [])
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const businesses = useMemo(
    () => businessMonths(deals, month, targets, brokerRows, brands),
    [deals, month, targets, brokerRows, brands])

  const slice = useMemo(
    () => who === null
      ? sliceFor(deals, month, targets)
      : (businesses.find(b => b.id === who)?.slice || sliceFor(deals, month, targets, who, brokerRows)),
    [who, deals, month, targets, businesses, brokerRows])

  const mine = useMemo(() => {
    if (who === null) return deals
    const ids = new Set(businesses.filter(b => b.id === who).map(b => b.id))
    return (deals || []).filter(d => {
      const b = businessMonths([d], month, targets, brokerRows, brands)[0]
      return b ? ids.has(b.id) : false
    })
  }, [who, deals, businesses, month, targets, brokerRows, brands])

  // PAST ITS CHASE TIME. The only part of this anybody can act on this morning.
  const stuck = useMemo(() => (mine || [])
    .filter(d => stepOf(d) && !d.settled_at && isOverdue(d, chase.chase))
    .map(d => ({ d, days: daysOnStep(d) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 6), [mine, chase])

  // EXPECTED, NOT BOOKED. The deals that decide whether the month lands - a
  // date nobody has confirmed, with the month running out.
  const notBooked = useMemo(() => (mine || [])
    .filter(d => bucketOf(d, month) === 'expected')
    .map(d => ({ d, amount: amountOf(d) || 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6), [mine, month])

  const pct = againstTarget(slice)
  const left = workdaysBetween(todayYmd(), `${month}-31`)

  return (
    <>
      {/* THE PILLS. Fabio: "there was little buttons. I want that... and it
        * should be carried on for settlements." They change the whole chapter,
        * not just the bar. */}
      {businesses.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {[{ id: null as string | null, name: 'Both businesses' },
            ...businesses.map(b => ({ id: b.id as string | null, name: b.name }))].map(p => (
            <button key={String(p.id)} type="button" onClick={() => setWho(p.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] border transition ${
                who === p.id
                  ? 'bg-ink border-ink text-page font-bold'
                  : 'bg-card border-field-line text-muted font-semibold hover:bg-page'}`}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="bg-[#1E1E1C] rounded-xl mb-3 overflow-hidden">
        {/* WHICH BAR THIS IS. The lodging one says so too - see RunThrough. */}
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white/[0.055] border-b border-white/10">
          <span className="inline-block w-[8px] h-[8px] rounded-sm bg-[#64E8BB]" />
          <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-page">
            Settlements
          </span>
          <span className="text-[11px] text-[#9A948C]">{monthName(month)}</span>
          <span className="ml-auto text-[11px] text-[#9A948C]">
            {left} working day{left === 1 ? '' : 's'} left
          </span>
        </div>

        <div className="px-4 py-3.5 flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">Settled</div>
            <div className="text-[26px] font-extrabold leading-none text-[#64E8BB] mt-1">{money(slice.settled)}</div>
            <div className="text-[11px] text-[#9A948C] mt-1">{slice.settledCount} deals</div>
          </div>
          <div className="text-[#56504A] text-[20px] font-light">+</div>
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">Booked</div>
            <div className="text-[26px] font-extrabold leading-none text-[#6FD3FF] mt-1">{money(slice.booked)}</div>
            <div className="text-[11px] text-[#9A948C] mt-1">{slice.bookedCount} confirmed</div>
          </div>
          <div className="text-[#56504A] text-[20px] font-light">+</div>
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">Expected</div>
            <div className="text-[26px] font-extrabold leading-none text-page mt-1">{money(slice.expected)}</div>
            <div className="text-[11px] text-[#9A948C] mt-1">{slice.expectedCount} not confirmed</div>
          </div>
          <div className="text-[#56504A] text-[20px] font-light">=</div>
          <div className="flex-1 min-w-[160px]">
            <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">On track for</div>
            <div className="text-[26px] font-extrabold leading-none text-page mt-1">{money(slice.onTrack)}</div>
            <Bars s={slice} />
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">Target</div>
            <div className="text-[26px] font-extrabold leading-none text-page mt-1">
              {slice.target === null ? '—' : money(slice.target)}
            </div>
            {/* NO TARGET IS NOT A ZERO. It says nobody has set one and where to. */}
            <div className="text-[11px] text-[#9A948C] mt-1">
              {pct === null
                ? <Link href="/settings?pane=targets" className="text-[#6FD3FF]">set one in Targets</Link>
                : <>{pct}% &middot; <Link href="/settings?pane=targets" className="text-[#6FD3FF]">change</Link></>}
            </div>
          </div>
        </div>
      </div>

      {/* ROOM AT THE BOTTOM FOR THE CHAT BUBBLE.
        * 17 Nov 2026: the support widget floats bottom right and sat on top of
        * the last row of Expected, not booked. A list whose last line cannot be
        * read is a list with one fewer line. */}
      <div className="flex gap-4 items-start flex-wrap lg:flex-nowrap pb-24">
        <div className="flex-1 min-w-[380px]">
          <div className="bg-card border-2 border-brand-ink rounded-xl px-4 py-3 mb-3">
            <div className={CAP}>Settlements stuck
              <span className="ml-auto font-normal tracking-normal normal-case text-[11.5px] text-faint">
                {stuck.length === 0 ? 'nothing' : `${stuck.length} past its chase time`}
              </span>
            </div>
            {stuck.length === 0 ? (
              <p className="text-[12.5px] text-faint m-0">
                Nothing has been sitting longer than it should.
              </p>
            ) : stuck.map(({ d, days }) => (
              <Link key={d.id} href={`/deals/${d.id}`}
                className="flex items-center gap-3 py-1.5 border-t border-line-soft first:border-0 text-[12.5px] hover:bg-page">
                <span className="font-bold flex-1 min-w-0 truncate">{d.deal_name || 'Unnamed deal'}</span>
                <span className="text-muted text-[11.5px]">{d.assigned_broker || ''}</span>
                <span className="rounded-full border border-info-edge bg-info-bg text-brand-ink px-2 py-[1px] text-[10px] font-bold whitespace-nowrap">
                  {STEP_LABEL[stepOf(d)!]}
                </span>
                <span className="font-extrabold whitespace-nowrap">{days} days</span>
              </Link>
            ))}
          </div>

          <div className="bg-card border border-card-line rounded-xl px-4 py-3">
            <div className={CAP}>Expected, not booked
              <span className="ml-auto font-normal tracking-normal normal-case text-[11.5px] text-faint">
                {money(slice.expected)} &middot; decides the month
              </span>
            </div>
            {notBooked.length === 0 ? (
              <p className="text-[12.5px] text-faint m-0">
                Everything left this month has a confirmed date.
              </p>
            ) : notBooked.map(({ d, amount }) => (
              <Link key={d.id} href={`/deals/${d.id}`}
                className="flex items-center gap-3 py-1.5 border-t border-line-soft first:border-0 text-[12.5px] hover:bg-page">
                <span className="font-bold flex-1 min-w-0 truncate">{d.deal_name || 'Unnamed deal'}</span>
                <span className="text-muted text-[11.5px] truncate">{d.lender || ''}</span>
                <span className="font-extrabold whitespace-nowrap">{money(amount)}</span>
              </Link>
            ))}
            {slice.forecast > 0 && (
              <p className="text-[11px] text-faint mt-2.5 mb-0 leading-snug">
                {money(slice.forecast)} more sits behind this in {slice.forecastCount} pre-formal
                refinance{slice.forecastCount === 1 ? '' : 's'}, which the month does not count.
              </p>
            )}
          </div>

          {/* THE DAY, NOT THE MONTH.
            * 18 Nov 2026. Everything above this is the month landing. This is
            * whether anybody is working on it this morning - the one thing the
            * band could not say until the settlements screen grew a My day.
            * One row each, named, because a count of 1 of 2 does not tell you
            * which one to ring. */}
          {staff.length > 0 && (() => {
            const byUser = new Map(dayPlans.map((p: any) => [String(p.user_id), p]))
            const rows = staff.map((p: any) => ({
              id: String(p.id),
              name: p.full_name as string,
              plan: byUser.get(String(p.id)) || null,
            }))
            const n = howManyPlanned(rows.map(r => ({ id: r.id, confirmedAt: r.plan?.confirmed_at })))
            return (
              <div className="bg-card border border-card-line rounded-xl px-4 py-3 mt-3">
                <div className={CAP}>The settlement team this morning
                  <span className="ml-auto font-normal tracking-normal normal-case text-[11.5px] text-faint">
                    {n.said} of {n.team} have said
                  </span>
                </div>
                {rows.map(r => (
                  <div key={r.id}
                    className={`rounded-lg px-3 py-2 mb-1.5 last:mb-0 border-l-4 ${
                      r.plan?.confirmed_at ? 'bg-done-bg border-done' : 'bg-page border-line'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12.5px] font-bold">{r.name}</span>
                      <span className="text-[11.5px] text-muted">
                        {plannedWords(r.name, r.plan?.confirmed_at).replace(/^\S+\s/, '')}
                      </span>
                      {r.plan?.confirmed_at && (
                        <span className="ml-auto text-[11.5px] text-faint">
                          {(r.plan?.deal_ids || []).length} on today
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </>
  )
}
