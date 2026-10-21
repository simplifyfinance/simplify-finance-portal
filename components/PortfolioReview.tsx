'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { money } from '@/lib/money'
import { SkelRows, SkelTile } from '@/components/Skeleton'
import BookImport from '@/components/BookImport'
import ReviewFigures from '@/components/ReviewFigures'
import {
  STAGES, stageLabel, outcomeLabel, countsFor, sortForTheList,
  dueState, whenDue, fullName, type Stage,
  usableForTheList, loanIsUnknown,
} from '@/lib/portfolio-review'
import {
  planFor, writeFor, monthName, asAtShort,
  type Holding, type TrailLine, type Plan, type Change,
} from '@/lib/refresh-balances'

// THE PORTFOLIO REVIEW LIST.
//
// 15 Oct 2026. Existing clients who may be sitting on equity. Fabio runs the
// numbers; this holds the list and remembers where each one got to.
//
// IT READS A VIEW, NOT THE WHOLE BOOK.
//
// The two tabs next door - Rate exposure and LVR exposure - pull every client
// row into the browser and unpack position_properties in Javascript. That is
// why a property value with a comma in it once knocked rows off the LVR report
// silently: Number('620,000') is NaN, the LVR came out null, and the row was
// filtered away without a word.
//
// portfolio_review_list does the counting in SQL, where the money is already
// numeric. Nothing below adds up a figure that came out of a JSON column.

type Row = {
  review_id: string
  client_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  book_broker_key: string | null
  opted_out: boolean
  status: Stage
  outcome: string | null
  reviewed_at: string | null
  next_review_date: string | null
  email_sent_at: string | null
  linked_deal_id: string | null
  properties: number
  investment_properties: number
  usable_equity: number | null
  calls: number
  last_contact: string | null
  due_on: string | null
  // 19 Oct 2026. The book's own name, for the people who are not clients - see
  // docs/portfolio-review-stands-alone.sql.
  book_name: string | null
}

// ONE PROPERTY, AS THE BOOK HAS IT.
type Prop = {
  // Needed to say WHICH property the equity comes out of - see ReviewFigures.
  id: string
  review_id: string
  ordinal: number
  address: string
  investor: boolean
  original_value: number | null
  original_loan: number | null
  current_balance: number | null
  balance_as_at: string | null
  loan_ref: string | null
  estimated_current_value: number | null
  usable_equity: number | null
  lender_raw: string | null
}

// WHAT THE ROW IS TRIAGED ON.
//
// Fabio, 19 Oct 2026: "All I need is the name of the client, the property
// address, the loan amount, the LVR, the security address." The list had a
// property count and nothing about the money, so 656 rows all looked the same
// and every one had to be opened to find out whether it was worth opening.
//
// OWNER OCCUPIED IS SHOWN AND NOT COUNTED - the same rule the schema sets on
// portfolio_review_properties. You need the whole portfolio to have the
// conversation; counting the home's equity inflates the figure and the email
// that goes out would be wrong.
//
// THE CURRENT FIGURE WINS WHERE THERE IS ONE. The balance keeps itself up to
// date from the commission statements, and a valuation somebody looked up by
// hand beats the settlement value. Where neither exists this is the book's
// own history, which is what Fabio asked for: "LVR against settlement value is
// fine because that's the information that we have."
export type Figures = {
  loan: number; value: number; lvr: number | null; usable: number | null
  /** No loan recorded against ANY counted property, so the equity is a guess. */
  loanUnknown: boolean
  /** The statement month behind the loan figure, where every part of it has one. */
  asAt: string | null
  first: string; more: number; count: number
}

export function figuresFor(props: Prop[] | undefined): Figures {
  const all = props || []
  const counted = all.filter(p => p.investor)
  const loan = counted.reduce((t, p) => t + (p.current_balance ?? p.original_loan ?? 0), 0)
  const value = counted.reduce((t, p) => t + (p.estimated_current_value ?? p.original_value ?? 0), 0)
  // A recorded figure is somebody's decision and is never recalculated over.
  // Only where nobody has worked one out is 80% of value less what is owed
  // used, which is the shortlist rule and not an answer.
  const recorded = counted.filter(p => p.usable_equity !== null)
  // THE SUMMARY CANNOT CLAIM MORE THAN THE ROWS UNDER IT.
  //
  // 21 Oct 2026. Where no counted property has a loan recorded, this was
  // reading the missing loans as zero and reporting 80% of the value as
  // equity - a figure the rows underneath now refuse to show. The client line
  // says so instead, and sorts on nothing.
  const loanUnknown = counted.length > 0 && counted.every(loanIsUnknown)
  // WHEN THE LOAN FIGURE WAS LAST TRUE.
  //
  // 21 Oct 2026. Only where EVERY counted property carries a dated balance.
  // One property refreshed and one still on the book's figure makes a total
  // that was never true on any date, and a date under it would be a claim
  // nobody could stand behind. The oldest of them, because a total is only as
  // current as its stalest part.
  const dated = counted.filter(p => !!p.balance_as_at && p.current_balance !== null)
  const asAt = counted.length > 0 && dated.length === counted.length
    ? dated.map(p => String(p.balance_as_at)).sort()[0]
    : null
  const usable = recorded.length > 0
    ? recorded.reduce((t, p) => t + (p.usable_equity as number), 0)
    : loanUnknown ? null
    : (value > 0 ? Math.round(value * 0.8 - loan) : null)
  const ordered = [...all].sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0))
  return {
    loan, value,
    lvr: value > 0 && loan > 0 ? Math.round((loan / value) * 1000) / 10 : null,
    usable, loanUnknown, asAt,
    first: ordered[0]?.address || '',
    more: Math.max(0, ordered.length - 1),
    count: ordered.length,
  }
}

const CARD = 'bg-card border border-card-line rounded-xl overflow-hidden'
const PILL = 'text-[10.5px] font-semibold rounded-full px-2.5 py-[3px] whitespace-nowrap border'
const BLURB = 'Existing clients who may have usable equity. You run the numbers; this keeps the list.'
// Client, security, loan, value, LVR, usable equity, status, next. Approved as
// a mock on 19 Oct 2026 before a line of this was written.
const GRID = 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.45fr)_104px_104px_58px_112px_118px_104px] gap-3 items-center'

// WHAT COLOUR A STAGE IS.
//
// Blue is work in hand, purple is waiting on somebody else, green is finished
// well, quiet grey is finished without a deal. There is no amber anywhere in
// this portal and there is none here.
const TONE: Record<string, string> = {
  not_reviewed:      'bg-page text-faint border-card-line',
  valuation_checked: 'bg-info-bg text-info border-info-edge',
  numbers_done:      'bg-info-bg text-info border-info-edge',
  template_sent:     'bg-waiting-bg text-waiting border-waiting-edge',
  client_responded:  'bg-done-bg text-done border-done-edge',
  closed:            'bg-page text-faint border-card-line',
}

function StageBadge({ r }: { r: Row }) {
  // A closed review says what came of it, not the word "closed". "Closed" is
  // true and tells nobody anything.
  const words = r.status === 'closed' && r.outcome ? outcomeLabel(r.outcome) : stageLabel(r.status)
  const tone = r.status === 'closed' && r.outcome === 'converted'
    ? TONE.client_responded
    : TONE[r.status] || TONE.not_reviewed
  return <span className={`${PILL} ${tone}`}>{words}</span>
}

function Count({ n, what, tone }: { n: number; what: string; tone?: 'info' | 'done' }) {
  const edge = tone === 'info' ? 'bg-info-bg border-info-edge'
             : tone === 'done' ? 'bg-done-bg border-done-edge'
             : 'bg-card border-card-line'
  const ink = tone === 'info' ? 'text-info' : tone === 'done' ? 'text-done' : 'text-ink'
  return (
    <div className={`border rounded-xl px-4 py-2.5 min-w-[118px] ${edge}`}>
      <b className={`block text-[20px] leading-tight ${ink}`}>{n}</b>
      <span className="text-[11px] text-muted">{what}</span>
    </div>
  )
}

// A link where there is somewhere to go, and a row that opens where there is
// not. A book row has no client page because these people are not clients.
function Row({ href, className, onClick, children }: {
  href: string | null; className: string
  onClick?: () => void; children: React.ReactNode
}) {
  if (!href) return <div className={className} onClick={onClick}>{children}</div>
  return <Link href={href} className={className}>{children}</Link>
}

// WHAT THE BOOK HOLDS FOR ONE PERSON.
//
// Opened in place, because the alternative is a page for somebody who is not a
// client of this portal yet. Fabio, 19 Oct 2026: the triage happens out here,
// and when one is worth doing he makes the deal card himself.
function OpenReview({ r, rows, today, onSaved }: {
  r: Row; rows: Prop[]; today: Date; onSaved?: () => void
}) {
  const ordered = [...rows].sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0))
  const cell = 'py-[7px] pr-3 border-t border-line-soft text-body align-top'
  const num = `${cell} tabular-nums whitespace-nowrap`
  const head = 'text-left text-[9.5px] font-bold uppercase tracking-[.06em] text-faint pb-1.5 pr-3 whitespace-nowrap'

  return (
    <div className="bg-page border-t border-line-soft px-4 py-3.5">
      <p className="text-[9.5px] font-bold uppercase tracking-[.06em] text-faint mb-2">
        {ordered.length === 1 ? 'The security' : 'The securities'}, as the book has them
      </p>

      {ordered.length === 0 ? (
        <p className="text-[12px] text-muted">No properties came across for this one.</p>
      ) : (
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            <tr>
              <th className={head} style={{ width: '34%' }}>Security address</th>
              <th className={head}>Lender</th><th className={head}>Loan</th>
              <th className={head}>Value</th><th className={head}>LVR</th>
              <th className={head}>Usable at 80%</th><th className={head}>Type</th>
            </tr>
            {ordered.map(p => {
              const loan = p.current_balance ?? p.original_loan ?? 0
              const value = p.estimated_current_value ?? p.original_value ?? 0
              const lvr = value > 0 && loan > 0 ? Math.round((loan / value) * 1000) / 10 : null
              // Owner occupied is shown and not counted - the same rule the
              // schema sets. You need the whole portfolio to have the
              // conversation; counting the home would inflate the figure.
              // A MISSING LOAN IS NOT A LOAN OF ZERO. A value with nothing
              // against it read as fully unencumbered - $720,000 of equity on a
              // $900,000 house we know nothing about. No row is in that state
              // today; it is there for the next import. See loanIsUnknown in
              // lib/portfolio-review.ts.
              const usable = usableForTheList(p)
              const unknown = usable === 'unknown'
              return (
                <tr key={p.id}>
                  <td className={cell}>{p.address}</td>
                  <td className={cell}>{p.lender_raw || '—'}</td>
                  <td className={num}>
                    {loan > 0 ? money(loan)
                      : unknown ? <span className="text-chase">not recorded</span> : '—'}
                  </td>
                  <td className={num}>{value > 0 ? money(value) : '—'}</td>
                  <td className={num}>{lvr === null ? '—' : `${lvr}%`}</td>
                  <td className={`${num} ${p.investor && typeof usable === 'number' && usable > 0
                      ? 'text-done font-semibold' : 'text-faint'}`}>
                    {!p.investor ? 'not counted'
                      : unknown ? <span className="text-chase">loan unknown</span>
                      : usable === null ? '—' : money(usable as number)}
                  </td>
                  <td className={cell}>{p.investor ? 'Investment' : 'Owner occupied'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* WHERE THESE FIGURES COME FROM, said on the screen rather than assumed.
          A number nobody can place is a number nobody acts on. */}
      <p className="text-[11px] text-faint mt-2.5 leading-relaxed">
        Loan and value are what the book recorded at settlement. The balance updates itself from the
        commission statements each month. The value stands until somebody puts a current one in, which
        is what the Valuation checked stage is for.
      </p>

      {/* THE SEVEN BOXES A PERSON DECIDES. Everything above this line came off
          the book; nothing below can send until these are filled in. */}
      <ReviewFigures review={r} props={rows} onSaved={onSaved} />

      {(r.last_contact || r.email_sent_at) && (
        <div className="mt-3 pt-2.5 border-t border-line-soft">
          <p className="text-[9.5px] font-bold uppercase tracking-[.06em] text-faint mb-1.5">What has happened</p>
          {r.email_sent_at && (
            <p className="text-[11.5px] text-muted">
              <b className="text-ink font-semibold">Review email sent</b>
              {' '}{whenDue(r.email_sent_at.slice(0, 10), today)}
            </p>
          )}
          {r.last_contact && (
            <p className="text-[11.5px] text-muted">
              <b className="text-ink font-semibold">
                {r.calls} {r.calls === 1 ? 'call' : 'calls'}
              </b>
              {' '}&middot; last {whenDue(r.last_contact, today)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// WHAT WOULD CHANGE, BEFORE ANYTHING CHANGES.
//
// The same shape as the book import above it: the counts, a green line saying
// nothing has been written, the rows themselves, then the one button that
// writes. Approved as a mock on 21 Oct 2026 before a line of this was written.
function RefreshPlan({ plan, way, setWay, writing, onWrite, onClose }: {
  plan: Plan
  way: 'all' | 'down' | 'up' | 'flat'
  setWay: (w: 'all' | 'down' | 'up' | 'flat') => void
  writing: boolean
  onWrite: () => void
  onClose: () => void
}) {
  const counted = {
    down: plan.fill.filter(c => c.way === 'down').length,
    up: plan.fill.filter(c => c.way === 'up').length,
    flat: plan.fill.filter(c => c.way === 'flat').length,
  }
  const shown = way === 'all' ? plan.fill : plan.fill.filter(c => c.way === way)
  const SEG = 'text-[11.5px] rounded-full px-3 py-[4px] border transition'

  return (
    <div className={`${CARD} px-4 py-4 mb-3`}>
      <b className="block text-[13px] text-ink mb-2">Refresh balances from the trail book</b>

      <div className="flex gap-2 flex-wrap mb-3">
        <Count n={plan.fill.length} what="would be filled in" tone="done" />
        <Count n={plan.noMatch} what="reference meets nothing" />
        <Count n={plan.noRef} what="no reference at all" />
        <Count n={plan.alreadyCurrent} what="already current" />
      </div>

      {plan.fill.length === 0 ? (
        <p className="text-[12px] text-body bg-done-bg border border-done-edge rounded-lg px-3 py-2">
          <b className="text-done">Every balance is already as current as the statements allow.</b>{' '}
          The newest one you hold is {monthName(plan.newest) || 'not dated'}. Import a later statement
          and press this again.
        </p>
      ) : (
        <>
          <p className="text-[12px] text-body bg-done-bg border border-done-edge rounded-lg px-3 py-2 mb-2">
            <b className="text-done">Nothing is written until you press Fill these in.</b> The book’s
            original loan is never touched — it stays as the history it is. This fills the current
            balance, the month it was true, and the lender.
          </p>
          <p className="text-[12px] text-body bg-info-bg border border-info-edge rounded-lg px-3 py-2 mb-2">
            <b className="text-info">Every one of these is the lender’s own number.</b> It comes off
            your trail statement against the loan reference already on the property. Nothing is matched
            on a name and nothing is estimated.
          </p>
          <p className="text-[12px] text-body mb-3">
            The newest statement you hold is <b className="text-ink">{monthName(plan.newest)}</b>.
            These figures are as at that month, not today.
          </p>

          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {([
              ['all', `All ${plan.fill.length}`],
              ['down', `Paid down (${counted.down})`],
              ['up', `Gone up (${counted.up})`],
              ['flat', `Barely moved (${counted.flat})`],
            ] as const).map(([k, label]) => (
              <button key={k} onClick={() => setWay(k)}
                className={`${SEG} ${way === k
                  ? 'bg-ink border-ink text-page font-semibold'
                  : 'bg-card border-line text-muted hover:bg-page'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="border border-card-line rounded-lg overflow-hidden mb-3 max-h-[320px] overflow-y-auto">
            <div className="grid grid-cols-[minmax(0,1fr)_112px_112px_104px_128px] gap-2.5 px-3 py-[7px]
                            bg-page border-b border-card-line sticky top-0">
              {['Reference', 'Book said', 'Lender says', 'Change', 'Lender · as at'].map((h, i) => (
                <span key={h} className={`text-[9.5px] font-bold uppercase tracking-[.05em] text-faint
                                          ${i > 0 && i < 4 ? 'text-right' : ''}`}>{h}</span>
              ))}
            </div>
            {shown.slice(0, 300).map(c => {
              const diff = c.was === null ? null : c.now - c.was
              return (
                <div key={c.id}
                  className="grid grid-cols-[minmax(0,1fr)_112px_112px_104px_128px] gap-2.5 px-3 py-2
                             border-b border-line-soft last:border-b-0 items-center">
                  <span className="text-[12.5px] text-body truncate">{c.ref}</span>
                  <span className="text-[12.5px] text-right text-body">
                    {c.was === null ? '—' : money(c.was)}
                  </span>
                  <span className="text-[12.5px] text-right font-bold text-ink">{money(c.now)}</span>
                  <span className={`text-[12.5px] text-right font-bold ${
                    diff === null ? 'text-faint'
                    : c.way === 'down' ? 'text-done'
                    : c.way === 'up' ? 'text-waiting' : 'text-faint'}`}>
                    {diff === null ? '' : `${diff < 0 ? '−' : '+'}${money(Math.abs(diff))}`}
                  </span>
                  <span className="text-[11px] text-faint truncate">
                    {[c.lender, asAtShort(`${c.asAt}-01`)].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )
            })}
            {shown.length > 300 && (
              <p className="px-3 py-2 text-[11.5px] text-faint">
                … and {shown.length - 300} more. All of them are written, not just the ones on screen.
              </p>
            )}
            {shown.length === 0 && (
              <p className="px-3 py-2 text-[11.5px] text-faint">None of them moved that way.</p>
            )}
          </div>

          <p className="text-[12px] text-muted mb-3 leading-relaxed">
            <b className="text-ink">A loan that has gone up is not an error.</b> It has been topped up
            or redrawn since the book was exported, and the lender’s figure is the right one either way.
          </p>

          <div className="flex gap-2 items-center">
            <button onClick={onWrite} disabled={writing}
              className="text-[12px] font-semibold bg-ink text-page rounded-lg px-3.5 py-[7px] disabled:opacity-50">
              {writing ? 'Filling them in…' : 'Fill these in'}
            </button>
            <button onClick={onClose} disabled={writing}
              className="text-[12px] border border-line bg-card rounded-lg px-3.5 py-[7px] text-body
                         hover:bg-page transition disabled:opacity-50">
              Cancel
            </button>
            <span className="ml-auto text-[11.5px] text-faint">
              {plan.fill.length} {plan.fill.length === 1 ? 'property' : 'properties'} across{' '}
              {plan.reviews} {plan.reviews === 1 ? 'review' : 'reviews'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default function PortfolioReview() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [why, setWhy] = useState('')
  const [stage, setStage] = useState<'all' | Stage>('all')
  const [onlyDue, setOnlyDue] = useState(false)
  const [find, setFind] = useState('')
  const [importing, setImporting] = useState(false)
  // REFRESHING THE BALANCES. Nothing is loaded until somebody asks: the trail
  // lines are tens of thousands of rows and nobody opening this list to make a
  // phone call needs them read first.
  const [plan, setPlan] = useState<Plan | null>(null)
  const [planning, setPlanning] = useState(false)
  const [writing, setWriting] = useState(false)
  const [planWhy, setPlanWhy] = useState('')
  const [way, setWay] = useState<'all' | 'down' | 'up' | 'flat'>('all')
  const [refreshed, setRefreshed] = useState(0)
  // The properties, by review. Read once beside the list rather than per row -
  // 656 rows asking one question each is 656 round trips.
  const [props, setProps] = useState<Map<string, Prop[]>>(new Map())
  // Which one is open. The book's people have no client page to go to, so the
  // detail belongs here. See the Row component above.
  const [open, setOpen] = useState<string | null>(null)
  // Bumped when a review saves, so the list and its figures are read again
  // rather than the screen quietly disagreeing with the database.
  const [reload, setReload] = useState(0)

  // ONE CLOCK FOR THE WHOLE SCREEN, taken once.
  //
  // Every "due today" on the page must agree with every other one. Calling new
  // Date() inside a row means a list opened at 11:59pm disagrees with itself a
  // minute later, and lib/portfolio-review.ts takes `today` as an argument for
  // exactly this reason.
  const [today] = useState(() => new Date())

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.from('portfolio_review_list').select('*').limit(5000)
      .then(({ data, error }) => {
        // A MISSING VIEW IS A THING NOBODY HAS SET UP YET, NOT A FAULT - but it
        // is said out loud rather than shown as an empty list, because "nothing
        // here" and "the table does not exist" look identical and one of them
        // means the SQL was never run.
        if (error) { setWhy(error.message); setRows([]); return }
        setRows((data || []) as Row[])
      })

    // THE SECURITIES. A failure here leaves the list standing with its figures
    // blank rather than taking the whole screen down - the names, the stages
    // and the chases are still the work.
    supabase.from('portfolio_review_properties')
      .select('id, review_id, ordinal, address, investor, original_value, original_loan, current_balance, balance_as_at, loan_ref, estimated_current_value, usable_equity, lender_raw')
      .limit(20000)
      .then(({ data }) => {
        const by = new Map<string, Prop[]>()
        for (const p of (data || []) as Prop[]) {
          by.set(p.review_id, [...(by.get(p.review_id) || []), p])
        }
        setProps(by)
      })
  }, [reload])

  const shown = useMemo(() => {
    const all = rows || []
    const needle = find.trim().toLowerCase()
    const kept = all.filter(r => {
      if (stage !== 'all' && r.status !== stage) return false
      if (onlyDue) {
        const d = dueState(r.due_on, today)
        if (d !== 'overdue' && d !== 'today') return false
      }
      if (needle) {
        // THE ADDRESS IS SEARCHABLE TOO. Half of what somebody remembers about
        // one of these is the street, not the surname.
        const addresses = (props.get(r.review_id) || []).map(p => p.address).join(' ')
        const hay = `${fullName(r)} ${r.book_name || ''} ${r.email || ''} ${addresses}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })

    // BIGGEST EQUITY FIRST, which is the question this list is asked.
    //
    // Fabio, 19 Oct 2026: "yes, okay to sort by usable equity first". 656 rows
    // of nobody-has-looked-yet sorted by chase date is 656 rows in no order at
    // all; sorted by equity, the ones worth an hour are the ones at the top.
    //
    // THE CHASES STILL WIN WHEN THERE ARE ANY. Turning on Due now, or filtering
    // to a stage that is mid-flight, puts it back on sortForTheList - because
    // at that point the question is "what do I owe somebody today", and a
    // client waiting on a callback does not care how much equity they have.
    if (onlyDue) return sortForTheList(kept, today) as Row[]
    return [...kept].sort((a, b) => {
      // Opted out sits at the bottom wherever it is sorted.
      if (!!a.opted_out !== !!b.opted_out) return a.opted_out ? 1 : -1
      // A CLIENT WE KNOW NOTHING ABOUT DOES NOT GO TO THE TOP. Reading a
      // missing loan as zero would put them above everybody who really does
      // have a loan and really might have equity. On 21 Oct 2026 no row on
      // this list was in that state - every property carried a figure - but
      // the next import is one empty column away from it.
      const fa = figuresFor(props.get(a.review_id))
      const fb = figuresFor(props.get(b.review_id))
      const ea = fa.loanUnknown ? -Infinity : (fa.usable ?? -Infinity)
      const eb = fb.loanUnknown ? -Infinity : (fb.usable ?? -Infinity)
      if (ea !== eb) return eb - ea
      return String(a.last_name || '').localeCompare(String(b.last_name || ''))
    }) as Row[]
  }, [rows, stage, onlyDue, find, today, props])

  const counts = useMemo(() => countsFor(rows || [], today), [rows, today])

  // WHAT THE LENDER SAYS THEY OWE NOW.
  //
  // 21 Oct 2026. Every figure on this list was the spreadsheet's original
  // loan - 760 of 760 - so a loan six years into being paid down read as if
  // nothing had come off it. The equity read low and a client worth ringing
  // looked like one who was not.
  //
  // The trail statement already holds the lender's own balance against the
  // loan reference already on the property. This reads it, works out what
  // would change, and shows that. It writes nothing on its own.
  async function buildPlan() {
    setPlanning(true); setPlanWhy(''); setPlan(null)
    try {
      const supabase = createSupabaseBrowser()

      // THE NEWEST MONTH FIRST, so the pull after it is three months of lines
      // rather than every month a loan has ever paid. The answer only ever
      // comes from the latest month; the rest is weight.
      const { data: top, error: topErr } = await supabase.from('commission_lines')
        .select('period_month').eq('kind', 'trail')
        .order('period_month', { ascending: false }).limit(1)
      if (topErr) { setPlanWhy(topErr.message); return }
      const newest = String((top || [])[0]?.period_month || '').slice(0, 10)
      if (!newest) {
        setPlanWhy('There are no trail lines on this database yet, so there is nothing to read a balance from.')
        return
      }
      const from = new Date(`${newest.slice(0, 7)}-01T00:00:00`)
      from.setMonth(from.getMonth() - 3)
      const since = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`

      const { data: lines, error: linesErr } = await supabase.from('commission_lines')
        .select('loan_ref, balance, period_month, lender_raw')
        .eq('kind', 'trail').gte('period_month', since).limit(50000)
      if (linesErr) { setPlanWhy(linesErr.message); return }

      // The properties are already on screen. Read them again anyway: the list
      // was loaded when the page opened and somebody may have edited a review
      // in another tab since.
      const { data: holdings, error: hErr } = await supabase.from('portfolio_review_properties')
        .select('id, review_id, loan_ref, original_loan, current_balance, balance_as_at, investor')
        .limit(20000)
      if (hErr) { setPlanWhy(hErr.message); return }

      setPlan(planFor((holdings || []) as Holding[], (lines || []) as TrailLine[]))
      setWay('all')
    } catch (e: any) {
      setPlanWhy(e?.message || 'The balances could not be read.')
    } finally {
      setPlanning(false)
    }
  }

  // THE WRITE, AND IT IS CHECKED.
  //
  // A policy refuses a write by returning zero rows and NO error. Every update
  // below takes its result and counts the rows that came back, because the
  // failure this codebase keeps paying for is a screen that says it worked.
  async function refreshBalances() {
    if (!plan || plan.fill.length === 0) return
    setWriting(true); setPlanWhy('')
    const supabase = createSupabaseBrowser()
    let done = 0
    const failed: string[] = []

    const all = plan.fill
    for (let i = 0; i < all.length; i += 20) {
      const chunk = all.slice(i, i + 20)
      const results = await Promise.all(chunk.map(async (c: Change) => {
        const { id, ...set } = writeFor(c)
        const { data, error } = await supabase.from('portfolio_review_properties')
          .update(set).eq('id', id).select('id')
        if (error) return error.message
        if (!data || data.length === 0) return 'the database refused it'
        return null
      }))
      for (const r of results) { if (r === null) done++; else if (failed.length < 3) failed.push(r) }
    }

    setWriting(false)
    setRefreshed(done)
    setPlan(null)
    if (failed.length > 0) {
      setPlanWhy(`${done} of ${all.length} were written. The rest came back with: ${failed.join('; ')}`)
    }
    // Read the list again so every figure on screen is the one in the database.
    setReload(n => n + 1)
  }

  // THE SHAPE, NOT THE WORD.
  //
  // lib/the-portal-says-it-is-busy.test.ts is a ratchet and it is at zero -
  // every screen in the portal has been converted, and a new one must not be
  // the one that puts the number back up. A line of grey text saying "Loading"
  // tells you nothing about what is coming; the shape does.
  if (rows === null) return (
    <div>
      <p className="text-[12.5px] text-muted mb-3.5">{BLURB}</p>
      <div className="flex gap-2 flex-wrap mb-3">
        {[0, 1, 2, 3, 4].map(i => <SkelTile key={i} />)}
      </div>
      <SkelRows rows={6} cols={5} />
    </div>
  )

  return (
    <div>
      <p className="text-[12.5px] text-muted mb-3.5">{BLURB}</p>

      {why && (
        <div className="mb-3 border border-info-edge bg-info-bg rounded-xl px-4 py-3">
          <b className="block text-[13px] text-info mb-0.5">The list could not be read</b>
          <p className="text-[12px] text-body">
            {why} — docs/portfolio-review-schema.sql may not have been run on this database yet.
          </p>
        </div>
      )}

      {importing && <BookImport onFinished={() => window.location.reload()} />}

      <div className="flex gap-2 flex-wrap mb-3">
        <Count n={counts.onTheList} what="on the list" />
        <Count n={counts.reviewed} what="reviewed" />
        <Count n={counts.awaitingReply} what="awaiting a reply" />
        <Count n={counts.toChase} what="to chase today" tone="info" />
        <Count n={counts.becameDeals} what="became deals" tone="done" />
      </div>

      <div className="flex gap-2 items-center flex-wrap mb-3">
        <select value={stage} onChange={e => setStage(e.target.value as any)}
          className="text-[11.5px] text-body bg-card border border-card-line rounded-lg px-2.5 py-[6px]">
          <option value="all">All statuses</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        <button onClick={() => setOnlyDue(v => !v)}
          className={`text-[11.5px] font-semibold rounded-lg px-3 py-[6px] border transition ${onlyDue
            ? 'bg-info-bg text-info border-info-edge'
            : 'bg-card text-body border-card-line hover:bg-page'}`}>
          Due now
        </button>

        <input value={find} onChange={e => setFind(e.target.value)} placeholder="Search a client"
          className="text-[11.5px] bg-card border border-card-line rounded-lg px-2.5 py-[6px] min-w-[180px]" />

        <span className="ml-auto text-[11.5px] text-faint">
          {shown.length} of {(rows || []).length}
        </span>
        <button onClick={() => { if (plan) { setPlan(null) } else { buildPlan() } }}
          disabled={planning}
          className="text-[11.5px] font-semibold text-body bg-card border border-card-line rounded-lg px-3 py-[6px] hover:bg-page transition disabled:opacity-50">
          {planning ? 'Reading the statements…' : plan ? 'Close' : 'Refresh balances'}
        </button>
        <button onClick={() => setImporting(v => !v)}
          className="text-[11.5px] font-semibold text-brand-ink bg-card border border-dashed border-info-edge rounded-lg px-3 py-[6px] hover:bg-page transition">
          {importing ? 'Close the import' : 'Import the book'}
        </button>
      </div>

      {planWhy && (
        <div className="mb-3 border border-chase-edge bg-chase-bg rounded-xl px-4 py-3">
          <b className="block text-[13px] text-chase mb-0.5">The balances</b>
          <p className="text-[12px] text-body">{planWhy}</p>
        </div>
      )}

      {refreshed > 0 && !plan && (
        <div className="mb-3 border border-done-edge bg-done-bg rounded-xl px-4 py-3">
          <b className="block text-[13px] text-done mb-0.5">
            {refreshed} {refreshed === 1 ? 'balance is' : 'balances are'} now the lender’s own figure.
          </b>
          <p className="text-[12px] text-body">
            The loan on those rows says when it was true. Everything else is still the book’s figure.
          </p>
        </div>
      )}

      {plan && <RefreshPlan
        plan={plan} way={way} setWay={setWay}
        writing={writing} onWrite={refreshBalances} onClose={() => setPlan(null)} />}

      <div className={`${GRID} px-4 pb-2 text-[9.5px] font-bold uppercase tracking-[.06em] text-faint`}>
        <span>Client</span><span>Security</span><span>Loan</span><span>Value</span>
        <span>LVR</span><span>Usable equity</span><span>Status</span><span>Next</span>
      </div>

      <div className={CARD}>
        {shown.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] text-ink font-medium mb-1">
              {(rows || []).length === 0 ? 'Nobody on the list yet.' : 'Nothing matches that.'}
            </p>
            <p className="text-[12px] text-muted">
              {(rows || []).length === 0
                ? 'The book has not been imported. Drop the spreadsheet to put your investor clients here.'
                : 'Try a different status, or turn off Due now.'}
            </p>
          </div>
        ) : shown.map(r => {
          const due = dueState(r.due_on, today)
          const late = due === 'overdue' || due === 'today'
          // A BOOK ROW IS NOT A CLIENT, SO IT DOES NOT LINK TO ONE.
            //
            // 19 Oct 2026. The book stopped being written into `clients` - see
            // BookImport.tsx - so client_id is null for everyone still sitting
            // in the book, and this used to send them to /clients/null. It
            // opens here instead: every security, every lender, the loan and
            // the LVR on each, and the contact history. A client the portal
          // really has still links to their own page.
          const f = figuresFor(props.get(r.review_id))
          const isOpen = open === r.review_id
          return (
            <div key={r.review_id} className="border-t border-line-soft first:border-t-0">
              <Row href={r.client_id ? `/clients/${r.client_id}` : null}
                onClick={r.client_id ? undefined : () => setOpen(o => o === r.review_id ? null : r.review_id)}
                className={`${GRID} px-4 py-2.5 text-[12.5px] transition ${isOpen ? 'bg-page' : 'hover:bg-page'} ${r.client_id ? '' : 'cursor-pointer'}`}>
                <span className="min-w-0">
                  <span className="font-semibold text-ink block truncate">
                    {fullName(r) || 'No name'}
                    {r.opted_out && <span className="ml-2 text-[10.5px] text-faint font-normal">opted out</span>}
                  </span>
                  {/* EVERY APPLICANT, not just the one the emails are addressed
                      to. 225 of the 656 are two people and 64 are three. */}
                  {r.book_name && r.book_name !== fullName(r) && (
                    <span className="text-[11px] text-faint block truncate">{r.book_name}</span>
                  )}
                </span>

                <span className="min-w-0">
                  <span className="text-[11.5px] text-body block truncate">{f.first || '—'}</span>
                  {f.count > 0 && (
                    <span className="text-[11px] text-faint block truncate">
                      {f.more > 0 ? `+ ${f.more} more · ` : ''}{f.count} {f.count === 1 ? 'property' : 'properties'}
                    </span>
                  )}
                </span>

                <span className="text-[11.5px] text-muted tabular-nums">
                  {f.loan > 0 ? money(f.loan) : '—'}
                  {/* THE ABSENCE OF THIS LINE IS THE SIGNAL. A dated figure is
                      the lender's own, from the trail statement. No line means
                      it is still what the book said when it was exported. */}
                  {f.asAt && (
                    <span className="block text-[10px] text-faint leading-tight">
                      as at {asAtShort(f.asAt)}
                    </span>
                  )}
                </span>
                <span className="text-[11.5px] text-muted tabular-nums">{f.value > 0 ? money(f.value) : '—'}</span>
                <span className="text-[11.5px] text-muted tabular-nums">{f.lvr === null ? '—' : `${f.lvr}%`}</span>
                <span className={`text-[11.5px] tabular-nums ${f.usable && f.usable > 0 ? 'text-done font-semibold' : 'text-faint'}`}>
                  {f.loanUnknown ? <span className="text-chase">loan unknown</span>
                    : f.usable === null ? '—' : money(f.usable)}
                </span>

                <StageBadge r={r} />
                <span className={`text-[11.5px] ${late ? 'text-info font-semibold' : 'text-muted'}`}>
                  {r.linked_deal_id ? 'became a deal' : whenDue(r.due_on, today) || '—'}
                </span>
              </Row>

              {isOpen && <OpenReview r={r} rows={props.get(r.review_id) || []} today={today}
                onSaved={() => setReload(x => x + 1)} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
