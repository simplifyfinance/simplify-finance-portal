'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { money } from '@/lib/money'
import { SkelRows, SkelTile } from '@/components/Skeleton'
import {
  STAGES, stageLabel, outcomeLabel, countsFor, sortForTheList,
  dueState, whenDue, fullName, type Stage,
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
}

const CARD = 'bg-card border border-card-line rounded-xl overflow-hidden'
const PILL = 'text-[10.5px] font-semibold rounded-full px-2.5 py-[3px] whitespace-nowrap border'
const BLURB = 'Existing clients who may have usable equity. You run the numbers; this keeps the list.'
const GRID = 'grid grid-cols-[minmax(0,1.5fr)_110px_132px_104px_104px_96px_minmax(0,1fr)] gap-3 items-center'

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

export default function PortfolioReview() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [why, setWhy] = useState('')
  const [stage, setStage] = useState<'all' | Stage>('all')
  const [onlyDue, setOnlyDue] = useState(false)
  const [find, setFind] = useState('')

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
  }, [])

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
        const hay = `${fullName(r)} ${r.email || ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    return sortForTheList(kept, today) as Row[]
  }, [rows, stage, onlyDue, find, today])

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
      </div>

      <div className={`${GRID} px-4 pb-2 text-[9.5px] font-bold uppercase tracking-[.06em] text-faint`}>
        <span>Client</span><span>Portfolio</span><span>Status</span><span>Last reviewed</span>
        <span>Next</span><span>Email sent</span><span>Last contact</span>
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
          return (
            <Link key={r.review_id} href={`/clients/${r.client_id}`}
              className={`${GRID} px-4 py-2.5 border-t border-line-soft first:border-t-0 text-[12.5px] hover:bg-page transition`}>
              <span className="font-semibold text-ink truncate">
                {fullName(r) || 'No name'}
                {r.opted_out && <span className="ml-2 text-[10.5px] text-faint font-normal">opted out</span>}
              </span>
              <span className="text-[11.5px] text-muted">
                {r.properties} {r.properties === 1 ? 'property' : 'properties'}
              </span>
              <StageBadge r={r} />
              <span className="text-[11.5px] text-muted">
                {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('en-AU',
                  { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </span>
              <span className={`text-[11.5px] ${late ? 'text-info font-semibold' : 'text-muted'}`}>
                {whenDue(r.due_on, today) || '—'}
              </span>
              <span className="text-[11.5px] text-muted">
                {r.email_sent_at ? whenDue(r.email_sent_at.slice(0, 10), today) : '—'}
              </span>
              <span className="text-[11.5px] text-muted truncate">
                {r.linked_deal_id
                  ? 'became a deal'
                  : [r.calls ? `${r.calls} ${r.calls === 1 ? 'call' : 'calls'}` : '',
                     r.usable_equity ? `${money(r.usable_equity)} usable` : '']
                      .filter(Boolean).join(' · ') || '—'}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
