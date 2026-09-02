'use client'
// The dialog that stands between somebody and a deleted client file.
//
// Declared at module level and never inside the page that uses it: a component
// defined inside another component is a new type on every render, so React
// throws the tree away and the "type DELETE" box loses focus after one letter.
// This codebase has been bitten by that twice.
import { useState } from 'react'
import { canDelete, whatIsLost, deleteConfirmed, DELETE_WORD } from '@/lib/delete-deal'

export function DeleteDealDialog({ deal, documentCount, busy, onMarkLost, onDelete, onCancel }: {
  deal: any
  documentCount: number
  busy?: boolean
  onMarkLost: () => void
  onDelete: () => void
  onCancel: () => void
}) {
  const [sure, setSure] = useState(false)
  const [typed, setTyped] = useState('')
  const check = canDelete(deal)
  const losing = whatIsLost(deal, documentCount)
  const name = deal?.deal_name || 'this deal'

  const btn = 'rounded-lg px-4 py-2 text-[13px] font-semibold border transition disabled:opacity-40'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-6 overflow-y-auto"
         onClick={e => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div className="bg-white rounded-2xl w-[600px] max-w-full shadow-2xl mt-16 overflow-hidden">
        <div className="px-6 pt-5">
          <h2 className="text-[17px] font-bold text-[#141C24] m-0 mb-1.5">Delete &ldquo;{name}&rdquo;?</h2>
          <p className="text-[13px] text-[#7C8894] m-0">{summaryOf(deal)}</p>
        </div>

        {!check.allowed ? (
          <div className="px-6 pt-4">
            <div className="border border-[#EBD9BE] bg-[#FDF6E7] rounded-[10px] px-4 py-3.5 text-[13px] text-[#8A6218]">
              <b className="text-[#141C24]">This deal cannot be deleted.</b><br />{check.because}
            </div>
          </div>
        ) : !sure ? (
          <div className="px-6 pt-4">
            <div className="border border-[#E9D2CF] bg-[#FDF3F2] rounded-[10px] px-4 py-3.5 mb-3.5">
              <div className="text-[13px] font-bold text-[#8E3A34] mb-1.5">
                This cannot be undone. You would lose:
              </div>
              <ul className="m-0 pl-4 text-[13px] text-[#8E3A34]">
                {losing.map(l => <li key={l} className="mb-0.5">{l}</li>)}
              </ul>
            </div>
            <div className="border border-[#CBE7F8] bg-[#EAF6FD] rounded-[10px] px-4 py-3.5">
              <div className="text-[13.5px] font-bold text-[#141C24] mb-1">
                Did the client just not proceed?
              </div>
              <p className="m-0 text-[13px] text-[#0B5E8A]">
                Mark it as lost instead. The deal stays on file with a reason, it still counts in your
                reporting, you can set a follow-up date, and it can be reopened later if they come back.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 pt-4">
            <div className="border border-[#E9D2CF] bg-[#FDF3F2] rounded-[10px] px-4 py-3.5">
              <div className="text-[13px] font-bold text-[#8E3A34] mb-2">Last check. This is permanent.</div>
              <label className="block text-[12.5px] text-[#8E3A34] mb-1.5">
                Type <b>{DELETE_WORD}</b> to confirm.
              </label>
              <input autoFocus value={typed} onChange={e => setTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && deleteConfirmed(typed) && !busy) onDelete() }}
                placeholder={DELETE_WORD}
                className="w-full border border-[#E3B4B0] rounded-lg px-3 py-2 text-[13px] font-semibold text-[#141C24] bg-white focus:outline-none focus:border-[#B23A34]" />
            </div>
          </div>
        )}

        <div className="px-6 py-4 mt-2 flex items-center gap-2.5 flex-wrap">
          {!check.allowed ? (
            <>
              <button onClick={onMarkLost} className={btn + ' bg-[#141C24] border-[#141C24] text-white'}>
                Mark it as lost instead
              </button>
              <button onClick={onCancel} className={btn + ' bg-white border-[#D7DCE1] text-[#3E4C59] font-medium'}>
                Cancel
              </button>
            </>
          ) : !sure ? (
            <>
              <button onClick={onMarkLost} className={btn + ' bg-[#141C24] border-[#141C24] text-white'}>
                Mark it as lost instead
              </button>
              <button onClick={onCancel} className={btn + ' bg-white border-[#D7DCE1] text-[#3E4C59] font-medium'}>
                Cancel
              </button>
              <span className="flex-1" />
              <button onClick={() => setSure(true)}
                className={btn + ' bg-white border-[#E3B4B0] text-[#B23A34]'}>
                Delete permanently
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setSure(false); setTyped('') }} disabled={busy}
                className={btn + ' bg-white border-[#D7DCE1] text-[#3E4C59] font-medium'}>
                Go back
              </button>
              <span className="flex-1" />
              <button onClick={onDelete} disabled={!deleteConfirmed(typed) || busy}
                className={btn + ' bg-[#B23A34] border-[#B23A34] text-white'}>
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// The line under the title: enough to know you have the right deal.
function summaryOf(deal: any): string {
  const words = (v: any) => {
    const t = String(v || '').replace(/_/g, ' ').trim()
    return t ? t[0].toUpperCase() + t.slice(1) : ''
  }
  const created = deal?.created_at
    ? new Date(deal.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })
    : ''
  return [
    words(deal?.transaction_type),
    deal?.lenders?.name,
    deal?.loan_amount ? '$' + Number(deal.loan_amount).toLocaleString('en-AU') : '',
    created ? `created ${created}` : '',
  ].filter(Boolean).join('  ·  ')
}
