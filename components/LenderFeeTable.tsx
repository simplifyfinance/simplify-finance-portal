'use client'
import { useMemo, useState } from 'react'
import {
  feeRows, shown, FEE_COLUMNS, FEES_THAT_REACH_A_CLIENT,
  type FeeKey, type Filter, type LibProduct, type LibLender,
} from '@/lib/fee-gaps'

// THE WHOLE LIBRARY ON ONE SCREEN, AND EDITABLE WHERE YOU FOUND IT.
//
// 30 Oct 2026 this was built as a tab on Reports, read only. Fabio, 17 Aug
// 2026: "I love the way it looks on the reports and the lender library ... but
// it doesn't allow us to edit, right? ... I feel like we're double handling."
//
// There was never a second copy of anything - both screens read these same two
// tables, live. The cost was the walk. You found a blank valuation fee on
// Reports, went to Settings, found the lender, found the product, typed the
// number, came back to check. Five steps to type a figure you were already
// looking at.
//
// So it moved here, to the library, which is the screen that can write - and
// the six fees that reach a client are typed straight into the cell. Everything
// else about a product is still one click down, in the lender below.
//
// CAPPED ON PURPOSE. Fabio: "don't make it too large so we will never see the
// bottom of it." Five rows, scrolling inside itself, with a line underneath
// saying how many there are in total and a button to make it taller. The
// lender list stays on the screen.

const GRID = 'grid grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)_repeat(6,78px)] gap-2 items-center'

export default function LenderFeeTable({ lenders, products, use, onFee }: {
  lenders: LibLender[]
  products: LibProduct[]
  use: Record<string, number>
  onFee: (productId: string, key: FeeKey, value: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('used')
  const [find, setFind] = useState('')
  const [tall, setTall] = useState(false)

  const all = useMemo(() => feeRows(products, lenders, use), [products, lenders, use])
  const rows = useMemo(() => shown(all, filter, find), [all, filter, find])
  // Blanks on the lenders you are actually writing deals with. The number the
  // Reports line quotes, worked out here so the two cannot disagree.
  const gaps = useMemo(
    () => shown(all, 'used').reduce((n, r) => n + r.missing.length, 0), [all])

  const SEG = 'text-[12px] font-semibold rounded-md px-3 py-[5px]'
  const on = 'bg-card text-brand-ink shadow-[0_1px_2px_rgba(0,0,0,.06)]'
  const off = 'text-muted'

  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold tracking-[.08em] uppercase text-faint m-0 mb-2">
        The fees, across every lender
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="inline-flex gap-[2px] bg-line-soft rounded-[9px] p-[3px]">
          {([['used', 'Lenders we use'], ['all', 'Everything'],
             ['gaps', 'Gaps only']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`${SEG} ${filter === k ? on : off}`}>{label}</button>
          ))}
        </span>
        {gaps > 0 && (
          <span className="text-[11.5px] font-semibold text-chase bg-chase-bg border
            border-chase-edge rounded-[7px] px-2.5 py-1">
            {gaps} fee{gaps === 1 ? '' : 's'} blank on lenders you use
          </span>
        )}
        <input value={find} onChange={e => setFind(e.target.value)}
          placeholder="Search a lender or a product"
          className="ml-auto text-[12px] border border-field-line rounded-lg px-2.5 py-[5px]
            bg-card text-ink w-[210px] focus:outline-none focus:border-brand" />
      </div>

      <div className="bg-card border border-card-line rounded-xl overflow-hidden">
        <div className={`${GRID} px-3.5 py-2 text-[10px] font-bold tracking-[.07em] uppercase
          text-faint border-b border-line-soft bg-[#FCFAF6]`}>
          <span>Lender</span><span>Product</span>
          {FEE_COLUMNS.map(k => <span key={k} className="text-right">{label(k)}</span>)}
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-6 text-[13px] text-muted text-center">
            {filter === 'gaps' ? 'Every product you can quote has all its fees recorded.'
              : filter === 'used' ? 'No deal has recorded a recommended lender yet.'
              : 'Nothing in the library.'}
          </div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: tall ? 520 : 206 }}>
            {rows.map(r => (
              <div key={r.id} className={`${GRID} px-3.5 py-[7px] text-[12.5px]
                border-b border-line-soft last:border-0 hover:bg-page transition`}>
                <span className="truncate text-ink font-semibold">
                  {r.firstOfLender ? r.lender : ''}
                  {r.firstOfLender && r.deals > 0 && (
                    <span className="block text-[11px] text-faint font-normal">
                      {r.deals} deal{r.deals === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                <span className="truncate text-body" title={r.product}>{r.product}</span>
                {FEE_COLUMNS.map(k => (
                  <Cell key={k} value={r.fees[k]} onSave={v => onFee(r.id, k, v)} />
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-[11.5px] text-muted px-3.5 py-2
          bg-[#FCFAF6] border-t border-line-soft">
          Showing <b className="text-body">{rows.length} of {all.length}</b> products
          {filter === 'used' ? ' on lenders you use' : ''} &mdash; scroll inside this box,
          or narrow it with Gaps only.
          <button onClick={() => setTall(t => !t)}
            className="ml-auto text-brand-ink font-semibold">
            {tall ? 'Make it shorter' : 'Make it taller'}
          </button>
        </div>
      </div>

      <p className="text-[11.5px] text-muted mt-2 max-w-[860px] leading-relaxed">
        A dash is nobody has said, not nothing to pay. The comparison email prints the figures
        it is given, so a product with its fee recorded reads dearer than the one beside it
        where the box was never filled in, and the client cannot tell. A typed{' '}
        <b className="text-ink">$0</b> counts as answered.
      </p>
    </div>
  )
}

// ONE CELL, TYPED IN PLACE.
//
// Uncontrolled with a key, like every other box on this screen: the row is
// re-read after a save and a controlled input would fight the person typing in
// it. Saved on blur, and only when it actually changed - a tab through a table
// must not write forty rows.
function Cell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const has = String(value || '').trim() !== ''
  return (
    <input defaultValue={value || ''} key={value || ''}
      onBlur={e => { if (e.target.value.trim() !== String(value || '').trim()) onSave(e.target.value) }}
      placeholder="blank"
      className={`text-[12px] text-right border rounded-[7px] px-1.5 py-[3px] w-full
        focus:outline-none focus:border-brand ${
        has ? 'border-field-line bg-card text-ink'
            : 'border-chase-edge bg-chase-bg text-chase font-semibold placeholder:text-chase'}`} />
  )
}

function label(k: FeeKey) {
  return FEES_THAT_REACH_A_CLIENT.find(f => f.key === k)?.label || k
}
