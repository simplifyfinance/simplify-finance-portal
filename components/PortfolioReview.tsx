'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { money } from '@/lib/money'
import { SkelRows, SkelTile } from '@/components/Skeleton'
import BookImport from '@/components/BookImport'
import ReviewFigures from '@/components/ReviewFigures'
import {
  STAGES, stageLabel, outcomeLabel, reasonLabel, countsFor, sortForTheList,
  dueState, whenDue, fullName, matchesTile, type Stage, type Tile,
  usableForTheList, loanIsUnknown, usableEquity,
} from '@/lib/portfolio-review'
import { readMoney } from '@/lib/money'
import { securitiesOf, bookTotals, type Security } from '@/lib/one-security-many-loans'
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
  // 26 Oct 2026. Why it was closed, in a word and in your own words, and when.
  // See docs/why-it-was-not-suitable.sql.
  outcome_reason: string | null
  outcome_note: string | null
  closed_at: string | null
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
  // ONE ROW PER LOAN IS NOT ONE ROW PER PROPERTY.
  //
  // 26 Oct 2026. Fabio: "see how the portal doesnt not think logically 2 loans
  // against same secuitry and it is not caluclating overall LVR". The export
  // writes a row per loan, and this added those rows up - so a house with two
  // loans on it had its value counted twice and its equity worked out twice.
  // On one client that was a million dollars of equity that does not exist.
  //
  // Every figure on this line now comes off securitiesOf(), which folds the
  // loans back onto the property they are secured by. See
  // lib/one-security-many-loans.ts.
  const securities = securitiesOf(props || [])
  const counted = securities.filter(s => s.investor)
  const totals = bookTotals(counted)

  // A LOAN NOBODY RECORDED IS NOT A LOAN OF ZERO, which is the rule the rows
  // underneath already refused to break. Where no counted security has a
  // balance on it, 80% of the value is not equity, it is a guess.
  const loanUnknown = counted.length > 0 && counted.every(sec => sec.owing === null)

  // WHEN THE LOAN FIGURE WAS LAST TRUE. Only where every loan on every counted
  // security carries a dated balance - one refreshed and one still on the
  // book's figure makes a total that was never true on any date. The oldest of
  // them, because a total is only as current as its stalest part.
  const everyLoan = counted.flatMap(sec => sec.loans)
  const dated = everyLoan.filter(l => !!l.asAt && l.balance !== null)
  const asAt = everyLoan.length > 0 && dated.length === everyLoan.length
    ? dated.map(l => String(l.asAt)).sort()[0]
    : null

  return {
    loan: totals.owing ?? 0,
    value: totals.value ?? 0,
    lvr: totals.lvr,
    usable: loanUnknown ? null : (totals.value === null ? null : totals.usable),
    loanUnknown, asAt,
    first: securities[0]?.address || '',
    // SECURITIES, NOT ROWS. "4 properties" on a client with three houses and
    // four loans is the same miscount said in words.
    more: Math.max(0, securities.length - 1),
    count: securities.length,
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

// EVERY ONE OF THESE IS A FILTER.
//
// 26 Oct 2026. Fabio: "when I press the box at the top, I can't tell which
// ones are reviewed. So what the fuck is the point?" They were six numbers
// that did nothing when pressed. The rule behind each one lives in onTile()
// in lib/portfolio-review.ts and the count above reads the same rule, so the
// number and the list it shows you cannot disagree.
function Count({ n, what, tone, on, onPick }: {
  n: number; what: string; tone?: 'info' | 'done' | 'chase'
  on?: boolean; onPick?: () => void
}) {
  const edge = tone === 'info' ? 'bg-info-bg border-info-edge'
             : tone === 'done' ? 'bg-done-bg border-done-edge'
             : tone === 'chase' ? 'bg-chase-bg border-chase-edge'
             : 'bg-card border-card-line'
  const ink = tone === 'info' ? 'text-info' : tone === 'done' ? 'text-done'
            : tone === 'chase' ? 'text-chase' : 'text-ink'
  return (
    <button onClick={onPick} disabled={!onPick}
      title={onPick ? (on ? 'Showing these - press again for all' : `Show the ${what}`) : undefined}
      className={`text-left border rounded-xl px-4 py-2.5 min-w-[118px] transition ${edge} ${
        on ? 'ring-2 ring-ink ring-offset-1' : onPick ? 'hover:border-brand' : ''}`}>
      <b className={`block text-[20px] leading-tight ${ink}`}>{n}</b>
      <span className="text-[11px] text-muted">{what}</span>
    </button>
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
// WHAT THE BOOK DOES NOT HAVE, AND WHAT IT HAS WRONG.
//
// 26 Oct 2026. Fabio, working a review: "I cannot add a security and loan that
// is not being pulled so need the ability of doing that".
//
// Every property on a review arrived from the spreadsheet import and there was
// no other door. A client who has bought since the export, or whose CRM record
// was short a property, could not be worked properly at all - and the usable
// equity figure the whole conversation turns on was wrong by whatever was
// missing.
//
// Asked whether rows should also be removable, he was exact: "I need to add
// not remove". So nothing here deletes a property. The loan and the value can
// be corrected in place, which is the other half of the same problem: a book
// figure from settlement three years ago is not what somebody owes today.
function OpenReview({ r, rows, today, onSaved }: {
  r: Row; rows: Prop[]; today: Date; onSaved?: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [oops, setOops] = useState('')
  const [form, setForm] = useState({ address: '', lender: '', loan: '', value: '', investor: true })
  // Which figure is being typed into: '<property id>:loan' or ':value'.
  const [editing, setEditing] = useState<string | null>(null)

  const ymd = new Date().toISOString().slice(0, 10)

  // THE STORED FIGURE HAS TO BE REWRITTEN WITH THE ONES IT CAME FROM.
  //
  // usable_equity is kept on the row, and the LIST adds up the stored column
  // rather than working it out per row - see portfolio_review_list. Change a
  // loan without rewriting it and the table on screen says one thing while the
  // headline figure above it says another.
  const equityFor = (value: any, loan: any, investor: boolean) =>
    usableEquity(value, loan, investor)

  async function addIt() {
    const address = form.address.trim()
    if (!address) { setOops('A security needs an address.'); return }
    setBusy(true); setOops('')
    const supabase = createSupabaseBrowser()
    const loan = readMoney(form.loan)
    const value = readMoney(form.value)
    const { data, error } = await supabase.from('portfolio_review_properties').insert({
      review_id: r.review_id,
      client_id: r.client_id,
      ordinal: (rows.length || 0) + 1,
      address,
      investor: form.investor,
      lender_raw: form.lender.trim() || null,
      current_balance: loan,
      balance_as_at: loan === null ? null : ymd,
      estimated_current_value: value,
      valuation_source: value === null ? null : 'Entered by hand',
      valuation_date: value === null ? null : ymd,
      usable_equity: equityFor(value, loan, form.investor),
      notes: 'Added by hand - not on the book.',
    }).select('id')
    setBusy(false)
    // A blocked policy returns no rows and no error, so the row is the proof.
    if (error || !data?.length) {
      setOops(error?.message || 'That was not saved - nothing reached the database.')
      return
    }
    setForm({ address: '', lender: '', loan: '', value: '', investor: true })
    setAdding(false)
    onSaved?.()
  }

  // A VALUE BELONGS TO THE PROPERTY, NOT TO A LOAN.
  //
  // 26 Oct 2026. Where two loans sit on one house the book carried two rows,
  // each with its own value - 1,600,000 on one and 1,700,000 on the other for
  // the same place. Typing the right one in writes it to both, so the two
  // stop disagreeing rather than one of them being quietly preferred forever.
  async function saveSecurityValue(sec: Security, typed: string) {
    setEditing(null)
    const n = readMoney(typed)
    const supabase = createSupabaseBrowser()
    for (const r of sec.rows) {
      const loan = (r as any).current_balance ?? (r as any).original_loan ?? null
      const { error } = await supabase.from('portfolio_review_properties').update({
        estimated_current_value: n,
        valuation_source: 'Entered by hand',
        valuation_date: n === null ? null : ymd,
        // Kept honest on a single-loan property. On a merged one the stored
        // figure is per loan and is ignored on the way out - see
        // lib/one-security-many-loans.ts.
        usable_equity: sec.rows.length === 1 ? equityFor(n, loan, sec.investor) : null,
      }).eq('id', (r as any).id)
      if (error) { setOops(error.message); return }
    }
    onSaved?.()
  }

  async function saveFigure(p: Prop, field: 'loan' | 'value', typed: string) {
    setEditing(null)
    const n = readMoney(typed)
    const loan = field === 'loan' ? n : (p.current_balance ?? p.original_loan ?? null)
    const value = field === 'value' ? n : (p.estimated_current_value ?? p.original_value ?? null)
    const patch: Record<string, any> = {
      usable_equity: equityFor(value, loan, p.investor !== false),
    }
    if (field === 'loan') { patch.current_balance = n; patch.balance_as_at = n === null ? null : ymd }
    else { patch.estimated_current_value = n; patch.valuation_source = 'Entered by hand'; patch.valuation_date = n === null ? null : ymd }
    const supabase = createSupabaseBrowser()
    const { data, error } = await supabase.from('portfolio_review_properties')
      .update(patch).eq('id', p.id).select('id')
    if (error || !data?.length) {
      setOops(error?.message || 'That was not saved - nothing reached the database.')
      return
    }
    onSaved?.()
  }

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
            {securitiesOf(ordered).map(sec => {
              // ONE ROW PER SECURITY, NOT PER LOAN. See
              // lib/one-security-many-loans.ts for the afternoon that taught
              // us the difference, and what it was costing.
              const many = sec.loans.length > 1
              const disagree = sec.values.length > 1
              return (
                <Fragment key={sec.key}>
                <tr>
                  <td className={cell}>
                    {sec.address}
                    {many && (
                      <span className="ml-2 text-[9.5px] font-bold text-info bg-info-bg border border-info-edge rounded-full px-2 py-[1px]">
                        {sec.loans.length} loans
                      </span>
                    )}
                    {disagree && (
                      <span className="block text-[10.5px] text-chase mt-0.5">
                        two values recorded &mdash; {sec.values.map(v => money(v)).join(' and ')}. Using the lower.
                      </span>
                    )}
                  </td>
                  <td className={cell}>
                    {many ? `${sec.loans.length} lenders` : (sec.loans[0]?.lender || '—')}
                  </td>
                  <td className={num}>
                    {!many && sec.rows[0] ? (
                      editing === `${(sec.rows[0] as any).id}:loan` ? (
                        <input autoFocus defaultValue={sec.owing !== null ? String(sec.owing) : ''}
                          onBlur={e => saveFigure(sec.rows[0] as Prop, 'loan', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveFigure(sec.rows[0] as Prop, 'loan', (e.target as HTMLInputElement).value)
                            if (e.key === 'Escape') setEditing(null)
                          }}
                          className="w-[110px] border border-field-line rounded-md px-1.5 py-[2px] text-[12px] bg-card" />
                      ) : (
                        <button onClick={() => setEditing(`${(sec.rows[0] as any).id}:loan`)} className="hover:underline text-left">
                          {sec.owing !== null ? money(sec.owing)
                            : <span className="text-chase">not recorded</span>}
                        </button>
                      )
                    ) : (
                      sec.owing !== null ? money(sec.owing) : <span className="text-chase">not recorded</span>
                    )}
                  </td>
                  <td className={num}>
                    {editing === `${sec.key}:value` ? (
                      <input autoFocus defaultValue={sec.value !== null ? String(sec.value) : ''}
                        onBlur={e => saveSecurityValue(sec, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveSecurityValue(sec, (e.target as HTMLInputElement).value)
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        className="w-[110px] border border-field-line rounded-md px-1.5 py-[2px] text-[12px] bg-card" />
                    ) : (
                      <button onClick={() => setEditing(`${sec.key}:value`)} className="hover:underline text-left">
                        {sec.value !== null ? money(sec.value) : '—'}
                      </button>
                    )}
                  </td>
                  <td className={num}>{sec.lvr === null ? '—' : `${sec.lvr}%`}</td>
                  <td className={`${num} ${sec.investor && sec.usable && sec.usable > 0
                      ? 'text-done font-semibold' : 'text-faint'}`}>
                    {!sec.investor ? 'not counted'
                      : sec.owing === null ? <span className="text-chase">loan unknown</span>
                      : sec.usable === null ? '—' : money(sec.usable)}
                  </td>
                  <td className={cell}>{sec.investor ? 'Investment' : 'Owner occupied'}</td>
                </tr>
                {/* EVERY LOAN ON IT, where there is more than one. The sum
                    above is the three of them together; these are the three. */}
                {many && sec.loans.map(l => (
                  <tr key={l.id}>
                    <td className="py-[3px] pr-3 text-[11.5px] text-faint pl-4">&#8627; {l.lender || 'no lender recorded'}</td>
                    <td className={cell}></td>
                    <td className="py-[3px] pr-3 text-[11.5px] text-muted tabular-nums whitespace-nowrap">
                      {editing === `${l.id}:loan` ? (
                        <input autoFocus defaultValue={l.balance !== null ? String(l.balance) : ''}
                          onBlur={e => saveFigure(sec.rows.find(r => (r as any).id === l.id) as Prop, 'loan', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveFigure(sec.rows.find(r => (r as any).id === l.id) as Prop, 'loan', (e.target as HTMLInputElement).value)
                            if (e.key === 'Escape') setEditing(null)
                          }}
                          className="w-[110px] border border-field-line rounded-md px-1.5 py-[2px] text-[12px] bg-card" />
                      ) : (
                        <button onClick={() => setEditing(`${l.id}:loan`)} className="hover:underline text-left">
                          {l.balance !== null ? money(l.balance) : 'not recorded'}
                        </button>
                      )}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}

      {oops && (
        <p className="text-[11.5px] text-chase bg-chase-bg border border-chase-edge rounded-lg px-3 py-1.5 mt-2.5 inline-block">
          {oops}
        </p>
      )}

      {/* ADDING ONE THE BOOK NEVER HAD. */}
      {adding ? (
        <div className="bg-card border-[1.5px] border-ink rounded-xl px-4 py-3.5 mt-2.5">
          <p className="text-[9.5px] font-bold uppercase tracking-[.06em] text-faint mb-2.5">
            Add a security the book does not have
          </p>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.1fr] gap-2.5 max-[900px]:grid-cols-2">
            {([['address', 'Security address'], ['lender', 'Lender'],
               ['loan', 'Loan owing'], ['value', 'Value']] as const).map(([k, label]) => (
              <div key={k}>
                <label className="block text-[10px] font-bold uppercase tracking-[.05em] text-muted mb-1">{label}</label>
                <input value={(form as any)[k]}
                  onChange={e => setForm({ ...form, [k]: e.target.value })}
                  className="w-full border border-field-line rounded-lg px-2.5 py-[7px] text-[12.5px] bg-card" />
              </div>
            ))}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[.05em] text-muted mb-1">Type</label>
              <div className="flex gap-1.5">
                {[[true, 'Investment'], [false, 'Owner occupied']].map(([v, label]) => (
                  <button key={String(label)} onClick={() => setForm({ ...form, investor: v as boolean })}
                    className={`text-[11.5px] rounded-lg px-2.5 py-[7px] border transition ${
                      form.investor === v
                        ? 'border-brand text-brand-ink bg-brand/5 font-semibold'
                        : 'border-card-line text-muted hover:bg-page'}`}>
                    {label as string}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center mt-3 flex-wrap">
            <button onClick={addIt} disabled={busy}
              className="text-[12.5px] rounded-lg px-4 py-2 font-semibold bg-ink text-page disabled:opacity-40">
              {busy ? 'Adding…' : 'Add it'}
            </button>
            <button onClick={() => { setAdding(false); setOops('') }}
              className="text-[12.5px] rounded-lg px-3.5 py-2 border border-card-line bg-card">Cancel</button>
            <span className="text-[11px] text-faint">
              LVR and usable equity work themselves out. Owner occupied is shown and never counted.
            </span>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="text-[12px] font-semibold text-brand-ink bg-card border border-brand rounded-lg px-3 py-1.5 mt-2.5">
          + Add a security
        </button>
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
  const [tile, setTile] = useState<Tile>('all')
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
      // THE TILE PRESSED AT THE TOP, by the same rule that counted it - and
      // "on the list" means the work left, so a review you closed is gone
      // from it the moment you close it.
      //
      // Picking a status by hand overrules the tile: choosing "Closed" has to
      // show you closed ones, or the dropdown would be a list of words that
      // return nothing.
      if (stage === 'all') { if (!matchesTile(r, tile, today)) return false }
      else if (r.status !== stage) return false
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
  }, [rows, stage, onlyDue, find, today, props, tile])

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
        <Count n={counts.onTheList} what="on the list"
          on={tile === 'all'} onPick={() => setTile('all')} />
        <Count n={counts.reviewed} what="reviewed"
          on={tile === 'reviewed'} onPick={() => setTile(tile === 'reviewed' ? 'all' : 'reviewed')} />
        <Count n={counts.awaitingReply} what="awaiting a reply"
          on={tile === 'awaiting'} onPick={() => setTile(tile === 'awaiting' ? 'all' : 'awaiting')} />
        <Count n={counts.toChase} what="to chase today" tone="info"
          on={tile === 'chase'} onPick={() => setTile(tile === 'chase' ? 'all' : 'chase')} />
        {/* THE ONES THAT CAME BACK ROUND. 26 Oct 2026 - the date you set when
            you closed one has always been saved and nothing ever counted it.
            Its own tile, because ringing somebody back a year later is a
            different job to finishing a conversation from last week. */}
        <Count n={counts.comingBack} what="coming back round" tone="chase"
          on={tile === 'coming'} onPick={() => setTile(tile === 'coming' ? 'all' : 'coming')} />
        <Count n={counts.becameDeals} what="became deals" tone="done"
          on={tile === 'deals'} onPick={() => setTile(tile === 'deals' ? 'all' : 'deals')} />
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

                <span className="min-w-0">
                  <StageBadge r={r} />
                  {/* WHY, IN ONE WORD, UNDER THE OUTCOME. "Not suitable now"
                      on its own is four words against a whole conversation. */}
                  {r.outcome_reason && (
                    <span className="block mt-1 text-[10.5px] text-waiting truncate">
                      {reasonLabel(r.outcome_reason)}
                    </span>
                  )}
                </span>
                <span className={`text-[11.5px] min-w-0 ${late ? 'text-info font-semibold' : 'text-muted'}`}>
                  {r.linked_deal_id ? 'became a deal' : whenDue(r.due_on, today) || '—'}
                  {r.outcome_note && (
                    <span className="block text-[10px] text-faint leading-tight truncate font-normal"
                      title={r.outcome_note}>{r.outcome_note}</span>
                  )}
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
