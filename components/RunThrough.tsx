'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSayTheWeek } from '@/lib/use-say-the-week'
import { ANSWERS, answerOf, type AnswerKey } from '@/lib/lodging-when'
import {
  SEATS, SEAT_LABEL, inTeam, isSlipping, notInTeam, runThrough, seatCounts,
  unansweredDays, weekSoFar, worthOf, type BrokerRun, type Seat,
} from '@/lib/the-run-through'
import { NO_TEAM_NAME } from '@/lib/which-team'

// THE MONDAY MEETING, ON A SCREEN.
//
// 12 Nov 2026. Fabio: "We have a meeting every Monday, and then we check in on
// Wednesday and we check in on Friday... Right now is an Excel spreadsheet. I
// want that gone."
//
// You go down it broker by broker and each one answers: this week, next week,
// or waiting on the client. It writes the same three answers the Due to lodge
// panel has always written - see lib/lodging-when.ts - so the meeting and the
// deal card can never disagree about what was said.
//
// IT OPENS ON "NOBODY HAS SAID", because those are the ones the meeting exists
// to decide. Everything else is there to look at, not to work through.

const money = (n: number) => n > 0 ? `$${n.toLocaleString('en-AU')}` : ''

const CAP = 'text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted'

export default function RunThrough({
  deals, brokerNames, brokerRows, secondTeam = 'Simplify Finance Brokers', now,
}: {
  deals: any[]
  brokerNames: Record<string, string>
  /** The register, for each broker's group. See lib/which-team.ts. */
  brokerRows: Array<{ broker_key?: any; name?: any; team?: any }>
  /** The group that gets its own section at the bottom. */
  secondTeam?: string
  now?: Date
}) {
  const when = now || new Date()
  const [seat, setSeat] = useState<Seat>('nobody')
  const { say, busy, problem, setProblem, withAnswers } = useSayTheWeek(when)

  const all = useMemo(() => withAnswers(deals || []), [deals, withAnswers])

  const teamOf = useMemo(() => {
    const by = new Map<string, string>()
    for (const b of brokerRows || []) {
      const k = String(b?.broker_key || '').toLowerCase()
      if (k) by.set(k, String(b?.team || '').trim() || NO_TEAM_NAME)
    }
    return (key: string) => by.get(String(key || '').toLowerCase()) || NO_TEAM_NAME
  }, [brokerRows])

  const names = (key: string) =>
    brokerNames[String(key || '').toLowerCase()] || String(key || '')

  const counts = useMemo(() => seatCounts(all, when), [all])
  const week = useMemo(() => weekSoFar(all, when), [all])
  const runs = useMemo(
    () => runThrough(all, seat, names, teamOf, when), [all, seat, teamOf])

  const mine = notInTeam(runs, secondTeam)
  const theirs = inTeam(runs, secondTeam)

  const row = (d: any) => {
    const answer = answerOf(d, when)
    const slipping = isSlipping(d, when)
    const days = unansweredDays(d, when)
    const amount = Number(d?.loan_amount ?? d?.amount) || 0
    return (
      <div key={d.id}
        className="flex items-center gap-2.5 py-2 border-b border-line-soft last:border-b-0
          flex-wrap">
        <Link href={`/deals/${d.id}`}
          className="flex-1 min-w-[180px] text-[13.5px] font-semibold hover:underline truncate">
          {d.deal_name}
        </Link>

        {/* WHY THIS ONE IS THE PROBLEM, not a red dot that says nothing. */}
        {slipping ? (
          <span className="text-[10.5px] text-chase bg-chase-bg border border-chase-edge
            rounded-full px-2 py-[1px] whitespace-nowrap">
            {days} days, nobody has said
          </span>
        ) : (
          <span className="text-[11px] text-faint whitespace-nowrap">
            {[d.lender, seat === 'lodged' ? 'lodged' : null].filter(Boolean).join(' · ')}
          </span>
        )}

        {amount > 0 && (
          <span className="text-[13px] font-bold tabular-nums whitespace-nowrap">
            {money(amount)}
          </span>
        )}

        {seat !== 'lodged' && (
          <span className="flex gap-1 flex-none">
            {ANSWERS.map(a => (
              <button key={a.key} onClick={() => void say(d.id, a.key as AnswerKey)}
                disabled={busy === d.id}
                className={`text-[11.5px] font-semibold rounded-lg px-2.5 py-[3px] border
                  disabled:opacity-40 ${
                  answer === a.key
                    ? a.key === 'this' ? 'bg-done border-done text-page'
                      : a.key === 'next' ? 'bg-brand-ink border-brand-ink text-page'
                      : 'bg-waiting-bg border-waiting-edge text-waiting'
                    : 'border-line bg-card text-muted hover:bg-page'}`}>
                {a.label}
              </button>
            ))}
          </span>
        )}
      </div>
    )
  }

  const section = (list: BrokerRun[]) => list.map(r => (
    <div key={r.key}>
      <div className="flex items-baseline gap-2 pt-3 pb-1">
        <span className="text-[11px] font-bold tracking-[0.07em] uppercase text-faint">
          {r.name}
        </span>
        <span className="ml-auto text-[11px] text-faint">
          {r.toDecide > 0 ? `${r.toDecide} to decide` : `${r.total}`}
          {worthOf(r.deals) > 0 ? ` · ${money(worthOf(r.deals))}` : ''}
        </span>
      </div>
      {r.deals.map(row)}
    </div>
  ))

  return (
    <>
      {/* ARE WE GOING TO MAKE TWELVE. The only question a Monday asks. */}
      <div className="bg-[#17140F] rounded-xl px-4 py-3.5 mb-3 flex items-center gap-6 flex-wrap">
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">
            Lodged</div>
          <div className="text-[26px] font-extrabold leading-none text-[#64E8BB] mt-1">
            {week.lodged}</div>
          <div className="text-[11px] text-[#9A948C] mt-1">this week, so far</div>
        </div>
        <div className="text-[#56504A] text-[20px] font-light">+</div>
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">
            Promised</div>
          <div className="text-[26px] font-extrabold leading-none text-[#6FD3FF] mt-1">
            {week.promised}</div>
          <div className="text-[11px] text-[#9A948C] mt-1">brokers said yes</div>
        </div>
        <div className="text-[#56504A] text-[20px] font-light">=</div>
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">
            On track for</div>
          <div className="text-[26px] font-extrabold leading-none text-page mt-1">
            {week.onTrack}</div>
          <div className="text-[11px] text-[#9A948C] mt-1">{week.words}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">
            Target</div>
          <div className="text-[26px] font-extrabold leading-none text-page mt-1">
            {week.floor}&ndash;{week.ceiling}</div>
          <div className="text-[11px] text-[#9A948C] mt-1">a week</div>
        </div>
      </div>

      <div className="bg-card border border-card-line rounded-xl px-4 py-3.5 mb-3">
        <div className={`${CAP} mb-3 flex items-center gap-2`}>
          The run-through &mdash; what are we lodging this week
          <span className="ml-auto text-faint tracking-[0.06em] normal-case font-semibold
            text-[10.5px]">go down the list, broker by broker</span>
        </div>

        <div className="flex gap-1.5 flex-wrap mb-3">
          {SEATS.map(s => (
            <button key={s} onClick={() => { setSeat(s); setProblem('') }}
              className={`text-[12px] font-semibold rounded-lg px-3 py-[5px] border ${
                seat === s ? 'bg-ink border-ink text-page' : 'border-line bg-card text-muted'}`}>
              {SEAT_LABEL[s]}
              <span className="font-extrabold ml-1.5">{counts[s]}</span>
            </button>
          ))}
        </div>

        {problem && <p className="text-[12px] text-chase mb-2 leading-relaxed">{problem}</p>}

        {mine.length === 0 && theirs.length === 0 ? (
          <div className="bg-page border border-dashed border-card-line rounded-xl py-7
            text-center text-[12.5px] text-faint">
            {seat === 'nobody'
              ? 'Every deal has an answer. That is the meeting done.'
              : `Nothing on ${SEAT_LABEL[seat].toLowerCase()}.`}
          </div>
        ) : section(mine)}
      </div>

      {/* THE OTHER GROUP, AT THE BOTTOM AND ON ITS OWN.
        *
        * Fabio, 12 Nov 2026: "Justin and Keanen are also brokers. So is there
        * any way to have a section for simplify brokers... just a section at
        * the bottom?" It is the group on the broker's own record - see
        * lib/which-team.ts - not a brand, and not a guess from the name. */}
      {theirs.length > 0 && (
        <div className="bg-card border border-card-line rounded-xl px-4 py-3.5 mb-3">
          <div className={`${CAP} mb-1 flex items-center gap-2`}>
            {secondTeam}
            <span className="ml-auto text-faint tracking-[0.06em] normal-case font-semibold
              text-[10.5px]">what they think is coming</span>
          </div>
          {section(theirs)}
        </div>
      )}
    </>
  )
}
