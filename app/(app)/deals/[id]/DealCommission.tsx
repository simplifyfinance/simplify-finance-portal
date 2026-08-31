'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { calcCommission, lvrOf, money, type CommissionRate } from '@/lib/commission'
import { todayYmd } from '@/lib/periods'

// What this loan pays. Finance only - commissions are not visible to the rest of
// the team. Every figure comes from lib/commission.ts, the same function the
// reports use, so this can never disagree with them.
export default function DealCommission({ deal }: { deal: any }) {
  const supabase = createSupabaseBrowser()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [rate, setRate] = useState<CommissionRate | null>(null)
  const [lenderName, setLenderName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser()
      if (!u?.user) { setAllowed(false); setLoading(false); return }
      const { data: p } = await supabase.from('user_profiles')
        .select('is_admin, sees_finance').eq('id', u.user.id).single()
      const ok = !!(p?.is_admin || p?.sees_finance)
      setAllowed(ok)
      if (!ok || !deal?.lender_id) { setLoading(false); return }

      const [r, l] = await Promise.all([
        supabase.from('commission_rates').select('*').eq('lender_id', deal.lender_id).maybeSingle(),
        supabase.from('lenders').select('name').eq('id', deal.lender_id).maybeSingle(),
      ])
      setRate((r.data as any) || null)
      setLenderName((l.data as any)?.name || '')
      setLoading(false)
    })()
  }, [deal?.lender_id])

  if (allowed !== true) return null
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
        <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#EAF7FE] border border-[#BFE6F9] text-[#0E8FCB] rounded-full px-2 py-[2px]">
          Finance only
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
