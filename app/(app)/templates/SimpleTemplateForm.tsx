'use client'
import { useMemo, useRef, useState, useEffect } from 'react'
import { TONE } from '@/lib/tone'
import { mailtoUrl } from '@/lib/email-shell'
import { useSender } from './useSender'
import { SenderPanel, ClientPanel } from './TemplateFields'
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
}) => BuiltEmail

export default function SimpleTemplateForm({ build }: { build: EmailBuilder }) {
  const sender = useSender('sf_template_sender_v1')

  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [joint, setJoint] = useState(false)
  const [secondName, setSecondName] = useState('')
  const [secondEmail, setSecondEmail] = useState('')
  const [bcc, setBcc] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const [err, setErr] = useState('')

  const second = joint ? secondName.trim() : ''
  const greeting = second ? `${firstName.trim()} and ${second}` : firstName.trim()
  const recipients = [email.trim(), joint ? secondEmail.trim() : ''].filter(Boolean).join(',')

  const built = useMemo(() => {
    if (!greeting || !sender.broker) return null
    return build({
      clientFirstName: greeting,
      brokerName: sender.broker.name,
      calendlyUrl: sender.calendlyUrl,
    })
  }, [greeting, sender.broker, sender.calendlyUrl, build])

  const missing: string[] = []
  if (!firstName.trim()) missing.push('client name')
  if (!recipients) missing.push('client email')
  if (!sender.broker) missing.push('a broker')
  const ready = Boolean(built) && missing.length === 0

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

        <div className="flex gap-2.5 items-center flex-wrap">
          <button onClick={openMail} disabled={!ready}
            className="rounded-lg px-4 py-[9px] text-[13px] font-semibold disabled:opacity-40"
            style={{ background: TONE.accent, color: '#fff' }}>
            {copied ? 'Copied — paste with Cmd V' : 'Open in mail'}
          </button>
          {missing.length > 0 && (
            <span className="text-[11.5px]" style={{ color: TONE.faint }}>Still needs {missing.join(', ')}</span>
          )}
        </div>
        {err && <p className="text-[12px] mt-2" style={{ color: TONE.neg }}>{err}</p>}
        <p className="text-[11.5px] mt-2.5" style={{ color: TONE.label }}>
          No figures to enter — the email reads the same for every investor, so it is ready as soon as
          the client is filled in. Open in mail copies it first, then opens a message with the address,
          BCC and subject already filled.
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
                     onRetry={openMail} />
    </div>
  )
}
