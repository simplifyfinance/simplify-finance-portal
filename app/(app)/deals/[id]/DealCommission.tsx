'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { calcCommission, lvrOf, money, type CommissionRate } from '@/lib/commission'
import { todayYmd } from '@/lib/periods'

// What this loan is EXPECTED to pay. Every figure comes from lib/commission.ts,
// the same function the reports use, so this can never disagree with them.
//
// Expected, not earned: it is the lender's rate card applied to the loan amount.
// What actually arrives can be less - an offset loan is paid on the drawn
// balance, so a $500k settlement with $100k sitting in offset pays on $400k.
// Saying "expected" here is the difference between a correct figure and somebody
// chasing SFG for money that was never owed.
export default function DealCommission({ deal }: { deal: any }) {
  const supabase = createSupabaseBrowser()
  const [rate, setRate] = useState<CommissionRate | null>(null)
  const [lenderName, setLenderName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      // Open to anyone who can open the deal. This is one loan's expected
      // upfront and trail, worked out from the loan amount and the lender's rate
      // card - arithmetic on figures already on the page, not the firm's book.
      // Fabio, 1 Sep 2026: "the commission doesn't really matter, it shouldn't
      // be a finance only ... that is restricted to finance, not the actual
      // commissions box on the deal card".
      //
      // sees_finance still gates the Commissions SECTION - revenue, trail book,
      // clawbacks, every broker. That stays exactly as it is.
      if (!deal?.lender_id) { setLoading(false); return }

      const [r, l] = await Promise.all([
        supabase.from('commission_rates').select('*').eq('lender_id', deal.lender_id).maybeSingle(),
        supabase.from('lenders').select('name').eq('id', deal.lender_id).maybeSingle(),
      ])
      setRate((r.data as any) || null)
      setLenderName((l.data as any)?.name || '')
      setLoading(false)
    })()
  }, [deal?.lender_id])

  if (!deal?.lodged_at) return null

  const amount = deal.settled_total ?? deal.lodged_total ?? deal.loan_amount ?? null
  const lvr = lvrOf(deal)
  const settledOn = deal.settled_at ? String(deal.settled_at).slice(0, 10) : null
  const c = calcCommission({ amount, rate, lvr, settledOn })

  const today = todayYmd()
  const inClawback = c.clawbackEndsOn ? today <= c.clawbackEndsOn : false

  const box = 'bg-white border border-[#EDE7DD] rounded-xl overflow-hidden mb-6'
  const k = 'text-[10px] font-bold uppercase tracking-[.08em] text-[#A29889] mb-1'

  return (
    <div className={box}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#F6F2EA] flex-wrap">
        <span className="text-[13.5px] font-semibold text-[#2E2A26]">Commission</span>
        <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-full px-2 py-[2px]">
          Expected
        </span>
        {lenderName && <span className="text-[11.5px] text-[#A29889] ml-auto">{lenderName}</span>}
      </div>

      {loading ? (
        <div className="px-4 py-5 text-[13px] text-[#A29889]">Loading the rate…</div>
      ) : !c.ok ? (
        <div className="px-4 py-4">
          <div className="bg-[#FDF6E7] border border-[#EFE0BC] rounded-lg px-3 py-2.5 text-[12.5px] text-[#7A5F17]">
            <strong className="text-[#5E4A11]">No commission figure.</strong>{' '}
            {c.reason}{!deal.lender_id ? ' — no lender recorded on this deal yet.' : '.'}
          </div>
          <p className="text-[11.5px] text-[#A29889] mt-2">
            Nothing is estimated. A figure appears once the missing piece is there.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 px-4 py-4 max-[820px]:grid-cols-1">
            <div>
              <div className={k}>Upfront</div>
              <div className="text-[21px] font-semibold tracking-[-.02em] text-[#2E2A26]">{money(c.upfront)}</div>
              <div className="text-[11.5px] text-[#A29889]">
                {c.upfrontPct}% {c.band ? `· ${c.band}` : ''} {c.gstInclusive ? '· inc GST' : '· ex GST'}
                {c.cappedAt !== null && ` · capped at ${money(c.cappedAt)}`}
              </div>
            </div>
            <div>
              <div className={k}>Trail</div>
              <div className="text-[21px] font-semibold tracking-[-.02em] text-[#2E2A26]">{money(c.trailYear)}</div>
              <div className="text-[11.5px] text-[#A29889]">
                {c.trailPct}% a year · {money(c.trailMonth)} a month at this balance
              </div>
            </div>
            <div>
              <div className={k}>Clawback</div>
              <div className="text-[21px] font-semibold tracking-[-.02em] text-[#2E2A26]">
                {c.clawbackMonths === null ? '—' : c.clawbackMonths === 0 ? 'None' : `${c.clawbackMonths} mo`}
              </div>
              <div className={`text-[11.5px] ${inClawback ? 'text-[#946017]' : 'text-[#A29889]'}`}>
                {c.clawbackMonths === 0
                  ? 'this lender claws back nothing'
                  : c.clawbackEndsOn
                    ? (inClawback ? `at risk until ${c.clawbackEndsOn}` : `clear since ${c.clawbackEndsOn}`)
                    : 'starts once the loan settles'}
              </div>
            </div>
          </div>
          <div className="px-4 py-2.5 border-t border-[#F6F2EA] bg-[#FDFCFA] text-[11.5px] text-[#A29889]">
            Worked out on {money(amount)}
            {deal.settled_at ? ' settled' : ' lodged, so it will change if the settled amount differs'}
            {lvr !== null && c.band ? ` · LVR ${lvr}%` : ''}
          </div>
        </>
      )}
    </div>
  )
}
