'use client'
import { useEffect } from 'react'
import { TONE } from '@/lib/tone'

// This template does not open a mail program — the portal sends it, the same way
// the credit officer's compliance email goes out, which is the only way the PDFs
// can travel with it. That is a different thing from every other button on this
// page, so it is said plainly before anything is sent rather than discovered
// afterwards in a Sent folder that has nothing in it.

export default function SendConfirm({
  open, to, copies, attachments, sending, error, onSend, onClose,
}: {
  open: boolean
  to: string[]
  copies: string[]
  attachments: string[]
  sending: boolean
  error: string
  onSend: () => void
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, sending, onClose])

  if (!open) return null

  const row = (k: string, v: string) => (
    <div className="flex gap-3 py-[5px] text-[13px]">
      <span className="w-[74px] shrink-0 text-[11px] uppercase tracking-[.06em] pt-[3px]"
            style={{ color: TONE.label }}>{k}</span>
      <span className="flex-1 break-all" style={{ color: TONE.ink }}>{v}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(34,31,27,.42)' }} onClick={() => !sending && onClose()}>
      <div className="bg-white rounded-2xl border w-full max-w-[460px] overflow-hidden"
           style={{ borderColor: TONE.line }} onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-5">
          <p className="text-[17px] font-[640] tracking-[-.015em] mb-1.5" style={{ color: TONE.ink }}>
            This sends the email now
          </p>
          <p className="text-[13.5px] leading-[1.6] mb-4" style={{ color: TONE.body }}>
            It goes straight to the client from the portal, with the PDFs attached. Your mail program
            does not open, there is nothing to paste, and nothing to attach afterwards.
          </p>

          <div className="rounded-xl border px-4 py-3 mb-4"
               style={{ background: TONE.zebra, borderColor: TONE.line }}>
            {row('To', to.join(', '))}
            {copies.length > 0 && row('BCC', copies.join(', '))}
            {attachments.length > 0 && row('Attached', attachments.join(', '))}
          </div>

          <div className="rounded-xl border px-4 py-3.5"
               style={{ background: '#FAF8F4', borderColor: TONE.line }}>
            <div className="text-[11px] font-bold uppercase tracking-[.09em] mb-1.5"
                 style={{ color: TONE.label }}>Worth knowing</div>
            <p className="text-[13px] leading-[1.6]" style={{ color: TONE.ink }}>
              Because it leaves the portal and not your mailbox, <b>it will not appear in your Sent
              items</b>. A separate copy is sent to you straight after, with <b>Your copy</b> at the front
              of the subject line — file that if you want a record. Replies come back to you as normal.
            </p>
          </div>

          {error && <p className="text-[12.5px] mt-3" style={{ color: TONE.neg }}>{error}</p>}
        </div>
        <div className="px-6 py-3.5 border-t flex items-center gap-2.5"
             style={{ borderColor: TONE.hair, background: TONE.zebra }}>
          <button onClick={onClose} disabled={sending}
                  className="text-[12.5px] disabled:opacity-40" style={{ color: TONE.label }}>Cancel</button>
          <button onClick={onSend} disabled={sending}
            className="ml-auto rounded-lg px-4 py-[8px] text-[13px] font-semibold disabled:opacity-50"
            style={{ background: TONE.accent, color: '#fff' }}>
            {sending ? 'Sending…' : 'Send it'}
          </button>
        </div>
      </div>
    </div>
  )
}
