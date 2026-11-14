'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import AskForThisNext from '@/components/AskForThisNext'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { dayMonth, OFFICE } from '@/lib/same-date-everywhere'
import BrokerWeek from '@/components/BrokerWeek'
import WhereMyDealsAre from '@/components/WhereMyDealsAre'
import { askAbout } from '@/lib/the-brokers-monday'
import TheOrderCame from '@/components/TheOrderCame'
import { whoHasIt } from '@/lib/who-has-it'
import { isFinished } from '@/lib/deal-phase'
import { whichToday, type TodayView } from '@/lib/which-today'
import { daysWaiting, waitedWords, oldestFirst } from '@/lib/how-long-waiting'
// A broker is never matched by lower-casing a name - brokerKey() takes the
// first word, so "Fabio De Castro".toLowerCase() never equals "fabio".
// See scripts/check-broker-keys.sh, which failed this file on the first run.
import { sameBroker } from '@/lib/broker-key'
import { whyNoPlan, lastWorkdayBefore } from '@/lib/the-week'
import YesterdayDid from '@/components/YesterdayDid'
import {
  stillOwed, whereSheIsUpTo, yesterdayShown, type Added as DoneAdded,
} from '@/lib/the-morning-three'
import {
  draftDay, finishedOn, finishedAcross, planBoard, notTold, stageWaitingOn, creditHasIt,
  reworkWaiting, askWaiting, stageOpenedAt,
  startingOrder, splitAtLine, withNote,
  type PlanDeal, type Plan,
} from '@/lib/the-days-plan'
import MyDay, { type DayDeal } from '@/components/MyDay'

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
//
// ---------------------------------------------------------------------------
// THREE PEOPLE OPEN THIS PAGE, AND IT WAS ONLY EVER BUILT FOR ONE.
//
// 23 Oct 2026, the morning after it shipped. Fabio opened his own Today and
// sent a screenshot: "yeah look at mine!" Every box on the page was written
// "only if you are a credit assessor", and he is not one. He got a greeting, a
// team panel floating on the right, and half a screen of nothing.
//
// So there are three views now, and they answer three different questions:
//
//   CREDIT  - what am I doing today, and what did I finish yesterday
//   BROKER  - what is sitting with me, and who in credit has my files
//   ADMIN   - where is the book, and what is nobody doing anything about
//
// ADMIN WINS WHERE SOMEBODY IS BOTH. Fabio, Mark and Kylie are brokers who are
// also admins; his words, 23 Oct: "a broker /admin, admin view supersedes".
// A credit assessor who is also an admin still gets the credit view, because
// they have a day of their own to agree to and nobody else can do it for them.

type Officer = { id: string; name: string }

/** A broker's own plan row. Same table as credit's, keyed by broker instead. */
export type BrokerPlan = {
  brokerKey: string
  yesterdayOkAt?: string | null
  informedAt?: string | null
  yesterdayAdded?: Array<{ id: string; name: string; what: string }>
  yesterdayRemoved?: string[]
  confirmedAt: string | null
  dealIds: string[]
  notes?: Record<string, string>
  onItNow?: string | null
}

const SOFT = 'text-[12px] text-muted'
const CAP = 'text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted mb-3'
const PILL = 'text-[10.5px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap border'
const PILL_US = `${PILL} bg-info-bg text-info border-info-edge`
const PILL_OK = `${PILL} bg-done-bg text-done border-done-edge`
const PILL_NOT = `${PILL} bg-chase-bg text-chase border-chase-edge`

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5 py-2 border-b border-line-soft last:border-b-0 text-[13.5px]">{children}</div>
}

function Card({ children, live }: { children: React.ReactNode; live?: boolean }) {
  return (
    <div className={`bg-card rounded-xl px-5 py-4 mb-3 ${live ? 'border-2 border-ink' : 'border border-card-line'}`}>
      {children}
    </div>
  )
}

// ONE TEST FOR "IS THIS DEAL STILL ALIVE", AND IT IS NOT THIS FILE'S OWN.
//
// 12 Nov 2026. This file had its own: status is not 'completed' and not
// 'lost'. Nothing has ever written 'completed', so it only ever excluded lost
// deals and every settled deal went on being counted as work. Meanwhile the
// deal board four inches above used isFinished(), which reads the timestamps.
// One page, two answers, eleven deals apart.
//
// Fabio, on being shown it: "we're now working on building statistics and
// analysis for the business... this needs to be 100% accurate."
//
// isFinished() is the honest one and it is now the only one.
const live = (d: any) => !isFinished(d)

export default function TodayPlan({
  deals, officers, plans, brokerPlans = [], meOfficerId, meName, today,
  seesAll = false, brokerKey = null, brokerNames = {}, greeting = true,
  readOnly = false,
}: {
  deals: any[]
  officers: Officer[]
  plans: Plan[]
  /** The brokers' own plans for today. See docs/brokers-plan-their-day.sql. */
  brokerPlans?: BrokerPlan[]
  /** Set when the person looking is a credit assessor. */
  meOfficerId: string | null
  meName: string
  /** ISO date, from the server, so the browser's clock cannot disagree. */
  today: string
  /** auth_sees_all_deals() - the admin flag, already asked by the page. */
  seesAll?: boolean
  /** Their broker key, when they are a broker. */
  brokerKey?: string | null
  /** key -> proper name. The key is lower case by design and is never shown. */
  brokerNames?: Record<string, string>
  /** False where the page has already said good morning. */
  greeting?: boolean
  /** Somebody is LOOKING at this person's day rather than living it.
   *  12 Nov 2026 - the three presses are an answer a credit assessor gives
   *  management about her own morning. Pressing one as her would file a plan
   *  she never agreed to. See lib/view-as.ts. */
  readOnly?: boolean
}) {
  const supabase = createSupabaseBrowser()
  // THE RULE IS IN ONE PLACE NOW - lib/which-today.ts. It used to live on
  // this line, and the dashboard page could not reach it, so it guessed with
  // a different question and bolted the business dashboard under a broker's
  // Today. 15 Nov 2026.
  const view: TodayView = whichToday(meOfficerId, seesAll)
  const myPlan = brokerKey ? brokerPlans.find(p => p.brokerKey === brokerKey) : undefined
  // THE ROW THAT IS THEIRS, whichever table it came from.
  const myRow: any = meOfficerId ? plans.find(p => p.officerId === meOfficerId) : myPlan

  const [saved, setSaved] = useState<string | null>(
    (meOfficerId ? plans.find(p => p.officerId === meOfficerId)?.confirmedAt : myPlan?.confirmedAt) || null)
  // THE OTHER TWO OF THE THREE. See lib/the-morning-three.ts.
  const [yOk, setYOk] = useState<string | null>(myRow?.yesterdayOkAt || null)
  const [informed, setInformed] = useState<string | null>(myRow?.informedAt || null)
  const [yAdded, setYAdded] = useState<DoneAdded[]>(myRow?.yesterdayAdded || [])
  const [yRemoved, setYRemoved] = useState<string[]>(myRow?.yesterdayRemoved || [])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const now = new Date()

  // THE DAY, AS THIS PERSON HAS ARRANGED IT.
  //
  // One array with the line in it - see LINE in lib/the-days-plan.ts. Starts
  // as everything drafted with the line at the bottom, and from there it is
  // theirs: drag a deal, drag the line, cross one off. Nothing is deleted.
  const mySaved = meOfficerId
    ? plans.find(p => p.officerId === meOfficerId)
    : myPlan ? { deals: myPlan.dealIds.map(id => ({ id })), notes: myPlan.notes, onItNow: myPlan.onItNow } : undefined
  const [order, setOrder] = useState<string[] | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>((mySaved as any)?.notes || {})
  const [onItNow, setOnItNow] = useState<string | null>((mySaved as any)?.onItNow || null)

  const named = (key: any) => brokerNames[String(key || '').toLowerCase()] || String(key || '')

  // MINE, DRAFTED. Only the deals where somebody here has to do something -
  // a deal sitting with a client is not today's work, and the column on the
  // right is where it goes instead.
  //
  // A BROKER'S DAY LEAVES OUT WHAT CREDIT IS CARRYING. If Katie has the BC,
  // that deal is on Katie's list, and putting it on the broker's as well would
  // have the same file counted twice on one screen by two people.
  const mine = useMemo<PlanDeal[]>(() => {
    const base = meOfficerId
      ? deals.filter(d => d.assigned_credit_officer === meOfficerId)
      : brokerKey
        ? deals.filter(d => sameBroker(d.assigned_broker, brokerKey))
               .filter(d => !creditHasIt(d))
        : []
    return draftDay(base
      .filter(live)
      .map(d => ({
        id: d.id, name: d.deal_name, stage: stageWaitingOn(d) || '',
        // CHRONOLOGICAL BY WHEN THE STAGE OPENED, not by when the deal was
        // handed to this person. See stageOpenedAt() - 12 Nov 2026.
        since: stageOpenedAt(d) || d.credit_assigned_at || d.created_at,
        // TODAY'S ASK ONLY. Yesterday's slot is not today's - see askOn() in
        // lib/a-slot-each.ts, which is also why this stopped being d.priority.
        priority: askWaiting(d, today),
        broker: d.assigned_broker || '',
        // A DEAL A BROKER SENT BACK GOES TO THE TOP. See draftDay().
        rework: reworkWaiting(d),
      }))
      .filter(x => x.stage))
  }, [deals, meOfficerId, brokerKey])

  // THE DRAFT, THEN WHATEVER THEY HAVE DONE TO IT SINCE.
  // A CREDIT ASSESSOR'S DAY OPENS EMPTY and she pulls up what she is doing.
  // See startingOrder() - 12 Nov 2026, on an assessor holding fourteen files.
  const dayOrder = order ?? startingOrder(
    mine.map(d => d.id), mySaved?.deals?.map(d => d.id) || null, view === 'credit')
  const todayIds = splitAtLine(dayOrder).today

  // YESTERDAY IS THE LAST DAY ANYBODY WAS AT WORK, which on a Monday is
  // Friday. See lib/the-week.ts - this used to be one calendar day back, so
  // every Monday looked at a Sunday and reported that nothing had happened.
  const yesterdayDate = useMemo(() => lastWorkdayBefore(today), [today])
  const yesterday = useMemo(
    () => meOfficerId ? finishedOn(deals, meOfficerId, yesterdayDate) : [],
    [deals, meOfficerId, yesterdayDate])

  const elsewhere = useMemo(() => deals
    .filter(d => meOfficerId
      ? d.assigned_credit_officer === meOfficerId
      : sameBroker(d.assigned_broker, brokerKey))
    .filter(live)
    .map(d => ({ deal: d, has: whoHasIt(d) }))
    .filter(x => x.has && x.has.holder !== 'us'), [deals, meOfficerId, brokerKey])

  const board = planBoard(plans)
  const late = notTold(plans, now, today)
  const mineLate = late.find(l => l.officerId === meOfficerId)

  // WHAT IS ON SOMEBODY'S PLAN TODAY. One set, asked by both new views.
  const plannedIds = useMemo(() => {
    const out = new Set<string>()
    for (const p of plans) if (p.confirmedAt) for (const d of p.deals) out.add(d.id)
    for (const p of brokerPlans) if (p.confirmedAt) for (const id of p.dealIds) out.add(id)
    return out
  }, [plans, brokerPlans])

  // A BROKER'S FILES THAT CREDIT IS CARRYING, and whether the person carrying
  // one has put it in their day. The red chip is the whole point of the box.
  const withCredit = useMemo(() => deals
    .filter(d => sameBroker(d.assigned_broker, brokerKey))
    .filter(live)
    .map(d => ({ deal: d, credit: creditHasIt(d), stage: stageWaitingOn(d) }))
    .filter(x => x.credit && x.stage), [deals, brokerKey])

  // ---- the admin view -----------------------------------------------------
  const book = useMemo(() => {
    const all = deals.filter(live).map(d => ({ d, has: whoHasIt(d) })).filter(x => x.has)
    const us = all.filter(x => x.has!.holder === 'us')
    return {
      us: us.length,
      client: all.filter(x => x.has!.holder === 'client').length,
      lender: all.filter(x => x.has!.holder === 'lender').length,
      unplanned: us.filter(x => !plannedIds.has(x.d.id)).map(x => x.d),
    }
  }, [deals, plannedIds])

  const byBroker = useMemo(() => {
    // FACT FIND WAS COUNTED AND NEVER SHOWN.
    //
    // 12 Nov 2026. stageWaitingOn() returns 'Fact Find' as well as BC, LO and
    // Compliance, and the total counted all four while the line printed three.
    // So the row could read "BC 21 - LO 0 - Compliance 0" beside "22 with us".
    // A row that does not add up teaches people to distrust the whole panel.
    //
    // Counted by its own name now, and only the stages with something in them
    // are printed - two permanent noughts across two thirds of the line was
    // the other half of why nobody read it.
    const out = new Map<string, {
      name: string; stages: Record<string, number>; total: number
    }>()
    for (const d of deals.filter(live)) {
      const stage = stageWaitingOn(d)
      if (!stage) continue
      const key = String(d.assigned_broker || '').toLowerCase()
      if (!key) continue
      const row = out.get(key) || { name: named(key), stages: {}, total: 0 }
      row.stages[stage] = (row.stages[stage] || 0) + 1
      row.total++
      out.set(key, row)
    }
    return [...out.values()].sort((a, b) => b.total - a.total)
  }, [deals, brokerNames])

  const longest = useMemo(() => book.unplanned
    .map(d => ({ d, since: d.credit_assigned_at || d.created_at }))
    .sort((a, b) => new Date(a.since || 0).getTime() - new Date(b.since || 0).getTime())
    .slice(0, 5), [book.unplanned])

  const businessYesterday = useMemo(
    () => view === 'admin' ? finishedAcross(deals, yesterdayDate) : [],
    [deals, yesterdayDate, view])

  const brokerYesterday = useMemo(
    () => view === 'broker'
      ? finishedAcross(deals.filter(d => sameBroker(d.assigned_broker, brokerKey)), yesterdayDate)
      : [], [deals, brokerKey, yesterdayDate, view])

  const daysSince = (v: any) => {
    const t = v ? new Date(v).getTime() : 0
    if (!t) return null
    return Math.round(((now.getTime() - t) / 86_400_000) * 10) / 10
  }

  // ONE WRITE, THREE REASONS TO MAKE IT.
  //
  // 12 Nov 2026. The morning is three presses now, and all three land on the
  // same daily_plans row - so they go through one function rather than three
  // that each have their own idea of what the key is. See
  // lib/the-morning-three.ts for why they are separate at all.
  // HIS WHOLE BOOK, AND THE PART OF IT WORTH ASKING ABOUT.
  //
  // NOT `mine` above. That one deliberately leaves out whatever credit is
  // carrying, so a file is not counted twice on one screen. Where my deals are
  // is the opposite question - it exists to show him which of our credit team
  // is holding each file, which is what he currently rings up to ask.
  const wholeBook = useMemo(
    () => brokerKey ? deals.filter(d => sameBroker(d.assigned_broker, brokerKey)) : [],
    [deals, brokerKey])
  const askThisWeek = useMemo(
    () => askAbout(deals, brokerKey, sameBroker), [deals, brokerKey])
  const officerName = (id: any) =>
    officers.find(o => o.id === String(id ?? ''))?.name || ''

  async function save(patch: Record<string, any>): Promise<boolean> {
    // NOT YOUR DAY, NOT YOUR ANSWER. One guard, at the single door that every
    // press goes through, rather than a disabled attribute on each button -
    // a disabled button is a style, and this has to be a rule.
    if (readOnly) return false
    if (busy || (!meOfficerId && !brokerKey)) return false
    setBusy(true); setErr('')
    const row: Record<string, any> = { plan_date: today, updated_at: new Date().toISOString(), ...patch }
    if (meOfficerId) row.officer_id = meOfficerId
    else row.broker_key = brokerKey
    // A blocked policy returns no rows and no error, so the row is the proof.
    const { data, error } = await supabase.from('daily_plans')
      .upsert(row, { onConflict: meOfficerId ? 'officer_id,plan_date' : 'broker_key,plan_date' })
      .select('id')
    setBusy(false)
    if (error || !data?.length) {
      setErr(error?.message || 'That was not saved — nothing reached the database.')
      return false
    }
    return true
  }

  // 1 - WHAT SHE DID YESTERDAY. Her corrections are stored AS corrections,
  // never written over what the portal saw, so the two can be compared.
  async function confirmYesterday() {
    const when = new Date().toISOString()
    if (await save({
      yesterday_ok_at: when, yesterday_added: yAdded, yesterday_removed: yRemoved,
    })) setYOk(when)
  }

  // 3 - AND MANAGEMENT HEARS ABOUT IT. Not the brokers: Fabio, 12 Nov 2026,
  // "I never say tell the brokers, it's inform management."
  async function inform() {
    const when = new Date().toISOString()
    if (await save({ informed_at: when })) setInformed(when)
  }

  // 2 - AND THIS IS MY DAY.
  //
  // ABOVE THE LINE ONLY. What is below it is the queue, not the day, and
  // saving the queue as the plan is how a day became a book in the first
  // place. See splitAtLine() in lib/the-days-plan.ts.
  async function confirm() {
    const when = new Date().toISOString()
    if (await save({ deal_ids: todayIds, notes, on_it_now: onItNow, confirmed_at: when })) {
      setSaved(when)
    }
  }

  // NOTHING ON A SATURDAY, AND NOTHING ON A PUBLIC HOLIDAY.
  //
  // Fabio, 23 Oct 2026: "there is weekends. So don't do that on the weekend.
  // So it's 7:30 Monday to Friday." Asked what a weekend should show, he chose
  // nothing at all - so the whole morning plan comes off the page and the
  // dashboard underneath carries on as normal. Without this, Saturday morning
  // tells four people they have not told the brokers their day, and keeps
  // counting how late they are until Monday. See lib/the-week.ts.
  if (whyNoPlan(today)) return null

  const dayCard = (
    <MyDay
      deals={mine.map(d => ({ ...d, days: daysSince(d.since) })) as DayDeal[]}
      order={dayOrder}
      setOrder={setOrder}
      notes={notes}
      setNote={(id, text) => setNotes(n => withNote(n, id, text))}
      onItNow={onItNow}
      setOnItNow={setOnItNow}
      saved={saved}
      busy={busy}
      onConfirm={confirm}
      heading={view === 'credit' ? '2 — Today, in this order' : 'Today, in this order'}
    />
  )

  const teamBox = (
    <Card>
      <div className={CAP}>The team today</div>
      {board.length === 0 ? <div className={SOFT}>No credit assessors set up.</div> : board.map(r => {
        const l = late.find(x => x.officerId === r.officerId)
        return (
          <div key={r.officerId}
            className={`rounded-lg px-3 py-2.5 mb-1.5 last:mb-0 border-l-4 ${
              r.confirmedAt ? 'bg-done-bg border-done' : l?.level === 'flag' ? 'bg-chase-bg border-chase' : 'bg-line-soft border-faint'}`}>
            <div className="text-[13.5px] font-semibold">{r.name}{r.officerId === meOfficerId ? ' — you' : ''}</div>
            <div className="text-[11.5px] text-muted leading-snug">
              {r.confirmedAt
                ? `Told the brokers ${new Date(r.confirmedAt).toLocaleTimeString('en-AU', { timeZone: OFFICE, hour: 'numeric', minute: '2-digit' })} · ${r.count} deals`
                : l?.theirs || `${r.name} has not started yet`}
            </div>
          </div>
        )
      })}
    </Card>
  )

  // TELL MANAGEMENT, NOT WATCH THE TEAM.
  //
  // 12 Nov 2026. Fabio: "the team today, you don't need to show Mellissa and
  // anyone else. So a credit assessor just works on their file. There should
  // be something on the right-hand side that says to remind them to share
  // their day with management."
  //
  // The board of who has and has not told the brokers is a management view and
  // it stays on the admin screen. What an assessor needs here is whether SHE
  // has, and the button that does it is on the left.
  const where = whereSheIsUpTo({
    yesterdayOkAt: yOk, daySavedAt: saved, sentAt: informed,
  })
  const owed = stillOwed(where)

  // THREE - AND IT NEVER INVITES A PRESS IT WOULD REFUSE.
  //
  // 12 Nov 2026. Fabio: "there should be something on the right-hand side that
  // says to remind them to share their day with management... make it fucking
  // intuitive." The reminder is not a sentence telling her off - it is a list
  // of what is still owed and a button that says, truthfully, that nothing has
  // gone anywhere yet.
  const tellBox = (
    <Card>
      <div className={CAP}>3 &mdash; Inform management</div>
      {[
        { n: '1', label: 'Yesterday', done: where.yesterday, at: yOk },
        { n: '2', label: 'Today', done: where.today, at: saved },
      ].map(step => (
        <div key={step.n}
          className="flex items-center gap-2.5 py-2.5 border-b border-line-soft last:border-b-0">
          <span className={`w-5 h-5 rounded-full text-[11px] font-bold leading-5 text-center
            flex-none ${step.done ? 'bg-done text-white' : 'bg-line-soft text-faint'}`}>
            {step.done ? '\u2713' : step.n}
          </span>
          <span className="text-[12.5px] text-muted">
            <b className="text-ink font-semibold">{step.label}</b>
            {step.done && step.at
              ? ` — confirmed ${new Date(step.at).toLocaleTimeString('en-AU', { timeZone: OFFICE, hour: 'numeric', minute: '2-digit' })}`
              : ' — not confirmed'}
          </span>
        </div>
      ))}
      {where.sent ? (
        <div className="mt-3 text-[13px] text-done bg-done-bg border border-done-edge rounded-[10px]
          px-3 py-2.5 text-center font-semibold">
          &#10003; {where.label} &mdash;{' '}
          {new Date(informed!).toLocaleTimeString('en-AU', { timeZone: OFFICE, hour: 'numeric', minute: '2-digit' })}
        </div>
      ) : (
        <button onClick={() => void inform()} disabled={!where.ready || busy}
          className={`mt-3 w-full text-[13.5px] font-bold rounded-[10px] px-3 py-2.5 ${
            where.ready ? 'bg-ink text-page' : 'bg-line-soft text-faint border border-line'}`}>
          {busy ? 'Sending...' : where.label}
        </button>
      )}
      {owed.length > 0 && (
        <div className="mt-2 text-[11.5px] text-faint leading-relaxed">
          Still to do: {owed.join(', ').toLowerCase()}.
        </div>
      )}
    </Card>
  )

  const waitingBox = elsewhere.length > 0 && (
    <Card>
      {/* WHOSE DEALS. 12 Nov 2026: this counts only the deals of whoever is
        * signed in, while "Where the book is" four inches above counts the
        * whole team - and neither said so, so the two numbers looked like
        * they disagreed. They never did; they were answering different
        * questions with the same words. */}
      {/* A CHASE LIST, AND IT NEEDS AGES. 15 Nov 2026.
        *
        * These are the deals nobody inside the business can move - they are
        * with a client, a valuer or a lender. Only the broker can shift them,
        * which makes this a chase list rather than a status list.
        *
        * It said "Client" and nothing else. "Client" is a category. "Client,
        * 6 days" is a phone call. A broker chases on age, not on kind.
        *
        * OLDEST FIRST AND NOTHING RED. A deal eleven days with a valuer is
        * not his fault, and a red chip reads as though it were. The order
        * carries the same information without the accusation.
        * See lib/how-long-waiting.ts. */}
      <div className={CAP}>
        {meOfficerId ? 'Yours, waiting on someone else'
          : view === 'broker' ? 'Chase these — waiting on somebody outside'
          : 'Your deals, waiting on someone else'}
        {' '}&mdash; {elsewhere.length}
      </div>
      {oldestFirst(elsewhere, r => r.deal, now).slice(0, 6).map(({ deal, has }) => (
        <Row key={deal.id}>
          <Link href={`/deals/${deal.id}`} className="flex-1 font-semibold hover:underline">{deal.deal_name}</Link>
          <span className={`${PILL} ${has!.style}`}>{has!.label}</span>
          <span className="whitespace-nowrap text-[11.5px] tabular-nums text-muted">
            {waitedWords(daysWaiting(deal, now))}
          </span>
        </Row>
      ))}
    </Card>
  )

  return (
    <div className="mb-6">
      {/* ONE GREETING A PAGE. 12 Nov 2026, Fabio: "Why there's so many
        * fucking good mornings?" On an admin page the greeting is rendered
        * once, above the week's bar, and this one stands down. */}
      {greeting && (
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-[22px] font-semibold">Good morning{meName ? ` ${meName.split(' ')[0]}` : ''}</h1>
          <span className={SOFT}>{dayMonth(today)}</span>
        </div>
      )}

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

          {view === 'credit' && (
            <YesterdayDid
              found={yesterday as any}
              deals={deals.map(d => ({ id: d.id, deal_name: d.deal_name }))}
              added={yAdded}
              removed={yRemoved}
              setAdded={setYAdded}
              setRemoved={setYRemoved}
              savedAt={yOk}
              busy={busy}
              onConfirm={() => void confirmYesterday()}
              dayWords={dayMonth(yesterdayDate)}
            />
          )}
          {/* MANAGEMENT CHANGED YOUR ORDER.
            *
            * 12 Nov 2026, Fabio: "Credit never disagrees with the order... if
            * I give the order, they follow the order." And 14 Nov, on what she
            * does about it: "I don't want her to have to agree to it... she
            * does confirm that she understands the changes."
            *
            * So Got it means SEEN. Her day keeps whatever tick it had and
            * there is nothing to accept. It sits above the three presses
            * because it is part of the day she was already going to answer,
            * not a notification beside it. See components/TheOrderCame.tsx. */}
          {view === 'credit' && !readOnly && meOfficerId && myRow && (
            <TheOrderCame plan={myRow} hers={(myRow?.dealIds || []).map(String)}
              officerId={meOfficerId} onSeen={() => window.location.reload()} />
          )}
          {view === 'credit' && dayCard}

          {/* THE MONDAY ASK, AND IT IS THE WHOLE POINT OF THIS PAGE.
            *
            * 12 Nov 2026, mocked and approved. His answers are exactly what
            * fills the Simplify Finance Brokers section of the run-through -
            * same three buttons, same three answers, written by the same
            * function. Nobody types anything twice.
            * See components/BrokerWeek.tsx and lib/the-brokers-monday.ts. */}
          {view === 'broker' && !readOnly && <BrokerWeek deals={askThisWeek} />}
          {view === 'broker' && readOnly && askThisWeek.length > 0 && (
            <div className="mb-3 rounded-xl border-2 border-ink bg-card px-4 py-3.5">
              <div className={CAP}>It is Monday &mdash; what is coming this week?</div>
              <div className={SOFT}>
                {askThisWeek.length} deals. Only {meName.split(' ')[0] || 'they'} can answer these.
              </div>
            </div>
          )}

          {/* WHAT WE ARE DOING WITH HIS FILES, which is the thing a
            * self-employed broker cannot see today and rings up to ask. */}
          {view === 'broker' && (
            <WhereMyDealsAre deals={wholeBook} officerName={officerName} />
          )}

          {/* NO DAY LIST FOR A BROKER. 15 Nov 2026.
            *
            * Credit has one because the business assigns them a day and they
            * confirm it. Nobody assigns Keanen a day - he is self-employed.
            * So it was a to-do list he had to maintain himself, on a screen
            * that should be read rather than managed. */}
          {view === 'broker' && (
            <Card>
              {/* 15 Nov 2026: was "With credit today - your files on somebody's plan",
                which does not say whose files or what is happening to them. This
                card exists to stop the "is anyone actually on this?" phone call. */}
              <div className={CAP}>What credit is doing on your files today</div>
              {withCredit.length === 0
                ? <div className={SOFT}>Credit is not carrying anything of yours.</div>
                : withCredit.map(({ deal, credit, stage }) => (
                  <Row key={deal.id}>
                    <Link href={`/deals/${deal.id}`} className="flex-1 font-semibold hover:underline">{deal.deal_name}</Link>
                    <span className={SOFT}>{credit!.name}</span>
                    <span className={SOFT}>{stage}</span>
                    <span className={plannedIds.has(deal.id) ? PILL_OK : PILL_NOT}>
                      {plannedIds.has(deal.id) ? 'On their plan' : 'Not on today’s plan'}
                    </span>
                    {/* ASK FOR THIS ONE NEXT. 27 Oct 2026, Catherine's item 2.
                        It belongs here because this box is already the list of
                        your files somebody else is carrying - the exact moment
                        a broker thinks "that one, today". One a day; see
                        lib/a-slot-each.ts. */}
                    {brokerKey && (
                      <AskForThisNext deal={deal} deals={deals} brokerKey={brokerKey}
                        onDone={() => window.location.reload()} />
                    )}
                  </Row>
                ))}
            </Card>
          )}

          {/* THREE ADMIN PANELS WENT FROM HERE ON 12 Nov 2026.
            *
            * Where the book is this morning, With us and on nobody's plan, and
            * By broker. Fabio, looking at his own Today page: "all these data,
            * I don't know if I like it. It's just a data overload... Live
            * deals 130, fact find 13. It's just a waste of time."
            *
            * He is right, and the reason is sharper than taste: none of the
            * three was a thing you could do anything about at 9am. Counting
            * the book is what Pipeline is for; counting what lodged is what
            * Lodged and settled is for. Today is for running today - the
            * meeting, the target, and the team. See components/RunThrough.tsx.
            *
            * The one number worth acting on is still here: somebody carrying
            * far more than the team average, which shows as one line and only
            * when it is true. */}
          {/* YESTERDAY, ACROSS THE BUSINESS went from the admin page on
            * 12 Nov 2026. What the credit team closed yesterday is on each of
            * their rows in The credit team this morning, where it belongs to a
            * person rather than floating as a list. A broker keeps theirs. */}
          {view === 'broker' && (
            <Card>
              <div className={CAP}>
                Yesterday on your deals
                &nbsp;&mdash; written from what moved
              </div>
              {brokerYesterday.length === 0
                ? <div className={SOFT}>Nothing closed on {dayMonth(yesterdayDate)}.</div>
                : brokerYesterday.slice(0, 8).map((y, i) => (
                  <Row key={i}>
                    <span className="text-done">&#10003;</span>
                    <Link href={`/deals/${y.id}`} className="flex-1 font-semibold hover:underline">{y.name}</Link>
                    <span className={SOFT}>{y.what}{y.who ? ` · ${y.days !== null ? `${y.days} days on ` : ''}${y.who}` : ''}</span>
                  </Row>
                ))}
            </Card>
          )}
        </div>

        <div className="w-full lg:w-[330px] lg:flex-none">
          {/* START SOMETHING. 12 Nov 2026, Fabio: the New deal card button
            * "must work" - so it opens the form rather than dropping somebody
            * on the deals list to hunt for it. See app/(app)/deals/page.tsx. */}
          {view === 'broker' && !readOnly && (
            <Card>
              <div className={CAP}>Start something</div>
              <Link href="/deals?new=1"
                className="inline-block rounded-[9px] bg-brand-ink px-3.5 py-2 text-[12.5px]
                           font-bold text-page">
                + New deal card
              </Link>
              <p className="mt-2 text-[11.5px] text-faint">
                It lands on your name and in our queue.
              </p>
            </Card>
          )}
          {/* THE CREDIT ROSTER IS NOT A BROKER'S BUSINESS. 15 Nov 2026.
            *
            * teamBox names every credit assessor and whether she has told the
            * brokers her day yet. It reached a broker only because this line
            * said "credit gets one box, everybody else gets the other" - a
            * default nobody chose. A self-employed broker should not be shown
            * who on your team is behind. */}
          {view === 'credit' ? tellBox : view === 'admin' ? teamBox : null}
          {waitingBox}
        </div>
      </div>
    </div>
  )
}
