'use client'
import { useMemo, useRef, useState, useEffect } from 'react'
import { TONE } from '@/lib/tone'
import { mailtoUrl } from '@/lib/email-shell'
import { useSender } from './useSender'
import { SenderPanel, ClientPanel, inp, inpS, panel, panelS } from './TemplateFields'
import PasteReminder from './PasteReminder'

// One form for every template that needs nothing but the client. Nothing is
// calculated, so the email is ready as soon as the name and address are in.
//
// No loan panel, no SMS (a text message about deferred tax losses is not one
// anyone wants), and no "get started" link — the call to action is a
// conversation, not an instruction to proceed.

export type BuiltEmail = { subject: string; html: string; plainText: string }
export type EmailBuilder = (ctx: {
  clientFirstName: string
  brokerName: string
  calendlyUrl: string
  opportunityUrl?: string
  [key: string]: string | undefined
}) => BuiltEmail

// A template that needs one or two things beyond the client — a rebate amount,
// a link to the project documents — declares them here rather than getting its
// own form. Anything more than a handful of fields deserves its own screen.
export type ExtraField = {
  key: string
  label: string
  placeholder?: string
  hint?: string
  required?: boolean
}

export default function SimpleTemplateForm({
  build, extras, extrasTitle, attachReminder, usesOpportunityLink,
}: {
  build: EmailBuilder
  extras?: ExtraField[]
  extrasTitle?: string
  // A template whose email says something is attached adds one line to the
  // paste reminder, so the PDFs are not forgotten. The sender attaches them in
  // their own mail program, the same way they attach anything.
  attachReminder?: string
  // Only the negative gearing email carries a link to the opportunity page.
  // Minting one for every template put a long green URL under templates that
  // have nowhere to put it.
  usesOpportunityLink?: boolean
}) {
  const sender = useSender('sf_template_sender_v1')

  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [joint, setJoint] = useState(false)
  const [secondName, setSecondName] = useState('')
  const [secondEmail, setSecondEmail] = useState('')
  const [bcc, setBcc] = useState('')
  const [extra, setExtra] = useState<Record<string, string>>({})
  const [opportunityUrl, setOpportunityUrl] = useState('')
  const [linkError, setLinkError] = useState('')
  // The link takes a moment to come back. Until it does, the email on the
  // clipboard would be the version without it — so the button waits.
  const [linkPending, setLinkPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const [err, setErr] = useState('')

  const second = joint ? secondName.trim() : ''
  const greeting = second ? `${firstName.trim()} and ${second}` : firstName.trim()
  const recipients = [email.trim(), joint ? secondEmail.trim() : ''].filter(Boolean).join(',')

  // Minted on the server, because the signing secret must not reach the browser.
  // A builder that has no use for it simply ignores it.
  //
  // The broker is depended on by key and name, not by the object: `brokers.find`
  // returns a new object every render, so an object dependency restarted the
  // debounce on every keystroke and the request never fired.
  const brokerKeyDep = sender.broker?.key || ''
  const brokerNameDep = sender.broker?.name || ''
  useEffect(() => {
    if (!usesOpportunityLink || !greeting || !recipients || !brokerKeyDep) {
      setOpportunityUrl(''); setLinkError(''); setLinkPending(false); return
    }
    setLinkPending(true)
    const body = {
      name: greeting,
      email: recipients,
      brokerKey: brokerKeyDep,
      brokerName: brokerNameDep,
      sentOn: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    }
    let live = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/opportunity-link', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!live) return
        if (!res.ok || !json?.url) {
          // Say so rather than sending an email quietly missing its link.
          console.error('[opportunity-link]', res.status, json)
          setOpportunityUrl('')
          setLinkError(json?.error || `Could not create the link (${res.status}).`)
          setLinkPending(false)
          return
        }
        setOpportunityUrl(json.url)
        setLinkError('')
        setLinkPending(false)
      } catch (e: any) {
        if (!live) return
        console.error('[opportunity-link] request failed', e)
        setOpportunityUrl('')
        setLinkError('Could not reach the server to create the link.')
        setLinkPending(false)
      }
    }, 400)
    return () => { live = false; clearTimeout(t) }
  }, [usesOpportunityLink, greeting, recipients, brokerKeyDep, brokerNameDep])

  const built = useMemo(() => {
    if (!greeting || !sender.broker) return null
    return build({
      ...extra,
      clientFirstName: greeting,
      brokerName: sender.broker.name,
      calendlyUrl: sender.calendlyUrl,
      opportunityUrl,
      // The email says "I have attached", so the template that says it always
      // means it — the sender drags the PDFs in before pressing Send.
      attachmentCount: attachReminder ? '1' : '0',
    })
  }, [greeting, sender.broker, sender.calendlyUrl, opportunityUrl, extra, build, attachReminder])

  const missing: string[] = []
  for (const f of extras || []) {
    if (f.required && !String(extra[f.key] || '').trim()) missing.push(f.label.toLowerCase())
  }
  if (!firstName.trim()) missing.push('client name')
  if (!recipients) missing.push('client email')
  if (!sender.broker) missing.push('a broker')
  // Not ready while the link is still coming — otherwise the copy is made from
  // an email the preview is about to replace.
  const ready = Boolean(built) && missing.length === 0 && !linkPending

  // Copy first, then open the message — navigating away can cancel a clipboard
  // write in flight, which would leave nothing to paste.
  const openMail = async () => {
    if (!built) return
    setErr('')
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([built.html], { type: 'text/html' }),
        'text/plain': new Blob([built.plainText], { type: 'text/plain' }),
      })])
      setCopied(true)
      setTimeout(() => setCopied(false), 4000)
      setShowPaste(true)
      window.location.href = mailtoUrl({ to: recipients, bcc, subject: built.subject })
    } catch {
      setErr('Could not copy the email, so nothing was opened. Your browser may be blocking clipboard access — try Chrome.')
    }
  }

  // A client email is a fixed 600px, wider than this column, so the preview is
  // scaled rather than clipped.
  const frameRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [frameHeight, setFrameHeight] = useState(0)
  useEffect(() => {
    const frame = frameRef.current, inner = innerRef.current
    if (!frame || !inner) return
    const measure = () => {
      const next = Math.min(1, frame.clientWidth > 0 ? frame.clientWidth / 600 : 1)
      setScale(next)
      setFrameHeight(inner.scrollHeight * next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(frame); ro.observe(inner)
    return () => ro.disconnect()
  }, [built])

  return (
    <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
      <div>
        <SenderPanel {...sender} />
        <ClientPanel
          firstName={firstName} setFirstName={setFirstName}
          email={email} setEmail={setEmail}
          joint={joint} setJoint={setJoint}
          secondName={secondName} setSecondName={setSecondName}
          secondEmail={secondEmail} setSecondEmail={setSecondEmail}
          bcc={bcc} setBcc={setBcc}
        />

        {extras && extras.length > 0 && (
          <div className={panel} style={panelS}>
            <h3 className="text-[11px] font-bold tracking-[.08em] uppercase mb-3" style={{ color: TONE.label }}>
              {extrasTitle || 'This project'}
            </h3>
            <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
              {extras.map(f => (
                <div key={f.key} className={extras.length === 1 ? '' : 'col-span-2 max-[520px]:col-span-1'}>
                  <label className="text-[11.5px] mb-1 block" style={{ color: TONE.label }}>{f.label}</label>
                  <input className={inp} style={inpS} value={extra[f.key] || ''}
                         onChange={e => setExtra(x => ({ ...x, [f.key]: e.target.value }))}
                         placeholder={f.placeholder} />
                  {f.hint && <p className="text-[11px] mt-1" style={{ color: TONE.faint }}>{f.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2.5 items-center flex-wrap">
          <button onClick={openMail} disabled={!ready}
            className="rounded-lg px-4 py-[9px] text-[13px] font-semibold disabled:opacity-40"
            style={{ background: TONE.accent, color: '#fff' }}>
            {copied ? 'Copied — paste with Cmd V' : linkPending ? 'Preparing…' : 'Open in mail'}
          </button>
          {missing.length > 0 && (
            <span className="text-[11.5px]" style={{ color: TONE.faint }}>Still needs {missing.join(', ')}</span>
          )}
        </div>
        {err && <p className="text-[12px] mt-2" style={{ color: TONE.neg }}>{err}</p>}
        {/* Whether the email carries its link, stated plainly rather than left to
            be discovered in someone's inbox. */}
        {!usesOpportunityLink ? null : linkError ? (
          <p className="text-[12px] mt-2" style={{ color: TONE.neg }}>
            {linkError} The email will still send, with that phrase as plain text instead of a link.
          </p>
        ) : linkPending ? (
          <p className="text-[12px] mt-2" style={{ color: TONE.label }}>Preparing the link…</p>
        ) : opportunityUrl ? (
          <p className="text-[12px] mt-2 break-all" style={{ color: TONE.pos }}>
            Link ready — {opportunityUrl}
          </p>
        ) : null}
        <p className="text-[11.5px] mt-2.5 leading-[1.6]" style={{ color: TONE.label }}>
          {attachReminder
            ? 'Open in mail copies the email first, then opens a message with the address, BCC and ' +
              'subject already filled. Paste it in, attach the project PDFs, and send.'
            : 'No figures to enter — the email reads the same for every investor, so it is ready as ' +
              'soon as the client is filled in. Open in mail copies it first, then opens a message ' +
              'with the address, BCC and subject already filled.'}
        </p>
      </div>

      <div>
        <div className="text-[11px] font-bold tracking-[.08em] uppercase mb-2" style={{ color: TONE.label }}>
          What the client receives
        </div>
        {built ? (
          <>
            <div className="rounded-xl border px-3 py-2 mb-2.5 text-[12.5px]"
                 style={{ borderColor: TONE.line, background: '#fff', color: TONE.body }}>
              <span style={{ color: TONE.label }}>Subject</span>{' '}
              <span style={{ color: TONE.ink, fontWeight: 520 }}>{built.subject}</span>
            </div>
            <div ref={frameRef} className="rounded-xl border overflow-y-auto overflow-x-hidden"
                 style={{ borderColor: TONE.line, background: '#f5f5f3', maxHeight: '78vh' }}>
              <div style={{ height: frameHeight || undefined }}>
                <div ref={innerRef} style={{ width: 600, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                     dangerouslySetInnerHTML={{ __html: built.html }} />
              </div>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: TONE.faint }}>
              Shown at {Math.round(scale * 100)}% to fit. The client receives it full size.
            </p>
          </>
        ) : (
          <div className="rounded-xl border px-4 py-8 text-[13px] text-center"
               style={{ borderColor: TONE.line, background: '#fff', color: TONE.faint }}>
            Fill in the client and the email appears here.
          </div>
        )}
      </div>
      <PasteReminder open={showPaste} onClose={() => setShowPaste(false)}
                     onRetry={openMail} alsoDo={attachReminder} />
    </div>
  )
}
