'use client'
import { Bubble } from '@/components/TheBubble'
import { useEffect, useState } from 'react'
import TheContracts from '@/components/TheContracts'
import TheOtherDocuments from '@/components/TheOtherDocuments'
import SettlementSteps from '@/components/SettlementSteps'
import { stepOf } from '@/lib/the-seven-steps'
import { useSettlementSettings } from '@/lib/use-settlement-settings'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { todayYmd } from '@/lib/periods'
import { STATE_LABEL, isRefinance, isPurchase, stepLabel, attentionFor,
         STEPS, stepIsOn, stepPatch,
         type SettlementState, type SettlementStep } from '@/lib/settlement'
import { OFFICE } from '@/lib/same-date-everywhere'
import { isWithLender } from '@/lib/deal-phase'

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
  // IT ASKED THE WRONG QUESTION - 26 Nov 2026.
  //
  // This gated on the lodgement date alone, so the whole settlement panel -
  // the seven steps, the contracts, ATTN Settlements and Latest update - was
  // hidden on any deal without a lodgement DATE.
  //
  // Belle, on Thomas and Sally Isherwood: "loan docs have just been issued im
  // gonna put a comment in the latest update but I couldnt find that section in
  // that particular deal."
  //
  // That deal has a preapproval, an offer accepted and a formal approval on it.
  // It has obviously reached the lender. Nobody ever ticked Lodged, so the
  // panel went on waiting for a date that was never coming, while the work it
  // exists for had already started.
  //
  // So it asks the question it meant to ask. isWithLender() reads the FURTHEST
  // milestone the deal has reached, not the first one - see lib/deal-phase.ts -
  // and a deal at formal approval is with the lender whatever the lodgement
  // column says.
  if (!isWithLender(d)) return null   // nothing to settle until it is with the lender

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

  // THE LAST TWO BOXES ON THE PAGE TO GET THE LOOK - 16 Nov 2026.
  // Every other section had its colour and its head by the morning ship;
  // these two did not, so a SETTLED deal read new at the top and old at the
  // bottom. Fabio: "copy everything." Nothing inside it moved.
  return (
    <Bubble tone="done" title={d.settled_at ? 'Settled' : 'Settlement'}
      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>}
      actions={<>
        {attention && !d.settled_at && (
          <span className={`text-[10px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[2px] border ${
            attention.level === 'stale'
              ? 'bg-chase-bg border-[#EFCFC5] text-[#C4553B]'
              : 'bg-waiting-bg border-waiting-edge text-waiting'}`}>
            {attention.why}
          </span>
        )}
        {d.settlement_updated_at && (
          <span className="text-[11.5px] text-faint">
            updated {String(d.settlement_updated_at).slice(0, 10)}
          </span>
        )}
      </>}>

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

      {/* THE TWO NOTE TRAILS MOVED OUT - 26 Nov 2026.
          They are in components/TheDealTrail.tsx now, drawn on every deal at
          every stage with no gate at all. Neither was a settlement field once
          it became a trail, and sitting in here meant nobody could write a note
          on a deal that had not reached the bank. See that file for the whole
          history of how they ended up in the wrong box. */}
      {/* A DEAL PAST LODGEMENT WITH NO LODGEMENT DATE IS NOT A COSMETIC GAP.
        *
        * 26 Nov 2026, found with the panel above. `lodged_at` is what the
        * lodgement numbers are counted from - components/MonthlyActuals.tsx and
        * components/BrokerTargets.tsx both read it and nothing else. A deal
        * that reached formal approval without it has never been counted as
        * lodged, by anybody, in any month.
        *
        * The panel is the only screen that knows, so the panel says it. */}
      {!d.lodged_at && (
        <div className="px-4 pb-3">
          <div className="rounded-xl border border-chase-edge bg-chase-bg px-4 py-3">
            <div className="text-[12.5px] font-bold text-chase mb-1">
              No lodgement date on this deal
            </div>
            <div className="text-[11.5px] text-body leading-relaxed">
              It has reached the lender, so the settlement work below is live. But the
              lodgement numbers are counted off that date &mdash; until somebody records it,
              this deal is missing from every lodgement figure for the month it went in.
            </div>
            {/* AND WHERE TO PUT IT IN. The button already exists, under
              * &ldquo;What happened next?&rdquo; on the stage panel above -
              * `lodged_at` is offered there on any deal that has not settled.
              * Saying the number is wrong without saying how to fix it is half
              * a message. */}
            <div className="text-[11.5px] text-body leading-relaxed mt-1.5">
              Record it with the <b>Lodged</b> button under &ldquo;What happened next?&rdquo;
              further up this page.
            </div>
          </div>
        </div>
      )}

      {/* THE CONTRACTS. Dropped at Contracts Issued and checked against the
          formal approval - "everyhtig passes through formal". The file is read
          on the way through and never saved; what it said is written onto the
          deal. See components/TheContracts.tsx. */}
      {!d.settled_at && stepOf(d) && (
        <TheContracts deal={d} me={me}
          onSaved={patch => { setD((prev: any) => ({ ...prev, ...patch })); onUpdated?.(patch) }} />
      )}

      {/* THE OTHER TWO DOCUMENTS. The signed pack arrives at Contracts
          Reviewing and the insurance certificate at Outstandings. Neither is a
          comparison against the formal approval - they are completeness checks,
          and what is MISSING is the finding. See components/TheOtherDocuments.tsx. */}
      {!d.settled_at && stepOf(d) && (
        <TheOtherDocuments deal={d} me={me}
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
    </Bubble>
  )
}
