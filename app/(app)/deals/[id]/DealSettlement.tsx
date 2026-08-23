'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Post-compliance stages. Marking one writes its timestamp; the progress bar reads those
// timestamps, so status changes because something happened rather than by navigation.
const STAGES = [
  { key: 'lodged_at',          label: 'Lodged',          verb: 'Mark as lodged' },
  { key: 'preapproval_at',     label: 'Preapproved',     verb: 'Mark as preapproved' },
  { key: 'formal_approval_at', label: 'Formal approval', verb: 'Mark as formally approved' },
  { key: 'settled_at',         label: 'Settled',         verb: 'Mark as settled' },
]

const rateOf = (l: any) => {
  const t = [l?.variablePI, l?.variableIO, l?.fixedPI, l?.fixedIO].find((x: any) => x?.enabled)
  return t?.rate || ''
}
const fmtDate = (v: any) => {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}
const today = () => new Date().toISOString().slice(0, 10)

export default function DealSettlement({ deal, onUpdated }: { deal: any; onUpdated?: (patch: any) => void }) {
  const lo: any = deal.lo_data || {}
  const comp: any = deal.compliance_data || {}
  const bc: any = deal.bc_data || {}

  // The client's actual selection wins over the original recommendation - we cannot lodge
  // until we know which lender they chose, and that choice is what goes to SalesTrekker.
  const chosen = comp.clientChosenLender || comp.clientChosenLenderOther
    || lo.clientChosenLender || lo.clientChosenLenderOther || lo.recommendedLender || ''
  const lenderObj = (lo.lenders || []).find((l: any) => l.lenderName === chosen) || (lo.lenders || [])[0] || {}
  const overrode = Boolean(chosen && lo.recommendedLender && chosen !== lo.recommendedLender)

  const nextIdx = STAGES.findIndex(s => !deal[s.key])
  const stage = nextIdx === -1 ? null : STAGES[nextIdx]

  const [lender, setLender]   = useState(deal.lender || chosen || lenderObj.lenderName || '')
  const [product, setProduct] = useState(lenderObj.productName || '')
  const [amount, setAmount]   = useState(deal.loan_amount || lo.loanAmount || bc.splits?.[0]?.amount || '')
  const [rate, setRate]       = useState(rateOf(lenderObj))
  const [when, setWhen]       = useState(today())
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  if (!deal.compliance_completed_at) return null

  async function confirm() {
    if (!stage) return
    setSaving(true); setErr('')
    const patch: any = { [stage.key]: new Date(when + 'T00:00:00').toISOString() }
    if (stage.key === 'lodged_at') {
      patch.lender = lender || null
      patch.loan_amount = amount ? Number(String(amount).replace(/[^0-9.]/g, '')) || null : null
    }
    const { data: rows, error } = await supabase.from('deals').update(patch).eq('id', deal.id).select('id')
    setSaving(false)
    if (error) { setErr('NOT SAVED - ' + error.message); return }
    if (!rows || rows.length === 0) { setErr('NOT SAVED - the change did not reach the database.'); return }
    setConfirming(false)
    onUpdated?.(patch)
  }

  return (
    <div className="bg-white border border-[#E8E1D6] rounded-xl px-5 py-4 mb-4">
      <div className="text-[10px] font-bold tracking-wider uppercase text-[#A29889] mb-3">After compliance</div>

      <div className="flex flex-col gap-1.5 mb-4">
        {STAGES.filter(s => deal[s.key]).map(s => (
          <div key={s.key} className="flex items-center gap-2.5 text-[13px]">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#12A150" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.4 L6.2 11.4 L13 4.6"/></svg>
            <span className="font-semibold">{s.label}</span>
            <span className="text-[#A29889]">{fmtDate(deal[s.key])}</span>
          </div>
        ))}
      </div>

      {!stage ? (
        <div className="text-[13px] text-[#6E665C]">Settled. Nothing further to record here.</div>
      ) : (
        <div className="border-t border-[#F1ECE4] pt-4">
          <div className="text-[13px] font-semibold mb-3">Next: {stage.label}</div>

          {stage.key === 'lodged_at' && (
            <div className="grid grid-cols-4 gap-3 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]">Lender</span>
                <input value={lender} onChange={e => setLender(e.target.value)}
                  className="border border-[#D9EDF7] bg-[#F8FDFF] rounded-lg px-3 py-2 text-[13.5px]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]">Product</span>
                <input value={product} onChange={e => setProduct(e.target.value)}
                  className="border border-[#D9EDF7] bg-[#F8FDFF] rounded-lg px-3 py-2 text-[13.5px]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]">Loan amount</span>
                <input value={amount} onChange={e => setAmount(e.target.value)}
                  className="border border-[#D9EDF7] bg-[#F8FDFF] rounded-lg px-3 py-2 text-[13.5px] tabular-nums" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]">Rate</span>
                <input value={rate} onChange={e => setRate(e.target.value)}
                  className="border border-[#D9EDF7] bg-[#F8FDFF] rounded-lg px-3 py-2 text-[13.5px] tabular-nums" />
              </label>
            </div>
          )}

          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]">Date</span>
              <input type="date" value={when} onChange={e => setWhen(e.target.value)}
                className="border border-[#E8E1D6] rounded-lg px-3 py-2 text-[13.5px]" />
            </label>
            <button onClick={() => setConfirming(true)}
              className="bg-[#2DBEFF] text-white text-[13.5px] font-semibold rounded-lg px-4 py-2.5 hover:bg-[#25AEEC] transition">
              {stage.verb}
            </button>
            <span className="text-[11.5px] text-[#A29889]">Opens a confirmation before anything is recorded.</span>
          </div>

          {stage.key === 'lodged_at' && (
            <p className="text-[11.5px] text-[#A29889] mt-3">
              Every field comes from Compliance and Lending Options, including the lender the client actually selected. Editable, but only if something genuinely changed.
            </p>
          )}
          {err && <div className="text-[12.5px] font-semibold text-red-600 mt-3">{err}</div>}
        </div>
      )}

      {confirming && stage && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-2xl w-[460px] max-w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 border-b border-[#F1ECE4]">
              <div className="text-[16.5px] font-bold">Confirm {stage.label.toLowerCase()}</div>
              <div className="text-[12.5px] text-[#A29889] mt-0.5">Check these details before the deal moves on.</div>
            </div>
            <div className="px-6 py-4 flex flex-col gap-2 text-[13px]">
              <Row k="Deal" v={deal.deal_name} />
              {stage.key === 'lodged_at' && <>
                <Row k="Lender" v={lender || '-'} />
                <Row k="Product" v={product || '-'} />
                <Row k="Loan amount" v={amount ? '$' + amount : '-'} />
                <Row k="Rate" v={rate ? rate + '%' : '-'} />
              </>}
              <Row k={stage.label + ' on'} v={fmtDate(when)} />
            </div>
            {stage.key === 'lodged_at' && overrode && (
              <div className="mx-6 mb-3 bg-[#FFF8EC] border border-[#F6E3C0] rounded-lg px-3 py-2.5 text-[11.5px] text-[#8A6320]">
                Client selected {chosen} over the originally recommended {lo.recommendedLender}. Lodging against the client&apos;s selection.
              </div>
            )}
            <div className="px-6 py-4 border-t border-[#F1ECE4] flex justify-end gap-2">
              <button onClick={() => setConfirming(false)}
                className="text-[13px] text-[#6E665C] border border-[#E8E1D6] rounded-lg px-4 py-2">Cancel</button>
              <button onClick={confirm} disabled={saving}
                className="bg-[#2DBEFF] text-white text-[13px] font-semibold rounded-lg px-4 py-2 disabled:opacity-50">
                {saving ? 'Saving...' : 'Confirm and record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#A29889]">{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  )
}
