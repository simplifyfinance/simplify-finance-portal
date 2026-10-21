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
  const usable = recorded.length > 0
    ? recorded.reduce((t, p) => t + (p.usable_equity as number), 0)
    : loanUnknown ? null
    : (value > 0 ? Math.round(value * 0.8 - loan) : null)
  const ordered = [...all].sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0))
  return {
    loan, value,
    lvr: value > 0 && loan > 0 ? Math.round((loan / value) * 1000) / 10 : null,
    usable, loanUnknown,
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
              // A MISSING LOAN IS NOT A LOAN OF ZERO. 267 of the 656 came across
              // with a value and nothing against it, and this read that as fully
              // unencumbered - $720,000 of equity on a $900,000 house we know
              // nothing about. See loanIsUnknown in lib/portfolio-review.ts.
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

export default function PortfolioReview() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [why, setWhy] = useState('')
  const [stage, setStage] = useState<'all' | Stage>('all')
  const [onlyDue, setOnlyDue] = useState(false)
  const [find, setFind] = useState('')
  const [importing, setImporting] = useState(false)
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
      .select('id, review_id, ordinal, address, investor, original_value, original_loan, current_balance, estimated_current_value, usable_equity, lender_raw')
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
      // missing loan as zero put all 267 of them above the 389 who really do
      // have a loan and really might have equity. 21 Oct 2026.
      const fa = figuresFor(props.get(a.review_id))
      const fb = figuresFor(props.get(b.review_id))
      const ea = fa.loanUnknown ? -Infinity : (fa.usable ?? -Infinity)
      const eb = fb.loanUnknown ? -Infinity : (fb.usable ?? -Infinity)
      if (ea !== eb) return eb - ea
      return String(a.last_name || '').localeCompare(String(b.last_name || ''))
    }) as Row[]
  }, [rows, stage, onlyDue, find, today, props])

  const counts = useMemo(() => countsFor(rows || [], today), [rows, today])

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
        <button onClick={() => setImporting(v => !v)}
          className="text-[11.5px] font-semibold text-brand-ink bg-card border border-dashed border-info-edge rounded-lg px-3 py-[6px] hover:bg-page transition">
          {importing ? 'Close the import' : 'Import the book'}
        </button>
      </div>

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

                <span className="text-[11.5px] text-muted tabular-nums">{f.loan > 0 ? money(f.loan) : '—'}</span>
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
