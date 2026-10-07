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
      <div className="bg-card rounded-2xl w-[600px] max-w-full shadow-2xl mt-16 overflow-hidden">
        <div className="px-6 pt-5">
          <h2 className="text-[17px] font-bold text-ink m-0 mb-1.5">Delete &ldquo;{name}&rdquo;?</h2>
          <p className="text-[13px] text-faint m-0">{summaryOf(deal)}</p>
        </div>

        {!check.allowed ? (
          <div className="px-6 pt-4">
            <div className="border border-chase-edge bg-chase-bg rounded-[10px] px-4 py-3.5 text-[13px] text-chase">
              <b className="text-ink">This deal cannot be deleted.</b><br />{check.because}
            </div>
          </div>
        ) : !sure ? (
          <div className="px-6 pt-4">
            <div className="border border-chase-edge bg-chase-bg rounded-[10px] px-4 py-3.5 mb-3.5">
              <div className="text-[13px] font-bold text-chase mb-1.5">
                This cannot be undone. You would lose:
              </div>
              <ul className="m-0 pl-4 text-[13px] text-chase">
                {losing.map(l => <li key={l} className="mb-0.5">{l}</li>)}
              </ul>
            </div>
            <div className="border border-info-edge bg-info-bg rounded-[10px] px-4 py-3.5">
              <div className="text-[13.5px] font-bold text-ink mb-1">
                Did the client just not proceed?
              </div>
              <p className="m-0 text-[13px] text-info">
                Mark it as lost instead. The deal stays on file with a reason, it still counts in your
                reporting, you can set a follow-up date, and it can be reopened later if they come back.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 pt-4">
            <div className="border border-chase-edge bg-chase-bg rounded-[10px] px-4 py-3.5">
              <div className="text-[13px] font-bold text-chase mb-2">Last check. This is permanent.</div>
              <label className="block text-[12.5px] text-chase mb-1.5">
                Type <b>{DELETE_WORD}</b> to confirm.
              </label>
              <input autoFocus value={typed} onChange={e => setTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && deleteConfirmed(typed) && !busy) onDelete() }}
                placeholder={DELETE_WORD}
                className="w-full border border-chase-edge rounded-lg px-3 py-2 text-[13px] font-semibold text-ink bg-card focus:outline-none focus:border-chase" />
            </div>
          </div>
        )}

        <div className="px-6 py-4 mt-2 flex items-center gap-2.5 flex-wrap">
          {!check.allowed ? (
            <>
              <button onClick={onMarkLost} className={btn + ' bg-ink border-ink text-page'}>
                Mark it as lost instead
              </button>
              <button onClick={onCancel} className={btn + ' bg-card border-line text-body font-medium'}>
                Cancel
              </button>
            </>
          ) : !sure ? (
            <>
              <button onClick={onMarkLost} className={btn + ' bg-ink border-ink text-page'}>
                Mark it as lost instead
              </button>
              <button onClick={onCancel} className={btn + ' bg-card border-line text-body font-medium'}>
                Cancel
              </button>
              <span className="flex-1" />
              <button onClick={() => setSure(true)}
                className={btn + ' bg-card border-chase-edge text-chase'}>
                Delete permanently
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setSure(false); setTyped('') }} disabled={busy}
                className={btn + ' bg-card border-line text-body font-medium'}>
                Go back
              </button>
              <span className="flex-1" />
              <button onClick={onDelete} disabled={!deleteConfirmed(typed) || busy}
                className={btn + ' bg-chase border-chase text-page'}>
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
