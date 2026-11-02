'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  feeRows, counts, shown, FEE_COLUMNS, FEES_THAT_REACH_A_CLIENT,
  type FeeKey, type Filter, type FeeRow, type LibProduct, type LibLender,
} from '@/lib/fee-gaps'

// THE LENDER LIBRARY, SEEN ALL AT ONCE.
//
// 30 Oct 2026. Fabio, after the Bankwest settlement fee did not reach a
// client: "I like one to be an information I can access at any time and with
// live update so build that on as a separate tab on reports."
//
// Everything here is read the moment the tab is opened. Nothing is stored and
// nothing is cached, because the whole point of the list is that a product
// drops off it the moment somebody fills the fee in. See lib/fee-gaps.ts for
// what counts as filled in, and why a typed $0 is not a gap.

const GRID = 'grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.6fr)_repeat(5,86px)] gap-3'

export default function LenderFees() {
  const supabase = createSupabaseBrowser()
  const [products, setProducts] = useState<LibProduct[] | null>(null)
  const [lenders, setLenders] = useState<LibLender[]>([])
  const [use, setUse] = useState<Record<string, number>>({})
  const [why, setWhy] = useState('')
  const [filter, setFilter] = useState<Filter>('used')
  const [find, setFind] = useState('')
  const [readAt, setReadAt] = useState<Date | null>(null)
  const [again, setAgain] = useState(0)

  // READ WHEN THE TAB IS LOOKED AT, AND AGAIN WHEN IT IS COME BACK TO.
  // Somebody filling a fee in does it in the other tab; coming back here is
  // exactly the moment they want to see it gone from the list.
  useEffect(() => {
    const back = () => { if (document.visibilityState === 'visible') setAgain(n => n + 1) }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    return () => {
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('focus', back)
    }
  }, [])

  useEffect(() => {
    let gone = false
    ;(async () => {
      const [p, l, d] = await Promise.all([
        supabase.from('lender_products').select('id, lender_id, product_name, active, application_fee, annual_fee, monthly_fee, valuation_fee, rate_lock_fee, early_repayment_fee, discharge_fee, legal_fee'),
        supabase.from('lenders').select('id, name, active, legal_fee_label'),
        supabase.from('deals').select('lender_id').not('lender_id', 'is', null).limit(20000),
      ])
      if (gone) return
      // A READ THAT FAILED IS NOT AN EMPTY LIBRARY. "Nothing is missing" and
      // "nothing came back" look identical on screen, and one of them is a lie.
      if (p.error) { setWhy(p.error.message); setProducts([]); return }
      setProducts((p.data || []) as LibProduct[])
      setLenders((l.data || []) as LibLender[])
      const n: Record<string, number> = {}
      ;(d.data || []).forEach((x: any) => {
        const id = String(x.lender_id ?? '').trim()
        if (id) n[id] = (n[id] || 0) + 1
      })
      setUse(n)
      setReadAt(new Date())
    })()
    return () => { gone = true }
  }, [again])

  const all = useMemo(
    () => feeRows(products || [], lenders, use), [products, lenders, use])
  const tally = useMemo(
    () => counts(products || [], lenders), [products, lenders])
  const rows = useMemo(() => shown(all, filter, find), [all, filter, find])

  if (products === null) return <div className="text-[13px] text-muted">Reading the library…</div>
  if (why) return (
    <div className="text-[13px] text-chase">
      The library could not be read, so this list is not empty — it is unknown. {why}
    </div>
  )

  const SEG = 'text-[11.5px] rounded-full px-3 py-[4px] border transition'
  const on = 'bg-ink text-page border-ink'
  const off = 'bg-card text-muted border-line hover:text-body'

  return (
    <>
      <div className="flex gap-2.5 flex-wrap mb-4">
        <Tile n={String(tally.products)} what={`products, ${tally.lenders} lenders`} />
        <Tile n={String(tally.missing.legal_fee)} what="no settlement fee" tone="chase" />
        <Tile n={String(tally.missing.discharge_fee)} what="no discharge fee" tone="chase" />
        <Tile n={String(tally.missing.valuation_fee)} what="no valuation fee" tone="chase" />
        <Tile n={String(tally.noWording)} what="lenders with no fee wording set" />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-2.5">
        {([['used', 'Lenders we use'], ['all', 'Everything'],
           ['gaps', 'Missing something']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`${SEG} ${filter === k ? on : off}`}>{label}</button>
        ))}
        <input value={find} onChange={e => setFind(e.target.value)}
          placeholder="Find a lender or product"
          className="text-[12px] border border-field-line rounded-lg px-2.5 py-[5px] bg-field
            text-ink w-[210px] focus:outline-none focus:border-brand" />
        <span className="ml-auto text-[11px] text-faint">
          read live · nothing stored{readAt ? ` · ${readAt.toLocaleTimeString()}` : ''}
        </span>
      </div>

      <div className="bg-card border border-card-line rounded-xl overflow-hidden">
        <div className={`${GRID} px-4 py-2 text-[10px] font-bold tracking-[.07em] uppercase
          text-faint border-b border-card-line`}>
          <span>Lender</span><span>Product</span>
          {FEE_COLUMNS.map(k => (
            <span key={k} className="text-center">{label(k)}</span>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-6 text-[13px] text-muted text-center">
            {filter === 'gaps' ? 'Every product we can quote has all five fees recorded.'
              : filter === 'used' ? 'No deal has recorded a recommended lender yet.'
              : 'Nothing in the library.'}
          </div>
        ) : rows.map(r => (
          <div key={r.id} className={`${GRID} px-4 py-[9px] text-[12.5px] items-center
            border-b border-line-soft last:border-0 hover:bg-page transition`}>
            <span className={`truncate ${r.firstOfLender ? 'text-ink' : 'text-faint'}`}>
              {r.firstOfLender ? r.lender : ''}
              {r.firstOfLender && r.deals > 0 && (
                <span className="ml-1.5 text-[10px] font-bold text-info bg-info-bg
                  border border-info-edge rounded-full px-1.5 py-[1px] whitespace-nowrap">
                  {r.deals} deal{r.deals === 1 ? '' : 's'}
                </span>
              )}
            </span>
            <span className="truncate text-body" title={r.product}>{r.product}</span>
            {FEE_COLUMNS.map(k => (
              <span key={k} className={`text-center ${r.fees[k] ? 'text-done' : 'text-chase font-bold'}`}>
                {r.fees[k] || '—'}
              </span>
            ))}
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-muted mt-3 max-w-[760px] leading-relaxed">
        A dash is nobody has said, not nothing to pay. The comparison email prints the
        figures it is given, so a product with its fee recorded reads dearer than the one
        beside it where the box was never filled in — and the client cannot tell.
        A typed <b className="text-ink">$0</b> counts as answered and drops the product off this list.
      </p>
      <p className="text-[11.5px] text-muted mt-1.5 max-w-[760px] leading-relaxed">
        Monthly, rate lock and early repayment reach a client too, and are counted the same
        way — they are off the table because eight columns of dashes is a wall rather than a
        list. <Link href="/lenders" className="text-brand-ink hover:underline">Fill them in
        in the lender library</Link>, and come back to this tab to see them go.
      </p>
    </>
  )
}

function label(k: FeeKey) {
  return FEES_THAT_REACH_A_CLIENT.find(f => f.key === k)?.label || k
}

function Tile({ n, what, tone }: { n: string; what: string; tone?: 'chase' }) {
  return (
    <div className={`border rounded-xl px-3.5 py-2.5 min-w-[122px] ${
      tone === 'chase' ? 'bg-chase-bg border-chase-edge' : 'bg-card border-card-line'}`}>
      <b className={`block text-[18px] leading-tight ${
        tone === 'chase' ? 'text-chase' : 'text-ink'}`}>{n}</b>
      <span className="text-[11px] text-muted">{what}</span>
    </div>
  )
}
