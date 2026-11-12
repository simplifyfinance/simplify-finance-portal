'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PAGE_WIDE } from '@/lib/page-width'
import { money } from '@/lib/money'
import { todayYmd, fyEndYear } from '@/lib/periods'
import { mondayOf, ymd, tabCounts } from '@/lib/lodging-when'
import {
  byBroker, totals, dayWords, lenderOf, termsWords, referralInside, dealsInside,
  referralName, UNANSWERED, type Line2,
} from '@/lib/who-brought-us-this'
import { viewFor, dealsFor, mayEmail, VIEW_NOTE } from '@/lib/who-sees-the-numbers'

// WHAT WE LODGED AND SETTLED, GROUPED BY BROKER.
//
// 12 Nov 2026. Fabio, on the first version: "admin need to per broker number
// of deals / name of the clients / dollar amount and within the broker the
// breakdown on referral splits."
//
// So the broker is the HEADING and the clients are the table. The first
// version had two tables of totals side by side, which answers "how many" and
// never answers "which ones" - and a number with no names behind it is the
// one thing nobody can act on.
//
// THE REFERRAL IS A COLUMN AND A LINE. On the row because you want to know
// which deal came from where; summed under the broker because "two of Mark's
// four were Justin's" is the sentence that manages the relationship.
//
// EVERYBODY SEES THE SAME PAGE. Fabio, asked what staff should see: the whole
// team, same detail. A broker gets their own deals under their own heading,
// and nothing is restyled for them - a page that changes shape depending on
// who opens it is a page people compare notes about. The only thing held back
// is the Friday email, which sends to referral partners.

type Kind = 'week' | 'month' | 'fy'

const CARD = 'bg-card border border-card-line rounded-xl px-4 py-3.5'
const TH = 'text-[9.5px] font-bold tracking-[.08em] uppercase text-faint text-left px-3.5 py-2 ' +
           'border-b border-line-soft'
const TD = 'text-[12.5px] text-body px-3.5 py-2.5 border-b border-line-soft align-middle'

function spanFor(kind: Kind, now: Date): { from: string; to: string; label: string } {
  const to = ymd(now)
  if (kind === 'week') return { from: mondayOf(now), to, label: 'This week' }
  if (kind === 'month') {
    const p = (n: number) => String(n).padStart(2, '0')
    return { from: `${now.getFullYear()}-${p(now.getMonth() + 1)}-01`, to, label: 'This month' }
  }
  const end = fyEndYear(todayYmd())
  return { from: `${end - 1}-07-01`, to, label: `FY${String(end).slice(2)}` }
}

export default function Lodgements({ deals: everything, brokerNames, role, brokerKey }: {
  deals: any[]
  brokerNames?: Record<string, string>
  role?: string
  brokerKey?: string
  meName?: string
}) {
  const now = useMemo(() => new Date(), [])
  const [kind, setKind] = useState<Kind>('week')
  const view = viewFor(role)
  const deals = dealsFor(view, everything, brokerKey)

  const span = spanFor(kind, now)
  const sum = totals(deals, span)
  const brokers = byBroker(deals, span, brokerNames)
  const ahead = tabCounts(deals, now)

  const [draft, setDraft] = useState<any>(null)
  const [busy, setBusy] = useState('')
  const [said, setSaid] = useState('')

  async function run(preview: boolean) {
    setBusy(preview ? 'preview' : 'send'); setSaid('')
    try {
      const res = await fetch('/api/weekly-lodgements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) { setSaid(data?.error || 'That did not work.'); setBusy(''); return }
      setDraft(data)
      if (!preview) {
        const went = [data.management, ...(data.referrers || [])].filter((x: any) => x?.sent).length
        setSaid(`${went} ${went === 1 ? 'email' : 'emails'} sent.`)
      }
    } catch (e: any) {
      setSaid(e?.message || 'That did not work.')
    }
    setBusy('')
  }

  return (
    <div className={PAGE_WIDE + ' px-6 py-6'}>
      <div className="flex items-baseline gap-2 mb-1">
        <h1 className="text-[18px] font-bold text-ink m-0">Lodged and settled</h1>
        <span className="text-[12.5px] text-faint">{span.label}</span>
      </div>
      <p className="text-[12px] text-faint m-0 mb-4 max-w-[760px]">
        Read off the day each deal was marked lodged and the day it settled. Nothing here is typed
        in, so it cannot disagree with the board. {VIEW_NOTE[view]}
      </p>

      <span className="inline-flex gap-0.5 bg-line-soft rounded-[9px] p-[3px] mb-4">
        {([['week', 'This week'], ['month', 'This month'],
           ['fy', `FY${String(fyEndYear(todayYmd())).slice(2)}`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setKind(k as Kind)}
            className={`text-[12px] font-semibold px-3.5 py-[5px] rounded-md transition ${
              kind === k ? 'bg-card text-brand-ink shadow-sm' : 'text-muted'}`}>
            {label}
          </button>
        ))}
      </span>

      {brokers.length === 0 ? (
        <div className="bg-card border border-dashed border-card-line rounded-xl py-8 text-center
          text-[13.5px] text-faint">
          Nothing lodged or settled in {span.label.toLowerCase()}.
        </div>
      ) : brokers.map(b => <Broker key={b.key} line={b} />)}

      {/* THE FRIDAY EMAIL. Admin only - one of these goes to a referral
        * partner. See lib/who-sees-the-numbers.ts. */}
      {kind === 'week' && mayEmail(view) && (
        <div className={CARD + ' mt-4'}>
          <p className="text-[13.5px] font-bold text-ink m-0 mb-0.5">The Friday email</p>
          <p className="text-[11.5px] text-faint m-0 mb-2.5 leading-[1.45]">
            One for management, and one for each referral partner who had something this week.
            A partner with nothing gets nothing.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => void run(true)} disabled={!!busy}
              className="text-[12px] font-semibold rounded-lg px-3 py-1.5 border border-line
                bg-card text-muted hover:bg-page disabled:opacity-50">
              {busy === 'preview' ? 'Reading…' : 'Show me what would go'}
            </button>
            {draft && (
              <button onClick={() => void run(false)} disabled={!!busy}
                className="text-[12px] font-semibold rounded-lg px-3 py-1.5 bg-ink text-page
                  disabled:opacity-50">
                {busy === 'send' ? 'Sending…' : `Send ${1 + (draft.referrers?.length || 0)}`}
              </button>
            )}
            {said && <span className="text-[11.5px] text-done font-semibold">{said}</span>}
          </div>

          {draft && (
            <div className="mt-3">
              {[draft.management, ...(draft.referrers || [])].filter(Boolean).map((e: any, i: number) => (
                <div key={i} className="border border-card-line bg-page rounded-[10px] px-3 py-2.5 mt-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[12px] font-bold text-ink">{e.subject}</span>
                    <span className="ml-auto text-[11px] text-faint">
                      {e.to?.length ? e.to.join(', ') : 'nobody'}
                    </span>
                  </div>
                  {e.error
                    ? <p className="text-[11.5px] text-chase m-0 mt-1">{e.error}</p>
                    : <pre className="text-[11.5px] text-body leading-[1.55] m-0 mt-1.5
                        whitespace-pre-wrap font-sans">{e.body}</pre>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AND WHAT IS COMING. A week's result with no forward line is half the
        * picture - the deals with no week set are what decides next week. */}
      <p className="text-[12.5px] text-muted leading-[1.6] mt-4">
        <b className="text-ink">{sum.lodged}</b> lodged and <b className="text-ink">{sum.settled}</b>{' '}
        settled in {span.label.toLowerCase()} — {money(sum.lodgedAmount)} and{' '}
        {money(sum.settledAmount)}. Due to lodge next week:{' '}
        <b className="text-ink">{ahead.next_week}</b> · still with no week set:{' '}
        <b className="text-ink">{ahead.no_week}</b>.{' '}
        <Link href="/dashboard" className="font-semibold text-brand-ink no-underline">
          The list →
        </Link>
      </p>
    </div>
  )
}

function Broker({ line }: { line: Line2 }) {
  const rows = dealsInside(line)
  const splits = referralInside(line)
  return (
    <div className="bg-card border border-card-line rounded-xl mb-2.5 overflow-hidden">
      <div className="flex items-baseline gap-2.5 px-3.5 py-2.5 bg-page border-b border-line-soft
        flex-wrap">
        <span className="text-[14px] font-bold text-ink">{line.name}</span>
        <span className="text-[12px] text-muted">
          {line.lodged.length} lodged{line.settled.length ? ` · ${line.settled.length} settled` : ''}
        </span>
        <span className="ml-auto text-[13px] font-bold text-ink tabular-nums">
          {money(line.lodgedAmount) || '—'} lodged
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead><tr>
          <th className={TH}>Client</th><th className={TH}>Lender</th>
          <th className={TH}>What</th><th className={TH}>Day</th>
          <th className={TH}>Referral</th><th className={TH + ' text-right'}>Amount</th>
        </tr></thead>
        <tbody>
          {rows.map(({ deal: d, what }, i) => (
            <tr key={d.id + what + i}>
              <td className={TD}>
                <Link href={`/deals/${d.id}`} className="font-semibold text-ink hover:text-brand-ink">
                  {d.deal_name || 'Untitled deal'}
                </Link>
              </td>
              <td className={TD}>{lenderOf(d) || '—'}</td>
              <td className={TD}>
                <span className={`text-[10px] font-bold rounded-md px-2 py-0.5 border ${
                  what === 'settled'
                    ? 'bg-done-bg text-done border-done-edge'
                    : 'bg-info-bg text-brand-ink border-info-edge'}`}>
                  {what === 'settled' ? 'Settled' : 'Lodged'}
                </span>
              </td>
              <td className={TD + ' text-faint'}>{dayWords(d, what)}</td>
              <td className={TD}>
                {termsWords(d)
                  ? <span className="text-ink font-semibold">{termsWords(d)}</span>
                  : <span className="text-faint">{referralName(d)}</span>}
              </td>
              <td className={TD + ' text-right font-semibold text-ink tabular-nums'}>
                {money((d.settled_total ?? d.lodged_total ?? d.loan_amount) || 0) || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* WHO BROUGHT THIS BROKER'S WORK, added up. The same figures as the
        * column above, read the other way a person reads them. */}
      <div className="flex gap-4 flex-wrap px-3.5 py-2.5 border-t border-line-soft bg-[#FCFBF9]
        text-[11.5px] text-muted">
        <span className="text-[9.5px] font-bold tracking-[.08em] uppercase text-faint self-center">
          Referral split
        </span>
        {splits.map(r => (
          <span key={r.key} className={r.key === UNANSWERED ? 'text-faint' : ''}>
            <b className={r.key === UNANSWERED ? '' : 'text-ink'}>{r.name}</b>{' '}
            {r.lodged.length + r.settled.length} · {money(r.lodgedAmount + r.settledAmount) || '—'}
          </span>
        ))}
      </div>
    </div>
  )
}
