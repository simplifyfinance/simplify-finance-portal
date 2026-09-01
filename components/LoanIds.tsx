'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { loanIdRows, applyLoanIds, loanIdStatus } from '@/lib/loan-id'

// The Loan ID boxes. One per split, one when a deal has no splits.
//
// Used in two places on purpose, because two different people arrive at it from
// two different directions: whoever marks the deal settled sees it immediately
// on the deal, and the settlements team - who own the chase - work from the
// settlements screen and should never have to open a deal to type a number.
// Same field, same component, one place to change it.

const money = (n: number | null) => n === null ? '' : '$' + Math.round(n).toLocaleString('en-AU')

export function LoanIdChip({ deal, className = '' }: { deal: any; className?: string }) {
  const s = loanIdStatus(deal)
  if (s.tone === 'not_settled') return null
  const style = s.tone === 'complete' ? 'bg-[#F1FAF4] border-[#C9E3D4] text-[#1E7A4A]'
    : s.tone === 'amber' ? 'bg-[#FDF6EC] border-[#EBD9BE] text-[#946017]'
    : 'bg-[#FCFAF6] border-[#EFEAE0] text-[#7A7266]'
  return (
    <span className={`text-[9.5px] font-bold tracking-[.05em] uppercase rounded-[5px] px-[7px] py-[2px] border whitespace-nowrap ${style} ${className}`}>
      {s.label}
    </span>
  )
}

export default function LoanIds({ deal, onSaved, onSkip, heading }: {
  deal: any
  onSaved?: (splits: any[]) => void
  onSkip?: () => void
  heading?: string
}) {
  const supabase = createSupabaseBrowser()
  const rows = loanIdRows(deal)
  const [vals, setVals] = useState<string[]>(() => rows.map(r => r.loanId))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const dirty = vals.some((v, i) => (v || '') !== (rows[i]?.loanId || ''))

  async function save() {
    setBusy(true); setMsg('')
    const splits = applyLoanIds(deal, vals)
    // Checked write. A row-level-security refusal returns no error and no rows,
    // so "it saved" has to mean a row actually came back.
    const { data, error } = await supabase.from('deals')
      .update({ settled_splits: splits }).eq('id', deal.id).select('id')
    setBusy(false)
    if (error) { setMsg('NOT SAVED - ' + error.message); return }
    if (!data || data.length === 0) { setMsg('NOT SAVED - the database refused the change.'); return }
    setMsg('Saved.')
    onSaved?.(splits)
  }

  const failed = msg.startsWith('NOT ')

  return (
    <div>
      <p className="text-[12.5px] text-[#575046] leading-[1.6] m-0 mb-3">
        {heading || 'The Loan ID for each split, from the bank.'} It is what the RCTI is matched
        against, so the portal can tell you when you have been paid instead of somebody having to
        remember.
      </p>

      <div className="border border-[#EFEAE0] rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_110px_170px] gap-2 px-3 py-2 bg-[#FCFAF6] border-b border-[#E5DED2]">
          {['Split', 'Amount', 'Loan ID'].map((h, i) => (
            <span key={h} className={`text-[10px] font-bold tracking-[.07em] uppercase text-[#7A7266] ${i === 1 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={r.label + i} className="grid grid-cols-[1fr_110px_170px] gap-2 px-3 py-2.5 items-center border-b border-[#EFEAE0] last:border-b-0">
            <span className="text-[12.5px] text-[#221F1B] font-[600]">{r.label}</span>
            <span className="text-[12.5px] text-[#575046] text-right tabular-nums">{money(r.amount)}</span>
            <input
              value={vals[i] || ''}
              onChange={e => setVals(p => p.map((v, j) => j === i ? e.target.value : v))}
              placeholder="from the bank"
              className={`text-[12.5px] font-mono rounded-lg px-2.5 py-1.5 border w-full focus:outline-none focus:border-[#2DBEFF] ${
                vals[i] ? 'border-[#C9E3D4] bg-[#F1FAF4] text-[#221F1B]' : 'border-[#EBD9BE] bg-[#FDF6EC] text-[#946017]'}`} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 mt-3 flex-wrap">
        <button onClick={save} disabled={busy || !dirty}
          className="bg-[#343333] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
          {busy ? 'Saving...' : 'Save Loan IDs'}
        </button>
        {onSkip && (
          <button onClick={onSkip} className="text-[12.5px] text-[#6E665C] border border-[#E8E1D6] rounded-lg px-3.5 py-2 hover:bg-[#FAF7F2] transition">
            I don&rsquo;t have them yet
          </button>
        )}
        <span className={`text-[12px] ${failed ? 'text-[#C4553B] font-medium' : msg ? 'text-[#1E7A4A]' : 'text-[#A29889]'}`}>
          {msg || 'Payment lands about 30 days after settlement. This is chased from day 15.'}
        </span>
      </div>
    </div>
  )
}
