'use client'
import { useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { templateLabel } from '@/lib/templates'
import {
  splitsOf, dealRow, stillNeeded, needsFundsRole, purposeSummary,
  withSplitDetail, PURPOSE_LABEL, FUNDS_LABEL, defaultSecurityAddress,
} from '@/lib/deal-structure'
import { fundsToComplete } from '@/lib/funds-to-complete'

// THE DEAL, AS ONE BLOCK, IN TWO PLACES.
//
// Replaces the "FROM BC" strip on Lending options and the "DEAL SUMMARY" strip
// on Compliance. One component, one record - change the approval type on the LO
// and it has already changed on Compliance, because there is no second copy to
// drift. Fabio, 3 Sep 2026: "that will replace these 2 section in LO and
// Compliance (static across)".
//
// Read-only wherever the value exists somewhere else. The only editable fields
// are the ones the portal has never recorded anywhere: approval type, security
// address, cashback, and each split's term and product. Everything else shows
// what the BC or the LO says, and the way to change it is to change it there -
// which is the whole reason the compliance notes went wrong in the first place.

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-AU')

const K = 'text-[9.5px] font-semibold tracking-[.09em] uppercase text-[#A29889]'
const INP = 'border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 text-[13px] text-[#221F1B] bg-white focus:outline-none focus:border-[#2DBEFF]'
const NEED = 'border-[#D9A441] bg-[#FFFDF8]'

export default function DealStructure({ deal, onUpdated, onSplitChange, onAddSplit }: {
  deal: any
  onUpdated?: (patch: any) => void
  // Supplied only by the Lending options tab, which owns lo_data and can write
  // to it safely from its own state. On Compliance these are absent and the two
  // LO-owned answers show a link back instead of a dropdown - the block is in
  // two places, but only one of them is allowed to change the LO's mind.
  onSplitChange?: (splitId: string, patch: { purpose?: string; funds?: string }) => void
  onAddSplit?: () => void
}) {
  const supabase = createSupabaseBrowser()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const splits = useMemo(() => splitsOf(deal), [deal])
  const row = useMemo(() => dealRow(deal), [deal])
  const funds = useMemo(() => fundsToComplete(deal), [deal])
  const needed = useMemo(() => stillNeeded(deal), [deal])
  const askFunds = needsFundsRole(deal)
  const purpose = purposeSummary(deal)

  const cd = deal?.compliance_data || {}

  // Everything editable here lives in compliance_data, deliberately: lo_data is
  // autosaved wholesale by the LO form, and a second writer would lose its
  // changes the next time somebody typed there.
  async function save(next: any) {
    setBusy(true)
    const problem = await checkedWrite(
      supabase.from('deals').update({ compliance_data: next }).eq('id', deal.id), 'That change')
    setBusy(false)
    if (problem) { setErr(problem); return }
    setErr('')
    onUpdated?.({ compliance_data: next })
  }

  const setField = (k: string, v: any) => save({ ...cd, [k]: v })
  const setDetail = (id: string, patch: any) => save(withSplitDetail(cd, id, patch))

  // Ticking pre-approval fills the address in, because on a pre-approval there
  // is no address yet and an empty box just looks unfinished.
  function setApproval(pre: boolean) {
    const next = { ...cd, preApproval: pre }
    if (pre && !String(cd.securityAddress || '').trim()) {
      next.securityAddress = defaultSecurityAddress(deal, true)
    }
    save(next)
  }

  return (
    <div className="bg-white border border-[#F0F0F0] rounded-xl px-[18px] py-[15px] mb-4">
      <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
        <span className={K}>Deal structure</span>
        {templateLabel(deal?.bc_data?.template) && (
          <span className="text-[11.5px] font-semibold text-[#0E86B8] bg-[#F4FCFF] border border-[#CDEBF8] rounded-md px-2.5 py-[3px]">
            {templateLabel(deal.bc_data.template)}
          </span>
        )}
        {purpose && <span className="text-[12px] text-[#7A7266]">{purpose}</span>}
        {needed.length > 0 && (
          <span className="text-[11px] font-semibold text-[#8A6218] bg-[#FDF6EC] border border-[#EBD9BE] rounded-md px-2 py-[2px]">
            {needed.length} to complete
          </span>
        )}
        <a href={`/deals/${deal.id}?stage=BC`} className="ml-auto text-[12px] text-[#2DBEFF] hover:underline">Open BC tab →</a>
      </div>

      {err && (
        <p className="mb-3 border border-[#E9D2CF] bg-[#FDF3F2] rounded-lg px-3 py-2 text-[12.5px] text-[#8E3A34]">{err}</p>
      )}

      {/* --- the deal, across ------------------------------------------- */}
      <div className="flex gap-6 items-start flex-wrap">
        <Field label="Lender">
          <Value v={row.lender} src="from the LO" />
        </Field>

        <Field label="Approval">
          <div className="inline-flex border border-[#E8E1D6] rounded-lg overflow-hidden">
            {[['Formal', false], ['Pre-approval', true]].map(([label, pre]) => (
              <button key={String(label)} disabled={busy} onClick={() => setApproval(pre as boolean)}
                className={`px-3 py-1.5 text-[12.5px] transition ${row.preApproval === pre
                  ? 'bg-[#221F1B] text-white font-semibold' : 'bg-white text-[#7A7266] hover:bg-[#FAF9F7]'}`}>
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Security address" grow>
          <input defaultValue={row.securityAddress} key={row.securityAddress}
            onBlur={e => { if (e.target.value !== row.securityAddress) setField('securityAddress', e.target.value) }}
            placeholder={row.preApproval ? 'TBA' : 'Street, suburb, state'}
            className={`${INP} w-full`} />
          {row.preApproval && row.securityAddress.startsWith('TBA') && (
            <p className="text-[11px] text-[#0E86B8] mt-1 mb-0">Filled from the BC suburb because this is a pre-approval</p>
          )}
        </Field>

        <Field label="Property value">
          <Value v={row.propertyValue > 0 ? money(row.propertyValue) : ''}
            src={row.securityCount > 1 ? `${row.securityCount} securities` : 'from the BC'} />
        </Field>

        {row.existingLoan > 0 && (
          <Field label="Existing loan"><Value v={money(row.existingLoan)} src="being refinanced" /></Field>
        )}

        <Field label="LVR">
          {row.lvr !== null
            ? <Value v={`${row.lvr}%`} src={`${money(row.totalLending)} lending`} />
            : <span className="text-[12.5px] font-semibold text-[#B58A2B]">not known</span>}
        </Field>

        {/* Cashback lives beside Product type in the splits table below, where
            Fabio asked for it. It only appears here when there are no splits to
            put it next to. */}
        {splits.length === 0 && (
          <Field label="Promotion / cashback">
            <CashbackInput value={row.cashback} onSave={v => setField('cashback', v)} />
          </Field>
        )}
      </div>

      {/* --- funds to complete ------------------------------------------ */}
      {funds.applies && (
        <div className="mt-3.5 bg-[#FBFAF8] border border-[#EFEAE0] rounded-[10px] px-3.5 py-2.5 flex items-center flex-wrap">
          {funds.lines.map((l, i) => (
            <div key={l.label} className={`px-4 ${i === 0 ? 'pl-0' : 'border-l border-[#EDE8DF]'}`}>
              <div className={K}>{l.label}</div>
              {/* Green is what says "this comes off". Fabio, 3 Sep 2026: "just
                  green number no minus dont like it". */}
              <div className={`text-[14.5px] font-bold whitespace-nowrap ${l.kind === 'source' ? 'text-[#1E7A4A]' : 'text-[#221F1B]'}`}>
                {money(l.amount)}
              </div>
            </div>
          ))}
          {funds.capitalised.map(c => (
            <div key={c.label} className="px-4 border-l border-[#EDE8DF]">
              <div className={K}>{c.label}</div>
              <div className="text-[13px] font-semibold text-[#7A7266] whitespace-nowrap">{money(c.amount)}</div>
              <div className="text-[10.5px] text-[#A29889]">capitalised</div>
            </div>
          ))}
          {funds.workable && (
            <div className="ml-auto pl-5 border-l border-[#E0D8CB]">
              <div className={`${K} text-[#7A7266]`}>Funds to complete</div>
              <div className="text-[17px] font-bold text-[#221F1B] whitespace-nowrap">
                {funds.toFind > 0 ? money(funds.toFind) : 'nil'}
              </div>
            </div>
          )}
          {funds.missing.length > 0 && (
            <div className="w-full mt-2 pt-2 border-t border-[#EFEAE0] text-[11.5px] text-[#8A6218]">
              {funds.missing.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* --- the splits, one row each ------------------------------------ */}
      {splits.length > 0 && (
        <>
          <div className="h-px bg-[#F2F2F2] my-3.5" />
          <div className="flex items-baseline gap-2.5 mb-2 flex-wrap">
            <span className={K}>Loan splits</span>
            <span className="text-[12px] text-[#A29889]">
              {onSplitChange
                ? 'amount and rate come from the lender options below'
                : 'amount, rate, repayment and purpose come from the Lending options tab'}
            </span>
            {onAddSplit && (
              <button onClick={onAddSplit}
                className="ml-auto text-[12px] text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-2.5 py-[3px] hover:bg-[#F4FCFF] transition">
                + Add split
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[760px]">
              <thead>
                <tr>
                  {['Split', 'Amount', 'Rate', 'P&I / IO', 'Purpose'].map(h => (
                    <th key={h} className={`${K} text-left pb-1.5 pr-3 whitespace-nowrap`}>{h}</th>
                  ))}
                  {askFunds && <th className={`${K} text-left pb-1.5 pr-3 whitespace-nowrap text-[#8A6218]`}>What it does</th>}
                  {['Term', 'Product type'].map(h => (
                    <th key={h} className={`${K} text-left pb-1.5 pr-3 whitespace-nowrap text-[#8A6218]`}>{h}</th>
                  ))}
                  {/* One per deal, not one per split. Fabio, 3 Sep 2026: "cashback
                      dont do one per split you only get one cashback or not" -
                      so it is one box spanning every row, sitting where he asked
                      for it: "just push cashback next to product type". */}
                  <th className={`${K} text-left pb-1.5 whitespace-nowrap`}>Promotion / cashback</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((s, i) => (
                  <tr key={s.id} className={i > 0 ? 'border-t border-[#F5F2ED]' : ''}>
                    <td className="py-1.5 pr-3">
                      <div className="text-[12.5px] font-bold text-[#221F1B] whitespace-nowrap">Split {i + 1}</div>
                      <div className="text-[10.5px] text-[#A29889] whitespace-nowrap">{s.label}</div>
                    </td>
                    <td className="py-1.5 pr-3 text-[15px] font-bold text-[#221F1B] whitespace-nowrap">
                      {s.amount ? money(Number(String(s.amount).replace(/[$,\s]/g, '')) || 0) : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-[13.5px] font-semibold text-[#221F1B]">{s.rate ? `${s.rate}%` : '—'}</td>
                    <td className="py-1.5 pr-3 text-[13.5px] text-[#221F1B] whitespace-nowrap">{s.repaymentType || '—'}</td>
                    {/* On the LO this is answered here. It used to say "set on
                        the LO" on the LO itself, which is a signpost pointing at
                        the ground you are standing on. */}
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {onSplitChange
                        ? <select value={s.purpose || ''}
                            onChange={e => onSplitChange(s.id, { purpose: e.target.value })}
                            className={`${INP} ${!s.purpose ? NEED : ''}`}>
                            <option value="">Owner occupied or investment?</option>
                            <option value="OO">{PURPOSE_LABEL.OO}</option>
                            <option value="INV">{PURPOSE_LABEL.INV}</option>
                          </select>
                        : s.purpose
                        ? <span className={`text-[9.5px] font-bold tracking-[.05em] rounded px-2 py-[2px] text-white ${
                            s.purpose === 'INV' ? 'bg-[#946017]' : 'bg-[#0E86B8]'}`}>
                            {PURPOSE_LABEL[s.purpose]}
                          </span>
                        : <a href={`/deals/${deal.id}?stage=LO`}
                            className="text-[11.5px] text-[#8A6218] bg-[#FDF6EC] border border-[#D9A441] rounded px-2 py-[3px] hover:underline">
                            set on the LO ↗
                          </a>}
                    </td>
                    {askFunds && (
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {onSplitChange
                          ? <select value={s.funds || ''}
                              onChange={e => onSplitChange(s.id, { funds: e.target.value })}
                              className={`${INP} ${!s.funds ? NEED : ''}`}>
                              <option value="">What does this money do?</option>
                              {Object.entries(FUNDS_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          : s.funds
                          ? <span className="text-[12px] text-[#221F1B]">{FUNDS_LABEL[s.funds]}</span>
                          : <a href={`/deals/${deal.id}?stage=LO`}
                              className="text-[11.5px] text-[#8A6218] bg-[#FDF6EC] border border-[#D9A441] rounded px-2 py-[3px] hover:underline">
                              set on the LO ↗
                            </a>}
                      </td>
                    )}
                    <td className="py-1.5 pr-3">
                      <input defaultValue={s.termYears} key={`t${s.id}${s.termYears}`}
                        onBlur={e => { if (e.target.value !== s.termYears) setDetail(s.id, { termYears: e.target.value }) }}
                        placeholder="years" className={`${INP} w-[76px] ${!s.termYears ? NEED : ''}`} />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input defaultValue={s.productType} key={`p${s.id}${s.productType}`}
                        onBlur={e => { if (e.target.value !== s.productType) setDetail(s.id, { productType: e.target.value }) }}
                        placeholder="product" className={`${INP} w-[150px] ${!s.productType ? NEED : ''}`} />
                    </td>
                    {i === 0 && (
                      <td className="py-1.5 align-top" rowSpan={splits.length}>
                        <CashbackInput value={row.cashback} onSave={v => setField('cashback', v)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {row.ooTotal > 0 && row.invTotal > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-[#F2F2F2] flex gap-6 flex-wrap text-[12.5px] text-[#7A7266]">
              <span>Total lending <b className="text-[15px] text-[#221F1B]">{money(row.totalLending)}</b></span>
              <span>Owner occupied <b className="text-[15px] text-[#221F1B]">{money(row.ooTotal)}</b></span>
              <span>Investment <b className="text-[15px] text-[#221F1B]">{money(row.invTotal)}</b></span>
              {row.unsetTotal > 0 && (
                <span className="text-[#8A6218]">No purpose set <b className="text-[15px]">{money(row.unsetTotal)}</b></span>
              )}
            </div>
          )}
        </>
      )}

      {/* THE WARNING, NOT A LOCK. The tab opens as normal; it is the credit
          notes that wait. Fabio, 3 Sep 2026: "dont lock but warning sign saying
          we need that information to generate compliance". */}
      {needed.length > 0 && (
        <div className="mt-3 border border-[#EBD9BE] bg-[#FDF6EC] rounded-[10px] px-4 py-3">
          <h4 className="m-0 mb-1 text-[13.5px] text-[#221F1B] font-semibold">
            ⚠ {needed.length === 1 ? 'One thing is' : `${needed.length} things are`} needed before the credit notes can be written
          </h4>
          <p className="m-0 text-[12.5px] text-[#8A6218]">
            Left blank, the notes would either say nothing useful about that money or start guessing.
          </p>
          <ul className="mt-2 mb-0 pl-5 text-[12.5px] text-[#8A6218]">
            {needed.slice(0, 6).map((n, i) => (
              <li key={i} className="mb-0.5">
                <b className="text-[#221F1B]">{n.splitLabel}</b> — {n.what}
              </li>
            ))}
            {needed.length > 6 && <li>and {needed.length - 6} more</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div className={grow ? 'flex-1 min-w-[200px]' : 'min-w-0'}>
      <div className={`${K} mb-1`}>{label}</div>
      {children}
    </div>
  )
}

function Value({ v, src }: { v: string; src?: string }) {
  if (!v) return <span className="text-[12.5px] text-[#C3BDB2] italic">not recorded</span>
  return (
    <div className="text-[15px] font-bold text-[#221F1B] leading-tight">
      {v}
      {src && <span className="block text-[10.5px] font-normal text-[#C3BDB2]">{src}</span>}
    </div>
  )
}

// Declared out here on purpose. A component defined inside another component is
// a brand new type on every render, so React throws the old input away and the
// cursor jumps out of the box while somebody is still typing in it.
function CashbackInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return (
    <input defaultValue={value} key={value}
      onBlur={e => { if (e.target.value !== value) onSave(e.target.value) }}
      placeholder="none" className={`${INP} w-[130px]`} />
  )
}
