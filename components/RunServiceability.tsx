'use client'
import { useMemo, useState } from 'react'
import { buildRequest, COPY_TO } from '@/lib/serviceability-request'
import { addSystemNote } from '@/components/DealFile'

// RUN SERVICEABILITY.
//
// 4 Nov 2026. Fabio: "we are asking for help from a bot to do serviceability
// calculations. When we complete a fact find, a button that pops a little box
// asking me to summarise, and then the information we pre-populate on the fact
// find is sent to the bot's email, where he runs the borrowing capacity and
// sends everything back to me."
//
// The request itself is built in lib/serviceability-request.ts and nothing is
// composed here - this screen collects the two things only a person knows
// (what they want worked out, and which lenders) and shows what is about to
// leave. See that file for the privacy rule, which is the shape of the request
// rather than a setting on this screen.
//
// IT GOES FROM THE BROKER'S OWN MAIL, not from the portal. The bot's spec:
// "results are returned to this sender". A server-sent email would come from
// the portal's address and the answers would go there, which is nobody.
//
// THE CLIPBOARD FIRST, ON THE CLICK. A browser only allows a clipboard write
// while a click is still live, and opening a mailto spends that. The same
// lesson as lib/send-again.ts, which was written after the Send again button
// looked dead for exactly this reason.

const LENDERS = ['BANKWEST', 'CBA', 'NAB', 'STGEORGE', 'PEPPER', 'LIBERTY', 'FIRSTMAC']

export default function RunServiceability({ deal, me }: { deal: any; me?: any }) {
  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [trouble, setTrouble] = useState('')

  const req = useMemo(() => buildRequest(deal, {
    instructions,
    lenders: picked.length ? picked.join(',') : 'ALL',
    brokerName: me?.name || deal?.assigned_broker || '',
  }), [deal, instructions, picked, me])

  const ready = req.gaps.length === 0

  async function send() {
    setSending(true); setTrouble('')
    // FIRST, WHILE THE CLICK IS STILL LIVE.
    let copied = true
    try {
      await navigator.clipboard.writeText(req.body)
    } catch {
      copied = false
    }
    if (!copied) {
      setTrouble('The request could not be put on your clipboard, so nothing was opened. '
        + 'Your browser may be blocking it — try again, or copy the text below by hand.')
      setSending(false)
      return
    }
    const url = `mailto:${encodeURIComponent(req.to)}`
      + `?cc=${encodeURIComponent(COPY_TO)}`
      + `&subject=${encodeURIComponent(req.subject)}`
      + `&body=${encodeURIComponent('Paste the request here — it is on your clipboard.')}`
    window.location.href = url
    // THE FILE WRITES ITSELF. Same rule as every other email on this portal:
    // the record of what went out does not depend on somebody remembering to
    // write it. Never allowed to stop the send.
    try {
      await addSystemNote(deal.id,
        `Serviceability requested — ${req.dealRef}.`
          + (instructions.trim() ? ` Asked: ${instructions.trim()}` : '')
          + (picked.length ? ` Lenders: ${picked.join(', ')}.` : ' All lenders.'),
        { id: me?.id || null, name: me?.name || '' })
    } catch { /* a missing line is a smaller problem than a blocked send */ }
    setSending(false)
    setOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-3 bg-card border border-info-edge rounded-xl px-3.5 py-2.5">
        <div className="text-[12.5px] text-body leading-relaxed flex-1 min-w-[200px]">
          <b className="text-ink">Serviceability</b> — send what is on this fact find to the
          calculator and get every lender back by email.
          <div className={`text-[11.5px] font-semibold mt-0.5 ${ready ? 'text-done' : 'text-chase'}`}>
            {ready
              ? '✓ Everything it needs is recorded.'
              : `It will not guess at: ${req.gaps.join(', ')}.`}
          </div>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex-none px-3.5 py-2 text-[12.5px] font-semibold rounded-lg bg-ink text-page">
          Run serviceability
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/45 flex items-start justify-center p-6 overflow-y-auto">
          {/* NO CLICK-AWAY. Typing instructions and losing them to a stray
            * click on the dark edge is the same fault the extract review had. */}
          <div className="bg-card rounded-2xl w-[580px] max-w-full shadow-[0_24px_64px_rgba(0,0,0,0.32)] mt-10">
            <div className="px-5 pt-4">
              <h3 className="m-0 mb-1 text-[15.5px] font-bold text-ink">Run serviceability</h3>
              <p className="m-0 mb-4 text-[12px] text-muted leading-relaxed">
                Goes out from your own email and comes back to you, with Fabio copied.
                Nothing on this deal changes.
              </p>
            </div>

            <div className="px-5 pb-4">
              <span className="block text-[10px] font-bold tracking-[.08em] uppercase text-muted mb-1.5">
                What do you want worked out?
              </span>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                className="w-full border border-[var(--color-field-line)] rounded-lg px-3 py-2 text-[12.5px] min-h-[64px] resize-y bg-field"
                placeholder="e.g. Show the 1.6M target and the max purchase price. Partner contributing 800k." />

              <span className="block text-[10px] font-bold tracking-[.08em] uppercase text-muted mb-1.5 mt-4">
                Which lenders
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setPicked([])}
                  className={`text-[11.5px] rounded-full px-3 py-[5px] border transition ${picked.length === 0
                    ? 'bg-ink border-ink text-page font-semibold' : 'bg-card border-line text-muted'}`}>
                  All
                </button>
                {LENDERS.map(l => (
                  <button key={l}
                    onClick={() => setPicked(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l])}
                    className={`text-[11.5px] rounded-full px-3 py-[5px] border transition ${picked.includes(l)
                      ? 'bg-ink border-ink text-page font-semibold' : 'bg-card border-line text-muted'}`}>
                    {l}
                  </button>
                ))}
              </div>

              {!ready && (
                <div className="mt-4 rounded-lg border border-chase-edge bg-chase-bg px-3 py-2.5">
                  <p className="m-0 mb-1 text-[11.5px] font-bold text-chase">
                    The bot will write back asking for {req.gaps.length === 1 ? 'this' : 'these'}
                  </p>
                  <ul className="m-0 pl-4">
                    {req.gaps.map(g => (
                      <li key={g} className="text-[11.5px] text-body leading-relaxed">{g}</li>
                    ))}
                  </ul>
                  <p className="m-0 mt-1.5 text-[11px] text-muted">
                    It runs nothing until it has them. Sending anyway is fine — you will just get a
                    list back instead of an answer.
                  </p>
                </div>
              )}

              <span className="block text-[10px] font-bold tracking-[.08em] uppercase text-muted mb-1.5 mt-4">
                What leaves the building
              </span>
              <pre className="m-0 max-h-[220px] overflow-y-auto rounded-lg border border-card-line bg-page
                px-3 py-2.5 text-[10.5px] leading-[1.6] text-body whitespace-pre-wrap font-mono">{req.body}</pre>
              <p className="mt-1.5 text-[11px] text-faint leading-relaxed">
                First names only. No surnames, dates of birth, addresses, phone numbers, emails,
                employer names or account numbers, and no documents.
              </p>

              {trouble && <p className="mt-2 text-[11.5px] text-chase">{trouble}</p>}
            </div>

            <div className="border-t border-[var(--color-line-soft)] px-5 py-3 flex items-center gap-2.5">
              <span className="text-[11px] text-faint">
                Comes back as <b className="text-body">{req.dealRef}</b>
              </span>
              <button onClick={() => setOpen(false)}
                className="ml-auto px-3.5 py-2 text-[12.5px] rounded-lg border border-line bg-card text-muted">
                Cancel
              </button>
              <button onClick={send} disabled={sending}
                className="px-3.5 py-2 text-[12.5px] font-semibold rounded-lg bg-ink text-page disabled:opacity-50">
                {sending ? 'Opening…' : 'Send to the bot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
