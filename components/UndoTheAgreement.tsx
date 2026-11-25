'use client'
import { useState } from 'react'
import {
  undoWarning, whereTheCardGoes, BACK_STAGE_LABEL, type BackStage,
} from '@/lib/send-it-back'

// THE QUESTION ASKED BEFORE A CLIENT'S AGREEMENT COMES OFF A DEAL.
//
// 25 Nov 2026. Until today a client pressing Proceed hid both Send again and
// Send it back, with nothing on screen saying so, and the only way back was
// dragging the card on another screen. Fabio: "I don't like dragging deal
// cards... even when we send to the client, it doesn't suppress. So we can
// always change it and send it again."
//
// So the buttons stay, and this box is what stands between them and the file.
// It is not a safety rail for its own sake - it is the only place a broker is
// told, in writing, that a recorded agreement is about to stop existing, which
// bank it named, and where the card is going to end up.
//
// IT NAMES THE BANK AND THE DATE. "Are you sure?" is not a question anybody
// can answer. "The client agreed to Bankwest on 2026-11-24" is.
export default function UndoTheAgreement({ deal, stage, byName, what, onDone, onCancel }: {
  deal: any
  stage: BackStage
  /** The broker's name, which goes in the file note. */
  byName: string
  /** What happens next, in the broker's words: 'send it again' / 'send it back'. */
  what: string
  /** Called once the agreement is off. The caller then does the thing. */
  onDone: () => void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const stageLabel = BACK_STAGE_LABEL[stage]
  const moves = whereTheCardGoes(deal, stage)

  async function go() {
    if (busy) return
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/undo-the-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, stage, by: byName }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok || out?.ok === false) {
        setErr(out?.error || 'That was not saved — nothing has been altered.')
        setBusy(false); return
      }
      onDone()
    } catch (e: any) {
      setErr(e?.message || 'That did not go through.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/45 flex items-start justify-center p-6 overflow-y-auto">
      <div className="bg-card rounded-2xl w-[520px] max-w-full shadow-[0_24px_64px_rgba(0,0,0,0.32)] overflow-hidden">
        <div className="px-5 pt-4">
          <h3 className="m-0 mb-1 text-[15.5px] font-bold text-ink">
            The client has already agreed to this one
          </h3>
          <p className="m-0 mb-3 text-[12.5px] text-body leading-relaxed">
            {undoWarning(deal, stage)}
          </p>
        </div>

        <div className="px-5">
          <div className="mb-3 rounded-[10px] border border-info-edge bg-info-bg px-3 py-2.5">
            <b className="block text-[11.5px] text-ink mb-1">What this does</b>
            <ul className="m-0 pl-4 text-[11.5px] text-body leading-relaxed">
              <li>Their agreement comes off the {stageLabel} — both the Proceed
                they pressed and the lender we recorded for them.</li>
              <li>The compliance pack reads that answer, so it stops naming a
                bank they are no longer taking.</li>
              {moves && <li>{moves}</li>}
              <li>It is written to the file notes with your name and the time.
                Nothing else on the tab is touched.</li>
            </ul>
          </div>

          <p className="mb-3 text-[11.5px] text-muted leading-relaxed">
            If they agree again — to this bank or another one — record it the
            same way you did the first time.
          </p>

          {err && <p className="mb-3 text-[12px] text-chase">{err}</p>}
        </div>

        <div className="flex gap-2 items-center justify-end px-5 py-3 bg-page border-t border-line-soft flex-wrap">
          <button type="button" onClick={onCancel} disabled={busy}
            className="text-[12px] border border-card-line bg-card rounded-lg px-3 py-1.5 text-body hover:bg-page transition">
            Leave it as it is
          </button>
          <button type="button" onClick={go} disabled={busy}
            className="text-[12px] bg-chase text-white rounded-lg px-3.5 py-1.5 font-bold disabled:opacity-40">
            {busy ? 'Taking it off…' : `Take it off and ${what}`}
          </button>
        </div>
      </div>
    </div>
  )
}
