'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { phaseOf, phaseSince, PHASE_LABEL } from '@/lib/deal-phase'
import {
  ANSWERS, TAB_LABEL, answerOf, daysOver, onTab, patchForAnswer, standingOf,
  tabCounts, weekLabel, type AnswerKey, type Tab,
} from '@/lib/lodging-when'

// DUE TO LODGE, AND WHO SAID SO.
//
// Alan's item 1. The list the week is actually run from.
//
// THE WEEK IS SET FROM HERE, NOT FROM THE DEAL CARD. Fabio, 10 Nov 2026:
// "Alan sets the week in conjunction with brokers." That is a meeting - you
// sit down with one broker and go through their deals one after another.
// Opening nine deal cards to record nine answers is the version nobody is
// still doing in week three.
//
// FOUR ANSWERS, NOT A DATE PICKER. Nobody is promising a Thursday, and a date
// is a promise somebody then has to keep changing. "Client" is an answer in
// its own right - without it every deal waiting on somebody else sits in No
// week set looking like an oversight.
//
// RED IS ONLY FOR SLIPPED. It did not lodge in the week it was promised, so it
// is today's problem. Everything else here is work in hand.
//
// AND IT DOES NOT RECORD A LODGEMENT. 17 Nov 2026. A "Mark it lodged" button
// sat on these rows for five days. Fabio pressed it while testing and could
// not tell whether it had written anything: "I don't like it because saying
// that he is not safe."
//
// He is right, and the fault was mine for putting it here. This page answers
// WHEN WE EXPECT a deal to lodge. Recording that one HAS lodged is a different
// question, it is irreversible, and a row that offers both invites the second
// answer when you meant the first. A deal like Merton that never lodged should
// sit here with its week and nothing else.
//
// Lodged is still marked in the deal card's settlement panel, which asks for
// the date rather than assuming today.

const PILL = 'text-[10.5px] font-bold rounded-md px-2 py-0.5 whitespace-nowrap border'
const TH = 'text-[9.5px] font-bold tracking-[.08em] uppercase text-faint text-left px-3.5 py-2 ' +
           'border-b border-line-soft bg-page'
const TD = 'text-[13px] text-body px-3.5 py-2.5 border-b border-line-soft align-middle'

export default function DueToLodge({ deals, brokerNames, canSet, now }: {
  deals: any[]
  brokerNames?: Record<string, string>
  /** Only management set the week. Everyone else reads it. */
  canSet?: boolean
  now?: Date
}) {
  const when = now || new Date()
  const supabase = createSupabaseBrowser()
  const [tab, setTab] = useState<Tab>('this_week')
  const [patched, setPatched] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState('')
  const [problem, setProblem] = useState('')

  const all = (deals || []).map(d => (patched[d.id] ? { ...d, ...patched[d.id] } : d))
  const counts = tabCounts(all, when)
  const rows = onTab(all, tab, when)

  async function setWeek(deal: any, key: AnswerKey) {
    const patch = patchForAnswer(key, when)
    setBusy(deal.id); setProblem('')
    const err = await checkedWrite(
      supabase.from('deals').update({
        ...patch,
        lodgement_week_at: new Date().toISOString(),
      }).eq('id', deal.id),
      'The lodgement week')
    setBusy('')
    if (err) { setProblem(err); return }
    setPatched(p => ({ ...p, [deal.id]: patch }))
  }

  return (
    <div className="bg-page border border-card-line rounded-2xl px-4 py-3.5 mb-4">
      <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-faint m-0 mb-2.5">
        Due to lodge
      </p>

      <span className="inline-flex gap-0.5 bg-line-soft rounded-[9px] p-[3px] mb-3">
        {(['this_week', 'next_week', 'no_week'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setProblem('') }}
            className={`text-[12px] font-semibold px-3.5 py-[5px] rounded-md transition ${
              tab === t ? 'bg-card text-brand-ink shadow-sm' : 'text-muted'}`}>
            {TAB_LABEL[t]}{counts[t] > 0 ? ' ' + counts[t] : ''}
          </button>
        ))}
      </span>

      {problem && <p className="text-[12px] text-chase m-0 mb-2 leading-[1.5]">{problem}</p>}

      {rows.length === 0 ? (
        <div className="bg-card border border-dashed border-card-line rounded-xl py-7 text-center
          text-[13.5px] text-faint">
          {tab === 'no_week'
            ? 'Every deal has a week on it.'
            : 'Nothing is due to lodge in that week.'}
        </div>
      ) : (
        <div className="bg-card border border-card-line rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Deal</th>
                <th className={TH}>Broker</th>
                <th className={TH}>Where it is</th>
                <th className={TH}>{canSet ? 'Lodging when?' : 'Target'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(d => {
                const standing = standingOf(d, when)
                const over = daysOver(d, when)
                const lit = answerOf(d, when)
                const days = ageOf(d, when)
                const broker = brokerNames?.[String(d.assigned_broker || '').toLowerCase()]
                  || String(d.assigned_broker || '')
                return (
                  <tr key={d.id} className="last:[&>td]:border-b-0">
                    <td className={TD}>
                      <Link href={`/deals/${d.id}`}
                        className="font-semibold text-ink hover:text-brand-ink">
                        {d.deal_name || 'Untitled deal'}
                      </Link>
                    </td>
                    <td className={TD}>{broker}</td>
                    <td className={TD}>
                      {standing === 'lodged' ? (
                        <span className={PILL + ' bg-done-bg text-done border-done-edge'}>
                          Lodged{lodgedDay(d) ? ' ' + lodgedDay(d) : ''}
                        </span>
                      ) : standing === 'slipped' ? (
                        <span className={PILL + ' bg-chase-bg text-chase border-chase-edge'}>
                          Slipped — {over} {over === 1 ? 'day' : 'days'} over
                        </span>
                      ) : (
                        <span className={PILL + ' bg-info-bg text-brand-ink border-info-edge'}>
                          {PHASE_LABEL[phaseOf(d)]}{days === null ? '' : ` — ${days} ${days === 1 ? 'day' : 'days'}`}
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      {canSet ? (
                        <span className="inline-flex gap-1 flex-wrap">
                          {ANSWERS.map(a => (
                            <button key={a.key} onClick={() => void setWeek(d, a.key)}
                              disabled={busy === d.id}
                              className={`text-[11.5px] rounded-lg px-2.5 py-1 border transition ${
                                lit === a.key
                                  ? 'bg-ink border-ink text-page font-semibold'
                                  : 'bg-card border-line text-muted hover:bg-page'} ${
                                busy === d.id ? 'opacity-50' : ''}`}>
                              {a.label}
                            </button>
                          ))}
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted">
                          {weekLabel(d.lodgement_week, when) || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11.5px] text-faint leading-[1.5] m-0 mt-2.5">
        {tab === 'no_week'
          ? 'Nobody has said which week these are meant to lodge in. That is the most useful number '
            + 'on the screen and the one a report would never show you.'
          : 'A deal gets on this list when somebody says which week it is meant to lodge in, and it '
            + 'stops being chased when it lodges. Where it is comes off the board — nobody keeps '
            + 'this list up to date.'}
      </p>
    </div>
  )
}

function ageOf(deal: any, now: Date): number | null {
  const since = phaseSince(deal) || deal?.created_at
  if (!since) return null
  const at = new Date(String(since)).getTime()
  if (!Number.isFinite(at)) return null
  return Math.max(0, Math.floor((now.getTime() - at) / 86_400_000))
}

function lodgedDay(deal: any): string {
  const t = String(deal?.lodged_at || '').trim()
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'Australia/Sydney' })
}
