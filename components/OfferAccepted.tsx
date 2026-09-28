'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { lenderSteps, preapprovalLine, pricingLine, anzTemplateFor,
         stillBlank, loanOnTheDeal, type PanelLine } from '@/lib/offer-accepted-panel'
import { anzReductionEmail } from '@/lib/offer-accepted-rules'
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

const INP = 'text-[12.5px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-[#221F1B] w-full'
const LAB = 'text-[8.5px] font-bold tracking-[.07em] uppercase text-[#A0A7AE] block mb-1'

function Line({ line }: { line: PanelLine }) {
  const tone =
    line.kind === 'watch'   ? 'bg-[#FDF6EC] border-[#EBD9BE] text-[#8A6218]' :
    line.kind === 'unknown' ? 'bg-[#F7F8F9] border-[#E3E6E8] text-[#5B6672]' :
    line.kind === 'clock'   ? 'bg-[#F4FAFE] border-[#CDEBF8] text-[#0E5E86]' :
                              'bg-[#F6FDF8] border-[#BBF7D0] text-[#166534]'
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

  const onBlurField = (field: string, cast: 'text' | 'money' = 'text') =>
    (e: any) => {
      const raw = e.target.value
      const value = cast === 'money' ? (num(raw) || null) : (String(raw).trim() || null)
      if (String(value ?? '') !== String(d[field] ?? '')) put(field, value)
    }

  const lenderName = d?.lenders?.name || d?.lo_data?.recommendedLender
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
  const wouldBe = estimate && paid && loanNow ? loanNow + (paid - estimate) : 0
  const pricing = wouldBe > 0 ? pricingLine(lenderName, loanNow, wouldBe, threshold) : null
  const anz = wouldBe > 0 ? anzTemplateFor(d, loanNow, wouldBe, me?.name) : { needed: false, reference: '', change: '' }

  return (
    <div className="bg-white border border-[#EDE7DD] rounded-xl px-5 py-4 mb-4">
      <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
        <span className="text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889]">Offer accepted</span>
        <span className="text-[12.5px] text-[#A29889]">{dayMonthYear(d.offer_accepted_at)}</span>
        {blanks.length > 0 && (
          <span className="text-[11.5px] text-[#8A6218]">Still to record: {blanks.join(', ')}</span>
        )}
        {saved && <span className="ml-auto text-[11.5px] text-[#15803D]">{saved}</span>}
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

      {/* WHAT THIS LENDER WANTS. Written down on 10 September and never shown to
          anybody until now. See lib/offer-accepted-rules.ts. */}
      <div className="mt-4">
        <span className={LAB}>Telling {lenderName || 'the lender'}</span>
        {steps.map((l, i) => <Line key={i} line={l} />)}
        {pricing && <Line line={pricing} />}
        {preapproval && <Line line={preapproval} />}
      </div>

      {anz.needed && (
        <div className="mt-4">
          <span className={LAB}>ANZ also need this from you, because the loan comes down</span>
          <pre className="m-0 mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed bg-[#FBFCFD]
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

      {err && <p className="m-0 mt-3 text-[12px] text-[#8E3A34]">{err}</p>}
    </div>
  )
}
