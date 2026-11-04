'use client'
import { useMemo, useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { addSystemNote } from '@/components/DealFile'
import {
  buildValuation, splitAddress, loanPurposeOf, expectedLvr, isAnz, valuationRef,
  PROPERTY_TYPES, ACCESS_CONTACTS, TENURES, ANCILLARY, COPY_TO, type Answers,
} from '@/lib/order-a-valuation'

// ORDER A VALUATION, ON THE SECURITY IT IS A VALUATION OF.
//
// 4 Nov 2026. Fabio: "a button in the BC stage that the credit team can press,
// a pop-up with information for them to input, and this generates an email to
// my valuations bot... just remember, we want this to be easy."
//
// EASY MEANS TAPS. Fabio again: "when I get you the list of questions, make
// them drop down boxes, tick boxes." Valerio asks fifteen questions and eleven
// of them are already on the deal, so this shows those and asks four - and all
// but the mobile are a single tap. The request itself is built in
// lib/order-a-valuation.ts; nothing is composed here.
//
// THE LENDER IS THE LIBRARY, NOT A LIST IN THE CODE. Fabio: "carry all the
// lenders from the library as an option." Ten names written in here would be
// wrong the first time somebody adds the eleventh.
//
// IT GOES FROM THE PERSON WHO PRESSED IT. Valerio replies to the sender, cc
// Fabio - so a server-sent email would send the answers to nobody. Same shape
// as components/RunServiceability.tsx, including the clipboard rule.

export default function OrderValuation({ deal, security, me, onOrdered }: {
  deal: any
  security: { id: string; address: string; use: string; value: string; limit: string }
  me?: any
  onOrdered?: (patch: any) => void
}) {
  const [open, setOpen] = useState(false)
  const [lenders, setLenders] = useState<string[]>([])
  const [a, setA] = useState<Answers>({ securityCategory: 'Residential', accessType: 'Owner' })
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState('')

  const ref = valuationRef(deal, security)
  // WHEN IT WAS LAST ASKED FOR, PER SECURITY. Seeded from the deal and kept
  // here as well, because the row does not re-read the deal after a write and
  // a button that still says "order a valuation" after you ordered one is a
  // button somebody presses twice.
  const [ordered, setOrdered] = useState<string>(
    (deal?.valuations_ordered || {})[String(security.id)] || '')

  // THE WHOLE LIBRARY, READ WHEN THE BOX OPENS.
  useEffect(() => {
    if (!open || lenders.length) return
    createSupabaseBrowser().from('lenders').select('name, active').order('name')
      .then(({ data }: any) => {
        setLenders((data || []).filter((l: any) => l?.active !== false)
          .map((l: any) => String(l?.name || '').trim()).filter(Boolean))
      })
  }, [open, lenders.length])

  // The lender on the deal, where there is one, so the common case is a glance
  // rather than a choice.
  useEffect(() => {
    if (!open || a.lender) return
    const onDeal = String(deal?.lenders?.name || deal?.lo_data?.recommendedLender || '').trim()
    if (onDeal) setA(x => ({ ...x, lender: onDeal }))
  }, [open, deal, a.lender])

  const ff = deal?.fact_find_data || {}
  const purpose = loanPurposeOf(security, deal?.bc_data, ff)
  const addr = splitAddress(security.address)
  const anz = isAnz(a.lender)
  const theirs = a.accessType === 'Owner' || a.accessType === 'Borrower'
  const client = (ff?.applicants || [])[0] || {}

  const req = useMemo(
    () => buildValuation(deal, security, anz ? a : { ...a, anzLvr: a.anzLvr || expectedLvr(security.limit, security.value) },
      { name: me?.name, email: me?.email }),
    [deal, security, a, me, anz])

  const set = (k: keyof Answers) => (v: any) => setA(x => ({ ...x, [k]: v }))

  async function order() {
    setBusy(true); setTrouble('')
    // FIRST, WHILE THE CLICK IS STILL LIVE. See lib/send-again.ts.
    let copied = true
    try { await navigator.clipboard.writeText(req.body) } catch { copied = false }
    if (!copied) {
      setTrouble('The request could not be put on your clipboard, so nothing was opened. Try again.')
      setBusy(false)
      return
    }
    const cc = String(me?.email || '').toLowerCase() === COPY_TO ? '' : `&cc=${encodeURIComponent(COPY_TO)}`
    window.location.href = `mailto:${encodeURIComponent(req.to)}${cc ? '?' + cc.slice(1) : ''}`
      + `${cc ? '&' : '?'}subject=${encodeURIComponent(req.subject)}`
      + `&body=${encodeURIComponent('Paste the request here — it is on your clipboard.')}`

    // WHEN IT WAS ASKED FOR, PER SECURITY. A deal with two houses has two
    // answers, and "valuation requested" with no date is not worth reading.
    const when = new Date().toISOString()
    const next = { ...(deal?.valuations_ordered || {}), [String(security.id)]: when }
    const problem = await checkedWrite(
      createSupabaseBrowser().from('deals').update({ valuations_ordered: next }).eq('id', deal.id),
      'The valuation request')
    // THE EMAIL HAS ALREADY OPENED. A failed write is a date nobody recorded,
    // not an order that did not happen, and saying "nothing was sent" here
    // would be a lie that sends somebody to order it twice.
    if (problem) {
      setTrouble('The email is open and on your clipboard, but the date could not be saved '
        + `on the deal, so this button will not show it. ${problem}`)
    } else {
      setOrdered(when)
      onOrdered?.({ valuations_ordered: next })
    }

    try {
      await addSystemNote(deal.id,
        `Valuation requested for ${security.address || 'a security'} — ${ref}. `
          + `${a.lender || 'Lender not named'}, ${purpose.toLowerCase().replace('_', ' ')}.`,
        { id: me?.id || null, name: me?.name || '' })
    } catch { /* a missing line is smaller than a blocked order */ }

    setBusy(false)
    if (!problem) setOpen(false)
  }

  const Pills = ({ all, picked, pick }: { all: readonly string[]; picked?: string; pick: (v: string) => void }) => (
    <div className="flex gap-1.5 flex-wrap">
      {all.map(x => (
        <button key={x} type="button" onClick={() => pick(x)}
          className={`text-[12px] rounded-full px-3 py-[5px] border transition ${picked === x
            ? 'bg-ink border-ink text-page font-semibold' : 'bg-card border-line text-muted hover:bg-page'}`}>
          {x}
        </button>
      ))}
    </div>
  )
  const Shout = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted mt-4 mb-1.5">{children}</p>
  )

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`shrink-0 text-[10.5px] font-semibold rounded-full px-2.5 py-[3px] border transition ${ordered
          ? 'bg-done-bg border-done-edge text-done'
          : 'bg-info-bg border-info-edge text-info hover:brightness-[.98]'}`}
        title={ordered ? 'Ask again — a price changes and a valuation gets ordered twice'
                       : 'Order a valuation for this property'}>
        {ordered
          ? `✓ valuation ${new Date(ordered).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} · ask again`
          : 'order a valuation'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/45 flex items-start justify-center p-6 overflow-y-auto">
          {/* NO CLICK-AWAY. A mobile number typed and lost to a stray click is
            * the same fault the extract review had. */}
          <div className="bg-card rounded-2xl w-[600px] max-w-full shadow-[0_24px_64px_rgba(0,0,0,0.32)] mt-8">
            <div className="px-5 pt-4">
              <h3 className="m-0 mb-1 text-[15.5px] font-bold text-ink">Order a valuation</h3>
              <p className="m-0 mb-3 text-[12px] text-muted leading-relaxed">
                {security.address || 'This property'}. Goes to Valerio from your own email; Fabio is copied.
              </p>
            </div>

            <div className="px-5 pb-4">
              <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted mb-1.5">
                From the deal <span className="font-semibold tracking-normal normal-case text-done text-[10.5px]">
                  — nothing retyped</span>
              </p>
              <div className="rounded-lg border border-done-edge bg-done-bg px-3 py-2.5">
                {([
                  ['Loan purpose', purpose.toLowerCase().replace('_', ' ')],
                  ['Property use', security.use || '—'],
                  ['Loan amount', security.limit || '—'],
                  [purpose === 'PURCHASE' ? 'Purchase price' : 'Estimated value', security.value || '—'],
                  ['Address', security.address || '—'],
                  ['Borrower', `${client.firstName || ''} ${client.lastName || ''}`.trim() || '—'],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex text-[12px] py-[2px]">
                    <span className="text-muted w-[132px] flex-none">{k}</span>
                    <span className="font-semibold text-ink">{v}</span>
                  </div>
                ))}
              </div>

              <Shout>Lender — every lender in your library</Shout>
              <select value={a.lender || ''} onChange={e => set('lender')(e.target.value)}
                className="w-full border border-[var(--color-field-line)] rounded-lg px-2.5 py-2 text-[12.5px] bg-field">
                <option value="">— choose —</option>
                {lenders.map(l => <option key={l} value={l}>{l}</option>)}
              </select>

              <Shout>Property type</Shout>
              <Pills all={PROPERTY_TYPES} picked={a.propertyType} pick={set('propertyType')} />

              <Shout>Security</Shout>
              <Pills all={['Residential', 'Commercial']} picked={a.securityCategory}
                pick={set('securityCategory')} />

              {anz && (
                <div className="mt-4 rounded-xl border border-info-edge bg-info-bg px-3 py-3">
                  <p className="m-0 mb-2 text-[10.5px] font-bold tracking-[.05em] uppercase text-info">
                    ANZ asks five more
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10.5px] text-muted mb-1">Expected LVR including LMI</label>
                      <input value={a.anzLvr ?? expectedLvr(security.limit, security.value)}
                        onChange={e => set('anzLvr')(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="w-full border border-[var(--color-field-line)] rounded-lg px-2.5 py-1.5 text-[12.5px] bg-card" />
                    </div>
                    <div>
                      <label className="block text-[10.5px] text-muted mb-1">Title</label>
                      <select value={a.anzTenure || ''} onChange={e => set('anzTenure')(e.target.value)}
                        className="w-full border border-[var(--color-field-line)] rounded-lg px-2.5 py-1.5 text-[12.5px] bg-card">
                        <option value="">— choose —</option>
                        {TENURES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <Shout>Does ANZ already hold this property?</Shout>
                  <Pills all={['Yes', 'No']} picked={a.anzHolds === undefined ? undefined : (a.anzHolds ? 'Yes' : 'No')}
                    pick={v => set('anzHolds')(v === 'Yes')} />
                  <Shout>On completion of a new build?</Shout>
                  <Pills all={['Yes', 'No']} picked={a.anzOnCompletion === undefined ? undefined : (a.anzOnCompletion ? 'Yes' : 'No')}
                    pick={v => set('anzOnCompletion')(v === 'Yes')} />
                  <Shout>Anything else on the block</Shout>
                  {/* NOTHING TICKED MEANS NONE, which is a real answer - so
                    * there is no fourth pill for somebody to have to press. */}
                  <div className="flex gap-1.5 flex-wrap">
                    {ANCILLARY.map(x => {
                      const on = (a.anzAncillary || []).includes(x)
                      return (
                        <button key={x} type="button"
                          onClick={() => set('anzAncillary')(on
                            ? (a.anzAncillary || []).filter(y => y !== x)
                            : [...(a.anzAncillary || []), x])}
                          className={`text-[12px] rounded-full px-3 py-[5px] border transition ${on
                            ? 'bg-ink border-ink text-page font-semibold' : 'bg-card border-line text-muted'}`}>
                          {x}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <Shout>Who lets the valuer in</Shout>
              <Pills all={ACCESS_CONTACTS} picked={a.accessType} pick={set('accessType')} />
              <div className="grid grid-cols-3 gap-2.5 mt-2.5">
                <div>
                  <label className="block text-[10.5px] text-muted mb-1">First name</label>
                  <input value={theirs ? (client.firstName || '') : (a.accessFirst || '')}
                    disabled={theirs} onChange={e => set('accessFirst')(e.target.value)}
                    className="w-full border border-[var(--color-field-line)] rounded-lg px-2.5 py-1.5 text-[12.5px] bg-field disabled:opacity-70" />
                </div>
                <div>
                  <label className="block text-[10.5px] text-muted mb-1">Last name</label>
                  <input value={theirs ? (client.lastName || '') : (a.accessLast || '')}
                    disabled={theirs} onChange={e => set('accessLast')(e.target.value)}
                    className="w-full border border-[var(--color-field-line)] rounded-lg px-2.5 py-1.5 text-[12.5px] bg-field disabled:opacity-70" />
                </div>
                <div>
                  <label className="block text-[10.5px] text-muted mb-1">Mobile</label>
                  <input value={a.accessMobile || ''} placeholder="0412 345 678"
                    onChange={e => set('accessMobile')(e.target.value)}
                    className="w-full border border-[var(--color-field-line)] rounded-lg px-2.5 py-1.5 text-[12.5px] bg-field" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[12.5px] text-body mt-3 cursor-pointer">
                <input type="checkbox" checked={!!a.inCompany}
                  onChange={e => set('inCompany')(e.target.checked)} />
                Borrowing in a company
              </label>
              {a.inCompany && (
                <input value={a.companyName || ''} placeholder="Company name"
                  onChange={e => set('companyName')(e.target.value)}
                  className="w-full mt-2 border border-[var(--color-field-line)] rounded-lg px-2.5 py-1.5 text-[12.5px] bg-field" />
              )}

              {req.missing.length > 0 && (
                <div className="mt-4 rounded-lg border border-chase-edge bg-chase-bg px-3 py-2.5">
                  <p className="m-0 mb-1 text-[11.5px] font-bold text-chase">
                    Valerio will write back asking for {req.missing.length === 1 ? 'this' : 'these'}
                  </p>
                  <ul className="m-0 pl-4">
                    {req.missing.map(x => (
                      <li key={x} className="text-[11.5px] text-body leading-relaxed">{x}</li>
                    ))}
                  </ul>
                  <p className="m-0 mt-1.5 text-[11px] text-muted">
                    He never guesses, so nothing is ordered until he has them.
                  </p>
                </div>
              )}

              {trouble && <p className="mt-2 text-[11.5px] text-chase">{trouble}</p>}
            </div>

            <div className="border-t border-[var(--color-line-soft)] px-5 py-3 flex items-center gap-2.5">
              <span className="text-[11px] text-faint">Comes back as <b className="text-body">{ref}</b></span>
              <button onClick={() => setOpen(false)}
                className="ml-auto px-3.5 py-2 text-[12.5px] rounded-lg border border-line bg-card text-muted">
                Cancel
              </button>
              <button onClick={order} disabled={busy}
                className="px-3.5 py-2 text-[12.5px] font-semibold rounded-lg bg-ink text-page disabled:opacity-50">
                {busy ? 'Opening…' : 'Order it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
