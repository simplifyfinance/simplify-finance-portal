'use client'
import { useMemo, useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { sentSummary, sentNote, sentAtWords, type Sent } from '@/lib/valuation-sent'
import { addSystemNote } from '@/components/DealFile'
import {
  buildValuation, splitAddress, loanPurposeOf, expectedLvr, isAnz, hasBankwest,
  valuationRef, PROPERTY_TYPES, ACCESS_CONTACTS, TENURES, ANCILLARY, BW_SPECIAL,
  type Answers, type Broker,
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
  // WHO THE ORDER IS PLACED UNDER. Valerio signs into CoreLogic as this
  // person, so it is the DEAL'S broker, not whoever pressed the button -
  // credit order these on somebody else's file all day. A deal with no broker
  // on it has to be asked, which is the only time this is a question.
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [brokerEmail, setBrokerEmail] = useState('')
  const [a, setA] = useState<Answers>({ securityCategory: 'Residential', accessType: 'Owner' })
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState('')
  // WHAT WENT, ONCE IT HAS GONE. Fabio, 17 Aug 2026: "than a new box shows
  // saying email sent valuation amount X LVR X Banks X for Broker X". Null
  // until the mail service has actually accepted it - see send().
  const [sent, setSent] = useState<{ box: Sent; when: string } | null>(null)
  // Set only where the send itself failed. The old copy-and-paste way is then
  // offered as the fallback, because nothing in this portal is ever blocked.
  const [failed, setFailed] = useState('')

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

  // EVERY BROKER AND THEIR EMAIL. user_profiles already holds both against the
  // key a deal carries, so there is nothing to set up and nothing to keep in
  // step - a broker who changes their email changes it in one place.
  useEffect(() => {
    if (!open || brokers.length) return
    createSupabaseBrowser().from('user_profiles')
      .select('full_name, email, broker_key').not('broker_key', 'is', null)
      .then(({ data }: any) => {
        const rows = (data || [])
          .map((r: any) => ({ name: String(r?.full_name || '').trim(),
                              email: String(r?.email || '').trim(),
                              key: String(r?.broker_key || '').trim() }))
          .filter((r: any) => r.email)
        setBrokers(rows)
        const mine = rows.find((r: any) =>
          r.key.toLowerCase() === String(deal?.assigned_broker || '').trim().toLowerCase())
        if (mine) setBrokerEmail(mine.email)
      })
  }, [open, brokers.length, deal?.assigned_broker])

  // The lender on the deal, where there is one, so the common case is a glance
  // rather than a choice. Ticked, because the box takes more than one now.
  useEffect(() => {
    if (!open || (a.lenders || []).length) return
    const onDeal = String(deal?.lenders?.name || deal?.lo_data?.recommendedLender || '').trim()
    if (onDeal) setA(x => ({ ...x, lenders: [onDeal] }))
  }, [open, deal, a.lenders])

  const ff = deal?.fact_find_data || {}
  const purpose = loanPurposeOf(security, deal?.bc_data, ff)
  const addr = splitAddress(security.address)
  const anz = isAnz(a.lenders)
  const bw = hasBankwest(a.lenders)
  const broker = brokers.find((b: any) => b.email === brokerEmail)
  const theirs = a.accessType === 'Owner' || a.accessType === 'Borrower'
  const client = (ff?.applicants || [])[0] || {}

  const req = useMemo(
    () => buildValuation(deal, security, a, { name: me?.name, email: me?.email }, broker),
    [deal, security, a, me, broker])

  const set = (k: keyof Answers) => (v: any) => setA(x => ({ ...x, [k]: v }))

  // SENT BY THE PORTAL, NOT PASTED BY A PERSON.
  //
  // 17 Aug 2026. This used to put the request on the clipboard and open a blank
  // mail window. Six steps - press, copy, open, paste, check, send - and three
  // of them can simply not happen with nothing here any the wiser. A valuation
  // everybody believes was ordered and was not is a week lost on a deal.
  //
  // The email is rebuilt on the server from the deal read fresh, so what goes
  // out is what this screen was showing. See app/api/send-valuation/route.ts.
  async function send() {
    setBusy(true); setTrouble(''); setFailed('')
    let out: any = {}
    try {
      const res = await fetch('/api/send-valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id, securityId: String(security.id),
          answers: a, brokerEmail,
        }),
      })
      out = await res.json().catch(() => ({}))
      if (!res.ok || !out?.ok) {
        setFailed(out?.error || `The mail service refused the send (${res.status}).`)
        setBusy(false)
        return
      }
    } catch {
      setFailed('The portal could not reach the mail service. Nothing has been sent.')
      setBusy(false)
      return
    }

    const box = sentSummary(deal, security, a, { name: me?.name, email: me?.email }, broker)
    setOrdered(out.when)
    onOrdered?.({ valuations_ordered: out.valuationsOrdered })
    setSent({ box, when: out.when })

    // ONE LINE, WITH THE NUMBERS IN IT, so somebody opening this deal in three
    // weeks can see what was ordered without going to anybody's mailbox.
    try {
      await addSystemNote(deal.id, sentNote(box), { id: me?.id || null, name: me?.name || '' })
    } catch { /* a missing line is smaller than a blocked order */ }

    // The email HAS gone. A date that would not save is a record nobody kept,
    // not an order that did not happen, and saying "not sent" here would send
    // somebody to order it twice.
    if (out.saveProblem) {
      setTrouble('It was sent, but the date could not be saved on the deal, so the button '
        + `will not show it. ${out.saveProblem}`)
    }
    setBusy(false)
  }

  // THE OLD WAY, KEPT AS THE FALLBACK. One button wide, for the day the mail
  // service is down. Nothing in this portal is ever blocked.
  async function copyAndOpen() {
    let copied = true
    try { await navigator.clipboard.writeText(req.body) } catch { copied = false }
    if (!copied) { setTrouble('The request could not be put on your clipboard.'); return }
    const cc = req.cc.length ? `cc=${encodeURIComponent(req.cc.join(','))}&` : ''
    window.location.href = `mailto:${encodeURIComponent(req.to)}?${cc}`
      + `subject=${encodeURIComponent(req.subject)}`
      + `&body=${encodeURIComponent('Paste the request here — it is on your clipboard.')}`
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
          <div className={`bg-card rounded-2xl w-[600px] max-w-full shadow-[0_24px_64px_rgba(0,0,0,0.32)] mt-8 ${
              sent ? 'border border-done-edge overflow-hidden' : ''}`}>
          {sent ? (
            /* THE BOX THAT COMES BACK.
             *
             * Fabio, 17 Aug 2026: "than a new box shows saying email sent
             * valuation amount X LVR X Banks X for Broker X".
             *
             * Built from the same inputs the email was built from - see
             * lib/valuation-sent.ts - so the screen cannot claim a figure the
             * email did not carry. The valuation amount says WHICH KIND it is,
             * because CoreLogic is told which and the two produce different
             * answers. Ordered for and Sent by are two lines because they are
             * two people. */
            <>
              <div className="bg-done-bg border-b border-done-edge px-5 py-4">
                <p className="m-0 mb-1 text-[16px] font-bold text-done">✓ Valuation ordered</p>
                <p className="m-0 text-[12.5px] text-body leading-relaxed">
                  Sent to Valerio{sentAtWords(sent.when) ? ` at ${sentAtWords(sent.when)}` : ''}.
                  It comes back by email.
                </p>
              </div>
              <div className="px-5 py-3">
                {sent.box.rows.map(r => (
                  <div key={r.label}
                    className="flex text-[13px] text-body py-[6px] border-b border-[var(--color-line-soft)] last:border-b-0">
                    <span className="text-muted w-[170px] shrink-0">{r.label}</span>
                    <span className="font-semibold text-ink min-w-0">{r.value}</span>
                  </div>
                ))}
                {req.byHand.length > 0 && (
                  <p className="mt-2.5 mb-0 text-[12px] text-chase leading-relaxed">
                    Valerio cannot order {req.byHand.join(', ')} himself — he will say so and
                    do the rest.
                  </p>
                )}
                {trouble && <p className="mt-2.5 mb-0 text-[11.5px] text-chase">{trouble}</p>}
              </div>
              <div className="border-t border-[var(--color-line-soft)] px-5 py-3 flex items-center gap-2.5">
                <span className="text-[11px] text-faint leading-relaxed">
                  On the file notes as <b className="text-body">{me?.name || 'you'}</b>.
                  {sent.box.copiedTo.length > 0 && <> Valerio replies to you, with{' '}
                    {sent.box.brokerName || 'the broker'} copied.</>}
                </span>
                <button onClick={() => { setSent(null); setOpen(false) }}
                  className="ml-auto px-3.5 py-2 text-[12.5px] font-semibold rounded-lg bg-ink text-page">
                  Done
                </button>
              </div>
            </>
          ) : (
          <>
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

              {/* ORDERED UNDER A BROKER, NOT UNDER WHOEVER PRESSED THE BUTTON.
                * Shown when the deal has one, asked when it does not. */}
              <Shout>Ordered under</Shout>
              {deal?.assigned_broker && broker ? (
                <div className="flex items-center gap-2 text-[12.5px] text-body">
                  <span className="font-semibold text-ink">{broker.name}</span>
                  <span className="text-faint">{broker.email}</span>
                  <button type="button" onClick={() => setBrokerEmail('')}
                    className="ml-auto text-[11px] text-brand-ink">Change</button>
                </div>
              ) : (
                <>
                  <select value={brokerEmail} onChange={e => setBrokerEmail(e.target.value)}
                    className="w-full border border-[var(--color-field-line)] rounded-lg px-2.5 py-2 text-[12.5px] bg-field">
                    <option value="">— choose the broker —</option>
                    {brokers.map((b: any) => (
                      <option key={b.email} value={b.email}>{b.name || b.email}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-faint">
                    Valerio signs into CoreLogic as this person, so the valuation lands in their account.
                  </p>
                </>
              )}

              {/* ONE PROPERTY, AS MANY LENDERS AS YOU LIKE, ONE EMAIL.
                * 5 Nov 2026 - Valerio places a separate order per lender off
                * the one request, so ticking three is three orders and one
                * set of answers. */}
              <Shout>Lenders — tick as many as you want</Shout>
              <div className="flex gap-1.5 flex-wrap">
                {lenders.map(l => {
                  const on = (a.lenders || []).includes(l)
                  return (
                    <button key={l} type="button"
                      onClick={() => set('lenders')(on
                        ? (a.lenders || []).filter(x => x !== l)
                        : [...(a.lenders || []), l])}
                      className={`text-[12px] rounded-full px-3 py-[5px] border transition ${on
                        ? 'bg-ink border-ink text-page font-semibold'
                        : 'bg-card border-line text-muted hover:bg-page'}`}>
                      {on ? '\u2713 ' : ''}{l}
                    </button>
                  )
                })}
              </div>
              {req.byHand.length > 0 && (
                <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
                  <b className="text-ink">{req.byHand.join(' and ')}</b> cannot be ordered by Valerio
                  yet — he will order the others and write back that this one needs a person.
                </p>
              )}

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

              {bw && (
                <div className="mt-4 rounded-xl border border-waiting-edge bg-waiting-bg px-3 py-3">
                  <p className="m-0 mb-2 text-[10.5px] font-bold tracking-[.05em] uppercase text-waiting">
                    Bankwest asks four more
                  </p>
                  <Shout>Is the property under 50 m²?</Shout>
                  <Pills all={['Yes', 'No']}
                    picked={a.bwUnder50 === undefined ? undefined : (a.bwUnder50 ? 'Yes' : 'No')}
                    pick={v => set('bwUnder50')(v === 'Yes')} />
                  {/* ONE OR THE OTHER, NEVER BOTH. It asks about off the plan
                    * on a purchase and about the current lender on a
                    * refinance. */}
                  {purpose === 'PURCHASE' ? (
                    <>
                      <Shout>Off the plan purchase?</Shout>
                      <Pills all={['Yes', 'No']}
                        picked={a.bwOffThePlan === undefined ? undefined : (a.bwOffThePlan ? 'Yes' : 'No')}
                        pick={v => set('bwOffThePlan')(v === 'Yes')} />
                    </>
                  ) : (
                    <>
                      <Shout>Is the current lender Bankwest or CBA?</Shout>
                      <Pills all={['Yes', 'No']}
                        picked={a.bwCurrentLenderBwCba === undefined ? undefined : (a.bwCurrentLenderBwCba ? 'Yes' : 'No')}
                        pick={v => set('bwCurrentLenderBwCba')(v === 'Yes')} />
                    </>
                  )}
                  <Shout>Anything special about the deal?</Shout>
                  {/* NOTHING TICKED IS "NONE OF THESE", and it goes out as
                    * NONE rather than blank - blank would read as unasked. */}
                  <div className="flex gap-1.5 flex-wrap">
                    {BW_SPECIAL.map(([label, key]) => {
                      const on = (a.bwSpecial || []).includes(key)
                      return (
                        <button key={key} type="button"
                          onClick={() => set('bwSpecial')(on
                            ? (a.bwSpecial || []).filter(x => x !== key)
                            : [...(a.bwSpecial || []), key])}
                          className={`text-[11.5px] rounded-full px-2.5 py-[4px] border transition ${on
                            ? 'bg-ink border-ink text-page font-semibold' : 'bg-card border-line text-muted'}`}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {(a.bwSpecial || []).length === 0 && (
                    <p className="mt-1.5 mb-0 text-[11px] text-muted">Nothing ticked means none of these.</p>
                  )}
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

              {/* NOT SENT, SAID OUT LOUD, with the old way still on the screen.
                * Nothing is recorded and no reference is issued, so pressing
                * Send again is safe - which the box says rather than leaving
                * somebody to wonder. */}
              {failed && (
                <div className="mt-3 border border-chase-edge bg-chase-bg rounded-xl px-3.5 py-3">
                  <p className="m-0 mb-1 text-[13px] font-bold text-chase">⚠ Not sent</p>
                  <p className="m-0 mb-2 text-[12.5px] text-body leading-relaxed">
                    Nothing has reached Valerio. Nothing is recorded against the deal and no
                    reference has been issued, so pressing Send again is safe.
                  </p>
                  <p className="m-0 mb-2.5 text-[12px] text-muted">Reported as: <i>{failed}</i></p>
                  <button onClick={copyAndOpen}
                    className="text-[12px] rounded-lg border border-line bg-card text-muted px-3 py-1.5">
                    Copy it and open my mail
                  </button>
                </div>
              )}
            </div>

            {/* WHO IT IS GOING FROM AND WHO IS COPIED, BEFORE IT GOES, so
              * nobody has to remember the spec. The cc list is worked out in
              * lib/order-a-valuation.ts, so this line and the email agree. */}
            <div className="border-t border-[var(--color-line-soft)] px-5 py-3 flex items-center gap-2.5">
              <span className="text-[11px] text-faint leading-relaxed">
                Goes to Valerio from <b className="text-body">{me?.email || 'your own address'}</b>
                {req.cc.length > 0 && <> · cc <b className="text-body">{broker?.name || req.cc[0]}</b></>}
                <br />Comes back as <b className="text-body">{ref}</b>
              </span>
              <button onClick={() => setOpen(false)}
                className="ml-auto px-3.5 py-2 text-[12.5px] rounded-lg border border-line bg-card text-muted">
                Cancel
              </button>
              {/* Cannot be pressed twice. Two valuations on one property is a
                * real cost, not a tidiness problem. */}
              <button onClick={send} disabled={busy}
                className="px-3.5 py-2 text-[12.5px] font-semibold rounded-lg bg-ink text-page disabled:opacity-50">
                {busy ? 'Sending…' : 'Send it'}
              </button>
            </div>
          </>
          )}
          </div>
        </div>
      )}
    </>
  )
}
