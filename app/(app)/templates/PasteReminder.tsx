'use client'
import { useEffect, useState } from 'react'
import { TONE } from '@/lib/tone'

// A mail link cannot carry a formatted body, so the email is put on the clipboard
// and the message opens empty. People forget the paste, send an empty email, or
// assume it failed and start again. This says the one thing they need to do next.

export default function PasteReminder({
  open, onClose, onRetry,
}: {
  open: boolean
  onClose: () => void
  onRetry?: () => void
}) {
  // Read the platform after mount, so the server and the browser agree on the
  // first render and React does not complain about a mismatch.
  const [combo, setCombo] = useState('Cmd V')
  useEffect(() => {
    const mac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
    setCombo(mac ? '⌘ V' : 'Ctrl V')
  }, [])

  // Escape closes it — this is a reminder, not a decision.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(34,31,27,.42)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl border w-full max-w-[420px] overflow-hidden"
           style={{ borderColor: TONE.line }} onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="w-11 h-11 rounded-full mx-auto mb-3 flex items-center justify-center text-[21px]"
               style={{ background: '#F1F7F3', border: '1px solid #CFE6D5', color: TONE.pos }}>✓</div>
          <p className="text-[17px] font-[640] tracking-[-.015em] mb-1" style={{ color: TONE.ink }}>
            The email is on your clipboard
          </p>
          <p className="text-[13.5px] leading-[1.6] mb-4" style={{ color: TONE.body }}>
            A blank message should have opened with the address, BCC and subject already filled.
            Click into the body and paste.
          </p>

          <div className="rounded-xl border px-4 py-4 mb-4"
               style={{ background: TONE.accentSoft, borderColor: TONE.accentLine }}>
            <div className="text-[11px] font-bold uppercase tracking-[.09em] mb-1.5" style={{ color: '#0B6F9E' }}>
              Press
            </div>
            <div className="text-[26px] font-[660] tracking-[-.02em]" style={{ color: '#095B83' }}>{combo}</div>
          </div>

          <p className="text-[12px] leading-[1.6]" style={{ color: TONE.label }}>
            Nothing pasted? The email is still on the clipboard — click into the message body first,
            then press {combo} again.
          </p>
        </div>
        <div className="px-6 py-3.5 border-t flex items-center gap-2.5"
             style={{ borderColor: TONE.hair, background: TONE.zebra }}>
          {onRetry && (
            <button onClick={onRetry} className="text-[12.5px] underline" style={{ color: TONE.label }}>
              The message did not open
            </button>
          )}
          <button onClick={onClose}
            className="ml-auto rounded-lg px-4 py-[8px] text-[13px] font-semibold"
            style={{ background: TONE.accent, color: '#fff' }}>Got it</button>
        </div>
      </div>
    </div>
  )
}
