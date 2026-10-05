'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { lenderSteps, preapprovalLine, pricingLine, anzTemplateFor,
         stillBlank, loanOnTheDeal, type PanelLine } from '@/lib/offer-accepted-panel'
import { anzReductionEmail } from '@/lib/offer-accepted-rules'
import { reworkFromDeposit, depositAsAssessed, depositToKeepLvr, dutyNow,
         priceHasMoved, stampDutyNeedsUpdating, type Reworked } from '@/lib/contract-funding'
import { purchaseRows, dutyLabelFor } from '@/lib/purchase-rows'
import { otherSideGaps } from '@/lib/other-side'
import { lenderOnTheDeal } from '@/lib/client-agreement'
import { dayMonthYear } from '@/lib/same-date-everywhere'

// THE OFFER WAS ACCEPTED.
//
// Fabio, 25 Sep 2026: "next project is offer accepted". Marking it recorded a
// date and nothing else, while the code's own comment said "on a purchase this
// is a process in its own right - there is now a property, a price and a
// settlement date". None of the three were ever asked for.
//
// A PANEL, NOT A POP-UP, and that is deliberate. The position prompt that opened
// when a deal settled cost a day on 24 September: it was drawn in two branches
// of a condition the deal CROSSED as it settled, so React threw it away in the
// same render it appeared in. Marking a deal offer-accepted crosses the same
// kind of line. A panel that is simply there once the stage is reached cannot
// die that way, and it can still be filled in tomorrow - which is the real
// working pattern anyway, because the settlement date often comes later than
// the phone call.
//
// IT WRITES ONLY COLUMNS ON `deals`. Nothing here touches bc_data, lo_data or
// compliance_data: those blobs each have one owner that saves them whole, and a
// second writer is how work gets silently overwritten. See lib/deal-structure.ts.

const money = (v: any) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? '$' + n.toLocaleString('en-AU') : ''
}
const num = (v: any) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

const INP = 'text-[12.5px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-card text-ink w-full'

const LAB = 'text-[8.5px] font-bold tracking-[.07em] uppercase text-[#A0A7AE] block mb-1'

function Line({ line }: { line: PanelLine }) {
  const tone =
    line.kind === 'watch'   ? 'bg-chase-bg border-chase-edge text-chase' :
    line.kind === 'unknown' ? 'bg-[#F7F8F9] border-[#E3E6E8] text-muted' :
    line.kind === 'clock'   ? 'bg-info-bg border-info-edge text-info' :
                              'bg-done-bg border-[#BBF7D0] text-[#166534]'
  return <p className={`m-0 mt-1.5 text-[12.5px] leading-relaxed border rounded-lg px-3 py-2 ${tone}`}>{line.text}</p>
}

export default function OfferAccepted({ deal, me, onUpdated }: {
  deal: any
  me?: { id?: string | null; name?: string | null } | null
  onUpdated?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [d, setD] = useState<any>(deal)
  const [threshold, setThreshold] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState('')
  const [copied, setCopied] = useState(false)
  // A loan amount typed by hand, offered as a third choice beside the two
  // obvious ones. Not saved until a choice is recorded.
  // The deposit being considered. Not saved until it is recorded.
  const [typedDeposit, setTypedDeposit] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setD(deal) }, [deal])

  // The lender's own repricing rule, typed into the lender library. Null is N/A
  // and stays N/A - see docs/lender-reprice-schema.sql.
  useEffect(() => {
    if (!deal?.lender_id) { setThreshold(null); return }
    let alive = true
    supabase.from('lenders').select('reprice_over_percent').eq('id', deal.lender_id).maybeSingle()
      .then(({ data }: any) => { if (alive) setThreshold(data?.reprice_over_percent ?? null) })
    return () => { alive = false }
  }, [deal?.lender_id])

  if (!d?.offer_accepted_at || d?.settled_at) return null

  async function put(field: string, value: any) {
    const problem = await checkedWrite(
      supabase.from('deals').update({ [field]: value }).eq('id', d.id), 'That')
    if (problem) { setErr(problem); return }
    setErr(''); setSaved('Saved.')
    setD((prev: any) => ({ ...prev, [field]: value }))
    onUpdated?.({ [field]: value })
    setTimeout(() => setSaved(''), 2000)
  }

  // THE ANSWER, AND WHO GAVE IT. Three columns at once rather than three saves:
  // a choice half-written is worse than none, and this is a regulated file.
  async function recordRework(r: Reworked) {
    setBusy(true)
    // ONE WRITE. The deposit answered, the loan that falls out of it, and who
    // said so - a rework half-written is worse than none, on a regulated file.
    const patch = {
      contract_deposit: r.deposit,
      contract_loan_amount: r.loan,
      contract_stamp_duty: r.duty,
      contract_funding_at: new Date().toISOString(),
      contract_funding_by: me?.name || null,
    }
    const problem = await checkedWrite(
      supabase.from('deals').update(patch).eq('id', d.id), 'Those figures')
    setBusy(false)
    if (problem) { setErr(problem); return }
    setErr(''); setSaved('Recorded.')
    setD((prev: any) => ({ ...prev, ...patch }))
    onUpdated?.(patch)
    setTimeout(() => setSaved(''), 2000)
  }

  const onBlurField = (field: string, cast: 'text' | 'money' = 'text') =>
    (e: any) => {
      const raw = e.target.value
      const value = cast === 'money' ? (num(raw) || null) : (String(raw).trim() || null)
      if (String(value ?? '') !== String(d[field] ?? '')) put(field, value)
    }

  const lenderName = d?.lenders?.name || lenderOnTheDeal(d?.lo_data || {})
  const blanks = stillBlank(d)
  const preapproval = preapprovalLine(d)
  const steps = lenderSteps(lenderName)

  // IF THE LOAN ABSORBS THE DIFFERENCE. Said as the conditional it is: nothing
  // has moved the loan yet, and nothing here will. It is the common case and the
  // one that decides whether the pricing survives, so it is worth saying before
  // somebody submits.
  const estimate = num(d?.bc_data?.purchasePrice) || num(d?.bc_data?.newPurchasePrice)
  const paid = num(d?.contract_price)
  const loanNow = loanOnTheDeal(d)
  // THE LOAN THE DEAL IS HEADING FOR.
  //
  // Once somebody has answered where the difference comes from, that answer IS
  // the loan and there is nothing to assume. Before they have, the useful thing
  // to show is what it would be if the loan absorbed the move - which is one of
  // the two choices, and the one that changes the lending.
  //
  // This matters most on a reduction, which Fabio says is nine deals in ten: a
  // client who takes the saving off the loan has moved it far enough to need new
  // pricing, while a client who keeps the difference has not moved it at all.
  // Assuming the first would have told the second they needed repricing they did
  // not need, and would have offered ANZ an acknowledgement for a reduction that
  // never happened.
  const chosenLoan = num(d.contract_loan_amount)
  const wouldBe = chosenLoan
    || (estimate && paid && loanNow ? loanNow + (paid - estimate) : 0)
  const pricing = wouldBe > 0 ? pricingLine(lenderName, loanNow, wouldBe, threshold) : null
  const moved = priceHasMoved(d)
  const assessed = depositAsAssessed(d)
  const keepLvr = depositToKeepLvr(d)
  // What is on screen, or what was recorded earlier, so reopening a deal shows
  // the figures rather than an empty question.
  const rework = reworkFromDeposit(d, num(typedDeposit) || num(d.contract_deposit))
  const anz = wouldBe > 0 ? anzTemplateFor(d, loanNow, wouldBe, me?.name) : { needed: false, reference: '', change: '' }

  return (
    <div className="bg-card border border-[#EDE7DD] rounded-xl px-5 py-4 mb-4">
      <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
        <span className="text-[9.5px] font-bold tracking-[.07em] uppercase text-faint">Offer accepted</span>
        <span className="text-[12.5px] text-faint">{dayMonthYear(d.offer_accepted_at)}</span>
        {blanks.length > 0 && (
          <span className="text-[11.5px] text-chase">Still to record: {blanks.join(', ')}</span>
        )}
        {saved && <span className="ml-auto text-[11.5px] text-done">{saved}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1">
        <div>
          <span className={LAB}>Settlement date</span>
          <input type="date" defaultValue={d.expected_settlement_date || ''}
            key={`s${d.expected_settlement_date || ''}`}
            onBlur={onBlurField('expected_settlement_date')} className={INP} />
          <p className="m-0 mt-1 text-[10.5px] text-[#A0A7AE]">
            The same date the settlements panel holds &mdash; not a second copy of it.
          </p>
        </div>
        <div>
          <span className={LAB}>Finance clause by</span>
          <input type="date" defaultValue={d.finance_clause_date || ''}
            key={`f${d.finance_clause_date || ''}`}
            onBlur={onBlurField('finance_clause_date')} className={INP} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3 max-[720px]:grid-cols-1">
        <div>
          <span className={LAB}>Price paid</span>
          <input defaultValue={d.contract_price ?? ''} key={`p${d.contract_price ?? ''}`}
            onBlur={onBlurField('contract_price', 'money')} placeholder="off the contract" className={INP} />
          {estimate > 0 && (
            <p className="m-0 mt-1 text-[10.5px] text-[#A0A7AE]">the BC allowed for {money(estimate)}</p>
          )}
        </div>
        <div>
          <span className={LAB}>Deposit paid</span>
          <input defaultValue={d.deposit_paid ?? ''} key={`dp${d.deposit_paid ?? ''}`}
            onBlur={onBlurField('deposit_paid', 'money')} placeholder="what has gone in" className={INP} />
        </div>
        <div>
          <span className={LAB}>Deposit paid on</span>
          <input type="date" defaultValue={d.deposit_paid_at || ''} key={`da${d.deposit_paid_at || ''}`}
            onBlur={onBlurField('deposit_paid_at')} className={INP} />
        </div>
      </div>

      {/* THE LENDER'S REFERENCE, for a deal that was lodged before the box at
          lodgement existed. Filled in there normally - see DealSettlement - but
          a deal already in flight has nowhere else to catch up, and ANZ will not
          take the acknowledgement email without it. */}
      <div className="mt-3 max-w-[360px]">
        <span className={LAB}>{lenderName || 'Lender'}&rsquo;s reference</span>
        <input defaultValue={d.lender_reference || ''} key={`lr${d.lender_reference || ''}`}
          onBlur={onBlurField('lender_reference')}
          placeholder="recorded when the deal was lodged" className={INP} />
      </div>

      {/* WHO ELSE IS ON THIS PURCHASE.
          
          Fabio, 29 Sep 2026: "we should have a spot do solictors details so they
          also recieve apporval??? when it is a purchase" - then "add buers agent
          as well".
          
          A draft of the formal approval email said we had let the solicitor
          know. Nothing in the portal could have: there was nowhere to record one
          at all. His answer is better than the sentence - copy them in, and it
          is true because they are reading it. See lib/other-side.ts.
          
          NEITHER IS COMPULSORY. A blank buyers agent is a fact, not a gap. What
          IS shown is a name with no address, because that is somebody we think
          we can reach and cannot. */}
      <div className="mt-4">
        <span className={LAB}>Who else is on this purchase</span>
        <p className="m-0 mb-2 text-[10.5px] text-[#A0A7AE]">
          Copied in on the formal approval. Leave either blank if there is not one.
        </p>
        <div className="grid grid-cols-3 gap-3 max-[720px]:grid-cols-1">
          <div>
            <span className={LAB}>Solicitor / conveyancer</span>
            <input defaultValue={d.solicitor_name || ''} key={`sn${d.solicitor_name || ''}`}
              onBlur={onBlurField('solicitor_name')} placeholder="name and firm" className={INP} />
          </div>
          <div>
            <span className={LAB}>Their email</span>
            <input defaultValue={d.solicitor_email || ''} key={`se${d.solicitor_email || ''}`}
              onBlur={onBlurField('solicitor_email')} placeholder="so they get the approval" className={INP} />
          </div>
          <div>
            <span className={LAB}>Their phone</span>
            <input defaultValue={d.solicitor_phone || ''} key={`sp${d.solicitor_phone || ''}`}
              onBlur={onBlurField('solicitor_phone')} placeholder="optional" className={INP} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 max-[720px]:grid-cols-1">
          <div>
            <span className={LAB}>Buyers agent</span>
            <input defaultValue={d.buyers_agent_name || ''} key={`bn${d.buyers_agent_name || ''}`}
              onBlur={onBlurField('buyers_agent_name')} placeholder="name and agency" className={INP} />
          </div>
          <div>
            <span className={LAB}>Their email</span>
            <input defaultValue={d.buyers_agent_email || ''} key={`be${d.buyers_agent_email || ''}`}
              onBlur={onBlurField('buyers_agent_email')} placeholder="so they get the approval" className={INP} />
          </div>
          <div>
            <span className={LAB}>Their phone</span>
            <input defaultValue={d.buyers_agent_phone || ''} key={`bp${d.buyers_agent_phone || ''}`}
              onBlur={onBlurField('buyers_agent_phone')} placeholder="optional" className={INP} />
          </div>
        </div>
        {/* A name we cannot reach. Said here, months before anybody presses send
            on an email that would have quietly left them off. */}
        {otherSideGaps(d).map((g, i) => (
          <p key={i} className="m-0 mt-2 text-[11.5px] text-chase">{g}.</p>
        ))}
      </div>

      {/* WHAT THIS LENDER WANTS. Written down on 10 September and never shown to
          anybody until now. See lib/offer-accepted-rules.ts. */}
      <div className="mt-4">
        <span className={LAB}>Telling {lenderName || 'the lender'}</span>
        {steps.map((l, i) => <Line key={i} line={l} />)}
        {pricing && <Line line={pricing} />}
        {preapproval && <Line line={preapproval} />}
      </div>

      {/* THE PRICE MOVED. HOW MUCH ARE THE CLIENTS PUTTING IN?
        *
        * Fabio, 28 Sep 2026: "depsoit is the only real question what the
        * customer would like to do and YES depsoit needs to be enough to cover
        * duty so purcahse pirce + duty = total cost - deposit = loan amount".
        *
        * The first version of this asked which LOAN they wanted and derived the
        * contribution. Backwards, and contrary to the portal's own rule in
        * lib/purchase-rows.ts. The deposit is the question. */}
      {moved && (
        <div className="mt-4 bg-chase-bg border border-chase-edge rounded-lg px-4 py-3.5">
          <div className="text-[13.5px] font-bold text-[#6E4C0F]">
            How much would the clients like to put in?
          </div>
          <div className="text-[12.5px] text-chase mt-0.5 leading-relaxed">
            They were going to bring {money(assessed)}. Total cost is now {money(dutyNow(d) + num(d.contract_price))},
            against {money(num(d.bc_data?.purchasePrice) + num(d.bc_data?.stampDuty))} as assessed.
          </div>

          {stampDutyNeedsUpdating(d) && (
            <div className="mt-2.5 bg-card border border-[#E7DECC] rounded-lg px-3 py-2.5">
              <div className="text-[12.5px] font-medium text-ink">Stamp duty still needs the new figure.</div>
              <div className="text-[11.5px] text-muted mt-0.5 leading-relaxed">
                The BC has {money(d.bc_data?.stampDuty)}. Duty moves with the price and the portal
                does not work it out &mdash; type it and everything below follows.
              </div>
              <input defaultValue={d.contract_stamp_duty ?? ''} key={`sd${d.contract_stamp_duty ?? ''}`}
                onBlur={onBlurField('contract_stamp_duty', 'money')}
                placeholder="duty on the price they paid"
                className="mt-2 text-[12px] border border-[#E3E6E8] rounded-lg px-2.5 py-1.5 bg-card w-[210px]" />
            </div>
          )}

          <button onClick={() => setTypedDeposit(String(assessed))}
            className={`w-full text-left mt-2 rounded-lg px-3 py-2.5 border bg-card transition ${
              num(typedDeposit) === assessed ? 'border-[#2DBEFF] ring-1 ring-[#2DBEFF]' : 'border-[#E7DECC] hover:border-[#D9C9A8]'}`}>
            <div className="text-[13px] font-medium text-ink">The same &mdash; {money(assessed)}</div>
            <div className="text-[12px] text-muted mt-0.5">The amount they were already bringing.</div>
          </button>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[11.5px] text-muted">Or a different amount:</span>
            <input value={typedDeposit} onChange={e => setTypedDeposit(e.target.value)}
              placeholder="what they will put in"
              className="text-[12px] border border-[#E3E6E8] rounded-lg px-2.5 py-1.5 bg-card w-[170px]" />
          </div>

          {keepLvr > 0 && (
            <div className="mt-2 text-[11.5px] text-info bg-info-bg border border-info-edge rounded-lg px-3 py-2 leading-relaxed">
              <b>{money(keepLvr)} keeps the LVR where it was.</b> Offered, not chosen.
              <button onClick={() => setTypedDeposit(String(keepLvr))}
                className="ml-2 underline hover:no-underline">Use it</button>
            </div>
          )}

          {/* THE BREAKDOWN, in the five lines every purchase uses. Fabio, 16 Sep
              2026 - and total cost is still not a box. See lib/purchase-rows.ts. */}
          {rework && (
            <div className="mt-3 bg-card border border-[#E7DECC] rounded-lg px-3.5 py-3">
              <table className="w-full text-[13px]">
                <tbody>
                  {purchaseRows({
                    price: rework.price, duty: rework.duty,
                    dutyLabel: dutyLabelFor(d.bc_data), loan: rework.loan,
                    contribution: rework.deposit, contributionFrom: 'savings',
                    lmiApplicable: d.bc_data?.lmiApplicable, lmi: d.bc_data?.lmi,
                    lmiTreatment: d.bc_data?.lmiTreatment,
                  }).map((r, i) => (
                    <tr key={i}>
                      {r.note
                        ? <td colSpan={2} className="py-1 text-[11.5px] text-[#8A9098] leading-relaxed">{r.value}</td>
                        : <>
                            <td className="py-1 text-[#666]">{r.label}</td>
                            <td className="py-1 text-right tabular-nums font-medium">{r.value}</td>
                          </>}
                    </tr>
                  ))}
                  <tr><td className="pt-2 text-[#666]">LVR</td>
                    <td className={`pt-2 text-right tabular-nums font-medium ${rework.bringsLmiIn ? 'text-[#B91C1C]' : ''}`}>
                      {rework.lvr === null ? 'not known' : `${rework.lvr}%`}
                      {rework.bringsLmiIn && ' — over 80%, LMI applies'}
                    </td></tr>
                </tbody>
              </table>
              <button onClick={() => recordRework(rework)} disabled={busy}
                className="mt-3 px-3 py-1.5 text-xs rounded-lg bg-ink text-page font-semibold hover:opacity-90 disabled:opacity-50">
                {busy ? 'Recording...' : 'Record these figures'}
              </button>
            </div>
          )}

          <p className="m-0 mt-2.5 text-[11.5px] text-muted leading-relaxed">
            Nothing changes until you record it. The borrowing capacity is left exactly as it is
            &mdash; these become the deal&rsquo;s figures from here: formal approval, settlement and
            commission all read them.
          </p>

          {d.contract_funding_at && (
            <p className="m-0 mt-2 text-[11.5px] text-done">
              Recorded{d.contract_funding_by ? ` by ${d.contract_funding_by}` : ''}
              {` on ${dayMonthYear(d.contract_funding_at)}`}. Change the deposit to rework it.
            </p>
          )}
        </div>
      )}

      {anz.needed && (
        <div className="mt-4">
          <span className={LAB}>ANZ also need this from you, because the loan comes down</span>
          <pre className="m-0 mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed bg-page
                          border border-[#E3E6E8] rounded-lg px-3 py-2.5 text-[#3C4450]">
{anzReductionEmail({ applicationReference: anz.reference, change: anz.change,
                     conversationDate: dayMonthYear(new Date()), brokerName: me?.name || '' })}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(anzReductionEmail({
                applicationReference: anz.reference, change: anz.change,
                conversationDate: dayMonthYear(new Date()), brokerName: me?.name || '',
              })).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
            }}
            className="mt-2 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            {copied ? 'Copied' : 'Copy it'}
          </button>
          <p className="m-0 mt-1.5 text-[11px] text-[#A0A7AE]">
            You are acknowledging a conversation you had, so the portal will never send this for you.
            Check the date and the description before it goes.
          </p>
        </div>
      )}

      {err && <p className="m-0 mt-3 text-[12px] text-chase">{err}</p>}
    </div>
  )
}
