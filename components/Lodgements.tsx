'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PAGE_WIDE } from '@/lib/page-width'
import { money } from '@/lib/money'
import { todayYmd, fyEndYear } from '@/lib/periods'
import { mondayOf, ymd, tabCounts } from '@/lib/lodging-when'
import {
  byReferral, byBroker, totals, dayWords, lenderOf, termsWords, type Line2,
} from '@/lib/who-brought-us-this'

// WHAT WE LODGED AND SETTLED, AND WHO BROUGHT IT.
//
// 11 Nov 2026. This is the Teams channel, except that nobody types in it.
// Every figure is read off the day somebody pressed Mark as lodged and the day
// the deal settled, so this page and the board cannot disagree.
//
// TWO BREAKDOWNS, SIDE BY SIDE. Fabio: "I want the reports to be able to say
// how many deals we did on this referral split... but also which deals each
// broker did in a week, because that allows me to run the business." They are
// two questions and a deal is in both, once each.
//
// AND EVERY NUMBER OPENS. "Pat lodged three" is a claim until somebody can see
// which three, on what day, with which lender. That is the difference between
// a report people argue with and one they act on.

type Kind = 'week' | 'month' | 'fy'

const CARD = 'bg-card border border-card-line rounded-xl px-4 py-3.5'
const TH = 'text-[9.5px] font-bold tracking-[.08em] uppercase text-faint text-left py-2 ' +
           'border-b border-line-soft'
const TD = 'text-[12.5px] text-body py-2.5 border-b border-line-soft align-middle'

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

export default function Lodgements({ deals, brokerNames }: {
  deals: any[]
  brokerNames?: Record<string, string>
}) {
  const now = useMemo(() => new Date(), [])
  const [kind, setKind] = useState<Kind>('week')
  const [open, setOpen] = useState<string>('')
  // THE FRIDAY EMAIL, BY HAND. The schedule is what makes it automatic; this
  // is what makes it usable the day it ships - and a preview first, so nobody
  // presses send to find out what would go.
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

  const span = spanFor(kind, now)
  const sum = totals(deals, span)
  const referral = byReferral(deals, span)
  const brokers = byBroker(deals, span, brokerNames)
  const ahead = tabCounts(deals, now)

  const opened: Line2 | null =
    referral.find(r => 'ref:' + r.key === open) || brokers.find(r => 'br:' + r.key === open) || null

  return (
    <div className={PAGE_WIDE + ' px-6 py-6'}>
      <div className="flex items-baseline gap-2 mb-1">
        <h1 className="text-[18px] font-bold text-ink m-0">Lodged and settled</h1>
        <span className="text-[12.5px] text-faint">{span.label}</span>
      </div>
      <p className="text-[12px] text-faint m-0 mb-4 max-w-[720px]">
        Read off the day each deal was marked lodged and the day it settled. Nothing here is typed
        in, so it cannot disagree with the board.
      </p>

      <span className="inline-flex gap-0.5 bg-line-soft rounded-[9px] p-[3px] mb-4">
        {([['week', 'This week'], ['month', 'This month'],
           ['fy', `FY${String(fyEndYear(todayYmd())).slice(2)}`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setKind(k as Kind); setOpen('') }}
            className={`text-[12px] font-semibold px-3.5 py-[5px] rounded-md transition ${
              kind === k ? 'bg-card text-brand-ink shadow-sm' : 'text-muted'}`}>
            {label}
          </button>
        ))}
      </span>

      <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <Side title="By who brought it" blurb="The commission split chosen on the fact find."
          head="Referral" rows={referral} terms open={open} setOpen={setOpen} prefix="ref:" />
        <Side title="By broker" blurb="Whose deal it is on the card."
          head="Broker" rows={brokers} open={open} setOpen={setOpen} prefix="br:" />
      </div>

      {opened && (
        <div className={CARD + ' mt-3'}>
          <p className="text-[13.5px] font-bold text-ink m-0 mb-0.5">
            {opened.name} — {opened.lodged.length} lodged, {opened.settled.length} settled
          </p>
          <p className="text-[11.5px] text-faint m-0 mb-2.5">
            Every number opens into the deals behind it. Nothing here is a total you cannot check.
          </p>
          <table className="w-full border-collapse">
            <thead><tr>
              <th className={TH}>Deal</th><th className={TH}>Lender</th>
              <th className={TH}>Referral</th><th className={TH}>What</th>
              <th className={TH}>Day</th><th className={TH + ' text-right'}>Amount</th>
            </tr></thead>
            <tbody>
              {[...opened.lodged.map(d => ({ d, what: 'Lodged' as const })),
                ...opened.settled.map(d => ({ d, what: 'Settled' as const }))].map(({ d, what }, i) => (
                <tr key={d.id + what + i}>
                  <td className={TD}>
                    <Link href={`/deals/${d.id}`} className="font-semibold text-ink hover:text-brand-ink">
                      {d.deal_name || 'Untitled deal'}
                    </Link>
                  </td>
                  <td className={TD}>{lenderOf(d) || '—'}</td>
                  <td className={TD + ' text-faint'}>{termsWords(d) || '—'}</td>
                  <td className={TD}>
                    <span className={`text-[10.5px] font-bold rounded-md px-2 py-0.5 border ${
                      what === 'Settled'
                        ? 'bg-done-bg text-done border-done-edge'
                        : 'bg-info-bg text-brand-ink border-info-edge'}`}>{what}</span>
                  </td>
                  <td className={TD + ' text-faint'}>
                    {dayWords(d, what === 'Settled' ? 'settled' : 'lodged')}
                  </td>
                  <td className={TD + ' text-right font-semibold text-ink tabular-nums'}>
                    {money((d.settled_total ?? d.lodged_total ?? d.loan_amount) || 0) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* THE FRIDAY EMAIL. One for management, one per referral partner who had
        * something this week - and nothing at all for a partner who had
        * nothing. See lib/the-friday-email.ts. */}
      {kind === 'week' && (
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

function Side({ title, blurb, head, rows, terms, open, setOpen, prefix }: {
  title: string; blurb: string; head: string; rows: Line2[]; terms?: boolean
  open: string; setOpen: (v: string) => void; prefix: string
}) {
  const TH2 = TH
  return (
    <div className={CARD}>
      <p className="text-[13.5px] font-bold text-ink m-0 mb-0.5">{title}</p>
      <p className="text-[11.5px] text-faint m-0 mb-2.5 leading-[1.45]">{blurb}</p>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-faint m-0">Nothing in this period.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead><tr>
            <th className={TH2}>{head}</th>
            {terms && <th className={TH2}>Terms</th>}
            <th className={TH2 + ' text-right'}>Lodged</th>
            <th className={TH2 + ' text-right'}>Settled</th>
            <th className={TH2 + ' text-right'}>Lodged $</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const id = prefix + r.key
              return (
                <tr key={id} onClick={() => setOpen(open === id ? '' : id)}
                  className={`cursor-pointer ${open === id ? 'bg-page' : 'hover:bg-page'}`}>
                  <td className={TD + ' font-semibold text-ink'}>{r.name}</td>
                  {terms && <td className={TD + ' text-faint'}>{r.terms || '—'}</td>}
                  <td className={TD + ' text-right font-bold text-ink tabular-nums'}>{r.lodged.length}</td>
                  <td className={TD + ' text-right font-bold text-ink tabular-nums'}>{r.settled.length}</td>
                  <td className={TD + ' text-right font-bold text-ink tabular-nums'}>
                    {money(r.lodgedAmount) || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
