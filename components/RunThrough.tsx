'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useSayTheWeek } from '@/lib/use-say-the-week'
import { ANSWERS, answerOf, type AnswerKey } from '@/lib/lodging-when'
import {
  CARRIED_WORDS, SEATS, SEAT_LABEL, SHOW_AT_ONCE, STAGE_TONE, carriedOver, inTeam, isSlipping,
  matches, notInTeam, readTarget, runThrough, seatCounts, theirOwnBook, unansweredDays,
  weekSoFar, whereItIs, worthOf, type BrokerRun, type Seat,
} from '@/lib/the-run-through'
import { shareOf } from '@/lib/who-gets-paid-on-this'
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
  deals, brokerNames, brokerRows, secondTeam = 'Simplify Finance Brokers',
  target: savedTarget, canSetTarget = false, firstTeam = 'Simplify Finance',
  team = [], settling = [], overloaded = null,
  meName = '',
  todayWords = '', now,
}: {
  deals: any[]
  brokerNames: Record<string, string>
  /** The register, for each broker's group. See lib/which-team.ts. */
  brokerRows: Array<{ broker_key?: any; name?: any; team?: any; last_in_list?: any }>
  /** The group whose deals fill the main box. */
  firstTeam?: string
  /** The group that gets its own section at the bottom. */
  secondTeam?: string
  /** What the business is aiming at this week. Editable on the bar. */
  target?: { floor?: any; ceiling?: any } | null
  canSetTarget?: boolean
  /** The credit assessors and whether they have told management their day. */
  team?: Array<{ name: string; informedAt?: any; yesterdayCount?: number; todayCount?: number
                 open?: number }>
  /** What is settling this week, for the box under it. */
  settling?: Array<{ id: string; name: string; day: string; amount: number }>
  /** Named only when one assessor is carrying far more than the rest. */
  overloaded?: { name: string; open: number; average: number; unplanned: boolean } | null
  meName?: string
  todayWords?: string
  now?: Date
}) {
  const when = now || new Date()
  const supabase = createSupabaseBrowser()
  const [seat, setSeat] = useState<Seat>('nobody')
  const [look, setLook] = useState<Record<string, string>>({})
  const [showAll, setShowAll] = useState<Record<string, boolean>>({})
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

  // THE NAMES THAT APPEAR WHETHER THEY HAVE ANYTHING OR NOT - the brokers who
  // run the business between them. Kylie is on this list with nothing under
  // her today, on purpose.
  // Fabio, 13 Nov 2026: "Kylie always last one within that box."
  const lastBrokers = useMemo(() => (brokerRows || [])
    .filter(b => String(b?.last_in_list ?? '') === 'true'
      || String(b?.name || '').toLowerCase().startsWith('kylie'))
    .map(b => String(b?.broker_key || '').toLowerCase())
    .filter(Boolean), [brokerRows])

  const ourBrokers = useMemo(() => (brokerRows || [])
    .filter(b => String(b?.team || '').trim() !== secondTeam)
    .map(b => String(b?.broker_key || '').toLowerCase())
    .filter(Boolean), [brokerRows, secondTeam])

  const [target, setTarget] = useState(() => readTarget(savedTarget))
  const [editing, setEditing] = useState(false)

  const counts = useMemo(() => seatCounts(all, when), [all])

  // WHOSE LOAD THE WEEK'S TARGET COUNTS, off the deal's own split.
  //
  // 13 Nov 2026. Fabio: "the 50/50 is ours, remember, sits on our load." So a
  // deal Justin writes on a 50/50 arrangement counts towards the ten to twelve
  // Mark, Fabio and Kylie are measured on; one he takes 80 of does not. It is
  // read off the deal's own copy of the terms, so it stays right when a split
  // is renegotiated later - see lib/who-gets-paid-on-this.ts.
  //
  // THIS DECIDES THE COUNT, NOT THE BOX. Which section a broker's name appears
  // in is their group and nothing else.
  const shareFor = (d: any) => {
    const who = names(String(d?.assigned_broker || ''))
    return shareOf({ lines: d?.commission_split_lines }, who)?.upfront ?? null
  }
  const ourLoad = useMemo(
    () => all.filter(d => !theirOwnBook(shareFor(d))), [all, brokerNames])
  const week = useMemo(() => weekSoFar(ourLoad, when, target), [ourLoad, target])

  // WHICH BOX A BROKER'S DEALS SIT IN IS THE BROKER'S GROUP. FULL STOP.
  //
  // 13 Nov 2026. Fabio: "Justin and Keanen NEED TO BE ON THEIR OWN BOX under
  // label Simplify Brokers, NOT with me and Mark - the data comes FROM THEM."
  //
  // I had used the 80/20-versus-50/50 split to decide the box. That rule says
  // whose LOAD a deal counts against for the week's target; it was never about
  // which section a broker's name appears in. A broker is in one box, the one
  // their record says - see lib/which-team.ts.
  const everyone = useMemo(
    () => runThrough(all, seat, names, teamOf, when, ourBrokers, lastBrokers),
    [all, seat, teamOf, ourBrokers, lastBrokers])
  const mine = useMemo(() => notInTeam(everyone, secondTeam), [everyone, secondTeam])
  const theirs = useMemo(() => inTeam(everyone, secondTeam), [everyone, secondTeam])

  const [savingTarget, setSavingTarget] = useState(false)

  // ONE ROW, ONE NUMBER PAIR. The target is the business's, not one person's,
  // so it lives in settings beside the brands rather than on a profile.
  async function saveTarget() {
    const next = readTarget(target)
    setSavingTarget(true)
    const { error } = await supabase.from('settings')
      .upsert({ id: 'singleton', week_target: next }).select('id')
    setSavingTarget(false)
    if (error) { setProblem('The target was not saved: ' + error.message); return }
    setTarget(next)
    setEditing(false)
  }

  const row = (d: any) => {
    const answer = answerOf(d, when)
    const slipping = isSlipping(d, when)
    // Promised at an earlier meeting, so worth asking about twice.
    const carried = carriedOver(d, when)
    const where = whereItIs(d)
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
        {carried ? (
          <span className={`text-[10.5px] rounded-full px-2 py-[1px] whitespace-nowrap border ${
            carried === 'slipped'
              ? 'text-chase bg-chase-bg border-chase-edge'
              : 'text-brand-ink bg-info-bg border-info-edge'}`}>
            {CARRIED_WORDS[carried]}
          </span>
        ) : slipping ? (
          <span className="text-[10.5px] text-chase bg-chase-bg border border-chase-edge
            rounded-full px-2 py-[1px] whitespace-nowrap">
            {days} days, nobody has said
          </span>
        ) : null}

        {/* WHERE IT IS: one blue, three depths, darker is closer to lodging.
          * See STAGE_TONE in lib/the-run-through.ts for why it is not a status
          * colour. */}
        {where && (
          <span className={`text-[10.5px] font-bold rounded-full px-2.5 py-[2px] border
            whitespace-nowrap ${STAGE_TONE[where] || 'border-line text-muted'}`}>
            {where.charAt(0).toUpperCase() + where.slice(1)}
          </span>
        )}

        {d.lender && (
          <span className="text-[11px] text-faint whitespace-nowrap">{d.lender}</span>
        )}


        {/* A BLANK AMOUNT IS A GAP, NOT A ZERO.
          * 13 Nov 2026, Fabio: "why Makeham is there if there's not even a
          * loan amount?" Because the list is chosen by stage, not by amount -
          * and a deal at compliance with no amount recorded is somebody's
          * oversight, which is worth saying out loud rather than leaving as an
          * empty column. */}
        <span className={`text-[13px] whitespace-nowrap ${amount > 0
          ? 'font-bold tabular-nums' : 'text-[11px] text-faint italic'}`}>
          {amount > 0 ? money(amount) : 'no amount yet'}
        </span>

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

  // TEN DEEP, AND IT SCROLLS.
  //
  // 13 Nov 2026. Fabio: "roll the list up and down for Mark and Fabio". The
  // first version put the rest behind a "17 more" button, which is a click
  // between a meeting and the deal it is looking for.
  const section = (list: BrokerRun[], canSearch: boolean) => list.map(r => {
    const q = look[r.key] || ''
    const found = q.trim().length >= 2 ? r.all.filter(d => matches(d, q)) : null
    const deals = found ?? r.deals
    return (
      <div key={r.key}>
        <div className="flex items-baseline gap-2 pt-3 pb-1 flex-wrap">
          <span className="text-[11px] font-bold tracking-[0.07em] uppercase text-faint">
            {r.name}
          </span>
          {canSearch && (
            <input value={q}
              onChange={e => setLook(x => ({ ...x, [r.key]: e.target.value }))}
              placeholder="find one of theirs…"
              className="text-[11.5px] bg-page border border-line rounded-md px-2.5 py-[3px]
                w-[190px] placeholder:text-faint" />
          )}
          <span className="ml-auto text-[11px] text-faint">
            {found ? `${found.length} found`
              : r.toDecide > 0 ? `${r.toDecide} to decide` : r.total > 0 ? `${r.total}` : '—'}
            {worthOf(deals) > 0 ? ` · ${money(worthOf(deals))}` : ''}
          </span>
        </div>
        {deals.length === 0 ? (
          <div className="text-[12px] text-faint pb-1">
            {found ? 'Nothing of theirs matches that.' : 'Nothing on this list.'}
          </div>
        ) : (
          <div className={deals.length > SHOW_AT_ONCE
            ? 'max-h-[430px] overflow-y-auto pr-1 border-y border-line-soft' : ''}>
            {deals.map(row)}
          </div>
        )}
      </div>
    )
  })

  return (
    <div className="mb-6">
      {/* ONE GREETING, THEN THE BAR. In that order, at the top of the page -
        * 12 Nov 2026, after the first attempt put the bar halfway down under
        * three panels that should not have been there at all. */}
      <div className="flex items-baseline gap-3 mb-2">
        <h1 className="text-[22px] font-semibold">
          Good morning{meName ? ` ${meName.split(' ')[0]}` : ''}</h1>
        <span className="text-[12px] text-muted">{todayWords}</span>
      </div>

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
        {/* THE PROGRESS ITSELF. Green is in, blue is promised, the rest is
          * what the week still has to find. */}
        <div className="flex-1 min-w-[150px]">
          <div className="h-[9px] rounded-full bg-[#2E2A24] overflow-hidden flex mb-1.5">
            <div className="bg-[#64E8BB]"
              style={{ width: `${Math.min(100, (week.lodged / week.ceiling) * 100)}%` }} />
            <div className="bg-[#6FD3FF]"
              style={{ width: `${Math.min(100 - (week.lodged / week.ceiling) * 100,
                (week.promised / week.ceiling) * 100)}%` }} />
          </div>
          <div className="flex gap-3.5 text-[10.5px] text-[#9A948C] flex-wrap">
            <span><span className="inline-block w-[7px] h-[7px] rounded-sm bg-[#64E8BB] mr-1" />
              {week.lodged} lodged</span>
            <span><span className="inline-block w-[7px] h-[7px] rounded-sm bg-[#6FD3FF] mr-1" />
              {week.promised} promised</span>
            <span><span className="inline-block w-[7px] h-[7px] rounded-sm bg-[#56504A] mr-1" />
              {week.words}</span>
          </div>
        </div>

        <div className="ml-auto text-right">
          <div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]">
            Target</div>
          {/* EDITABLE, BECAUSE A TARGET IS A DECISION AND NOT A FACT.
            * Fabio, 12 Nov 2026: "if we want to target, let's say we start
            * wanting to lodge 15, 20... it's just the target week for the bar." */}
          {editing ? (
            <div className="flex items-center gap-1 justify-end mt-1">
              {(['floor', 'ceiling'] as const).map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i === 1 && <span className="text-[#9A948C] text-[18px]">&ndash;</span>}
                  <input type="number" min={1} max={999} value={target[k]}
                    onChange={e => setTarget(t => ({ ...t, [k]: e.target.value }))}
                    className="w-[58px] text-[20px] font-extrabold bg-[#2E2A24] text-page
                      rounded-md px-2 py-1 text-right" />
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[26px] font-extrabold leading-none text-page mt-1">
              {week.floor}&ndash;{week.ceiling}</div>
          )}
          {canSetTarget ? (
            <button onClick={() => void (editing ? saveTarget() : setEditing(true))}
              disabled={savingTarget}
              className="text-[11px] text-[#6FD3FF] font-semibold mt-1 disabled:opacity-50">
              {savingTarget ? 'Saving...' : editing ? 'Save' : 'a week — change'}
            </button>
          ) : (
            <div className="text-[11px] text-[#9A948C] mt-1">a week</div>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-start flex-wrap lg:flex-nowrap">
      <div className="flex-1 min-w-[420px]">
      <div className="bg-card border border-card-line rounded-xl px-4 py-3.5 mb-3">
        {/* THE BOX IS NAMED FOR THE GROUP IT HOLDS. 13 Nov 2026, Fabio: "the
          * box needs to read Simplify Finance, the bottom box Simplify Finance
          * Brokers." The meeting is what the screen is; the group is whose
          * deals are in it, and that is the heading. */}
        <div className={`${CAP} mb-3 flex items-center gap-2`}>
          {firstTeam}
          <span className="ml-auto text-faint tracking-[0.06em] normal-case font-semibold
            text-[10.5px]">what are we lodging this week</span>
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
        ) : section(mine, true)}
      </div>
      {/* ONE RED LINE, AND ONLY WHEN SOMEBODY IS GENUINELY OVER.
        *
        * Fabio, 12 Nov 2026: "the one thing out of shape, he sits there in red
        * if he needs to be there." The detail lives on Credit team workload;
        * this is the exception, and on a week where nobody is carrying far
        * more than the rest it is not on the page at all. */}
      {overloaded && (
        <div className="bg-chase-bg border border-chase-edge rounded-xl px-4 py-3.5 mb-3">
          <div className={`${CAP} mb-2 text-chase`}>One thing is out of shape</div>
          <div className="bg-card border-l-4 border-chase rounded-lg px-3 py-2.5 flex
            items-center gap-3 flex-wrap">
            <span className="text-[13px] font-bold w-[74px] flex-none">{overloaded.name}</span>
            <span className="text-[11.5px] text-muted leading-snug">
              <b className="text-ink">{overloaded.open} files open</b>, against a team average
              of {overloaded.average}.
              {overloaded.unplanned ? <><br />None of them are on a plan today.</> : null}
            </span>
            <Link href="/credit-team-workload"
              className="ml-auto text-[11px] font-semibold text-brand-ink border border-info-edge
                bg-info-bg rounded-lg px-2.5 py-[3px] whitespace-nowrap">
              Move some off {overloaded.name.split(' ')[0]}
            </Link>
          </div>
        </div>
      )}

      {/* THE OTHER GROUP, AT THE BOTTOM AND ON ITS OWN.
        *
        * Fabio, 12 Nov 2026: "Justin and Keanen are also brokers. So is there
        * any way to have a section for simplify brokers... just a section at
        * the bottom?" It is the group on the broker's own record - see
        * lib/which-team.ts - not a brand, and not a guess from the name. */}
      {(
        <div className="bg-card border border-card-line rounded-xl px-4 py-3.5 mb-3">
          <div className={`${CAP} mb-1 flex items-center gap-2`}>
            {secondTeam}
            <span className="ml-auto text-faint tracking-[0.06em] normal-case font-semibold
              text-[10.5px]">what they think is coming</span>
          </div>
          {theirs.length === 0
            ? <div className="text-[12px] text-faint pt-2">
                Nothing from them on this list.
              </div>
            : section(theirs, false)}
        </div>
      )}
      </div>

      {/* THE TEAM, BESIDE THE MEETING. The box Fabio kept from the old page:
        * who has told management their day, and what is settling. */}
      <div className="w-full lg:w-[316px] lg:flex-none">
        {/* ALWAYS ON THE PAGE. 13 Nov 2026, Fabio: "settling this week box??
          * WHERE IS THIS box - if no deal, no deals, but box is there." An
          * empty box tells you nothing is settling, which is worth knowing. A
          * missing box tells you nothing at all, and makes the page move
          * around week to week. */}
        {(
          <div className="bg-card border border-card-line rounded-xl px-4 py-3.5 mb-3">
            <div className={`${CAP} mb-3 flex items-center gap-2`}>
              The credit team this morning
              <span className="ml-auto text-faint tracking-[0.06em] normal-case font-semibold
                text-[10.5px]">
                {team.filter(t => t.informedAt).length} of {team.length}
              </span>
            </div>
            {team.length === 0 ? (
              <div className="text-[12px] text-faint">No credit assessors set up.</div>
            ) : team.map(t => (
              <div key={t.name}
                className={`rounded-lg px-3 py-2.5 mb-1.5 last:mb-0 border-l-4 ${
                  t.informedAt ? 'bg-done-bg border-done' : 'bg-chase-bg border-chase'}`}>
                <div className="text-[12.5px] font-bold">{t.name}</div>
                <div className="text-[11px] text-muted leading-snug mt-[1px]">
                  {t.informedAt ? (
                    <>
                      <b className="text-ink">Sent {new Date(t.informedAt)
                        .toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</b>
                      <br />{t.yesterdayCount ?? 0} done yesterday &middot; {t.todayCount ?? 0} on today
                    </>
                  ) : (
                    <>
                      <b className="text-ink">Nothing yet</b>
                      <br />{t.open ?? 0} files, none planned
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {(
          <div className="bg-card border border-card-line rounded-xl px-4 py-3.5">
            <div className={`${CAP} mb-2`}>Settling this week</div>
            {settling.length === 0 ? (
              <div className="text-[12px] text-faint">Nothing is booked to settle this week.</div>
            ) : settling.map(x => (
              <div key={x.id}
                className="flex items-center gap-2.5 py-2 border-b border-line-soft last:border-b-0">
                <Link href={`/deals/${x.id}`}
                  className="flex-1 text-[13px] font-semibold hover:underline truncate">{x.name}</Link>
                <span className="text-[11px] text-faint">{x.day}</span>
                <span className="text-[13px] font-bold tabular-nums">{money(x.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
