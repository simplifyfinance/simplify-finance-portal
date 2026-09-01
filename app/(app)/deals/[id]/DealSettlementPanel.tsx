'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { todayYmd } from '@/lib/periods'
import { STATE_LABEL, isRefinance, isPurchase, stepLabel, attentionFor,
         type SettlementState, type SettlementStep } from '@/lib/settlement'

// The same fields as the settlements board, on the deal itself, for the people who
// work settlements. A broker opening this deal never renders it - the panel is the
// only place in the portal that shows the in-between steps.
export default function DealSettlementPanel({ deal, onUpdated }: { deal: any; onUpdated?: (patch: any) => void }) {
  const supabase = createSupabaseBrowser()
  const today = todayYmd()
  const [d, setD] = useState<any>(deal)
  const [draft, setDraft] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { setD(deal) }, [deal])

  useEffect(() => {
    setDraft({
      expected_settlement_date: d.expected_settlement_date || '',
      confirmed_settlement_date: d.confirmed_settlement_date || '',
      settlement_state: d.settlement_state || '',
      settlement_note: d.settlement_note || '',
      discharge_ready: d.discharge_ready,
      discharge_note: d.discharge_note || '',
      outstandings: d.outstandings || '',
      next_action: d.next_action || '',
      next_action_due: d.next_action_due || '',
      funds_to_complete_checked: !!d.funds_to_complete_checked,
      review_sent: !!d.review_sent,
      compliance_finalised: !!d.compliance_finalised,
      commission_paid: !!d.commission_paid,
    })
  }, [d])

  // Open to anyone who can open the deal.
  //
  // This panel was gated on is_admin || sees_settlements from back when the
  // portal had no deal board and the only way to keep the credit team out of the
  // settlement process was to hide the box. The gate that matters is on the deal
  // itself - row level security decides who can open it at all - and nothing in
  // here is more sensitive than the rest of the deal. Fabio, 1 Sep 2026:
  // everyone reads and edits.
  //
  // The sees_settlements flag still gates the Settlements SCREEN, which is the
  // whole book across every broker. That is a different question and it stays.
  if (!d.lodged_at) return null   // nothing to settle until it is lodged

  const refi = isRefinance(d)
  const attention = attentionFor(d, today)

  async function save(extra: Record<string, any> = {}) {
    setBusy(true); setMsg('')
    const { data: u } = await supabase.auth.getUser()
    const patch: any = {
      ...draft, ...extra,
      expected_settlement_date: draft.expected_settlement_date || null,
      confirmed_settlement_date: draft.confirmed_settlement_date || null,
      next_action_due: draft.next_action_due || null,
      settlement_state: draft.settlement_state || null,
      settlement_updated_at: new Date().toISOString(),
      settlement_updated_by: u?.user?.id || null,
    }
    if (patch.review_sent && !d.review_sent_at) patch.review_sent_at = today
    if (patch.compliance_finalised && !d.compliance_finalised_at) patch.compliance_finalised_at = today
    if (patch.funds_to_complete_checked && !d.funds_to_complete_at) patch.funds_to_complete_at = today

    const { data, error } = await supabase.from('deals').update(patch).eq('id', d.id).select('id')
    setBusy(false)
    if (error) { setMsg('NOT SAVED - ' + error.message); return }
    if (!data || data.length === 0) { setMsg('NOT SAVED - the database refused the change.'); return }
    const next = { ...d, ...patch }
    setD(next)
    onUpdated?.(patch)
    setMsg('Saved at ' + new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
  }

  async function setStep(step: SettlementStep | null) {
    if (step === 'settlement_booked' && !(draft.confirmed_settlement_date || d.confirmed_settlement_date)) {
      setMsg('A confirmed settlement date is needed before this can be marked as booked.')
      return
    }
    await save({ settlement_step: step })
  }

  const inp = 'w-full text-[12.5px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2DBEFF]'
  const lab = 'block text-[10px] font-bold uppercase tracking-[.08em] text-[#A29889] mb-1'
  const failed = msg.startsWith('NOT SAVED')

  return (
    <div className="bg-white border border-[#EDE7DD] rounded-xl overflow-hidden mb-6">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#F6F2EA] flex-wrap">
        <span className="text-[13.5px] font-semibold text-[#2E2A26]">Settlement</span>
        {attention && !d.settled_at && (
          <span className={`text-[10px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[2px] border ${
            attention.level === 'stale'
              ? 'bg-[#FBEDE9] border-[#EFCFC5] text-[#C4553B]'
              : 'bg-[#FDF6E7] border-[#EFE0BC] text-[#9A7B2E]'}`}>
            {attention.why}
          </span>
        )}
        {d.settlement_updated_at && (
          <span className="text-[11.5px] text-[#A29889] ml-auto">
            updated {String(d.settlement_updated_at).slice(0, 10)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 py-4 max-[820px]:grid-cols-1">
        <div><label className={lab}>Expected settlement</label>
          <input type="date" className={inp} value={draft.expected_settlement_date || ''}
            onChange={e => setDraft({ ...draft, expected_settlement_date: e.target.value })} /></div>
        <div><label className={lab}>Confirmed date</label>
          <input type="date" className={inp} value={draft.confirmed_settlement_date || ''}
            onChange={e => setDraft({ ...draft, confirmed_settlement_date: e.target.value })} /></div>
        <div><label className={lab}>Ready to settle</label>
          <select className={inp} value={draft.settlement_state || ''}
            onChange={e => setDraft({ ...draft, settlement_state: e.target.value })}>
            <option value="">Not set</option>
            {(['confirmed','awaiting','at_risk','pushed'] as SettlementState[]).map(s =>
              <option key={s} value={s}>{STATE_LABEL[s]}</option>)}
          </select></div>

        <div><label className={lab}>Latest update</label>
          <input className={inp} placeholder="e.g. settling 3pm" value={draft.settlement_note || ''}
            onChange={e => setDraft({ ...draft, settlement_note: e.target.value })} /></div>
        <div><label className={lab}>Outstandings</label>
          <input className={inp} placeholder="PEXA TOL, pending OFI" value={draft.outstandings || ''}
            onChange={e => setDraft({ ...draft, outstandings: e.target.value })} /></div>

        {refi && (
          <div><label className={lab}>Discharge form ready</label>
            <select className={inp}
              value={draft.discharge_ready === true ? 'yes' : draft.discharge_ready === false ? 'no' : ''}
              onChange={e => setDraft({ ...draft, discharge_ready: e.target.value === '' ? null : e.target.value === 'yes' })}>
              <option value="">Not set</option><option value="yes">Yes</option><option value="no">No</option>
            </select></div>
        )}
        {refi && draft.discharge_ready === false && (
          <div><label className={lab}>Outstanding on the discharge</label>
            <input className={inp} placeholder="chasing the bank, client to call…" value={draft.discharge_note || ''}
              onChange={e => setDraft({ ...draft, discharge_note: e.target.value })} /></div>
        )}
        {isPurchase(d) && (
          <div><label className={lab}>Funds to complete</label>
            <label className="flex items-center gap-2 text-[12.5px] text-[#2E2A26] py-1.5">
              <input type="checkbox" checked={!!draft.funds_to_complete_checked}
                onChange={e => setDraft({ ...draft, funds_to_complete_checked: e.target.checked })} />
              Checked with the solicitor
            </label></div>
        )}

        <div><label className={lab}>Next action</label>
          <input className={inp} value={draft.next_action || ''}
            onChange={e => setDraft({ ...draft, next_action: e.target.value })} /></div>
        <div><label className={lab}>Due</label>
          <input type="date" className={inp} value={draft.next_action_due || ''}
            onChange={e => setDraft({ ...draft, next_action_due: e.target.value })} /></div>

        {d.settled_at && (
          <div><label className={lab}>After settlement</label>
            <label className="flex items-center gap-2 text-[12.5px] py-1"><input type="checkbox"
              checked={!!draft.review_sent} onChange={e => setDraft({ ...draft, review_sent: e.target.checked })} />Google review sent</label>
            <label className="flex items-center gap-2 text-[12.5px] py-1"><input type="checkbox"
              checked={!!draft.compliance_finalised} onChange={e => setDraft({ ...draft, compliance_finalised: e.target.checked })} />Compliance finalised</label>
            <label className="flex items-center gap-2 text-[12.5px] py-1"><input type="checkbox"
              checked={!!draft.commission_paid} onChange={e => setDraft({ ...draft, commission_paid: e.target.checked })} />Commission paid</label>
          </div>
        )}
      </div>

      {!d.settled_at && (
        <div className="flex gap-2 items-center flex-wrap px-4 pb-4">
          <span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#A29889] mr-1">Step</span>
          {(['contracts_returned','settlement_booked'] as SettlementStep[]).map(s => (
            <button key={s} type="button" disabled={busy} onClick={() => setStep(d.settlement_step === s ? null : s)}
              className={`text-[12px] rounded-lg px-3 py-1.5 border transition ${d.settlement_step === s
                ? 'bg-[#343333] border-[#343333] text-white font-semibold'
                : 'bg-white border-[#E8E1D6] text-[#6E665C] hover:bg-[#FAF7F2]'}`}>
              {stepLabel(s, d.transaction_type)}
            </button>
          ))}
          <span className="text-[11px] text-[#A29889]">optional · either can be skipped · a broker sees this deal as Formal</span>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3 border-t border-[#F6F2EA] bg-[#FDFCFA] flex-wrap">
        <button type="button" onClick={() => save()} disabled={busy}
          className="bg-[#343333] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <span className={`text-[12px] ${failed ? 'text-[#C4553B] font-medium' : 'text-[#A29889]'}`}>{msg}</span>
      </div>
    </div>
  )
}
