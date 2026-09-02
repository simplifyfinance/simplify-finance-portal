'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LoanIds from '@/components/LoanIds'
import { loanIdStatus } from '@/lib/loan-id'
import { stepLabel } from '@/lib/settlement'

// A refinance has no contracts of sale - it has loan documents. The buttons in
// the Settlement panel have always said so; this list says the same thing now
// that the step is a stage that shows up here too.
const labelOf = (key: string, label: string, deal: any) =>
  key === 'contracts_returned_at' ? stepLabel('contracts_returned', deal?.transaction_type) : label

// Post-compliance stages. Lodged, Formal and Settled each write a snapshot of the loan as it
// stood at that moment - lender, total and every split with its own amount, rate and repayment
// type. The amount is not one number: it changes during the application, and commission is
// calculated from what SETTLED. Overwriting a single loan_amount would destroy that history.
//
// `mark: false` means the stage is shown here when it has happened, but is not
// offered as a button. Contracts returned and Settlement booked are recorded by
// the settlements team in the Settlement panel below, where they already click
// them; putting a second button here would be two doors onto the same lock.
const STAGES = [
  { key: 'lodged_at',             snap: 'lodged',  label: 'Lodged',              verb: 'Mark as lodged',              mark: true },
  { key: 'preapproval_at',        snap: null,      label: 'Preapproved',         verb: 'Mark as preapproved',         mark: true },
  // The client's offer on a property has been accepted. On a purchase this is a
  // process in its own right - there is now a property, a price and a settlement
  // date - and until now those deals sat in Preapproved looking identical to a
  // client who was still house hunting.
  { key: 'offer_accepted_at',     snap: null,      label: 'Offer accepted',      verb: 'Mark as offer accepted',      mark: true },
  { key: 'formal_approval_at',    snap: 'formal',  label: 'Formal approval',     verb: 'Mark as formally approved',   mark: true },
  { key: 'contracts_returned_at', snap: null,      label: 'Contracts returned',  verb: '',                            mark: false },
  { key: 'settlement_booked_at',  snap: null,      label: 'Settlement booked',   verb: '',                            mark: false },
  { key: 'settled_at',            snap: 'settled', label: 'Settled',             verb: 'Mark as settled',             mark: true },
]

const TYPES = ['P&I', 'Interest only']
const num = (v: any) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0
const money = (n: number) => '$' + n.toLocaleString('en-AU')
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

  const chosen = comp.clientChosenLender || comp.clientChosenLenderOther
    || lo.clientChosenLender || lo.clientChosenLenderOther || lo.recommendedLender || ''
  const overrode = Boolean(chosen && lo.recommendedLender && chosen !== lo.recommendedLender)

  const [snaps, setSnaps] = useState<any>({})
  const [lender, setLender] = useState('')
  const [splits, setSplits] = useState<any[]>([])
  const [when, setWhen] = useState(today())
  const [confirming, setConfirming] = useState(false)
  // Asked for the moment a deal is marked settled - that is when your team rings
  // the bank for the numbers. Skipping is allowed and expected; the panel below
  // keeps asking until they are in.
  const [askLoanIds, setAskLoanIds] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // What can happen next - not what must.
  //
  // These used to be walked in a fixed line, so the moment a deal was lodged the
  // only button on screen was "Mark as preapproved". It read as an instruction,
  // and most deals go straight from lodged to formal approval. Preapproval is
  // for a client still looking for a property.
  //
  // Fabio, 1 Sep 2026. Anything not yet recorded is offered; nothing is forced
  // and nothing is skipped silently - a deal marked formally approved that was
  // never preapproved simply leaves preapproval blank, which is the truth.
  const available = STAGES
    .filter(s => s.mark)
    .filter(s => !deal[s.key])
    // A preapproval after formal approval is meaningless, so it stops being offered.
    .filter(s => s.key !== 'preapproval_at' || (!deal.formal_approval_at && !deal.settled_at))
    // An accepted offer after settlement is not. It stays offered right up to the
    // end, because it is the kind of thing that gets recorded late.
    .filter(s => s.key !== 'offer_accepted_at' || !deal.settled_at)

  const [pickedKey, setPickedKey] = useState('')
  // One choice left is not a choice: go straight into it, the way it always did.
  const stage = available.length === 1
    ? available[0]
    : (available.find(s => s.key === pickedKey) || null)

  const prior = stage?.snap === 'formal' ? snaps.lodged
    : stage?.snap === 'settled' ? (snaps.formal || snaps.lodged) : null

  useEffect(() => {
    supabase.from('deal_stage_snapshots').select('*').eq('deal_id', deal.id).then(({ data }) => {
      const m: any = {}; (data || []).forEach((r: any) => { m[r.stage] = r })
      setSnaps(m)
    })
  }, [deal.id])

  useEffect(() => {
    if (!stage?.snap) return
    const src = prior
      ? { lender: prior.lender, splits: prior.splits || [] }
      : { lender: chosen || '', splits: (bc.splits || []).filter((s: any) => s && (s.amount || s.label)) }
    setLender(src.lender || '')
    setSplits((src.splits || []).map((s: any) => ({
      label: s.label || '', amount: String(s.amount ?? ''), rate: String(s.rate ?? ''), type: s.type || 'P&I',
    })))
  }, [stage?.snap, snaps.lodged, snaps.formal])

  if (!deal.compliance_completed_at) return null

  const total = splits.reduce((a, s) => a + num(s.amount), 0)
  const priorTotal = prior ? num(prior.total_amount) : 0
  const changed = prior ? (
    lender !== (prior.lender || '') || total !== priorTotal ||
    splits.some((s, i) => {
      const p = (prior.splits || [])[i]
      return !p || num(s.amount) !== num(p.amount) || (s.type || '') !== (p.type || '')
    })
  ) : false

  function setSplit(i: number, k: string, v: string) {
    setSplits(prev => prev.map((s, j) => j === i ? { ...s, [k]: v } : s))
  }

  async function confirmIt() {
    if (!stage) return
    setSaving(true); setErr('')
    const iso = new Date(when + 'T00:00:00').toISOString()
    const patch: any = { [stage.key]: iso }
    // Lodged and settled are the two amounts that are KEPT. Everything before
    // them - BC, LO, compliance - is a working figure that moves, and the amount
    // can change at any point along the way.
    //
    // Both used to write only loan_amount, so whichever ran last won and the
    // lodged figure vanished the moment a deal settled. Meanwhile
    // lodged_total / lodged_splits / settled_total / settled_splits were read in
    // eight places and written in none. They are written here now, and because
    // every reader prefers them over loan_amount, what settled can no longer be
    // overwritten by anything else.
    if (stage.snap === 'lodged') {
      patch.lender = lender || null
      patch.lodged_total = total || null
      patch.lodged_splits = splits
      patch.loan_amount = total || null
    }
    if (stage.snap === 'settled') {
      patch.lender = lender || null
      patch.settled_total = total || null
      patch.settled_splits = splits
      patch.loan_amount = total || null
    }

    if (stage.snap) {
      const { data: sess } = await supabase.auth.getUser()
      const { error: se } = await supabase.from('deal_stage_snapshots').upsert({
        deal_id: deal.id, stage: stage.snap, effective_date: when,
        lender: lender || null, total_amount: total || null, splits,
        recorded_by: sess?.user?.id || null,
      }, { onConflict: 'deal_id,stage' })
      if (se) { setSaving(false); setErr('NOT SAVED - ' + se.message); return }
    }

    const { data: rows, error } = await supabase.from('deals').update(patch).eq('id', deal.id).select('id')
    setSaving(false)
    if (error) { setErr('NOT SAVED - ' + error.message); return }
    if (!rows || rows.length === 0) { setErr('NOT SAVED - the change did not reach the database.'); return }
    setConfirming(false)
    if (stage.snap === 'settled') setAskLoanIds(true)
    const { data } = await supabase.from('deal_stage_snapshots').select('*').eq('deal_id', deal.id)
    const m: any = {}; (data || []).forEach((r: any) => { m[r.stage] = r }); setSnaps(m)
    onUpdated?.(patch)
  }

  const K = 'text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]'
  const IN = 'border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 text-[13px] w-full'

  return (
    <div className="bg-white border border-[#E8E1D6] rounded-xl px-5 py-4 mb-4">
      <div className={K + ' mb-3'}>After compliance</div>

      <div className="flex flex-col gap-1.5 mb-4">
        {STAGES.filter(s => deal[s.key]).map(s => {
          const sn = s.snap ? snaps[s.snap] : null
          return (
            <div key={s.key} className="flex items-center gap-2.5 text-[13px] flex-wrap">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#12A150" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.4 L6.2 11.4 L13 4.6"/></svg>
              <span className="font-semibold">{labelOf(s.key, s.label, deal)}</span>
              <span className="text-[#A29889]">{fmtDate(deal[s.key])}</span>
              {sn && (
                /* num(null) is 0, and money(0) is "$0" - so a stage recorded with
                   no amount used to claim the loan lodged for nothing. */
                <span className="text-[#6E665C] tabular-nums">
                  {sn.lender}{sn.lender ? ' \u00b7 ' : ''}
                  {num(sn.total_amount) > 0
                    ? money(num(sn.total_amount))
                    : <i className="text-[#946017] not-italic">amount not recorded</i>}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Once it has settled, the Loan IDs are the only thing left to collect.
          They stay on screen until every split has one - a deal cannot be
          matched to the RCTI without them. */}
      {deal.settled_at && loanIdStatus(deal).tone !== 'complete' && !askLoanIds && (
        <div className="border border-[#EBD9BE] bg-[#FDF6EC] rounded-xl px-4 py-3.5 mb-4">
          <div className={K + ' mb-2'} style={{ color: '#946017' }}>{loanIdStatus(deal).label}</div>
          <LoanIds deal={deal} onSaved={splits => onUpdated?.({ settled_splits: splits })} />
        </div>
      )}

      {available.length === 0 ? (
        <div className="text-[13px] text-[#6E665C]">Settled. Nothing further to record here.</div>
      ) : !stage ? (
        <div className="border-t border-[#F1ECE4] pt-4">
          <div className="text-[13px] font-semibold mb-1">What happened next?</div>
          <div className="text-[12px] text-[#A29889] mb-3">
            Whichever one it was. A deal can go straight to formal approval &mdash; preapproval is
            only for a client still looking.
          </div>
          <div className="flex gap-2 flex-wrap">
            {available.map(s => (
              <button key={s.key} onClick={() => setPickedKey(s.key)}
                className="text-[13px] border border-[#E8E1D6] bg-white text-[#2E2A26] rounded-lg px-4 py-2 hover:bg-[#FAF7F2] hover:border-[#D6CCBC] transition">
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-[#F1ECE4] pt-4">
          <div className="text-[13px] font-semibold mb-3 flex items-center gap-2 flex-wrap">
            Next: {stage.label}
            {available.length > 1 && (
              <button onClick={() => { setPickedKey(''); setConfirming(false); setErr('') }}
                className="font-normal text-[12px] text-[#2DBEFF] hover:underline">change</button>
            )}
            {prior && <span className="font-normal text-[#A29889]"> &mdash; checked against {stage.snap === 'settled' && snaps.formal ? 'formal approval' : 'lodgement'}</span>}
          </div>

          {stage.snap && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3 max-w-md">
                <label className="flex flex-col gap-1"><span className={K}>Lender</span>
                  <input className={IN} value={lender} onChange={e => setLender(e.target.value)} /></label>
                <label className="flex flex-col gap-1"><span className={K}>Date</span>
                  <input type="date" className={IN} value={when} onChange={e => setWhen(e.target.value)} /></label>
              </div>

              <div className={K + ' mb-1.5'}>Splits</div>
              <div className="flex flex-col gap-2 mb-3">
                {splits.map((s, i) => {
                  const p = prior ? (prior.splits || [])[i] : null
                  const amtChanged = p && num(s.amount) !== num(p.amount)
                  const typChanged = p && (s.type || '') !== (p.type || '')
                  return (
                    <div key={i} className="grid grid-cols-[1.4fr_1fr_0.7fr_1fr] gap-2 items-center">
                      <input className={IN} value={s.label} onChange={e => setSplit(i, 'label', e.target.value)} placeholder="Label" />
                      <input className={IN + (amtChanged ? ' bg-[#FFF8EC] border-[#F0DCB4]' : '')} value={s.amount}
                        onChange={e => setSplit(i, 'amount', e.target.value)} placeholder="Amount" />
                      <input className={IN} value={s.rate} onChange={e => setSplit(i, 'rate', e.target.value)} placeholder="Rate" />
                      <select className={IN + (typChanged ? ' bg-[#FFF8EC] border-[#F0DCB4]' : '')} value={s.type}
                        onChange={e => setSplit(i, 'type', e.target.value)}>
                        {TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  )
                })}
                <button onClick={() => setSplits([...splits, { label: '', amount: '', rate: '', type: 'P&I' }])}
                  className="text-[12px] text-[#2DBEFF] self-start">+ Add split</button>
              </div>

              <div className="flex items-center gap-4 text-[13px] mb-3">
                <span className={K}>Total</span>
                <span className="font-bold tabular-nums">{money(total)}</span>
                {prior && total !== priorTotal && (
                  <span className={'tabular-nums font-semibold ' + (total > priorTotal ? 'text-[#12A150]' : 'text-[#B04A4A]')}>
                    {total > priorTotal ? '+' : '\u2212'}{money(Math.abs(total - priorTotal))} vs {money(priorTotal)}
                  </span>
                )}
              </div>
            </>
          )}

          {!stage.snap && (
            <label className="flex flex-col gap-1 max-w-[200px] mb-3"><span className={K}>Date</span>
              <input type="date" className={IN} value={when} onChange={e => setWhen(e.target.value)} /></label>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setConfirming(true)}
              className="bg-[#2DBEFF] text-white text-[13.5px] font-semibold rounded-lg px-4 py-2.5 hover:bg-[#25AEEC] transition">
              {stage.verb}
            </button>
            <span className="text-[11.5px] text-[#A29889]">Opens a confirmation before anything is recorded.</span>
          </div>
          {err && <div className="text-[12.5px] font-semibold text-red-600 mt-3">{err}</div>}
        </div>
      )}

      {confirming && stage && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-2xl w-[540px] max-w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 border-b border-[#F1ECE4]">
              <div className="text-[16.5px] font-bold">Confirm {stage.label.toLowerCase()}</div>
              <div className="text-[12.5px] text-[#A29889] mt-0.5">
                {prior && changed ? 'Some figures differ from the previous stage. Check before recording.'
                  : 'Check these details before the deal moves on.'}
              </div>
            </div>
            <div className="px-6 py-4 text-[13px]">
              <div className="flex justify-between gap-4 mb-2">
                <span className="text-[#A29889]">Deal</span><span className="font-semibold text-right">{deal.deal_name}</span>
              </div>
              {stage.snap && <>
                <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2 py-1.5 border-b border-[#F1ECE4] text-[11.5px] text-[#A29889]">
                  <span>Field</span><span>{prior ? 'Previous' : ''}</span><span>Now</span>
                </div>
                <Cmp k="Lender" was={prior?.lender} now={lender} />
                {splits.map((s, i) => {
                  const p = prior ? (prior.splits || [])[i] : null
                  return <Cmp key={i} k={s.label || ('Split ' + (i + 1))}
                    was={p ? money(num(p.amount)) + ' \u00b7 ' + (p.type || '') : ''}
                    now={money(num(s.amount)) + ' \u00b7 ' + s.type} />
                })}
                <Cmp k="Total" was={prior ? money(priorTotal) : ''} now={money(total)} bold />
              </>}
              <div className="flex justify-between gap-4 mt-2">
                <span className="text-[#A29889]">{stage.label} on</span>
                <span className="font-semibold text-right">{fmtDate(when)}</span>
              </div>
            </div>
            {stage.snap === 'lodged' && overrode && (
              <div className="mx-6 mb-3 bg-[#FFF8EC] border border-[#F6E3C0] rounded-lg px-3 py-2.5 text-[11.5px] text-[#8A6320]">
                Client selected {chosen} over the originally recommended {lo.recommendedLender}. Lodging against the client&apos;s selection.
              </div>
            )}
            {prior && changed && (
              <div className="mx-6 mb-3 bg-[#FFF8EC] border border-[#F6E3C0] rounded-lg px-3 py-2.5 text-[11.5px] text-[#8A6320]">
                Figures have changed since the previous stage. Both versions are kept &mdash; commission is calculated from what settles.
              </div>
            )}
            <div className="px-6 py-4 border-t border-[#F1ECE4] flex justify-end gap-2">
              <button onClick={() => setConfirming(false)}
                className="text-[13px] text-[#6E665C] border border-[#E8E1D6] rounded-lg px-4 py-2">Cancel</button>
              <button onClick={confirmIt} disabled={saving}
                className="bg-[#2DBEFF] text-white text-[13px] font-semibold rounded-lg px-4 py-2 disabled:opacity-50">
                {saving ? 'Saving...' : 'Confirm and record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {askLoanIds && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-6 overflow-y-auto"
             onClick={() => setAskLoanIds(false)}>
          <div className="bg-white border border-[#E8E1D6] rounded-2xl px-6 py-5 max-w-[640px] w-full mt-16 shadow-xl"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-1">
              <svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke="#12A150" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.4 L6.2 11.4 L13 4.6"/></svg>
              <span className="text-[15px] font-semibold text-[#221F1B]">Settled &mdash; {fmtDate(deal.settled_at || when)}</span>
            </div>
            <p className="text-[12.5px] text-[#A29889] m-0 mb-4">Last thing.</p>
            <LoanIds deal={deal}
              onSaved={splits => { onUpdated?.({ settled_splits: splits }); setAskLoanIds(false) }}
              onSkip={() => setAskLoanIds(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

function Cmp({ k, was, now, bold }: { k: string; was?: any; now: any; bold?: boolean }) {
  const diff = was && String(was) !== String(now)
  return (
    <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2 py-1.5 border-b border-[#F1ECE4] last:border-0">
      <span className="text-[#A29889] text-[12px]">{k}</span>
      <span className="text-[#A29889] tabular-nums">{was || ''}</span>
      <span className={(bold ? 'font-bold ' : 'font-semibold ') + 'tabular-nums ' + (diff ? 'text-[#8A6320]' : '')}>{now}</span>
    </div>
  )
}
