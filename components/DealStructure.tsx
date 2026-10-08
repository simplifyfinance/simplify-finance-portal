'use client'
import { useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { patchDealColumn } from '@/lib/patch-deal-column'
import { templateLabel } from '@/lib/templates'
import {
  splitsOf, dealRow, stillNeeded, needsFundsRole, purposeSummary,
  withSplitDetail, isInterestOnly, PURPOSE_LABEL, FUNDS_LABEL, defaultSecurityAddress,
} from '@/lib/deal-structure'
import { fundsToComplete, loanAmountDisagrees, bcSplitsTotal } from '@/lib/funds-to-complete'
import { SPLIT_TYPES, typesOffered, typeContradictsProduct } from '@/lib/lo-splits'
import { optionOnTheDeal } from '@/lib/client-agreement'

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

const K = 'text-[9.5px] font-semibold tracking-[.09em] uppercase text-faint'
const INP = 'border border-line rounded-lg px-2.5 py-1.5 text-[13px] text-ink bg-card focus:outline-none focus:border-brand'
const NEED = 'border-dashed border-field-line bg-page'

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
  // The product the deal structure is describing - option one until somebody
  // picks a recommendation, exactly as splitsOf itself does. Only ever used to
  // say that the ticks and the answer here disagree; it never changes either.
  const recOption = useMemo(() => optionOnTheDeal(deal?.lo_data || {}), [deal])
  const row = useMemo(() => dealRow(deal), [deal])
  const funds = useMemo(() => fundsToComplete(deal), [deal])
  // Two records, one loan. Null when they agree, which is almost always.
  const loanSplit = useMemo(() => loanAmountDisagrees(deal), [deal])
  const needed = useMemo(() => stillNeeded(deal), [deal])
  const askFunds = needsFundsRole(deal)
  const purpose = purposeSummary(deal)

  const cd = deal?.compliance_data || {}

  // Everything editable here lives in compliance_data, deliberately: lo_data is
  // autosaved wholesale by the LO form, and a second writer would lose its
  // changes the next time somebody typed there.
  //
  // WHY THIS RE-READS THE RECORD BEFORE EVERY CHANGE.
  //
  // This block writes the WHOLE compliance_data column, and it used to build
  // that from `deal.compliance_data` - the copy the page was rendered with. That
  // copy goes stale the moment the Compliance tab saves anything, and this block
  // is also shown on the Lending options tab. So:
  //
  //   type the compliance notes on the Compliance tab      saved
  //   switch to Lending options, tick pre-approval here     writes the copy of
  //                                                         compliance_data this
  //                                                         page was BORN with
  //   the notes are gone                                    no error, nothing on
  //                                                         screen
  //
  // One person, two tabs, no warning - the same shape of bug as two people on
  // one deal, which is what Fabio's team lost an afternoon to. So the change is
  // applied to what the database holds RIGHT NOW, not to what this page
  // remembers. `apply` is a function rather than a value for exactly that
  // reason: the caller cannot be handed the old record to build from.
  //
  // NOT A GUARANTEE. There is still a gap of milliseconds between the read and
  // the write. See lib/save-conflict.ts - the real fix for the whole class is a
  // version column, and it is not built yet.
  async function save(apply: (current: any) => any) {
    setBusy(true)
    // A failed read falls back to what is on screen, which is what this did
    // every time before today. See lib/patch-deal-column.ts.
    const { next, problem } = await patchDealColumn(supabase, deal.id, 'compliance_data', apply, cd)
    setBusy(false)
    if (problem) { setErr(problem); return }
    setErr('')
    onUpdated?.({ compliance_data: next })
  }

  const setField = (k: string, v: any) => save(cur => ({ ...cur, [k]: v }))
  const setDetail = (id: string, patch: any) => save(cur => withSplitDetail(cur, id, patch))

  // Ticking pre-approval fills the address in, because on a pre-approval there
  // is no address yet and an empty box just looks unfinished.
  function setApproval(pre: boolean) {
    save(cur => {
      const next = { ...cur, preApproval: pre }
      if (pre && !String(cur.securityAddress || '').trim()) {
        next.securityAddress = defaultSecurityAddress(deal, true)
      }
      return next
    })
  }

  return (
    <div className="bg-card border border-card-line rounded-xl px-[18px] py-[15px] mb-4">
      <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
        <span className={K}>Deal structure</span>
        {templateLabel(deal?.bc_data?.template) && (
          <span className="text-[11.5px] font-semibold text-info bg-info-bg border border-info-edge rounded-md px-2.5 py-[3px]">
            {templateLabel(deal.bc_data.template)}
          </span>
        )}
        {purpose && <span className="text-[12px] text-muted">{purpose}</span>}
        {needed.length > 0 && (
          <span className="text-[11px] font-semibold text-chase bg-chase-bg border border-chase-edge rounded-md px-2 py-[2px]">
            {needed.length} to complete
          </span>
        )}
        <a href={`/deals/${deal.id}?stage=BC`} className="ml-auto text-[12px] text-brand-ink hover:underline">Open BC tab →</a>
      </div>

      {row.optionGap && (
        <p className="mb-3 border border-chase-edge bg-chase-bg rounded-lg px-3 py-2 text-[12.5px] text-chase">
          <b>{row.optionGap}.</b> Until then the rate, product and term stay blank rather than borrowing another lender&apos;s.
        </p>
      )}

      {err && (
        <p className="mb-3 border border-chase-edge bg-chase-bg rounded-lg px-3 py-2 text-[12.5px] text-chase">{err}</p>
      )}

      {/* --- the deal, across ------------------------------------------- */}
      <div className="flex gap-6 items-start flex-wrap">
        <Field label="Lender">
          {/* WHO THIS DEAL IS WITH. It used to say "from the LO" underneath,
              which answers a question nobody asked - the whole strip comes from
              the LO. On a deal where the clients went elsewhere it now names
              the recommendation it replaced, so the swap is visible here rather
              than three clicks away on the Lending options tab. */}
          <Value v={row.lender} src={row.lenderSource} />
        </Field>

        <Field label="Approval">
          <div className="inline-flex border border-line rounded-lg overflow-hidden">
            {[['Formal', false], ['Pre-approval', true]].map(([label, pre]) => (
              <button key={String(label)} disabled={busy} onClick={() => setApproval(pre as boolean)}
                className={`px-3 py-1.5 text-[12.5px] transition ${row.preApproval === pre
                  ? 'bg-ink text-page font-semibold' : 'bg-card text-muted hover:bg-page'}`}>
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
            <p className="text-[11px] text-info mt-1 mb-0">Filled from the BC suburb because this is a pre-approval</p>
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
            : <span className="text-[12.5px] font-semibold text-muted">not known</span>}
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
        <div className="mt-3.5 bg-page border border-line rounded-[10px] px-3.5 py-2.5 flex items-center flex-wrap">
          {funds.lines.map((l, i) => (
            <div key={l.label} className={`px-4 ${i === 0 ? 'pl-0' : 'border-l border-line'}`}>
              <div className={K}>{l.label}</div>
              {/* Green is what says "this comes off". Fabio, 3 Sep 2026: "just
                  green number no minus dont like it". */}
              <div className={`text-[14.5px] font-bold whitespace-nowrap ${l.kind === 'source' ? 'text-done' : 'text-ink'}`}>
                {money(l.amount)}
              </div>
            </div>
          ))}
          {funds.capitalised.map(c => (
            <div key={c.label} className="px-4 border-l border-line">
              <div className={K}>{c.label}</div>
              <div className="text-[13px] font-semibold text-muted whitespace-nowrap">{money(c.amount)}</div>
              <div className="text-[10.5px] text-faint">capitalised</div>
            </div>
          ))}
          {/* THE DEPOSIT IS THE ANSWER, NOT A DEDUCTION. Fabio, 3 Sep 2026:
              "missed that funds to complete IS deposit not one or the other!"
              So the BC's deposit sits beside the total as a check on it -
              agreeing to the dollar on Chapman - instead of being subtracted
              and driving a $3,841,500 answer down to nil. */}
          {funds.workable && (
            <div className="ml-auto pl-5 border-l border-line">
              <div className={`${K} text-muted`}>Funds to complete</div>
              <div className="text-[17px] font-bold text-done whitespace-nowrap">
                {funds.toFind > 0 ? money(funds.toFind) : 'nil'}
              </div>
              {funds.deposit !== null && (
                <div className={`text-[10.5px] whitespace-nowrap ${funds.depositAgrees ? 'text-faint' : 'text-chase font-semibold'}`}>
                  {funds.depositAgrees
                    ? 'matches the deposit on the BC'
                    : `BC deposit ${money(funds.deposit)} — out by ${money(Math.abs(funds.deposit - funds.toFind))}`}
                </div>
              )}
            </div>
          )}
          {funds.missing.length > 0 && (
            <div className="w-full mt-2 pt-2 border-t border-line text-[11.5px] text-chase">
              {funds.missing.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* TWO RECORDS, ONE LOAN. See loanAmountDisagrees. */}
      {loanSplit && (
        <div className="bg-chase-bg border border-chase-edge rounded-xl px-4 py-2.5 mb-3 text-[12px] text-chase leading-relaxed">
          {loanSplit.byHand ? (
            <>
              <b>The lending options hold a loan amount that was entered by hand.</b>{' '}
              Using {money(loanSplit.using)} from the lending options. The borrowing capacity
              says {money(bcSplitsTotal(deal))}. Everything quoted to the client, and the
              compliance wording, follows the figure entered by hand.
            </>
          ) : (
            <>
              <b>The lending options are showing an older loan amount.</b>{' '}
              They hold {money(loanSplit.stored)}; the borrowing capacity says{' '}
              {money(loanSplit.using)}, and that is the figure being used everywhere.
              Open the lending options and type it to make the two agree.
            </>
          )}
        </div>
      )}

      {/* --- the splits, one row each ------------------------------------ */}
      {splits.length > 0 && (
        <>
          <div className="h-px bg-line-soft my-3.5" />
          <div className="flex items-baseline gap-2.5 mb-2 flex-wrap">
            <span className={K}>Loan splits</span>
            <span className="text-[12px] text-faint">
              {onSplitChange
                ? 'amount and rate come from the lender options below'
                : 'amount, rate, repayment and purpose come from the Lending options tab'}
            </span>
            {onAddSplit && (
              <button onClick={onAddSplit}
                className="ml-auto text-[12px] text-brand-ink border border-dashed border-brand rounded-lg px-2.5 py-[3px] hover:bg-info-bg transition">
                + Add split
              </button>
            )}
          </div>
          {/* TWO LINES PER SPLIT - docs/approved-looks/ds.html, density B.
              Fabio chose B on 3 Oct 2026 and confirmed it on the 5th: "this is
              perfect". The money reads first, the detail sits quieter under it.
              The nine column table this replaces needed 760px and could not
              live beside a form. EVERY CONTROL HERE IS THE ONE THAT WAS IN THE
              TABLE - lifted out, not retyped. */}
          <div className="border-t border-line-soft">
            {splits.map((s, i) => (
              <div key={s.id} className={`py-2.5 ${i > 0 ? 'border-t border-line-soft' : ''}`}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[12.5px] font-bold text-ink whitespace-nowrap">Split {i + 1}</span>
                  <span className="text-[12px] text-muted whitespace-nowrap">{s.label}</span>
                  <span className="text-[15px] font-bold text-ink whitespace-nowrap ml-auto">
                    {s.amount ? money(Number(String(s.amount).replace(/[$,\s]/g, '')) || 0) : '—'}
                  </span>
                  <span className="text-[13.5px] font-semibold text-ink whitespace-nowrap">{s.rate ? `${s.rate}%` : '—'}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {onSplitChange
                        ? <select value={s.purpose || ''}
                            onChange={e => onSplitChange(s.id, { purpose: e.target.value })}
                            className={`${INP} ${!s.purpose ? NEED : ''}`}>
                            <option value="">Owner occupied or investment?</option>
                            <option value="OO">{PURPOSE_LABEL.OO}</option>
                            <option value="INV">{PURPOSE_LABEL.INV}</option>
                          </select>
                        : s.purpose
                        ? <span className={`text-[9.5px] font-bold tracking-[.05em] rounded px-2 py-[2px] ${
                            s.purpose === 'INV' ? 'bg-ink text-page' : 'bg-info text-page'}`}>
                            {PURPOSE_LABEL[s.purpose]}
                          </span>
                        : <a href={`/deals/${deal.id}?stage=LO`}
                            className="text-[11.5px] text-chase bg-chase-bg border border-chase-edge rounded px-2 py-[3px] hover:underline">
                            set on the LO ↗
                          </a>}
                  {onSplitChange
                        ? <>
                            <select value={s.repaymentType || ''}
                              onChange={e => setDetail(s.id, { repaymentType: e.target.value })}
                              className={`${INP} ${!s.repaymentType ? NEED : ''}`}>
                              <option value="">P&I or interest only?</option>
                              {SPLIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {typeContradictsProduct({ repaymentType: s.repaymentType }, recOption) && (
                              <div className="text-[10.5px] text-chase mt-0.5 max-w-[150px] leading-tight">
                                the product has {typesOffered(recOption).join(' and ')} ticked
                              </div>
                            )}
                          </>
                        : <span className="text-[13.5px] text-ink">{s.repaymentType || '—'}</span>}
                  {askFunds && (
                    <>                        {onSplitChange
                          ? <select value={s.funds || ''}
                              onChange={e => onSplitChange(s.id, { funds: e.target.value })}
                              className={`${INP} ${!s.funds ? NEED : ''}`}>
                              <option value="">What does this money do?</option>
                              {Object.entries(FUNDS_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          : s.funds
                          ? <span className="text-[12px] text-ink">{FUNDS_LABEL[s.funds]}</span>
                          : <a href={`/deals/${deal.id}?stage=LO`}
                              className="text-[11.5px] text-chase bg-chase-bg border border-chase-edge rounded px-2 py-[3px] hover:underline">
                              set on the LO ↗
                            </a>}</>
                  )}
                </div>
                <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mt-1.5">
                  <label className="inline-flex items-center gap-1.5"><span className={K}>Term</span><input aria-label='Term' defaultValue={s.termYears} key={`t${s.id}${s.termYears}`}
                        onBlur={e => { if (e.target.value !== s.termYears) setDetail(s.id, { termYears: e.target.value }) }}
                        placeholder="years" className={`${INP} w-[76px] ${!s.termYears ? NEED : ''}`} /></label>
                  <label className="inline-flex items-center gap-1.5"><span className={K}>IO years</span>{isInterestOnly(s.repaymentType)
                        ? <input aria-label='IO years' defaultValue={s.ioYears} key={`io${s.id}${s.ioYears}`}
                            onBlur={e => { if (e.target.value !== s.ioYears) setDetail(s.id, { ioYears: e.target.value }) }}
                            placeholder="years" className={`${INP} w-[76px] ${!s.ioYears ? NEED : ''}`} />
                        : <span className="text-[13.5px] text-faint">—</span>}</label>
                  <label className="inline-flex items-center gap-1.5 min-w-0"><span className={K}>Product type</span><input aria-label='Product type' defaultValue={s.productType} key={`p${s.id}${s.productType}`}
                        onBlur={e => { if (e.target.value !== s.productType) setDetail(s.id, { productType: e.target.value }) }}
                        placeholder="product" className={`${INP} w-[150px] ${!s.productType ? NEED : ''}`} /></label>
                </div>
              </div>
            ))}
          </div>
          {/* ONE PER DEAL, NOT ONE PER SPLIT. Fabio, 3 Sep 2026: "cashback dont
              do one per split you only get one cashback or not". It was a cell
              spanning every row; with no table it says so out loud. */}
          <div className="mt-2.5 pt-2.5 border-t border-line-soft flex items-center gap-2.5 flex-wrap">
            <span className={K}>Promotion / cashback</span>
            <CashbackInput value={row.cashback} onSave={v => setField('cashback', v)} />
          </div>

          {row.ooTotal > 0 && row.invTotal > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-card-line flex gap-6 flex-wrap text-[12.5px] text-muted">
              <span>Total lending <b className="text-[15px] text-ink">{money(row.totalLending)}</b></span>
              <span>Owner occupied <b className="text-[15px] text-ink">{money(row.ooTotal)}</b></span>
              <span>Investment <b className="text-[15px] text-ink">{money(row.invTotal)}</b></span>
              {row.unsetTotal > 0 && (
                <span className="text-chase">No purpose set <b className="text-[15px]">{money(row.unsetTotal)}</b></span>
              )}
            </div>
          )}
        </>
      )}

      {/* THE WARNING, NOT A LOCK. The tab opens as normal; it is the credit
          notes that wait. Fabio, 3 Sep 2026: "dont lock but warning sign saying
          we need that information to generate compliance". */}
      {needed.length > 0 && (
        <div className="mt-3 border border-chase-edge bg-chase-bg rounded-[10px] px-4 py-3">
          <h4 className="m-0 mb-1 text-[13.5px] text-ink font-semibold">
            ⚠ {needed.length === 1 ? 'One thing is' : `${needed.length} things are`} needed before the credit notes can be written
          </h4>
          <p className="m-0 text-[12.5px] text-chase">
            Left blank, the notes would either say nothing useful about that money or start guessing.
          </p>
          <ul className="mt-2 mb-0 pl-5 text-[12.5px] text-chase">
            {needed.slice(0, 6).map((n, i) => (
              <li key={i} className="mb-0.5">
                <b className="text-ink">{n.splitLabel}</b> — {n.what}
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
  if (!v) return <span className="text-[12.5px] text-faint italic">not recorded</span>
  return (
    <div className="text-[15px] font-bold text-ink leading-tight">
      {v}
      {src && <span className="block text-[10.5px] font-normal text-faint">{src}</span>}
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
