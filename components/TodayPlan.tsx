'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { dayMonth } from '@/lib/same-date-everywhere'
import { whoHasIt } from '@/lib/who-has-it'
// A broker is never matched by lower-casing a name - brokerKey() takes the
// first word, so "Fabio De Castro".toLowerCase() never equals "fabio".
// See scripts/check-broker-keys.sh, which failed this file on the first run.
import { sameBroker } from '@/lib/broker-key'
import { whyNoPlan, lastWorkdayBefore } from '@/lib/the-week'
import {
  draftDay, finishedOn, finishedAcross, planBoard, notTold, stageWaitingOn, creditHasIt,
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

const live = (d: any) => d?.status !== 'completed' && d?.status !== 'lost'

export default function TodayPlan({
  deals, officers, plans, brokerPlans = [], meOfficerId, meName, today,
  seesAll = false, brokerKey = null, brokerNames = {},
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
}) {
  const supabase = createSupabaseBrowser()
  const view: 'credit' | 'admin' | 'broker' = meOfficerId ? 'credit' : seesAll ? 'admin' : 'broker'
  const myPlan = brokerKey ? brokerPlans.find(p => p.brokerKey === brokerKey) : undefined

  const [saved, setSaved] = useState<string | null>(
    (meOfficerId ? plans.find(p => p.officerId === meOfficerId)?.confirmedAt : myPlan?.confirmedAt) || null)
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
        since: d.credit_assigned_at || d.created_at,
        priority: d.priority || null,
      }))
      .filter(x => x.stage))
  }, [deals, meOfficerId, brokerKey])

  // THE DRAFT, THEN WHATEVER THEY HAVE DONE TO IT SINCE.
  const dayOrder = order ?? startingOrder(mine.map(d => d.id), mySaved?.deals?.map(d => d.id) || null)
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
    const out = new Map<string, { name: string; bc: number; lo: number; compliance: number; total: number }>()
    for (const d of deals.filter(live)) {
      const stage = stageWaitingOn(d)
      if (!stage) continue
      const key = String(d.assigned_broker || '').toLowerCase()
      if (!key) continue
      const row = out.get(key) || { name: named(key), bc: 0, lo: 0, compliance: 0, total: 0 }
      if (stage === 'BC') row.bc++
      else if (stage === 'LO') row.lo++
      else if (stage === 'Compliance') row.compliance++
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

  async function confirm() {
    if (busy || (!meOfficerId && !brokerKey)) return
    setBusy(true); setErr('')
    const when = new Date().toISOString()
    const row: Record<string, any> = {
      plan_date: today,
      // ABOVE THE LINE ONLY. What is below it is the queue, not the day, and
      // saving the queue as the plan is how a day became a book in the first
      // place. See splitAtLine() in lib/the-days-plan.ts.
      deal_ids: todayIds,
      notes, on_it_now: onItNow,
      confirmed_at: when, updated_at: when,
    }
    if (meOfficerId) row.officer_id = meOfficerId
    else row.broker_key = brokerKey
    // A blocked policy returns no rows and no error, so the row is the proof.
    const { data, error } = await supabase.from('daily_plans')
      .upsert(row, { onConflict: meOfficerId ? 'officer_id,plan_date' : 'broker_key,plan_date' })
      .select('id')
    setBusy(false)
    if (error || !data?.length) {
      setErr(error?.message || 'That was not saved — nothing reached the database.')
      return
    }
    setSaved(when)
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
                ? `Told the brokers ${new Date(r.confirmedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} · ${r.count} deals`
                : l?.theirs || `${r.name} has not started yet`}
            </div>
          </div>
        )
      })}
    </Card>
  )

  const waitingBox = elsewhere.length > 0 && (
    <Card>
      <div className={CAP}>Waiting on someone else &mdash; {elsewhere.length}</div>
      {elsewhere.slice(0, 6).map(({ deal, has }) => (
        <Row key={deal.id}>
          <Link href={`/deals/${deal.id}`} className="flex-1 font-semibold hover:underline">{deal.deal_name}</Link>
          <span className={`${PILL} ${has!.style}`}>{has!.label}</span>
        </Row>
      ))}
    </Card>
  )

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

          {view === 'credit' && dayCard}
          {view === 'credit' && (
            <Card>
              <div className={CAP}>Yesterday you finished &mdash; written from what moved</div>
              {yesterday.length === 0
                ? <div className={SOFT}>Nothing closed on {dayMonth(yesterdayDate)}.</div>
                : yesterday.map((y, i) => (
                  <Row key={i}>
                    <span className="text-done">&#10003;</span>
                    <Link href={`/deals/${y.id}`} className="flex-1 font-semibold hover:underline">{y.name}</Link>
                    <span className={SOFT}>{y.what}{y.days !== null ? ` · ${y.days} days on you` : ''}</span>
                  </Row>
                ))}
            </Card>
          )}

          {view === 'broker' && dayCard}
          {view === 'broker' && (
            <Card>
              <div className={CAP}>With credit today &mdash; your files on somebody&rsquo;s plan</div>
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
                  </Row>
                ))}
            </Card>
          )}

          {view === 'admin' && (
            <Card>
              <div className={CAP}>Where the book is this morning</div>
              <div className="flex gap-6 flex-wrap">
                {[['With us', book.us, 'text-info'],
                  ['With the client', book.client, 'text-waiting'],
                  ['With the lender', book.lender, 'text-faint'],
                  ['Nobody has planned', book.unplanned.length, 'text-chase']].map(([label, n, tone]) => (
                  <div key={String(label)} className="min-w-[120px]">
                    <div className="text-[12.5px] text-body font-semibold">{label}</div>
                    <div className={`text-[21px] font-bold ${tone}`}>{n as number}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {view === 'admin' && (
            <Card live>
              <div className={CAP}>With us and on nobody&rsquo;s plan today &mdash; {book.unplanned.length}</div>
              {book.unplanned.length === 0
                ? <div className={SOFT}>Everything with us is in somebody&rsquo;s day.</div>
                : longest.map(({ d }) => {
                  const credit = creditHasIt(d)
                  return (
                    <Row key={d.id}>
                      <Link href={`/deals/${d.id}`} className="flex-1 font-semibold hover:underline">{d.deal_name}</Link>
                      <span className={SOFT}>{credit ? credit.name : `${named(d.assigned_broker)} — broker`}</span>
                      <span className={SOFT}>{stageWaitingOn(d)}
                        {daysSince(d.credit_assigned_at || d.created_at) !== null
                          ? ` · ${daysSince(d.credit_assigned_at || d.created_at)} days` : ''}</span>
                      <span className={PILL_NOT}>Not planned</span>
                    </Row>
                  )
                })}
              {book.unplanned.length > longest.length && (
                <div className={`${SOFT} mt-2`}>oldest first &mdash; and {book.unplanned.length - longest.length} more</div>
              )}
            </Card>
          )}

          {view === 'admin' && (
            <Card>
              <div className={CAP}>By broker &mdash; what is with us right now</div>
              {byBroker.length === 0 ? <div className={SOFT}>Nothing is with us.</div> : byBroker.map(b => (
                <Row key={b.name}>
                  <span className="flex-1 font-semibold">{b.name}</span>
                  <span className={SOFT}>BC {b.bc} &middot; LO {b.lo} &middot; Compliance {b.compliance}</span>
                  <span className={PILL_US}>{b.total} with us</span>
                </Row>
              ))}
            </Card>
          )}

          {(view === 'admin' || view === 'broker') && (
            <Card>
              <div className={CAP}>
                {view === 'admin' ? 'Yesterday, across the business' : 'Yesterday on your deals'}
                &nbsp;&mdash; written from what moved
              </div>
              {(view === 'admin' ? businessYesterday : brokerYesterday).length === 0
                ? <div className={SOFT}>Nothing closed on {dayMonth(yesterdayDate)}.</div>
                : (view === 'admin' ? businessYesterday : brokerYesterday).slice(0, 8).map((y, i) => (
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
          {teamBox}
          {waitingBox}
        </div>
      </div>
    </div>
  )
}
