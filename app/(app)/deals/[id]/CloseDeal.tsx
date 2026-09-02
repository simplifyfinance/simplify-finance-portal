'use client'
import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export const CLOSE_REASONS: { value: string; label: string; needsDate?: boolean }[] = [
  { value: 'no_response',           label: 'No response from client' },
  { value: 'not_ready',             label: 'Not ready yet — revisit later', needsDate: true },
  { value: 'changed_plans',         label: 'Client changed plans' },
  { value: 'property_fell_through', label: 'Property fell through' },
  { value: 'servicing',             label: "Servicing — couldn't borrow enough", needsDate: true },
  { value: 'insufficient_funds',    label: 'Insufficient deposit or funds', needsDate: true },
  { value: 'duplicate',             label: 'Duplicate or invalid enquiry' },
  { value: 'other',                 label: 'Other — note required' },
]
export function reasonLabel(v?: string | null) {
  return CLOSE_REASONS.find(r => r.value === v)?.label || v || ''
}

export default function CloseDeal({ deal, onUpdated }: { deal: any; onUpdated: (patch: any) => void }) {
  const supabase = createSupabaseBrowser()
  // ?close=1 opens this panel on arrival. The delete dialog on the deals list
  // offers "mark it as lost instead", and that has to land on the reason list
  // rather than on the deal page with a hint to go looking for it.
  const params = useSearchParams()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (params?.get('close') === '1' && deal?.status !== 'lost') setOpen(true)
  }, [params, deal?.status])
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [savePosition, setSavePosition] = useState(true)
  const [action, setAction] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isClosed = deal?.status === 'lost'
  const chosen = CLOSE_REASONS.find(r => r.value === reason)

  // Only applicants already linked to a client record can have a position saved.
  const linked = useMemo(() => {
    const ff = deal?.fact_find_data || {}
    return (ff.applicants || []).filter((a: any) => a?.clientId)
  }, [deal])

  function reset() {
    setReason(''); setNote(''); setSavePosition(true); setAction(''); setDue(''); setError('')
  }

  async function writePositions() {
    const ff = deal?.fact_find_data || {}
    for (const applicant of linked) {
      // As declared. No loan is added, because no loan happened.
      const owned = (list: any[]) => (list || []).filter((x: any) => !!x?.ownership?.[applicant.id])
      const { data, error: e } = await supabase.from('clients').update({
        position_properties: owned(ff.properties),
        position_liabilities: owned(ff.liabilities),
        position_assets: owned(ff.assets),
        position_updated_at: new Date().toISOString(),
        position_updated_from_deal_id: deal.id,
      }).eq('id', applicant.clientId).select('id')
      if (e) throw new Error('Saving ' + (applicant.name || 'a client') + "'s position: " + e.message)
      if (!data || data.length === 0) throw new Error("A client's position did not reach the database.")
    }
  }

  async function confirm() {
    setError('')
    if (!reason) { setError('Pick a reason.'); return }
    if (reason === 'other' && !note.trim()) { setError('A note is required for "Other".'); return }
    if (chosen?.needsDate && !due) { setError('This reason needs a follow-up date — it is a "not now", not a "never".'); return }
    if (due && !action.trim()) { setError('Say what the next action is, not just when.'); return }

    setBusy(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const patch: any = {
        status: 'lost',
        closed_at: new Date().toISOString(),
        close_reason: reason,
        close_note: note.trim() || null,
        next_action: action.trim() || null,
        next_action_due: due || null,
        closed_by: u?.user?.id || null,
      }
      const { data, error: e } = await supabase.from('deals').update(patch).eq('id', deal.id).select('id')
      if (e) throw new Error(e.message)
      if (!data || data.length === 0) throw new Error('The close did not reach the database. Nothing was changed.')

      if (savePosition && linked.length > 0) await writePositions()

      // A follow-up date asks support to put a task on the deal card, for the broker
      // and themselves. Until tasks live in the portal, this is how it survives.
      let emailWarning = ''
      if (due) {
        try {
          const res = await fetch('/api/notify-salestrekker', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId: deal.id, trigger: 'close_followup' }),
          })
          if (!res.ok) emailWarning = 'The deal is closed, but the follow-up email did not send. Set the task up manually.'
        } catch {
          emailWarning = 'The deal is closed, but the follow-up email did not send. Set the task up manually.'
        }
      }
      if (emailWarning) setTimeout(() => alert(emailWarning), 50)

      onUpdated(patch)
      setOpen(false)
      reset()
    } catch (err: any) {
      setError('NOT SAVED — ' + (err?.message || 'the change did not reach the database'))
    } finally {
      setBusy(false)
    }
  }

  async function reopen() {
    if (!confirm2()) return
    setBusy(true)
    const patch = { status: 'in_progress', closed_at: null, close_reason: null, close_note: null }
    const { data, error: e } = await supabase.from('deals').update(patch).eq('id', deal.id).select('id')
    setBusy(false)
    if (e || !data || data.length === 0) { alert('NOT SAVED — the deal was not reopened.'); return }
    onUpdated(patch)
  }
  function confirm2() {
    return window.confirm('Reopen this deal? It goes back into the active list. Any next action stays.')
  }

  const btn = 'text-xs text-[#6E665C] bg-[#FAF7F2] px-3.5 py-2 hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-2 disabled:opacity-40'
  const inp = 'w-full text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-2 text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]'

  if (isClosed) {
    return (
      <button onClick={reopen} disabled={busy} className={btn} title={reasonLabel(deal.close_reason)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a5 5 0 1 1 1.6 3.7M3 8V4.8M3 8h3.2"/></svg>
        Reopen
      </button>
    )
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btn}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>
        Close deal
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-6 overflow-y-auto"
             onClick={e => { if (e.target === e.currentTarget && !busy) { setOpen(false); reset() } }}>
          <div className="bg-white rounded-2xl border border-[#EDE7DD] w-full max-w-[560px] mt-[6vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F6F2EA]">
              <div className="text-[15px] font-semibold text-[#2E2A26]">Close this deal</div>
              <div className="text-[12px] text-[#A29889]">
                It leaves the active list and stops counting as work in progress. Nothing is deleted.
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#A29889] mb-1.5">Why</label>
                <div className="space-y-1">
                  {CLOSE_REASONS.map(r => (
                    <label key={r.value}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition ${reason === r.value ? 'border-[#BFE6F9] bg-[#EAF7FE]' : 'border-[#EDE7DD] hover:bg-[#FCFAF6]'}`}>
                      <input type="radio" name="close-reason" value={r.value}
                        checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[#0E8FCB]" />
                      <span className="text-[13px] text-[#2E2A26]">{r.label}</span>
                      {r.needsDate && <span className="ml-auto text-[10px] font-bold uppercase tracking-[.05em] text-[#9A7B2E] bg-[#FDF6E7] border border-[#EFE0BC] rounded-full px-2 py-[2px]">Comes back</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#A29889] mb-1.5">
                  Note {reason === 'other' && <span className="text-[#C4553B]">— required</span>}
                </label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={inp}
                  placeholder="Anything worth knowing next time you speak to them." />
              </div>

              <div className="border border-[#EDE7DD] rounded-xl p-3.5 bg-[#FDFCFA]">
                <label className="block text-[11px] font-semibold text-[#A29889] mb-1.5">
                  Next action {chosen?.needsDate && <span className="text-[#C4553B]">— required for this reason</span>}
                </label>
                <input value={action} onChange={e => setAction(e.target.value)} className={inp + ' mb-2'}
                  placeholder="Call about the refinance" />
                <div className="flex items-center gap-2.5">
                  <span className="text-[12px] text-[#6E665C]">When</span>
                  <input type="date" value={due} onChange={e => setDue(e.target.value)}
                    className="text-[13px] border border-[#E8E1D6] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#2DBEFF]" />
                </div>
                <div className="text-[11px] text-[#A29889] mt-2">Setting a date emails support to put a follow-up task on the deal card, for the broker and themselves.</div>
              </div>

              {linked.length > 0 && (
                <label className="flex items-start gap-2.5 border border-[#EDE7DD] rounded-xl p-3.5 cursor-pointer hover:bg-[#FCFAF6]">
                  <input type="checkbox" checked={savePosition} onChange={e => setSavePosition(e.target.checked)}
                    className="mt-[3px] accent-[#0E8FCB]" />
                  <span>
                    <span className="block text-[13px] font-medium text-[#2E2A26]">
                      Save the client&apos;s position for {linked.map((a: any) => a.name || 'applicant').join(' and ')}
                    </span>
                    <span className="block text-[11.5px] text-[#A29889]">
                      Their properties, liabilities and assets as declared on the fact find. No loan is added,
                      because no loan happened. This overwrites what is on their client record.
                    </span>
                  </span>
                </label>
              )}

              {error && <div className="text-[12.5px] text-[#C4553B] font-medium">{error}</div>}
            </div>

            <div className="px-5 py-3.5 border-t border-[#F6F2EA] bg-[#FDFCFA] flex justify-end gap-2">
              <button onClick={() => { setOpen(false); reset() }} disabled={busy}
                className="text-[12.5px] text-[#6E665C] px-3.5 py-2 hover:text-[#2E2A26]">Cancel</button>
              <button onClick={confirm} disabled={busy}
                className="bg-[#343333] text-white rounded-lg px-5 py-2 text-[13px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
                {busy ? 'Closing...' : 'Close deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
