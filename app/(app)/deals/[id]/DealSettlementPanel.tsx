'use client'
import { useEffect, useState } from 'react'
import TheContracts from '@/components/TheContracts'
import SettlementSteps from '@/components/SettlementSteps'
import { stepOf } from '@/lib/the-seven-steps'
import SettlementTrail from '@/components/SettlementTrail'
import { useSettlementSettings } from '@/lib/use-settlement-settings'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { todayYmd } from '@/lib/periods'
import { STATE_LABEL, isRefinance, isPurchase, stepLabel, attentionFor,
         STEPS, stepIsOn, stepPatch,
         type SettlementState, type SettlementStep } from '@/lib/settlement'
import { OFFICE } from '@/lib/same-date-everywhere'

// The same fields as the settlements board, on the deal itself, for the people who
// work settlements. A broker opening this deal never renders it - the panel is the
// only place in the portal that shows the in-between steps.
export default function DealSettlementPanel({ deal, onUpdated, me }: {
  deal: any; onUpdated?: (patch: any) => void; me?: { id?: string | null; name?: string | null }
}) {
  const supabase = createSupabaseBrowser()
  // Every chase time, from Settings, falling back to the defaults in code.
  const settings = useSettlementSettings()
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
      // 17 Nov 2026. The lender's solicitor comes in by email when documents
      // are issued - Belle: "we normally get an email from lender solicitor
      // when loan documents are issued so reference + settlements handler will
      // be noted there." Until both are blank the client email says two
      // business days.
      lender_solicitor: d.lender_solicitor || '',
      lender_solicitor_ref: d.lender_solicitor_ref || '',
      loan_docs_signing: d.loan_docs_signing || '',
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
    setMsg('Saved at ' + new Date().toLocaleTimeString('en-AU', { timeZone: OFFICE, hour: '2-digit', minute: '2-digit' }))
  }

  // Two independent stages now, each with its own date, not one enum holding one
  // of them. A deal can have its contracts back AND its settlement booked, which
  // the old field could not say - and neither of them recorded when it happened,
  // so nobody could see loan docs that had been sitting returned for three weeks.
  async function setStep(step: SettlementStep, on: boolean) {
    if (step === 'settlement_booked' && on && !(draft.confirmed_settlement_date || d.confirmed_settlement_date)) {
      setMsg('A confirmed settlement date is needed before this can be marked as booked.')
      return
    }
    await save(stepPatch(d, step, on))
  }

  const inp = 'w-full text-[12.5px] border border-line rounded-lg px-2.5 py-1.5 bg-card focus:outline-none focus:border-brand'
  const lab = 'block text-[10px] font-bold uppercase tracking-[.08em] text-faint mb-1'
  const failed = msg.startsWith('NOT SAVED')

  return (
    <div className="bg-card border border-[#EDE7DD] rounded-xl overflow-hidden mb-6">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#F6F2EA] flex-wrap">
        <span className="text-[13.5px] font-semibold text-ink">Settlement</span>
        {attention && !d.settled_at && (
          <span className={`text-[10px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[2px] border ${
            attention.level === 'stale'
              ? 'bg-chase-bg border-[#EFCFC5] text-[#C4553B]'
              : 'bg-waiting-bg border-waiting-edge text-waiting'}`}>
            {attention.why}
          </span>
        )}
        {d.settlement_updated_at && (
          <span className="text-[11.5px] text-faint ml-auto">
            updated {String(d.settlement_updated_at).slice(0, 10)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 py-4 max-[820px]:grid-cols-1">
        {/* The date a purchaser loses their deposit if finance is not approved.
            The most time critical date between lodgement and settlement, and the
            portal has never held it anywhere. Turns red inside a week while the
            deal is still not formally approved. */}
        <div><label className={lab}>Finance clause</label>
          <input type="date" value={draft.finance_clause_date || ''}
            onChange={e => setDraft({ ...draft, finance_clause_date: e.target.value })}
            className={inp + (
              draft.finance_clause_date && !d.formal_approval_at &&
              (new Date(String(draft.finance_clause_date)).getTime() - Date.now()) < 7 * 86400000
                ? ' border-chase-edge bg-[#FBECEC] text-chase font-semibold' : '')} /></div>
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

        <div><label className={lab}>Outstandings</label>
          <input className={inp} placeholder="PEXA TOL, pending OFI" value={draft.outstandings || ''}
            onChange={e => setDraft({ ...draft, outstandings: e.target.value })} /></div>

        {/* HOW THE DOCUMENTS ARE BEING SIGNED. It decides what the client is
            told and which reminders appear - on an esign deal there is nothing
            to post, so the reminder to scan copies back does not show. */}
        <div><label className={lab}>Loan docs completed by</label>
          <select className={inp} value={draft.loan_docs_signing || ''}
            onChange={e => setDraft({ ...draft, loan_docs_signing: e.target.value })}>
            <option value="">Not set</option>
            <option value="Esign">Esign</option>
            <option value="Wet sign">Wet sign</option>
            <option value="Mortgage only to be wet signed">Mortgage only to be wet signed</option>
          </select></div>
        <div><label className={lab}>Lender solicitor</label>
          <input className={inp} placeholder="firm or contact" value={draft.lender_solicitor || ''}
            onChange={e => setDraft({ ...draft, lender_solicitor: e.target.value })} /></div>
        <div><label className={lab}>Reference &amp; handler</label>
          <input className={inp} placeholder="reference, settlements handler" value={draft.lender_solicitor_ref || ''}
            onChange={e => setDraft({ ...draft, lender_solicitor_ref: e.target.value })} /></div>

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
            <label className="flex items-center gap-2 text-[12.5px] text-ink py-1.5">
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

      {/* ATTN SETTLEMENTS - THE FIELD THAT CROSSES THE HANDOVER.
          The broker and the credit manager write into it before formal, and it
          comes through when the file lands. Settlements add to it as they go.
          One field, both sides, nothing retyped. */}
      <div className="px-4 pb-3">
        <div className="rounded-xl border border-info-edge border-l-[4px] border-l-info bg-info-bg px-4 py-3">
          <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[.08em] text-info">
            ATTN Settlements
          </div>
          <SettlementTrail deal={d} column="attn_settlements" me={me?.name || ''} busy={busy} tone="info"
            placeholder="Anything settlements need to know about this file"
            onWrite={patch => save(patch)} />
        </div>
      </div>

      {/* LATEST UPDATE, AS A TRAIL. 17 Nov 2026: "a trail, not a box. Every
          entry dated and named, nothing typed over." settlement_note is left
          exactly where it is and seeds the first entry. */}
      <div className="px-4 pb-3">
        <div className="rounded-xl border border-card-line bg-card px-4 py-3">
          <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted">
            Latest update
          </div>
          <SettlementTrail deal={d} me={me?.name || ''} busy={busy} onWrite={patch => save(patch)} />
        </div>
      </div>

      {/* THE CONTRACTS. Dropped at Contracts Issued and checked against the
          formal approval - "everyhtig passes through formal". The file is read
          on the way through and never saved; what it said is written onto the
          deal. See components/TheContracts.tsx. */}
      {!d.settled_at && stepOf(d) && (
        <TheContracts deal={d} me={me}
          onSaved={patch => { setD((prev: any) => ({ ...prev, ...patch })); onUpdated?.(patch) }} />
      )}

      {/* THE SEVEN STEPS. See components/SettlementSteps.tsx. */}
      {!d.settled_at && (
        <SettlementSteps deal={d} settings={settings} busy={busy}
          onMove={patch => save(patch)} onTick={patch => save(patch)} />
      )}

      <div className="flex items-center gap-3 px-4 py-3 border-t border-[#F6F2EA] bg-[#FDFCFA] flex-wrap">
        <button type="button" onClick={() => save()} disabled={busy}
          className="bg-ink text-page rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:opacity-90 transition disabled:opacity-40">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <span className={`text-[12px] ${failed ? 'text-[#C4553B] font-medium' : 'text-faint'}`}>{msg}</span>
      </div>
    </div>
  )
}
