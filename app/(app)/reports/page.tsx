'use client'
import { useEffect, useMemo, useState } from 'react'
import { PAGE_WIDE } from '@/lib/page-width'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { money } from '@/lib/money'
import PortfolioReview from '@/components/PortfolioReview'
import {
  exposure, totalsFor, sourceLine,
  type Holding as ExposureHolding, type Named, type Row as ExposureRow,
} from '@/lib/lvr-exposure'

export default function ReportsPage() {
  const supabase = createSupabaseBrowser()
  // THE THIRD TAB. 15 Oct 2026 - existing clients who may be sitting on equity.
  // See components/PortfolioReview.tsx; unlike the two beside it, that one reads
  // a view rather than unpacking the whole book in the browser.
  const [tab, setTab] = useState<'rate' | 'lvr' | 'portfolio'>('rate')
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [rateThreshold, setRateThreshold] = useState('6.50')

  // LVR EXPOSURE READS THE BOOK, NOT THE 33.
  //
  // 21 Oct 2026. Both reports read clients.position_properties, which holds 33
  // properties across the whole portal - the few clients who have been through
  // a full fact find here. Thirty rows looks like a report, so nobody noticed
  // it was showing about four percent of the lending. The portfolio review
  // holds 760 of them.
  //
  // RATE EXPOSURE STAYS WHERE IT IS. The client's interest rate is recorded on
  // the position and nowhere else - not in the book, and not on a trail
  // statement, which pays a percentage of the balance to US and says nothing
  // about what the client pays the bank.
  const [holdings, setHoldings] = useState<ExposureHolding[] | null>(null)
  const [named, setNamed] = useState<Named[]>([])
  const [lvrWhy, setLvrWhy] = useState('')
  const [band, setBand] = useState<'all' | 'hot' | 'warm' | 'cool'>('all')
  // TODAY'S FIGURES, OR HISTORY. Opens on today's, which is the only thing on
  // this screen anybody can act on. See the comment on Totals in
  // lib/lvr-exposure.ts for why that matters more than it sounds.
  const [basis, setBasis] = useState<'current' | 'book' | 'all'>('current')
  const [homes, setHomes] = useState(true)
  const [findOne, setFindOne] = useState('')

  useEffect(() => {
    document.title = 'Reports — Simplify Finance'
  }, [])

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('clients').select('id, first_name, last_name, position_properties').not('position_properties', 'is', null)
      setClients(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Only when somebody is looking at it. 760 properties and 656 names is not
  // something to read on the way past to Rate exposure.
  useEffect(() => {
    if (tab !== 'lvr' || holdings !== null) return
    let gone = false
    ;(async () => {
      const [h, r] = await Promise.all([
        supabase.from('portfolio_review_properties')
          .select('review_id, address, investor, original_value, original_loan, current_balance, balance_as_at, estimated_current_value, valuation_date')
          .limit(20000),
        supabase.from('portfolio_review_list').select('review_id, first_name, last_name').limit(5000),
      ])
      if (gone) return
      // A MISSING TABLE IS SOMETHING NOBODY HAS SET UP, NOT AN EMPTY REPORT.
      // "Nothing here" and "the SQL was never run" look identical on screen.
      if (h.error) { setLvrWhy(h.error.message); setHoldings([]); return }
      setHoldings((h.data || []) as ExposureHolding[])
      setNamed((r.data || []) as Named[])
    })()
    return () => { gone = true }
  }, [tab, holdings])

  const lvrAll = useMemo(
    () => exposure(holdings || [], named), [holdings, named])

  const lvrShown = useMemo(() => {
    const needle = findOne.trim().toLowerCase()
    return lvrAll.filter(r => {
      if (!homes && !r.investor) return false
      if (basis === 'current' && !r.current) return false
      if (basis === 'book' && r.current) return false
      if (band !== 'all' && r.band !== band) return false
      if (needle && !`${r.client} ${r.address}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [lvrAll, homes, band, findOne, basis])

  const lvrTotals = useMemo(
    () => totalsFor(homes ? lvrAll : lvrAll.filter(r => r.investor)), [lvrAll, homes])

  const rateRows = clients.flatMap((c: any) =>
    (c.position_properties || []).flatMap((p: any) =>
      (p.loans || []).map((l: any) => ({
        clientId: c.id,
        clientName: `${c.first_name} ${c.last_name}`,
        propertyAddress: p.address || 'Address not set',
        lenderName: l.lenderName || 'Not set',
        rate: Number(l.interestRate) || 0
      }))
    )
  ).filter(r => r.rate > (Number(rateThreshold) || 0))
    .sort((a, b) => b.rate - a.rate)

  // THE OLD LVR ROWS WERE HERE, READING clients.position_properties.
  //
  // 21 Oct 2026. Removed, not left in place unused: it unpacked every client
  // position on every page load to build a report nobody reads any more. The
  // rate report below still needs that data and still loads it.

  return (
    <div className={PAGE_WIDE}>
      <p className="text-lg font-medium text-ink mb-4">Reports</p>

      {/* The approved sub-navigation, from the mock Fabio signed off on 15 Oct
          2026. It replaces bg-gray-100 / text-gray-500, which were raw Tailwind
          greys rather than the portal's own tokens and did not follow dark
          mode. */}
      <div className="inline-flex gap-0.5 bg-track rounded-[10px] p-[3px] w-fit mb-5">
        {([['rate', 'Rate exposure'], ['lvr', 'LVR exposure'],
           ['portfolio', 'Portfolio review']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-[7px] transition ${tab === k
              ? 'bg-card text-brand-ink shadow-sm' : 'text-muted hover:text-body'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'portfolio' ? (
        <PortfolioReview />
      ) : loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : tab === 'rate' ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">Show loans with a rate above</span>
            <input type="text" value={rateThreshold} onChange={e => setRateThreshold(e.target.value)}
              className="w-16 text-sm px-2 py-1.5 border border-gray-300 rounded-lg text-center" />
            <span className="text-sm text-gray-500">%</span>
          </div>
          <div className="bg-card border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1.5fr_2fr_1fr_0.8fr] px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <span>Client</span><span>Property</span><span>Lender</span><span>Rate</span>
            </div>
            {rateRows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">No loans found above this threshold.</div>
            ) : rateRows.map((r, i) => (
              <Link key={i} href={`/clients/${r.clientId}`} className="grid grid-cols-[1.5fr_2fr_1fr_0.8fr] px-4 py-3 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                <span>{r.clientName}</span><span>{r.propertyAddress}</span><span>{r.lenderName}</span><span className="font-medium text-red-600">{r.rate}%</span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <LvrExposure
          rows={lvrShown} totals={lvrTotals} all={lvrAll} loaded={holdings !== null} why={lvrWhy}
          band={band} setBand={setBand} homes={homes} setHomes={setHomes}
          find={findOne} setFind={setFindOne} basis={basis} setBasis={setBasis} />
      )}
    </div>
  )
}


// THE GRID. Five columns, same as the report has always had, sorted worst
// first. What is new is the grey line under each figure saying where it came
// from - a 53% LVR against a settlement value from 2016 is not 53%, and the
// screen has to say which rows are like that.
const LVR_GRID = 'grid grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)_132px_132px_78px] gap-3'

function Tile({ n, what, tone }: { n: string; what: string; tone?: 'chase' | 'done' }) {
  const edge = tone === 'chase' ? 'bg-chase-bg border-chase-edge'
             : tone === 'done' ? 'bg-done-bg border-done-edge'
             : 'bg-card border-card-line'
  const ink = tone === 'chase' ? 'text-chase' : tone === 'done' ? 'text-done' : 'text-ink'
  return (
    <div className={`border rounded-xl px-3.5 py-2.5 min-w-[118px] ${edge}`}>
      <b className={`block text-[18px] leading-tight ${ink}`}>{n}</b>
      <span className="text-[11px] text-muted">{what}</span>
    </div>
  )
}

function LvrExposure({ rows, totals, all, loaded, why, band, setBand, homes, setHomes, find, setFind,
                      basis, setBasis }: {
  rows: ExposureRow[]
  totals: ReturnType<typeof totalsFor>
  all: ExposureRow[]
  loaded: boolean
  why: string
  band: 'all' | 'hot' | 'warm' | 'cool'
  setBand: (b: 'all' | 'hot' | 'warm' | 'cool') => void
  homes: boolean
  setHomes: (v: boolean) => void
  find: string
  setFind: (v: string) => void
  basis: 'current' | 'book' | 'all'
  setBasis: (b: 'current' | 'book' | 'all') => void
}) {
  if (!loaded) return <div className="text-[13px] text-muted">Reading the book…</div>

  const SEG = 'text-[11.5px] rounded-full px-3 py-[4px] border transition'
  const millions = totals.lending >= 1000000
    ? `$${Math.round(totals.lending / 1000000)}m`
    : money(totals.lending)

  return (
    <div>
      {why && (
        <div className="mb-3 border border-info-edge bg-info-bg rounded-xl px-4 py-3">
          <b className="block text-[13px] text-info mb-0.5">The book could not be read</b>
          <p className="text-[12px] text-body">
            {why} — docs/portfolio-review-schema.sql may not have been run on this database yet.
          </p>
        </div>
      )}

      {/* ONLY WHAT IS TODAY'S FIGURE IS COUNTED AS EXPOSURE. The first version
          of these tiles said "359 at 80% or over" in red across the top. 308
          of those were settlement-day LVRs - a 10% deposit purchase is 90% on
          the day it settles - and 39 were construction, where the value is the
          land and the loan is land plus build. None of it was risk. */}
      <div className="flex gap-2 flex-wrap mb-3">
        <Tile n={String(totals.current)} what="on today’s figures" tone={totals.current > 0 ? 'done' : undefined} />
        <Tile n={String(totals.over80)} what="at 80% or over" tone={totals.over80 > 0 ? 'chase' : undefined} />
        <Tile n={String(totals.between)} what="70% to 80%" />
        <Tile n={String(totals.stillOnBook)} what="still on book figures" />
        <Tile n={millions} what="lending on the book" />
      </div>

      {totals.current === 0 && totals.stillOnBook > 0 && (
        <div className="mb-3 border border-info-edge bg-info-bg rounded-xl px-4 py-3">
          <b className="block text-[13px] text-info mb-0.5">No LVR here is current yet</b>
          <p className="text-[12px] text-body leading-relaxed">
            Every one of these {totals.stillOnBook} properties is showing what the loan and the value
            were when it settled. A purchase with a 10% deposit was 90% on that day and may be 55%
            now — this screen cannot tell you which. Press <b>Refresh balances</b> on the Portfolio
            review tab and the loan side becomes the lender’s own figure.
          </p>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap mb-2">
        {([['current', `Today’s figures (${totals.current})`],
           ['book', `At settlement (${totals.stillOnBook})`],
           ['all', 'Both']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setBasis(k)}
            className={`text-[11.5px] rounded-lg px-3 py-[5px] border transition ${basis === k
              ? 'bg-info-bg border-info-edge text-info font-semibold'
              : 'bg-card border-line text-muted hover:bg-page'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center flex-wrap mb-3">
        <div className="flex gap-1.5">
          {([['all', 'All'], ['hot', 'Over 80%'], ['warm', '70–80%'],
             ['cool', 'Under 70%']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setBand(k)}
              className={`${SEG} ${band === k
                ? 'bg-ink border-ink text-page font-semibold'
                : 'bg-card border-line text-muted hover:bg-page'}`}>
              {label}
            </button>
          ))}
        </div>
        <input value={find} onChange={e => setFind(e.target.value)} placeholder="Search a client or street"
          className="text-[11.5px] bg-card border border-card-line rounded-lg px-2.5 py-[6px] min-w-[200px]" />
        <span className="ml-auto" />
        {/* The home is not counted for equity anywhere on this portal, but it is
            still lending against a security, so it is on the exposure report. */}
        <button onClick={() => setHomes(!homes)}
          className={`${SEG} ${homes
            ? 'bg-card border-line text-muted hover:bg-page'
            : 'bg-info-bg border-info-edge text-info font-semibold'}`}>
          {homes ? 'Investment only' : 'Showing investments only'}
        </button>
      </div>

      <div className={`${LVR_GRID} px-4 pb-2 text-[10px] font-semibold uppercase tracking-[.04em] text-faint`}>
        <span>Client</span><span>Property</span>
        <span className="text-right">Value</span><span className="text-right">Loan balance</span>
        <span className="text-right">LVR</span>
      </div>

      <div className="bg-card border border-card-line rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] text-ink font-medium mb-1">
              {all.length === 0 ? 'Nothing on the book has both a value and a loan yet.'
                : basis === 'current' && totals.current === 0 ? 'No loan on the book is current yet.'
                : 'Nothing matches that.'}
            </p>
            <p className="text-[12px] text-muted max-w-[520px] mx-auto leading-relaxed">
              {all.length === 0
                ? 'Import the book on the Portfolio review tab and they appear here.'
                : basis === 'current' && totals.current === 0
                  ? 'Press Refresh balances on the Portfolio review tab, or switch to At settlement to see what the book holds.'
                  : 'Try a different band, or clear the search.'}
            </p>
          </div>
        ) : rows.slice(0, 500).map((r, i) => (
          <div key={`${r.reviewId}-${i}`}
            className={`${LVR_GRID} px-4 py-3 border-b border-line-soft last:border-0 items-center`}>
            <span className="text-[13px] text-body truncate">
              {r.client}
              {!r.investor && <span className="block text-[10px] text-faint leading-tight">their home</span>}
            </span>
            <span className="text-[13px] text-body truncate">{r.address}</span>
            <span className="text-[13px] text-right text-ink">
              {money(r.value)}
              <span className="block text-[10px] text-faint leading-tight font-normal">
                {sourceLine(r.valueFrom)}
              </span>
            </span>
            <span className="text-[13px] text-right text-ink">
              {money(r.loan)}
              <span className="block text-[10px] text-faint leading-tight font-normal">
                {sourceLine(r.loanFrom)}
              </span>
            </span>
            {/* COLOUR IS A CLAIM, SO ONLY TODAY'S FIGURES GET IT. Red where
                LMI starts, purple for the ones that cross it if a value
                softens. A settlement LVR is printed plain and grey: it is
                history, and painting it red tells somebody to act on a number
                from 2016. No amber anywhere. */}
            <span className={`text-[13px] text-right ${!r.current ? 'text-faint'
              : r.band === 'hot' ? 'text-chase font-semibold'
              : r.band === 'warm' ? 'text-waiting font-semibold' : 'text-body font-semibold'}`}>
              {r.lvr}%
              {!r.current && (
                <span className="block text-[10px] text-faint leading-tight font-normal">
                  at settlement
                </span>
              )}
            </span>
          </div>
        ))}
        {rows.length > 500 && (
          <p className="px-4 py-2.5 text-[11.5px] text-faint">
            Showing the worst 500 of {rows.length}. Narrow it with the bands or the search.
          </p>
        )}
      </div>

      <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
        An LVR is only worth reading where both halves are current. The loan can be the lender’s own
        figure once balances are refreshed; the value never is — it is an estimate somebody looked up,
        or what the property was worth the day the loan settled. Anything marked at settlement is
        history: a 90% there was a 10% deposit, not a problem.
      </p>
    </div>
  )
}
