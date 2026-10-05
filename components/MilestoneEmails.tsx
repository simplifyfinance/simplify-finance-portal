'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { menuFor, lastSent, type MenuItem, type TemplateId } from '@/lib/milestone-emails'

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
  blocks: Block[]
  problems: string[]
  to: string[]
  cc: string[]
  copyDropped: string[]
  testDeal: boolean
  redirected: boolean
  state: string | null
}

export default function MilestoneEmails({ deal, onUpdated }: {
  deal: any
  me?: any
  onUpdated?: (patch: any) => void
}) {
  const [open, setOpen] = useState<TemplateId | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  const menu = menuFor(deal)

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
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const already = lastSent(deal, templateId)
  const isExtension = templateId === 'preapproval_extension'

  const load = useCallback(async () => {
    setErr('')
    const qs = new URLSearchParams({
      dealId: deal.id, template: templateId,
      overrides: JSON.stringify(overrides), extra, expiry, insuranceAmount,
    })
    try {
      const res = await fetch(`/api/send-milestone-email?${qs.toString()}`)
      const json = await res.json()
      if (!res.ok) { setErr(json?.error || 'The preview could not be built.'); return }
      setPreview(json)
    } catch (e: any) {
      setErr(`The preview could not be built — ${e?.message || 'network error'}.`)
    }
  }, [deal.id, templateId, overrides, extra, expiry, insuranceAmount])

  // Redrawn as you tick. Typing is debounced so the free text box does not
  // rebuild the email on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { load() }, 250)
    return () => clearTimeout(t)
  }, [load])

  async function send() {
    if (!file) { setErr('Attach the lender’s letter first.'); return }
    setBusy(true); setErr(''); setDone('')
    try {
      const body = new FormData()
      body.set('dealId', deal.id)
      body.set('template', templateId)
      body.set('overrides', JSON.stringify(overrides))
      body.set('extra', extra)
      body.set('expiry', expiry)
      body.set('insuranceAmount', insuranceAmount)
      body.append('file', file)
      const res = await fetch('/api/send-milestone-email', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) { setErr(json?.error || 'The send was refused.'); return }
      // The deal now has one more entry in emails_sent. The page is told rather
      // than reloaded, so the button underneath says "sent" immediately.
      onSent({
        emails_sent: [...(Array.isArray(deal.emails_sent) ? deal.emails_sent : []), {
          template: templateId, at: new Date().toISOString(), by: 'you',
          to: preview?.to || [], cc: json.cc || [], attached: true,
        }],
      })
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
      <div className="bg-card rounded-xl border border-[#E3E6E8] shadow-lg w-full max-w-[1000px] mt-6"
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

            <Shout className="mt-5">The bank&rsquo;s letter</Shout>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()}
              className={file
                ? 'w-full text-left border border-done-edge bg-done-bg text-done rounded-lg px-3 py-2.5 text-[12px]'
                : 'w-full border border-dashed border-[#D8DDE2] text-faint rounded-lg px-3 py-3 text-[12px]'}>
              {file ? `${file.name} — ${Math.round(file.size / 1024)} KB` : 'Attach the approval letter (required)'}
            </button>

            {isExtension && (
              <>
                <Shout className="mt-5">The new expiry the lender granted</Shout>
                <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
                  className="border border-[#E3E6E8] rounded-lg px-2.5 py-1.5 text-[12.5px]" />
              </>
            )}

            <Shout className="mt-5">What goes in</Shout>
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

            <Shout className="mt-5">Anything else</Shout>
            <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={2}
              placeholder="Added to this email only. Never remembered."
              className="w-full border border-[#E3E6E8] rounded-lg px-2.5 py-2 text-[12.5px]" />
          </div>

          {/* --- what they will get ------------------------------------- */}
          <div className="flex-1 min-w-[310px] basis-[380px] p-4 bg-panel">
            <Shout>What they will get</Shout>
            <p className="text-[12px] text-ink font-semibold mb-2">{preview?.subject || ' '}</p>
            <iframe title="The email" sandbox="" srcDoc={preview?.html || ''}
              className="w-full h-[460px] border border-[#EEF0F2] rounded-lg bg-card" />
            <p className="mt-2 text-[11px] text-faint">
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

        <div className="border-t border-[#EEF0F2] bg-[#FAFAF8] px-5 py-3 flex gap-2 items-center flex-wrap rounded-b-xl">
          <button onClick={send} disabled={busy || !file || !preview?.to?.length}
            className="bg-ink text-page rounded-lg px-4 py-2 text-[12.5px] font-semibold disabled:opacity-40">
            {busy ? 'Sending…' : 'Send'}
          </button>
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

function titleOf(id: TemplateId): string {
  return id === 'formal_approval' ? 'Formal approval'
    : id === 'preapproval_extension' ? 'Pre-approval extension'
    : 'Pre-approval'
}
