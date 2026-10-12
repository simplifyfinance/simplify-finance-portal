'use client'
import { useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { patchDealColumn } from '@/lib/patch-deal-column'
import { templateLabel } from '@/lib/templates'
import {
  splitsOf, dealRow, whatIsLeft, splitsNamed, needsFundsRole, purposeSummary,
  withSplitDetail, isInterestOnly, PURPOSE_LABEL, FUNDS_LABEL, defaultSecurityAddress,
} from '@/lib/deal-structure'
import { fundsToComplete, bcSplitsTotal } from '@/lib/funds-to-complete'
import { splitsDisagree } from '@/lib/deal-structure'
import { securitiesOf } from '@/lib/box-security'
import { securitiesOf as tickedSecurities, lvrOf as securityLvr, totalsOf } from '@/lib/securities'
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

export default function DealStructure({ deal, onUpdated, onSplitChange, onAddSplit, onRemoveSplit, structureIsBc }: {
  deal: any
  onUpdated?: (patch: any) => void
  // Supplied only by the Lending options tab, which owns lo_data and can write
  // to it safely from its own state. On Compliance these are absent and the two
  // LO-owned answers show a link back instead of a dropdown - the block is in
  // two places, but only one of them is allowed to change the LO's mind.
  onSplitChange?: (splitId: string, patch: { purpose?: string; funds?: string }) => void
  onAddSplit?: () => void
  // THERE WAS AN ADD AND NO TAKE AWAY. 13 Oct 2026, Fabio on the Veljovic deal:
  // "I dont have the ability to delete splits on LO?" - he had pressed add four
  // times and the list only ever grew.
  //
  // It takes the POSITION, not the id. A split that came from the BC has no id
  // of its own, and this list is built in the same order as the lending
  // options' own, so the position is the one thing both sides agree on.
  onRemoveSplit?: (idx: number) => void
  // THE BORROWING CAPACITY DECIDES THE STRUCTURE. THE LENDING OPTIONS PICK THE
  // PRODUCT. That is the whole rule and it has been broken on this panel the
  // entire time.
  //
  // 13 Oct 2026, Fabio, on a deal where every split was answered Interest only
  // on the BC and the lending options still showed an empty "P&I or interest
  // only?" dropdown beside each one: "the logic is ALWAYS THE SAME BC sets the
  // tone structure the LO is JUST where we select products DO YOU FINALLY
  // UNDERSTAND THIS".
  //
  // So on the lending options these are shown, not asked. A dropdown here is an
  // invitation to answer a question that already has an answer somewhere that
  // owns it, and two answers to one question is how they end up disagreeing.
  structureIsBc?: boolean
}) {
  const supabase = createSupabaseBrowser()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const splits = useMemo(() => splitsOf(deal), [deal])
  // Handlers alone used to mean "this tab may edit the structure". Now the tab
  // also has to be one that OWNS the structure, and the lending options is not.
  // 13 Oct 2026, the rest of the audit. This started as "the lending options
  // show the structure". Compliance was left alone that day because Fabio was
  // talking about the LO - but it could still edit the repayment type, the
  // term, the IO years and the product, which are the same four controls, and
  // the rule does not change with which tab you are standing on.
  //
  // So the BC owns the structure everywhere. The only place these are answered
  // is the tab that owns them.
  // Typed, not inferred: as a bare `false` TypeScript narrows it and then
  // complains about the branch it has proved unreachable. The branch is left in
  // place deliberately - it is the only record of what this panel used to offer,
  // and lib/structure-repayment.test.ts still reads it.
  const canEditStructure: boolean = false
  // Where to send somebody when the answer is missing. It said "set on the LO"
  // on every tab, including the LO itself.
  // Always the BC now. It said "set on the LO" on every tab including the LO.
  const setItOn = 'BC'
  // HOW MANY OF THOSE BELONG TO THE BORROWING CAPACITY.
  //
  // splitsOf builds its list as the BC's splits followed by anything the
  // lending options added beyond them, so everything from this index on is the
  // LO's own. Only those may be removed here: a BC split deleted on this tab
  // would be back on the next load, because the BC owns the structure and the
  // merge puts it straight back. A button that undoes itself is worse than no
  // button. It is removed on the BC, which is where it lives.
  const bcOwned: number = (deal?.bc_data?.splits || []).length
  // The product the deal structure is describing - option one until somebody
  // picks a recommendation, exactly as splitsOf itself does. Only ever used to
  // say that the ticks and the answer here disagree; it never changes either.
  const recOption = useMemo(() => optionOnTheDeal(deal?.lo_data || {}), [deal])
  const row = useMemo(() => dealRow(deal), [deal])
  const funds = useMemo(() => fundsToComplete(deal), [deal])
  // Two records, one loan. Null when they agree, which is almost always.
  // Two split lists, one deal. Null when they agree, which is almost always.
  const splitGap = useMemo(() => splitsDisagree(deal), [deal])
  const left = useMemo(() => whatIsLeft(deal), [deal])
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
        {/* THE SAME COUNT, AND IT WAS RED TOO. It counted empty fields, so the
            Veljovic deal wore a red "14 to complete" chip in its heading for
            two things nobody had got to yet. Jobs, and quiet. */}
        {left.jobs > 0 && (
          <span className="text-[11px] font-medium text-muted bg-page border border-card-line rounded-md px-2 py-[2px]">
            {left.jobs} to complete
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

        {/* ONE ANSWER, NOT TWO.
          *
          * 12 Oct 2026. This box is older than ticking securities on the BC. On
          * a deal that has them it sat beside three real, named properties
          * asking somebody to type a fourth answer - and whatever they typed
          * won in several places. docs/the-chain.md, rule 1: the fact find and
          * the borrowing capacity own the securities, and Compliance does not
          * get to hold a competing copy.
          *
          * So where the deal HAS securities it reads them, the same list box
          * nine names, in the same order. Where it has none - a pre-approval
          * with no property identified yet - nothing upstream exists to read,
          * so the box stays exactly as it was: editable, with its TBA fill.
          * That is the only case it was ever right for. */}
        {(() => {
          const secs = securitiesOf(deal).filter(x => String(x.address || '').trim())
          if (secs.length === 0) {
            return (
              <Field label="Security address" grow>
                <input defaultValue={row.securityAddress} key={row.securityAddress}
                  onBlur={e => { if (e.target.value !== row.securityAddress) setField('securityAddress', e.target.value) }}
                  placeholder={row.preApproval ? 'TBA' : 'Street, suburb, state'}
                  className={`${INP} w-full`} />
                {row.preApproval && row.securityAddress.startsWith('TBA') && (
                  <p className="text-[11px] text-info mt-1 mb-0">Filled from the BC suburb because this is a pre-approval</p>
                )}
              </Field>
            )
          }
          return (
            <Field label={secs.length === 1 ? 'Security' : `Securities (${secs.length})`} grow>
              <div className="flex flex-col gap-0.5">
                {secs.map((x, i) => (
                  <span key={i} className="text-[12.5px] text-ink">{x.address}</span>
                ))}
              </div>
              <p className="text-[11px] text-muted mt-1 mb-0">From the fact find, ticked on the BC</p>
            </Field>
          )
        })()}

        {/* ONE VALUE AND ONE LVR PER HOUSE, ON A DEAL WITH SEVERAL.
            *
            * 13 Oct 2026. Fabio: "in the complex sceario should be property
            * value and LVR in the deal strautre one per property and the data
            * just comes from BC anyway".
            *
            * It does. The value is the fact find's figure for that property and
            * the limit is what is approved against it, typed on the BC - the
            * same two numbers lib/securities.ts has always held. One combined
            * LVR across three houses is not a number a lender assesses or a
            * credit officer can act on; each house has its own.
            *
            * The total stays underneath, because that IS the figure on a
            * multi-security deal, and a reader should not have to add three
            * numbers in their head to find it. */}
        {(() => {
          const ticked = tickedSecurities(deal?.bc_data, deal?.fact_find_data)
          if (ticked.length < 2) {
            return (
              <Field label="Property value">
                <Value v={row.propertyValue > 0 ? money(row.propertyValue) : ''} src="from the BC" />
              </Field>
            )
          }
          const t = totalsOf(ticked)
          return (
            <Field label="Value and LVR, per property" grow>
              <div className="flex flex-col gap-1 mt-0.5">
                {ticked.map(x => {
                  // WHAT IS ACTUALLY BORROWED AGAINST THIS HOUSE.
                  //
                  // 13 Oct 2026. This read securityLimits - a figure typed on
                  // the BC and almost never filled in - so every LVR on the
                  // Veljovic deal printed a dash beside a real value. Fabio:
                  // "LVR is blank wtf".
                  //
                  // The answer was already on the deal. Every split carries the
                  // security it sits against, so the lending on a house is the
                  // sum of its splits. The typed limit stays as the fallback for
                  // a deal where somebody filled it in and there are no splits.
                  const against = splits
                    .filter(sp => String(sp.securityId || '') === String(x.id))
                    .reduce((t, sp) => t + (Number(String(sp.amount).replace(/[^0-9.]/g, '')) || 0), 0)
                  const val = Number(String(x.value).replace(/[^0-9.]/g, '')) || 0
                  const l = against > 0 && val > 0 ? (against / val) * 100 : securityLvr(x)
                  return (
                    <div key={x.id} className="flex items-baseline gap-2 flex-wrap text-[12.5px]">
                      <span className="text-muted min-w-0 truncate max-w-[260px]">{x.address}</span>
                      <span className="font-semibold text-ink ml-auto">
                        {Number(String(x.value).replace(/[^0-9.]/g, '')) > 0 ? money(Number(String(x.value).replace(/[^0-9.]/g, ''))) : 'no value on the fact find'}
                      </span>
                      <span className="font-semibold text-ink w-[62px] text-right">
                        {l === null ? '—' : `${Math.round(l * 10) / 10}%`}
                      </span>
                    </div>
                  )
                })}
                {/* NO "ALL 3 TOGETHER" LINE. Fabio asked for the per-property
                    figures and then, seeing it, asked twice for the total to go:
                    "the 'all together' line still there". A combined LVR across
                    three houses is not a number any lender assesses, and adding
                    three values up is not a fact about this deal that anybody
                    needs on this row. */}
                {!t.valuedAll && (
                  <p className="text-[11px] text-chase mt-0.5 mb-0">
                    One of these has no value on the fact find, so the total is lower than the real one.
                  </p>
                )}
              </div>
            </Field>
          )
        })()}

        {row.existingLoan > 0 && (
          <Field label="Existing loan"><Value v={money(row.existingLoan)} src="being refinanced" /></Field>
        )}

        {tickedSecurities(deal?.bc_data, deal?.fact_find_data).length < 2 && (
          <Field label="LVR">
            {row.lvr !== null
              ? <Value v={`${row.lvr}%`} src={`${money(row.totalLending)} lending`} />
              : <span className="text-[12.5px] font-semibold text-muted">not known</span>}
          </Field>
        )}

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

      {/* THE BLUE BANNER THAT USED TO SIT HERE IS GONE.
          *
          * It said: "This loan amount was entered on the lending options. Using
          * $1,000,000. The borrowing capacity says $2,720,000 - the figure
          * entered by hand wins, and it is what the client sees and what the
          * compliance wording uses."
          *
          * Which was true, and was the fault. A number typed on the lending
          * options overruled the borrowing capacity for good, and this banner
          * calmly explained that it had. Fabio, 13 Oct 2026: "why LO anc BC
          * amount dont match fucking hell".
          *
          * They cannot disagree any more. The loan is the sum of the BC's
          * splits - see loanAmount in lib/funds-to-complete.ts - so there is
          * nothing left for a banner to report. */}

      {/* TWO SPLIT LISTS, ONE DEAL. See splitsDisagree in lib/deal-structure.ts.
          *
          * Not corrected, on purpose. A list somebody built on the lending
          * options is theirs, and on a deal saved before 9 Oct 2026 there is
          * nothing in the record that tells a hand-built list from a stale
          * copy. Guessing would replace real work.
          *
          * Chase rather than info, because unlike the loan amount above this is
          * not a decision anybody made - it is two answers nobody reconciled,
          * and the documents are built from the lending options' one. */}
      {splitGap && (
        <div className="bg-chase-bg border border-chase-edge rounded-xl px-4 py-2.5 mb-3 text-[12px] text-chase leading-relaxed">
          <b>The two split lists do not match.</b>{' '}
          {splitGap.lines.join(', and ')}. The lending options follow the borrowing capacity now,
          so this only appears when a split exists on the lending options that the borrowing
          capacity has never heard of. Remove it below with the &times;, or add it on the
          borrowing capacity so the two agree.
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
            {/* ADDING ONE IS STRUCTURE. Every split this tab added on Veljovic
                existed because the BC's six were not reaching it. They reach it
                now, so the place to add a seventh is the BC. The × stays, to
                clear the ones already added. */}
            {onAddSplit && !structureIsBc && (
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
                  {onRemoveSplit && i >= bcOwned && (
                    <button onClick={() => onRemoveSplit(i)}
                      aria-label={`Remove split ${i + 1}`}
                      title="Remove this split. It was added here, so it is this tab's to remove."
                      className="text-[15px] leading-none text-faint hover:text-chase px-1.5 py-0.5 rounded
                                 hover:bg-chase-bg transition">
                      &times;
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {canEditStructure
                        ? <select value={s.purpose || ''}
                            onChange={e => onSplitChange?.(s.id, { purpose: e.target.value })}
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
                        : <a href={`/deals/${deal.id}?stage=${setItOn}`}
                            className="text-[11.5px] text-chase bg-chase-bg border border-chase-edge rounded px-2 py-[3px] hover:underline">
                            set on the {setItOn} ↗
                          </a>}
                  {canEditStructure
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
                    <>                        {canEditStructure
                          ? <select value={s.funds || ''}
                              onChange={e => onSplitChange?.(s.id, { funds: e.target.value })}
                              className={`${INP} ${!s.funds ? NEED : ''}`}>
                              <option value="">What does this money do?</option>
                              {Object.entries(FUNDS_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          : s.funds
                          ? <span className="text-[12px] text-ink">{FUNDS_LABEL[s.funds]}</span>
                          : <a href={`/deals/${deal.id}?stage=${setItOn}`}
                              className="text-[11.5px] text-chase bg-chase-bg border border-chase-edge rounded px-2 py-[3px] hover:underline">
                              set on the {setItOn} ↗
                            </a>}</>
                  )}
                </div>
                <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mt-1.5">
                  {/* TERM AND IO YEARS ARE THE BC's ANSWERS. The BC asks both,
                      per split - see Split.type and Split.ioYears in BCForm. On
                      the lending options they are printed, because this tab
                      does not decide how long the loan runs for.
                      PRODUCT TYPE IS NOT TYPED ANYWHERE. It is read off the
                      lending option marked as recommended, which is the one
                      thing on this row the LO genuinely owns. A box inviting
                      somebody to type it by hand was a third copy of an answer
                      that already has a home. */}
                  {/* TERM, IO YEARS AND PRODUCT - PRINTED, ON EVERY TAB.
                      The term and the interest only years are asked per split
                      on the BC. The product is read off the lending option
                      marked as recommended. None of the three is typed here any
                      more, on the lending options OR on compliance: each was a
                      second copy of an answer that already has a home, and a
                      second copy is only ever a way for two answers to differ. */}
                  <label className="inline-flex items-center gap-1.5">
                    <span className={K}>Term</span>
                    <span className="text-[13.5px] text-ink">{s.termYears || '—'}</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <span className={K}>IO years</span>
                    {isInterestOnly(s.repaymentType)
                      ? <span className="text-[13.5px] text-ink">{s.ioYears || '—'}</span>
                      : <span className="text-[13.5px] text-faint">—</span>}
                  </label>
                  <label className="inline-flex items-center gap-1.5 min-w-0">
                    <span className={K}>Product</span>
                    <span className="text-[13.5px] text-ink">
                      {s.productType || <span className="text-faint">from the lender option you tick</span>}
                    </span>
                  </label>
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

      {/* NOT A LOCK, AND NO LONGER A WARNING EITHER.
          *
          * The tab opens as normal; it is the credit notes that wait. Fabio,
          * 3 Sep 2026: "dont lock but warning sign saying we need that
          * information to generate compliance".
          *
          * 13 Oct 2026, it stopped being a warning sign. It was red, it counted
          * empty fields rather than jobs, it printed labels that repeat, and it
          * hid most of itself behind "and 8 more". On the Veljovic deal that
          * read "14 things are needed" when there were two things to do.
          *
          * Fabio: "I dont like warnigns for the sake of warnigns unless it is
          * needed meaning BC and LO are not mtching". A deal being written has
          * blanks in it. Red is spent on splitsDisagree above, and spending it
          * twice is how both stop being read. See whatIsLeft(). */}
      {left.jobs > 0 && (
        <div className="mt-3 border border-card-line bg-page rounded-[10px] px-4 py-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h4 className="m-0 text-[13px] text-ink font-semibold">
              {left.jobs === 1 ? 'One thing left' : `${left.jobs} things left`} before the credit notes
            </h4>
            <span className="text-[12px] text-muted">Nothing is wrong. The notes just wait for these.</span>
          </div>

          {/* THE CAUSE FIRST, and what ticking it actually does. One tick, a
              whole column of splits answered. */}
          {left.pickLender && (
            <div className="mt-2 bg-info-bg border border-info-edge rounded-lg px-3 py-2
                            text-[12.5px] text-info leading-relaxed">
              <b>Tick the lending option you are recommending.</b> The product on every split is read
              from it, so that one tick answers {left.ofSplits === 1 ? 'it' : `all ${left.ofSplits}`}.
            </div>
          )}

          {/* BY SPLIT NUMBER, which is what is printed on the rows above. All of
              them - a list that hides half of itself cannot be worked through. */}
          {left.lines.map((l, i) => (
            <div key={i} className="mt-2 text-[12.5px] text-body leading-relaxed">
              <b className="text-ink">{splitsNamed(l.splits)}</b> &mdash; {l.what}
            </div>
          ))}
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
