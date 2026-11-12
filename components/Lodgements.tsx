'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PAGE_WIDE } from '@/lib/page-width'
import { money } from '@/lib/money'
import { todayYmd, fyEndYear } from '@/lib/periods'
import { mondayOf, ymd, tabCounts } from '@/lib/lodging-when'
import {
  byBroker, totals, type Line2,
} from '@/lib/who-brought-us-this'
import { viewFor, dealsFor, mayEmail, VIEW_NOTE } from '@/lib/who-sees-the-numbers'
import LodgementSummary from '@/components/LodgementSummary'
import PartnerNote from '@/components/PartnerNote'

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

export default function Lodgements({
  deals: everything, brokerNames, brokerRows, splits, brands, role, brokerKey, meName,
}: {
  deals: any[]
  brokerNames?: Record<string, string>
  /** public.brokers, carrying team - which group each broker is in. */
  brokerRows?: any[]
  /** public.commission_splits - the referral partners and their saved note. */
  splits?: any[]
  /** settings.brands - only the banner on the partner note uses these. */
  brands?: any[]
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

      {/* LODGED, A LINE, THEN SETTLED - and one list that opens rather than a
        * summary followed by the same brokers all over again. The whole body
        * of the page is in here now. See components/LodgementSummary.tsx. */}
      {brokers.length === 0 ? (
        <div className="bg-card border border-dashed border-card-line rounded-xl py-8 text-center
          text-[13.5px] text-faint">
          Nothing lodged or settled in {span.label.toLowerCase()}.
        </div>
      ) : (
        <LodgementSummary lines={brokers} brokerRows={brokerRows}
          kind={kind} label={span.label} />
      )}

      {/* A NOTE TO A REFERRAL PARTNER, where the Friday email used to be.
        *
        * 12 Nov 2026. Fabio: "the whole thing of the Friday email is shit."
        * The fault was the automation - it wrote the email, chose the week and
        * sent four at once from notifications@ on a timer, with nothing but a
        * preview between him and the send.
        *
        * Admin only, because it goes outside the business. See
        * lib/who-sees-the-numbers.ts and components/PartnerNote.tsx. */}
      {mayEmail(view) && (
        <PartnerNote deals={deals} splits={splits || []} brands={brands || []}
          meName={meName} />
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
