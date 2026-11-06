'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { everyRow } from '@/lib/the-whole-book'
import { REAL_DEALS_OR } from '@/lib/test-deal'
import { feeRows, shown, type LibProduct, type LibLender } from '@/lib/fee-gaps'

// WHAT IS LEFT OF THE LENDER FEES TAB.
//
// 17 Aug 2026. Fabio: "I think we move that from the reports tab because it's
// very confusing being there." It was a full table of the lender library,
// drawn on Reports, that could not change a single figure - so finding a blank
// fee and filling it in happened on two different screens.
//
// The table is on the lender library now, with every cell typed in place. This
// is the line that still belongs here: Reports is where you notice, the
// library is where you fix.
//
// THE SAME ARITHMETIC AS THE TABLE. feeRows and shown, out of lib/fee-gaps.ts,
// which is what the library's own table counts with. A second way of counting
// the same thing is how two screens come to disagree, and this codebase has
// paid for that often enough.

export default function LenderFeeGapLine() {
  const supabase = createSupabaseBrowser()
  const [gaps, setGaps] = useState<number | null>(null)

  useEffect(() => {
    let gone = false
    ;(async () => {
      const [p, l, d] = await Promise.all([
        supabase.from('lender_products').select('id, lender_id, product_name, active, application_fee, annual_fee, monthly_fee, valuation_fee, rate_lock_fee, early_repayment_fee, discharge_fee, legal_fee'),
        supabase.from('lenders').select('id, name, active, legal_fee_label'),
        // A page at a time. A limit of twenty thousand is not a limit the
        // database honours - it caps the answer at a thousand and says nothing.
        everyRow<any>((from, to) => supabase.from('deals').select('lender_id')
          .not('lender_id', 'is', null).or(REAL_DEALS_OR)
          .order('id').range(from, to)),
      ])
      if (gone) return
      const use: Record<string, number> = {}
      for (const row of (d?.rows || [])) {
        const id = String(row?.lender_id || '')
        if (id) use[id] = (use[id] || 0) + 1
      }
      const rows = feeRows((p.data || []) as LibProduct[], (l.data || []) as LibLender[], use)
      setGaps(shown(rows, 'used').reduce((n, r) => n + r.missing.length, 0))
    })()
    return () => { gone = true }
  }, [])

  // NOTHING WHILE IT IS COUNTING, and nothing when there is nothing to say. A
  // line that reads "0 fees are blank" is a line somebody stops seeing.
  if (gaps === null || gaps === 0) return null

  return (
    <div className="bg-card border border-card-line rounded-xl px-4 py-3 mb-5
      flex items-center gap-3 flex-wrap">
      <span className="text-[13px] text-body leading-relaxed">
        <b className="text-ink">Lender fees</b> &mdash; {gaps} fee{gaps === 1 ? ' is' : 's are'} blank
        across the lenders you are writing deals with. A blank fee is the one that does not
        reach a client.
      </span>
      <Link href="/lenders"
        className="ml-auto text-[12.5px] font-semibold border border-info-edge text-brand-ink
          bg-info-bg rounded-lg px-3.5 py-2 hover:opacity-90 whitespace-nowrap">
        Open the lender library &rarr;
      </Link>
    </div>
  )
}
