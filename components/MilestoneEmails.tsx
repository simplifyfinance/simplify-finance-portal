'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { menuFor, lastSent, type MenuItem, type TemplateId } from '@/lib/milestone-emails'

// THE CLIENT EMAILS A DEAL CAN SEND.
//
// ABOVE THE TABS, OUTSIDE THE LOCK, like the documents beside it. Telling a
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
  const menu = menuFor(deal)

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-bold tracking-[.07em] uppercase text-[#A29889] mr-1">Client emails</span>
        {menu.map(item => (
          <MenuButton key={item.id} item={item} onOpen={() => setOpen(item.id)} />
        ))}
      </div>

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
      <span className="border border-dashed border-[#E8E1D6] text-[#C3BDB2] rounded-lg px-3 py-1.5 text-[12px]"
            title={item.note}>
        {item.name} <span className="text-[11px]">— {item.note}</span>
      </span>
    )
  }
  const ready = item.state === 'ready'
  return (
    <button onClick={onOpen}
      className={ready
        ? 'bg-[#221F1B] text-white rounded-lg px-3 py-1.5 text-[12px] font-semibold'
        : 'bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition'}>
      {item.name}
      <span className={`ml-1.5 text-[11px] font-normal ${ready ? 'text-white/60' : 'text-[#A29889]'}`}>
        {item.note}
      </span>
    </button>
  )
}

// --- the send screen -------------------------------------------------------

function SendScreen({ deal, templateId, onClose, onSent }: {
  deal: any
  templateId: TemplateId
  onClose: () => void
  onSent: (patch: any) => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [extra, setExtra] = useState('')
  const [expiry, setExpiry] = useState('')
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
      overrides: JSON.stringify(overrides), extra, expiry,
    })
    try {
      const res = await fetch(`/api/send-milestone-email?${qs.toString()}`)
      const json = await res.json()
      if (!res.ok) { setErr(json?.error || 'The preview could not be built.'); return }
      setPreview(json)
    } catch (e: any) {
      setErr(`The preview could not be built — ${e?.message || 'network error'}.`)
    }
  }, [deal.id, templateId, overrides, extra, expiry])

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
      <div className="bg-white rounded-xl border border-[#E3E6E8] shadow-lg w-full max-w-[1000px] mt-6"
           onClick={e => e.stopPropagation()}>

        <div className="border-b border-[#EEF0F2] bg-[#FAFAF8] px-5 py-3 flex items-baseline gap-2 flex-wrap rounded-t-xl">
          <b className="text-[14px]">{titleOf(templateId)}</b>
          <span className="text-[11.5px] text-[#A29889]">{deal.deal_name || ''}</span>
          {already && (
            <span className="text-[11.5px] text-[#8A6218] ml-auto">
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
              {!preview?.to?.length && <span className="text-[11.5px] text-[#C3BDB2]">nobody on file</span>}
            </div>
            {!!preview?.cc?.length && (
              <p className="mt-1.5 text-[11px] text-[#A29889]">Copied: {preview.cc.join(', ')}</p>
            )}
            {preview?.redirected && (
              <p className="mt-1.5 text-[11px] text-[#8A6218]">
                This is a test deal, so it comes to you instead of the clients
                {preview.copyDropped.length ? `, and ${preview.copyDropped.join(', ')} are left off` : ''}.
              </p>
            )}

            <Shout className="mt-5">The bank&rsquo;s letter</Shout>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()}
              className={file
                ? 'w-full text-left border border-[#BBE7CF] bg-[#F4FBF7] text-[#0F7B4F] rounded-lg px-3 py-2.5 text-[12px]'
                : 'w-full border border-dashed border-[#D8DDE2] text-[#A29889] rounded-lg px-3 py-3 text-[12px]'}>
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
                    isOn(b) ? 'bg-[#0F7B4F] border-[#0F7B4F] text-white' : 'bg-white border-[#CBD2D8] text-transparent'}`}>
                  &#10003;
                </button>
                <div>
                  <div className="text-[12.5px] leading-[1.45]">{b.label}</div>
                  <div className={`text-[10.5px] mt-0.5 leading-[1.45] ${
                    b.why.startsWith('Not recorded') ? 'text-[#8A6218]'
                      : isOn(b) ? 'text-[#0F7B4F]' : 'text-[#C3BDB2]'}`}>{b.why}</div>
                </div>
              </div>
            ))}

            <Shout className="mt-5">Anything else</Shout>
            <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={2}
              placeholder="Added to this email only. Never remembered."
              className="w-full border border-[#E3E6E8] rounded-lg px-2.5 py-2 text-[12.5px]" />
          </div>

          {/* --- what they will get ------------------------------------- */}
          <div className="flex-1 min-w-[310px] basis-[380px] p-4 bg-[#FCFCFB]">
            <Shout>What they will get</Shout>
            <p className="text-[12px] text-[#221F1B] font-semibold mb-2">{preview?.subject || ' '}</p>
            <iframe title="The email" sandbox="" srcDoc={preview?.html || ''}
              className="w-full h-[460px] border border-[#EEF0F2] rounded-lg bg-white" />
            <p className="mt-2 text-[11px] text-[#A29889]">
              Every figure comes off the deal. Nothing on this screen can be typed over a number.
            </p>
          </div>
        </div>

        {/* --- what is worth knowing before pressing it ----------------- */}
        {!!preview?.problems?.length && (
          <div className="px-5 pb-1">
            <ul className="text-[12px] text-[#8A6218] list-disc pl-4 space-y-1">
              {preview.problems.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
        {err && (
          <div className="px-5 pt-2">
            <p className="border border-[#E9D2CF] bg-[#FDF3F2] rounded-lg px-3 py-2 text-[12.5px] text-[#8E3A34]">{err}</p>
          </div>
        )}
        {done && (
          <div className="px-5 pt-2">
            <p className="border border-[#EBD9BE] bg-[#FDF6EC] rounded-lg px-3 py-2 text-[12.5px] text-[#8A6218]">{done}</p>
          </div>
        )}

        <div className="border-t border-[#EEF0F2] bg-[#FAFAF8] px-5 py-3 flex gap-2 items-center flex-wrap rounded-b-xl">
          <button onClick={send} disabled={busy || !file || !preview?.to?.length}
            className="bg-[#221F1B] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold disabled:opacity-40">
            {busy ? 'Sending…' : 'Send'}
          </button>
          <button onClick={onClose}
            className="border border-[#E3E6E8] text-[#5B6672] bg-white rounded-lg px-4 py-2 text-[12.5px] font-semibold">
            Close
          </button>
          <span className="ml-auto text-[11px] text-[#A29889]">Recorded on the deal when it goes</span>
        </div>
      </div>
    </div>
  )
}

function Shout({ children, className = '' }: { children: any; className?: string }) {
  return <p className={`text-[9px] font-bold tracking-[.07em] uppercase text-[#A29889] mb-2 ${className}`}>{children}</p>
}

function titleOf(id: TemplateId): string {
  return id === 'formal_approval' ? 'Formal approval'
    : id === 'preapproval_extension' ? 'Pre-approval extension'
    : 'Pre-approval'
}
