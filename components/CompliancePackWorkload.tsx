'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { countPacks, daysOfMonth, type PackRow, type PersonCount, type DayRow } from '@/lib/compliance-workload'

// COMPLIANCE PACKS, ON THE WORKLOAD TAB.
//
// 28 Oct 2026. Fabio: "we would like on the workload tab on the left-hand side
// for us to start measuring how many deals person number one and person number
// two are having in that particular month, in that particular day, in that
// particular quarter, in that particular year."
//
// Every figure here is counted from the deals themselves - the same three
// columns the deal card reads and the next push allocates from - so this page
// cannot disagree with either. Reassign a deal and it moves here too, because
// this counts where a pack ENDED UP.
//
// The counting is lib/compliance-workload.ts and is tested without a database.
// This draws it.

const FIRST = '#107EA8'
const THEN = '#5B3A9E'
const TONES = [FIRST, THEN, '#137A55', '#B25A33']

export default function CompliancePackWorkload() {
  const supabase = createSupabaseBrowser()
  const [people, setPeople] = useState<PersonCount[]>([])
  const [days, setDays] = useState<DayRow[]>([])
  const [ready, setReady] = useState(false)
  const [missing, setMissing] = useState(false)
  // TWENTY ROWS OF NOUGHTS IS NOISE. 28 Oct 2026, Fabio, seeing it with one
  // pack in it: "this overwhelming... maybe only show rolling last 5 days with
  // ability to expand? its too much". The month is still there, folded away.
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    try {
      const { data: settings } = await supabase.from('settings')
        .select('compliance_issued_notification_user_id, compliance_issued_backup_user_id')
        .eq('id', 'singleton').single()

      const ids = [settings?.compliance_issued_notification_user_id, settings?.compliance_issued_backup_user_id]
        .filter(Boolean) as string[]
      const { data: profiles } = ids.length
        ? await supabase.from('user_profiles').select('id, full_name').in('id', ids)
        : { data: [] as any[] }
      // In the order Settings has them - first, then second - not whatever the
      // database happened to return.
      const pair = ids.map(id => {
        const p = (profiles || []).find((x: any) => x.id === id)
        return { id, name: String(p?.full_name || '') }
      })

      // THE WHOLE FINANCIAL YEAR, because the year figure needs it. One query.
      const yearFrom = `${Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) >= 7 ? 0 : 1)}-07-01`
      const { data: rows } = await supabase.from('deals')
        .select('compliance_pack_user_id, compliance_pack_user_name, compliance_pack_at')
        .gte('compliance_pack_at', `${yearFrom}T00:00:00`)

      const packs: PackRow[] = (rows || []).map((r: any) => ({
        userId: r.compliance_pack_user_id, name: r.compliance_pack_user_name, at: r.compliance_pack_at,
      }))
      setPeople(countPacks(packs, pair, today))
      setDays(daysOfMonth(packs, today))
    } catch {
      // docs/compliance-allocation.sql has not been run on this database.
      setMissing(true)
    }
    setReady(true)
  }

  if (!ready) return null
  if (missing) return null
  if (people.length === 0) return null

  const busiest = Math.max(1, ...people.map(p => p.month))

  return (
    <div className="bg-card border border-gray-100 rounded-xl p-5 mb-8">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Compliance packs</div>
      <p className="text-[11.5px] text-faint mb-4">
        Who received the Fact Find, Handover and Broker Notes. Quarter and year are the financial
        year, 1 July to 30 June. A reassigned deal counts against whoever has it now.
      </p>

      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        {people.map((p, i) => (
          <div key={p.id} className="border border-line-soft rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-bold rounded-full px-2 py-0.5 border"
                style={{ color: TONES[i % TONES.length], borderColor: TONES[i % TONES.length] + '55',
                         background: TONES[i % TONES.length] + '12' }}>
                {i === 0 ? 'First' : i === 1 ? 'Then' : 'Also'}
              </span>
              <span className="text-[14.5px] font-bold text-ink">{p.name || 'Somebody'}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([['Today', p.today], ['This month', p.month], ['FY quarter', p.quarter], ['Financial year', p.year]] as const)
                .map(([label, n]) => (
                  <div key={label}>
                    <div className="text-[26px] font-bold text-ink tabular-nums leading-none">{n}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-faint mt-1">{label}</div>
                  </div>
                ))}
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-3">
              <div className="h-full rounded-full"
                style={{ width: `${(p.month / busiest) * 100}%`, background: TONES[i % TONES.length] }} />
            </div>
          </div>
        ))}
      </div>

      {days.length > 0 && (() => {
        const RECENT = 5
        const shown = showAll ? days : days.slice(0, RECENT)
        const hidden = days.slice(shown.length)
        const hiddenPacks = hidden.reduce((t, d) => t + d.total, 0)
        const today = days[0]?.day
        return (
        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-faint mb-2">
            {showAll ? 'Every working day this month' : `The last ${shown.length} working ${shown.length === 1 ? 'day' : 'days'}`}
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[10px] font-bold uppercase tracking-wider text-faint text-left pb-2 pr-3 border-b border-line-soft">Day</th>
                {people.map(p => (
                  <th key={p.id} className="text-[10px] font-bold uppercase tracking-wider text-faint text-right pb-2 pr-3 border-b border-line-soft">
                    {(p.name || 'Somebody').split(' ')[0]}
                  </th>
                ))}
                <th className="text-[10px] font-bold uppercase tracking-wider text-faint text-right pb-2 border-b border-line-soft">Total</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(d => (
                <tr key={d.day} className={d.day === today ? 'bg-page' : undefined}>
                  <td className={`py-2 pr-3 text-[13px] border-b border-line-soft ${d.day === today ? 'font-bold text-ink' : 'text-gray-700'}`}>
                    {new Date(`${d.day}T00:00:00`).toLocaleDateString('en-AU',
                      { weekday: 'short', day: 'numeric', month: 'short' })}
                    {d.day === today && <span className="font-normal text-faint"> · today</span>}
                  </td>
                  {people.map(p => {
                    const n = d.counts[p.id] || 0
                    // A NOUGHT IN THE SAME WEIGHT AS A REAL FIGURE MAKES THE EYE
                    // WORK FOR NOTHING. Only what happened is dark.
                    return (
                      <td key={p.id} className={`py-2 pr-3 text-[13px] text-right tabular-nums border-b border-line-soft ${n ? 'font-semibold text-ink' : 'text-line'}`}>
                        {n}
                      </td>
                    )
                  })}
                  <td className={`py-2 text-[13px] text-right tabular-nums border-b border-line-soft ${d.total ? 'font-bold text-ink' : 'text-line'}`}>{d.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {hidden.length > 0 && (
            <button type="button" onClick={() => setShowAll(true)}
              className="mt-2.5 text-[13px] font-semibold text-brand-ink hover:underline">
              Show the rest of {new Date(`${days[0].day}T00:00:00`).toLocaleDateString('en-AU', { month: 'long' })} ↓
              {/* WHAT IS IN IT, BEFORE YOU OPEN IT. A fortnight where nothing
                  happened is one sentence, not fourteen rows. */}
              <span className="font-normal text-faint">
                {'  '}{hidden.length} more working {hidden.length === 1 ? 'day' : 'days'},
                {' '}{hiddenPacks} {hiddenPacks === 1 ? 'pack' : 'packs'}
              </span>
            </button>
          )}
          {showAll && days.length > RECENT && (
            <button type="button" onClick={() => setShowAll(false)}
              className="mt-2.5 text-[13px] font-semibold text-brand-ink hover:underline">Show less ↑</button>
          )}

          <p className="text-[11px] text-faint mt-2">
            Weekends and NSW public holidays are not rows &mdash; nothing is allocated on them. A day
            with nothing on it is still a row, because the gap says something.
          </p>
        </div>
        )
      })()}
    </div>
  )
}
