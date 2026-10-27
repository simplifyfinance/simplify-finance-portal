'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { copyHtmlAndPlain } from '@/lib/rich-text'
import { outstandingFromDeal } from '@/lib/documents-outstanding'
import { type DocRow } from '@/lib/document-progress'
import { SENT_WITH } from '@/lib/offer-accepted-email'
import { menuFor, menuToBrowse, lastSent, templateById, type MenuItem, type TemplateId } from '@/lib/milestone-emails'
import { useSender } from '@/app/(app)/templates/useSender'
import { SenderPanel } from '@/app/(app)/templates/TemplateFields'

// THE CLIENT EMAILS A DEAL CAN SEND.
//
// IN THE HEADER, BEHIND ONE WORD, AND OUTSIDE THE LOCK.
// one-inside-the-deal-v4.html: an envelope in the header opening "Send to the
// client". It was a full width row of buttons above the tabs - the widest
// thing on the page, saying nothing on most days.
//
// OUTSIDE THE LOCK, like the documents beside it. Telling a
// client their loan is approved is not a stage of the deal - it happens when the
// bank says so, whatever tab anybody is looking at, and a lodged deal is exactly
// when a formal approval goes out. The same mistake the PDFs made is not made
// twice; see components/DealDocuments.tsx.
//
// WHAT IS NOT READY IS STILL LISTED, greyed, with the reason on it. A button
// that has disappeared is a question somebody has to ask; a greyed one with
// "not formally approved yet" on it is an answer.
//
// THE BROWSER NEVER POSTS THE EMAIL. It posts the deal, the ticks, the free text
// and the bank's letter. The server loads the deal again and rebuilds the email
// from the same function this preview called - so a stale tab, a half-saved
// figure, or somebody with a developer console cannot change a dollar of what
// goes out. See app/api/send-milestone-email/route.ts.

type Block = { key: string; label: string; on: boolean; by: string; why: string }

type Preview = {
  subject: string
  html: string
  // Whether the portal's own mail provider will carry the SalesTrekker copy.
  filesItself?: boolean
  // Where to file it by hand when it will not. See lib/files-itself-in-salestrekker.ts.
  filingAddress?: string
  blocks: Block[]
  problems: string[]
  to: string[]
  cc: string[]
  copyDropped: string[]
  testDeal: boolean
  redirected: boolean
  state: string | null
  // OFF THE TEMPLATE RECORD, NOT GUESSED HERE. The screen used to assume every
  // one of these carries a bank letter and is signed by whoever is logged in.
  // Both are properties of the template, and both now arrive with the preview -
  // see lib/milestone-emails.ts and the route that reads it.
  letterRequired: boolean
  picksSender: boolean
  // Empty unless the chosen broker has no login linked, and so no email or
  // mobile for the signature. Said on screen rather than discovered in a sent
  // email.
  senderNote: string
  senderName: string
}

export default function MilestoneEmails({ deal, onUpdated }: {
  deal: any
  me?: any
  onUpdated?: (patch: any) => void
}) {
  const [open, setOpen] = useState<TemplateId | null>(null)
  const [listOpen, setListOpen] = useState(false)

  // ARRIVING FROM SOMEWHERE ELSE WITH ONE ALREADY IN MIND.
  //
  // 21 Oct 2026. The offer accepted step ends with "write the offer accepted
  // email", and the honest way to do that is to open THIS menu on THAT
  // template rather than to build a second copy of the email over there.
  //
  // Read once, from the address bar, and only for a template that exists. A
  // link somebody edited by hand opens the menu and nothing else.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const want = new URLSearchParams(window.location.search).get('email')
    if (!want || !templateById(want as TemplateId)) return
    setOpen(want as TemplateId)
    // Taken out of the address so a reload does not reopen it, and so the back
    // button goes back to the deal rather than to the same email again.
    const url = new URL(window.location.href)
    url.searchParams.delete('email')
    window.history.replaceState({}, '', url.toString())
  }, [])
  const box = useRef<HTMLDivElement | null>(null)
  // THE BROWSABLE LIST, NOT THE WHOLE ONE. The offer accepted email is sent
  // from the step that asks for its figures and nowhere else - see
  // SENT_FROM_ITS_OWN_STEP in lib/milestone-emails.ts. Opening it directly,
  // which is what that step's link does, still works: this filters the menu,
  // not the screen.
  const menu = menuToBrowse(deal)

  // The menu shuts on a click anywhere else and on Escape. A menu you cannot
  // get out of without picking something is worse than no menu.
  useEffect(() => {
    if (!listOpen) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setListOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setListOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [listOpen])

  return (
    <div ref={box} className="relative">
      <button onClick={() => setListOpen(o => !o)} aria-expanded={listOpen} aria-haspopup="menu"
        className="text-xs font-semibold text-page bg-ink border border-ink rounded-[10px] px-3.5 py-2
          hover:opacity-90 transition inline-flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" />
        </svg>
        <span className="whitespace-nowrap">Client emails</span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={listOpen ? 'M12 10L8 6l-4 4' : 'M4 6l4 4 4-4'} />
        </svg>
      </button>

      {listOpen && (
        <div role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[340px] max-w-[420px]
            bg-card border border-card-line rounded-xl shadow-lg p-1.5">
          <div className="text-[9px] font-bold tracking-[.07em] uppercase text-faint px-2.5 py-1.5">
            Send to the client
          </div>
          {menu.map(item => (
            <MenuButton key={item.id} item={item}
              onOpen={() => { setListOpen(false); setOpen(item.id) }} />
          ))}
        </div>
      )}

      {open && (
        <SendScreen deal={deal} templateId={open} onClose={() => setOpen(null)}
          onSent={(patch) => { onUpdated?.(patch); setOpen(null) }} />
      )}
    </div>
  )
}

function MenuButton({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  // Not yet is a statement, not a button. It says what the deal is waiting for.
  if (item.state === 'not_yet') {
    return (
      <span className="block w-full px-2.5 py-2 text-[12px] text-faint" title={item.note}>
        {item.name} <span className="text-[11px]">— {item.note}</span>
      </span>
    )
  }
  const ready = item.state === 'ready'
  return (
    <button onClick={onOpen}
      className={`w-full text-left rounded-lg px-2.5 py-2 text-[12px] transition ${ready
        ? 'font-semibold text-ink bg-info-bg hover:opacity-90'
        : 'font-medium text-muted hover:bg-page hover:text-ink'}`}>
      {item.name}
      <span className={`ml-1.5 text-[11px] font-normal ${ready ? 'text-white/60' : 'text-faint'}`}>
        {item.note}
      </span>
    </button>
  )
}

// --- the send screen -------------------------------------------------------

// EXPORTED, so the Templates page opens THIS screen rather than growing its own.
//
// Fabio asked for the milestone emails on the Templates page as well as on the
// deal, and the tempting shortcut is a second screen over there. It would drift:
// the one on the deal would get the next fix and the other would keep the bug,
// which is the mistake this codebase has paid for more than once. One screen,
// two doors into it.
export function SendScreen({ deal, templateId, onClose, onSent }: {
  deal: any
  templateId: TemplateId
  onClose: () => void
  onSent: (patch: any) => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [extra, setExtra] = useState('')
  const [expiry, setExpiry] = useState('')
  const [insuranceAmount, setInsuranceAmount] = useState('')
  // THE OFFER ACCEPTED EMAIL'S OWN FOUR CHOICES. Everything else on this
  // screen comes off the deal; these are the things only a person knows.
  const [valuation, setValuation] = useState<'desktop' | 'full' | 'none'>('desktop')
  // TICKS, NOT A SENTENCE. See SENT_WITH in lib/offer-accepted-email.ts and
  // the rule in lib/emails-survive-the-lock.test.ts: a browser must not be
  // able to put words into a client email.
  const [sentWith, setSentWith] = useState<Record<string, boolean>>({ contract: true })
  const [businessDays, setBusinessDays] = useState('2')
  const [fixedTerm, setFixedTerm] = useState('2')
  // Which of the deal's outstanding documents to chase in THIS email. Keyed by
  // the document's own key, so the list and the email cannot drift apart.
  const [chasing, setChasing] = useState<Record<string, boolean>>({})
  const isOfferAccepted = templateId === 'offer_accepted'
  // Read off the deal, never retyped. groupLabel is whose it is - "Margot" -
  // and detail is why we want it.
  const outstanding: DocRow[] = useMemo(
    () => isOfferAccepted ? outstandingFromDeal(deal) : [], [deal, isOfferAccepted])
  // KEYS ONLY, NEVER THE WORDS. The route reads the same outstanding list off
  // the deal and takes the wording from there - see the rule in
  // lib/emails-survive-the-lock.test.ts.
  const docKeys = useMemo(
    () => outstanding.filter((d: DocRow) => chasing[d.key]).map((d: DocRow) => d.key),
    [outstanding, chasing])
  const sentWithKeys = useMemo(
    () => SENT_WITH.filter(x => sentWith[x.key]).map(x => x.key), [sentWith])
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  // Set once the client's copy has gone, so the footer can offer the
  // filing step. 27 Oct 2026.
  const [sent, setSent] = useState(false)
  const [filed, setFiled] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // HOW MUCH OF THE 600px EMAIL FITS. Measured rather than assumed, so the
  // preview shrinks on a laptop and sits at 100% on a wide screen - see the
  // note on the preview column below.
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => setScale(Math.min(1, (frame.clientWidth || 600) / 600))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [])

  // WHO IT GOES OUT AS. The same hook and the same panel the Templates page
  // forms use, so there is one Sending as box in the portal rather than two
  // that drift. It loads on every template rather than only the ones that show
  // it, because a hook cannot be called conditionally - two small selects, and
  // the alternative is lifting its state out through callbacks and a loop.
  // See app/(app)/templates/useSender.ts.
  const sender = useSender('sf_milestone_sender_v1')
  const picksSender = Boolean(preview?.picksSender)
  const brokerKey = picksSender ? sender.brokerKey : ''
  const brandId = picksSender ? sender.brandId : ''
  const calendly = picksSender ? sender.calendlyUrl : ''

  const already = lastSent(deal, templateId)
  const isExtension = templateId === 'preapproval_extension'

  // WHETHER A LETTER IS WANTED AT ALL. Off the template record, by way of the
  // preview - true until the preview lands, so the screen can never flash a
  // Send button that is about to be refused by the server.
  const wantsLetter = preview ? preview.letterRequired !== false : true

  const load = useCallback(async () => {
    setErr('')
    const qs = new URLSearchParams({
      dealId: deal.id, template: templateId,
      overrides: JSON.stringify(overrides), extra, expiry, insuranceAmount,
      valuation, businessDays, fixedTerm,
      sentWith: JSON.stringify(sentWithKeys),
      documents: JSON.stringify(docKeys),
      // Ignored by the route for a template that does not pick its sender.
      brokerKey, brandId, calendly,
    })
    try {
      const res = await fetch(`/api/send-milestone-email?${qs.toString()}`)
      const json = await res.json()
      if (!res.ok) { setErr(json?.error || 'The preview could not be built.'); return }
      setPreview(json)
    } catch (e: any) {
      setErr(`The preview could not be built — ${e?.message || 'network error'}.`)
    }
  }, [deal.id, templateId, overrides, extra, expiry, insuranceAmount, brokerKey, brandId, calendly,
      valuation, sentWithKeys, businessDays, fixedTerm, docKeys])

  // Redrawn as you tick. Typing is debounced so the free text box does not
  // rebuild the email on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { load() }, 250)
    return () => clearTimeout(t)
  }, [load])

  // ONE PASTE, AND THE CARD HAS IT.
  //
  // The same two steps the BC and the lending options take: put the email on
  // the clipboard, then hand the browser a mailto. Outlook opens already
  // addressed with the subject filled in, and the person pastes.
  //
  // The clipboard write happens FIRST. Handing the browser a mailto: can cut
  // short whatever is still in flight - lib/the-lo-marks-itself-sent.test.ts
  // exists because of exactly that, on this same pattern.
  async function fileItByHand() {
    const to = String(preview?.filingAddress || '')
    if (!to) return
    try { await copyHtmlAndPlain(preview?.html || '') } catch { /* the mailto still opens */ }
    setFiled(true)
    const subject = `${preview?.subject || ''} — ${deal.deal_name || ''}`.trim()
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`
  }

  async function send() {
    // Only the three that say "please find attached" - see the template record.
    if (wantsLetter && !file) { setErr('Attach the lender’s letter first.'); return }
    setBusy(true); setErr(''); setDone('')
    try {
      const body = new FormData()
      body.set('dealId', deal.id)
      body.set('template', templateId)
      body.set('overrides', JSON.stringify(overrides))
      body.set('extra', extra)
      body.set('expiry', expiry)
      body.set('insuranceAmount', insuranceAmount)
      body.set('valuation', valuation)
      body.set('sentWith', JSON.stringify(sentWithKeys))
      body.set('businessDays', businessDays)
      body.set('fixedTerm', fixedTerm)
      body.set('documents', JSON.stringify(docKeys))
      body.set('brokerKey', brokerKey)
      body.set('brandId', brandId)
      body.set('calendly', calendly)
      if (file) body.append('file', file)
      const res = await fetch('/api/send-milestone-email', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) { setErr(json?.error || 'The send was refused.'); return }
      // The deal now has one more entry in emails_sent. The page is told rather
      // than reloaded, so the button underneath says "sent" immediately.
      onSent({
        emails_sent: [...(Array.isArray(deal.emails_sent) ? deal.emails_sent : []), {
          template: templateId, at: new Date().toISOString(), by: 'you',
          to: preview?.to || [], cc: json.cc || [], attached: Boolean(file),
        }],
      })
      setSent(true)
      setDone(json.warning || '')
    } catch (e: any) {
      setErr(`The send failed — ${e?.message || 'network error'}.`)
    } finally {
      setBusy(false)
    }
  }

  const blocks = preview?.blocks || []
  const isOn = (b: Block) => (b.key in overrides ? overrides[b.key] : b.on)

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-4 overflow-auto"
         onClick={onClose}>
      <div className="bg-card rounded-xl border border-[#E3E6E8] shadow-lg w-full max-w-[1180px] mt-6"
           onClick={e => e.stopPropagation()}>

        <div className="border-b border-[#EEF0F2] bg-[#FAFAF8] px-5 py-3 flex items-baseline gap-2 flex-wrap rounded-t-xl">
          <b className="text-[14px]">{titleOf(templateId)}</b>
          <span className="text-[11.5px] text-faint">{deal.deal_name || ''}</span>
          {already && (
            <span className="text-[11.5px] text-chase ml-auto">
              Already sent {new Date(already.at).toLocaleDateString('en-AU')}{already.by ? ` by ${already.by}` : ''} — this would be another one.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-stretch">
          {/* --- what goes in ------------------------------------------- */}
          <div className="flex-1 min-w-[330px] basis-[400px] p-4 border-r border-[#F2F4F5]">
            <Shout>Going to</Shout>
            <div className="border border-[#E3E6E8] rounded-lg px-2.5 py-2 text-[12.5px] flex flex-wrap gap-1.5 items-center">
              {(preview?.to || []).map(a => (
                <span key={a} className="bg-[#F2F4F5] rounded px-1.5 py-0.5 text-[11.5px] text-[#3F4650]">{a}</span>
              ))}
              {!preview?.to?.length && <span className="text-[11.5px] text-faint">nobody on file</span>}
            </div>
            {!!preview?.cc?.length && (
              <p className="mt-1.5 text-[11px] text-faint">Copied: {preview.cc.join(', ')}</p>
            )}
            {preview?.redirected && (
              <p className="mt-1.5 text-[11px] text-chase">
                This is a test deal, so it comes to you instead of the clients
                {preview.copyDropped.length ? `, and ${preview.copyDropped.join(', ')} are left off` : ''}.
              </p>
            )}

            {/* SENDING AS, FOR THE TEMPLATES THAT ARE SENT ON SOMEBODY'S BEHALF.
                The brand control is always drawn, even for a broker with one
                brand - a control that is simply absent says nothing about why. */}
            {picksSender && (
              <div className="mt-5">
                <SenderPanel {...sender} />
                {!!preview?.senderNote && (
                  <p className="mt-1.5 text-[11px] text-chase leading-snug">{preview.senderNote}</p>
                )}
              </div>
            )}

            {/* THE LETTER, ONLY WHERE ONE IS PROMISED.
                *
                * Drawn always and required always, which is why the final
                * check-in could not be sent at all: Send was gated on a file
                * for an email that attaches nothing. The flag is on the
                * template record and the API hands it over - see
                * lib/milestone-emails.ts. */}
            {wantsLetter ? (
              <>
                <Shout className="mt-5">The bank&rsquo;s letter</Shout>
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)} />
                <button onClick={() => fileRef.current?.click()}
                  className={file
                    ? 'w-full text-left border border-done-edge bg-done-bg text-done rounded-lg px-3 py-2.5 text-[12px]'
                    : 'w-full border border-dashed border-[#D8DDE2] text-faint rounded-lg px-3 py-3 text-[12px]'}>
                  {file ? `${file.name} — ${Math.round(file.size / 1024)} KB` : 'Attach the approval letter (required)'}
                </button>
              </>
            ) : null}

            {isExtension && (
              <>
                <Shout className="mt-5">The new expiry the lender granted</Shout>
                <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
                  className="border border-[#E3E6E8] rounded-lg px-2.5 py-1.5 text-[12.5px]" />
              </>
            )}

            {isOfferAccepted && (
              <>
                {/* ONE OF THREE, NOT TWO PARAGRAPHS AND A NOTE TO DELETE ONE.
                    Fabio's blank template carried both valuation paragraphs
                    wrapped in asterisks. */}
                <Shout className="mt-5">The valuation</Shout>
                <div className="flex gap-1.5 flex-wrap">
                  {([['desktop', 'Desktop — back at price'],
                     ['full', 'Full — awaiting inspection'],
                     ['none', 'Not ordered yet']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setValuation(k)}
                      className={`text-[11.5px] rounded-full px-3 py-[5px] border transition ${
                        valuation === k ? 'bg-ink border-ink text-page font-semibold'
                                        : 'bg-card border-line text-muted hover:bg-page'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <Shout className="mt-5">What went with it</Shout>
                <div className="flex gap-1.5 flex-wrap">
                  {SENT_WITH.map(x => (
                    <button key={x.key}
                      onClick={() => setSentWith(v => ({ ...v, [x.key]: !v[x.key] }))}
                      className={`text-[11.5px] rounded-full px-3 py-[5px] border transition ${
                        sentWith[x.key] ? 'bg-ink border-ink text-page font-semibold'
                                        : 'bg-card border-line text-muted hover:bg-page'}`}>
                      {x.words}
                    </button>
                  ))}
                </div>

                <Shout className="mt-5">We should hear back in</Shout>
                <div className="flex gap-2 items-center">
                  <input value={businessDays} onChange={e => setBusinessDays(e.target.value)}
                    placeholder="2"
                    className="w-20 border border-[#E3E6E8] rounded-lg px-2.5 py-1.5 text-[12.5px]" />
                  <span className="text-[11.5px] text-faint">
                    business days. Blank leaves the sentence out.
                  </span>
                </div>

                {/* THE DEAL'S OWN OUTSTANDING DOCUMENTS, not a list somebody
                    retypes. Ticking one here only decides whether it is named
                    in this email. */}
                <Shout className="mt-5">What to chase in this email</Shout>
                {outstanding.length === 0 ? (
                  <p className="text-[11.5px] text-faint">
                    Nothing is outstanding on this deal, so the email asks for nothing.
                  </p>
                ) : outstanding.map((d: DocRow) => (
                  <div key={d.key} className="flex gap-2.5 items-start py-1.5 border-b border-[#F6F7F8] last:border-b-0">
                    <button onClick={() => setChasing(c => ({ ...c, [d.key]: !c[d.key] }))}
                      aria-label={`${chasing[d.key] ? 'Do not ask' : 'Ask'} for ${d.label}`}
                      className={`shrink-0 w-4 h-4 mt-0.5 rounded border-[1.5px] flex items-center justify-center text-[10px] font-bold ${
                        chasing[d.key] ? 'bg-[#0F7B4F] border-[#0F7B4F] text-white' : 'bg-card border-[#CBD2D8] text-transparent'}`}>
                      &#10003;
                    </button>
                    <div>
                      <div className="text-[12.5px] leading-[1.45]">{d.label}</div>
                      {(d.groupLabel || d.detail) && (
                        <div className="text-[10.5px] mt-0.5 leading-[1.45] text-faint">
                          {[d.groupLabel, d.detail].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* A heading over nothing is a screen with a piece missing. The
                final check-in has no blocks, so it has no heading. */}
            {blocks.length > 0 && <Shout className="mt-5">What goes in</Shout>}
            {blocks.map(b => (
              <div key={b.key} className="flex gap-2.5 items-start py-2 border-b border-[#F6F7F8] last:border-b-0">
                <button onClick={() => setOverrides(o => ({ ...o, [b.key]: !isOn(b) }))}
                  aria-label={`${isOn(b) ? 'Turn off' : 'Turn on'} ${b.label}`}
                  className={`shrink-0 w-4 h-4 mt-0.5 rounded border-[1.5px] flex items-center justify-center text-[10px] font-bold ${
                    isOn(b) ? 'bg-[#0F7B4F] border-[#0F7B4F] text-white' : 'bg-card border-[#CBD2D8] text-transparent'}`}>
                  &#10003;
                </button>
                <div>
                  <div className="text-[12.5px] leading-[1.45]">{b.label}</div>
                  <div className={`text-[10.5px] mt-0.5 leading-[1.45] ${
                    b.why.startsWith('Not recorded') ? 'text-chase'
                      : isOn(b) ? 'text-done' : 'text-faint'}`}>{b.why}</div>
                </div>
              </div>
            ))}

            {/* HOW MUCH, OFF THIS DEAL'S APPROVAL LETTER. Typed here and never
                remembered, because it is a different figure every time. WHO has
                to be named on the policy is the opposite - remembered per
                lender, and without it the block above is off entirely. */}
            {blocks.some(b => b.key === 'insurance_interested_party' && isOn(b)) && (
              <>
                <Shout className="mt-5">Insure for at least</Shout>
                <input value={insuranceAmount} onChange={e => setInsuranceAmount(e.target.value)}
                  placeholder="Leave blank and the email names no figure"
                  className="w-full border border-[#E3E6E8] rounded-lg px-2.5 py-1.5 text-[12.5px]" />
                <p className="mt-1 text-[11px] text-faint">
                  Off the lender&rsquo;s own approval letter. Never remembered.
                </p>
              </>
            )}

            {isOfferAccepted && blocks.some(b => b.key === 'fixed_rate' && isOn(b)) && (
              <>
                <Shout className="mt-5">The fixed rate term to offer</Shout>
                <div className="flex gap-2 items-center">
                  <input value={fixedTerm} onChange={e => setFixedTerm(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="2"
                    className="w-20 border border-[#E3E6E8] rounded-lg px-2.5 py-1.5 text-[12.5px]" />
                  <span className="text-[11.5px] text-faint">years</span>
                </div>
              </>
            )}

            <Shout className="mt-5">Anything else</Shout>
            <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={2}
              placeholder="Added to this email only. Never remembered."
              className="w-full border border-[#E3E6E8] rounded-lg px-2.5 py-2 text-[12.5px]" />
          </div>

          {/* --- what they will get -------------------------------------
              *
              * THE WHOLE EMAIL, NOT THE LEFT-HAND 380px OF IT.
              *
              * 9 Oct 2026. These emails are 600px wide - every one of them, by
              * design, because that is the width mail clients handle. This
              * column was 380px, so the preview was a 600px email with its
              * right-hand third cut off and nobody could check what they were
              * about to send. Fabio, in a deal: "the screen on the left doesnt
              * sjow the full email".
              *
              * SCALED TO FIT, NEVER CLIPPED - the same answer the Templates
              * page reached: measure the column, shrink the email into it, and
              * say what percentage is on screen so the preview is not mistaken
              * for the real size. See app/(app)/templates/SimpleTemplateForm.tsx.
              *
              * STILL A SANDBOXED IFRAME. The email carries whatever was typed
              * into "anything else"; it does not go into this page's own DOM. */}
          <div className="flex-1 min-w-[320px] basis-[620px] p-4 bg-panel">
            <Shout>What they will get</Shout>
            <p className="text-[12px] text-ink font-semibold mb-2">{preview?.subject || ' '}</p>
            <div ref={frameRef} className="border border-[#EEF0F2] rounded-lg bg-card overflow-hidden">
              <div style={{ height: 1100 * scale }}>
                <iframe title="The email" sandbox="" srcDoc={preview?.html || ''}
                  style={{ width: 600, height: 1100, border: 0,
                           transform: `scale(${scale})`, transformOrigin: 'top left' }} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-faint">
              {scale < 0.995 ? `Shown at ${Math.round(scale * 100)}% to fit. The client receives it full size. ` : ''}
              Every figure comes off the deal. Nothing on this screen can be typed over a number.
            </p>
          </div>
        </div>

        {/* --- what is worth knowing before pressing it ----------------- */}
        {!!preview?.problems?.length && (
          <div className="px-5 pb-1">
            <ul className="text-[12px] text-chase list-disc pl-4 space-y-1">
              {preview.problems.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
        {err && (
          <div className="px-5 pt-2">
            <p className="border border-chase-edge bg-chase-bg rounded-lg px-3 py-2 text-[12.5px] text-chase">{err}</p>
          </div>
        )}
        {done && (
          <div className="px-5 pt-2">
            <p className="border border-chase-edge bg-chase-bg rounded-lg px-3 py-2 text-[12.5px] text-chase">{done}</p>
          </div>
        )}

        {/* FILING IT BY HAND, WHEN OUR MAIL PROVIDER WILL NOT.
            27 Oct 2026. Fabio: "copy the html and our outlook opnes with BCC
            inthere so we can paste and send". It is exactly what the BC and the
            lending options have always done, and it works because Outlook
            accepts the 74-character SalesTrekker address that Resend refuses.
            The client's copy has already gone from the portal with its PDF on
            it - this is the filing copy only, which is why the address goes in
            To rather than Bcc. There is nobody left to hide it from. */}
        {sent && !!preview?.filingAddress && (
          <div className="px-5 pt-2">
            <div className="border border-info-edge bg-info-bg rounded-lg px-3.5 py-3 text-[12.5px] text-body leading-relaxed">
              {filed
                ? <span><b className="text-ink">Outlook is open with it.</b> Paste the email in and send,
                    and the card has it. Nothing else to fill in.</span>
                : <span><b className="text-ink">It has not filed in SalesTrekker yet.</b> Press the button
                    below — the email is copied and Outlook opens, already addressed. Paste, and send.</span>}
            </div>
          </div>
        )}

        <div className="border-t border-[#EEF0F2] bg-[#FAFAF8] px-5 py-3 flex gap-2 items-center flex-wrap rounded-b-xl">
          <button onClick={send} disabled={busy || sent || (wantsLetter && !file) || !preview?.to?.length}
            className="bg-ink text-page rounded-lg px-4 py-2 text-[12.5px] font-semibold disabled:opacity-40">
            {busy ? 'Sending…' : sent ? '\u2713 Sent' : 'Send'}
          </button>
          {sent && !!preview?.filingAddress && (
            <button onClick={fileItByHand}
              className="border border-[#BFE6F9] bg-card text-brand-ink rounded-lg px-4 py-2 text-[12.5px] font-bold">
              {filed ? 'Open Outlook again' : 'Copy and open Outlook to file it'}
            </button>
          )}
          <button onClick={onClose}
            className="border border-[#E3E6E8] text-muted bg-card rounded-lg px-4 py-2 text-[12.5px] font-semibold">
            Close
          </button>
          <span className="ml-auto text-[11px] text-faint">Recorded on the deal when it goes</span>
        </div>
      </div>
    </div>
  )
}

function Shout({ children, className = '' }: { children: any; className?: string }) {
  return <p className={`text-[9px] font-bold tracking-[.07em] uppercase text-faint mb-2 ${className}`}>{children}</p>
}

// ONE LIST, NOT A SECOND ONE WRITTEN BY HAND.
//
// This was a chain of three with everything else falling through to
// "Pre-approval", so the fourth template opened a screen with the wrong name on
// it and nothing anywhere said why. The names live in lib/milestone-emails.ts;
// a fifth template cannot be mis-named either now.
function titleOf(id: TemplateId): string {
  return templateById(id)?.name || 'Email'
}
