'use client'
import { useEffect, useRef, useState } from 'react'
import { HOLA, type Answer } from '@/lib/paco'

// PACO, IN THE BOTTOM RIGHT OF EVERY PAGE.
//
// 12 Oct 2026. Mounted once in app/(app)/layout.tsx, which is the only place
// that is on every screen behind the login - so he is one component rather than
// one per page, and he cannot be missing from the page somebody happens to be on
// when they need him.
//
// HE OPENS OVER THE PAGE AND NEVER NAVIGATES.
//
// Fabio: "clicking on it pops a box but we dont need to leave current page
// never". So this is fixed to the window, not a route. Nothing behind it moves,
// nothing reloads, nothing is lost out of a half-typed form. Close him and you
// are exactly where you were, because you never left.
//
// EVERY WORD HE SAYS COMES FROM lib/paco.ts. There is no copy in this file
// beyond labels on controls - the things Paco is able to say live together in
// one readable place, by design. See the note at the top of that file.

function Bird({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="rounded-full block">
      <circle cx="32" cy="32" r="31" fill="#0B4C3F" />
      <path d="M30 8c10 0 13 6 11 12l-13 1z" fill="#FF6B5A" />
      <circle cx="32" cy="36" r="21" fill="#1BBE92" />
      <path d="M46 48c5-6 6-14 4-21 6 8 5 20-4 26z" fill="#12A079" />
      {/* The one Simplify colour on him, by name rather than by value - so his
          wing follows the brand, including in dark mode. lib/colours.ts. */}
      <path d="M43 30c7 2 9 9 6 15-1-7-4-11-8-12z" fill="var(--color-brand)" />
      <circle cx="26" cy="31" r="10.5" fill="#FDF8EE" />
      <circle cx="28" cy="32.5" r="5.6" fill="#0F1115" />
      <circle cx="30.2" cy="30.3" r="2.1" fill="#fff" />
      <path d="M14 34c-6 1.5-7 6-2.5 8.5 3.6 2 7 1.2 9.5-1.2z" fill="#FF8A5B" />
    </svg>
  )
}

type Turn = { mine: boolean; text?: string; a?: Answer; error?: string }

const SUGGEST = ['Limited title', 'Casual income', 'SMSF', 'Construction']

export default function Paco() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [counts, setCounts] = useState<Answer['counts'] | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // What he can see at all, fetched once when he is first opened rather than on
  // every page load - he is on every page, and a greeting is not worth a query
  // on a screen nobody opened him on.
  useEffect(() => {
    if (!open || counts) return
    fetch('/api/paco').then(r => r.json()).then(j => { if (j?.counts) setCounts(j.counts) }).catch(() => {})
  }, [open, counts])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [turns, busy])

  async function ask(text: string) {
    const said = text.trim()
    if (!said || busy) return
    setQ('')
    setTurns(t => [...t, { mine: true, text: said }])
    setBusy(true)
    try {
      const res = await fetch(`/api/paco?q=${encodeURIComponent(said)}`)
      const j = await res.json()
      if (!res.ok) setTurns(t => [...t, { mine: false, error: j?.error || 'I could not reach the deals.' }])
      else { setTurns(t => [...t, { mine: false, a: j as Answer }]); if (j?.counts) setCounts(j.counts) }
    } catch {
      setTurns(t => [...t, { mine: false, error: 'I could not reach the deals just then.' }])
    } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Ask Paco"
        className="fixed right-5 bottom-5 z-40 w-[58px] h-[58px] rounded-full bg-card border border-card-line
                   shadow-[0_10px_26px_rgba(0,0,0,0.2)] flex items-center justify-center hover:scale-105 transition">
        <Bird size={44} />
      </button>
    )
  }

  return (
    <div className="fixed right-5 bottom-5 z-40 w-[420px] max-w-[calc(100vw-2rem)]
                    max-h-[calc(100vh-3rem)] bg-card border border-card-line rounded-2xl
                    shadow-[0_20px_50px_rgba(0,0,0,0.26)] flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#0F1115] text-white">
        <Bird size={30} />
        <div className="min-w-0">
          <b className="text-[13.5px] block leading-tight">Paco</b>
          <span className="text-[10.5px] text-white/55">Repeats. Never invents.</span>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close Paco"
          className="ml-auto text-white/55 hover:text-white text-[17px] leading-none">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 bg-panel">
        <Bubble>
          {HOLA}
          {counts && counts.tagged === 0 && (
            <p className="text-[11px] text-faint mt-1.5 leading-snug">
              No deal has been tagged yet, so there is not much I can answer. Tag one on its
              Lending Options tab and I will remember it.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SUGGEST.map(s => (
              <button key={s} onClick={() => ask(`Who have we used for ${s.toLowerCase()}?`)}
                className="text-[11.5px] text-info bg-info-bg border border-info-edge rounded-full px-2.5 py-1">
                {s}
              </button>
            ))}
          </div>
        </Bubble>

        {turns.map((t, i) => t.mine ? (
          <div key={i} className="flex justify-end mb-3">
            <div className="bg-[#0F1115] text-white/90 rounded-[14px_14px_4px_14px] px-3 py-2 text-[12.5px] max-w-[290px]">
              {t.text}
            </div>
          </div>
        ) : (
          <Bubble key={i}>{t.error ? <span className="text-chase">{t.error}</span> : <Said a={t.a!} />}</Bubble>
        ))}

        {busy && <Bubble><span className="text-faint text-[12.5px]">&hellip;</span></Bubble>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line-soft p-2.5 bg-card">
        <div className="flex items-center gap-2 border border-card-line rounded-full px-3 py-1.5">
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(q) }}
            placeholder="Ask Paco something…" aria-label="Ask Paco something"
            className="flex-1 min-w-0 text-[12.5px] bg-transparent focus:outline-none" />
          <button onClick={() => ask(q)} disabled={busy || !q.trim()} aria-label="Ask"
            className="w-[22px] h-[22px] rounded-full bg-brand text-white text-[12px] font-bold
                       flex items-center justify-center disabled:opacity-40">&uarr;</button>
        </div>
        <p className="text-[10px] text-faint text-center mt-1.5">
          Policies &middot; BDM notes &middot; our own deals. Nothing else.
        </p>
      </div>
    </div>
  )
}

function Bubble({ children }: { children: any }) {
  return (
    <div className="flex gap-2 mb-3 items-start">
      <Bird size={26} />
      <div className="bg-card border border-line-soft rounded-[14px_14px_14px_4px] px-3 py-2
                      text-[12.5px] text-body max-w-[330px] leading-[1.55]">{children}</div>
    </div>
  )
}

// WHAT HE SAYS, DRAWN FROM THE ANSWER AND NOTHING ELSE.
//
// There is no branch here that writes a claim about a lender. Every string is
// either a field off a deal or one of Paco's own lines from lib/paco.ts.
function Said({ a }: { a: Answer }) {
  const total = a.lenders.reduce((t, l) => t + l.deals.length, 0)
  const names = (x: string[]) => x.map(s => s.toLowerCase()).join(', ')

  return (
    <>
      {a.kind === 'found' && (
        <>
          <div className="font-semibold text-ink">
            &iexcl;Eso! {total} deal{total === 1 ? '' : 's'} tagged {names(a.asked)}.
          </div>
          <div className="text-[10.5px] text-faint mt-0.5">From our own deals.</div>

          {a.lenders.map(l => (
            <div key={l.lender} className="border border-line-soft rounded-[10px] p-2 mt-2 bg-panel">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[12.5px] font-[650] text-ink">{l.lender}</span>
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wide rounded-full px-2 py-[2px]
                                 bg-done-bg text-done border border-done-edge">
                  {l.deals.length} deal{l.deals.length === 1 ? '' : 's'}
                </span>
              </div>
              {l.deals.map((d, i) => (
                <div key={i} className="text-[11.5px] text-muted py-[1px]">
                  <b className="text-ink font-semibold">{d.when || 'date not recorded'}</b>
                  {' · '}{d.outcome}
                  {d.alsoTagged.length > 0 && <> {' · '}also {names(d.alsoTagged)}</>}
                </div>
              ))}
            </div>
          ))}

          {a.alsoConsidered.length > 0 && (
            <p className="text-[11.5px] text-muted mt-2">
              {a.alsoConsidered.join(', ')} {a.alsoConsidered.length === 1 ? 'was' : 'were'} compared
              and not chosen.
            </p>
          )}
        </>
      )}

      {a.kind !== 'found' && (
        <>
          <div className="text-[22px] font-bold text-[#0B4C3F] leading-tight">
            {a.kind === 'none_tagged' ? 'Nada — yet.' : 'Nada.'}
          </div>
          <div className="text-[12.5px] font-semibold text-ink mt-0.5">
            {a.kind === 'none_tagged'
              ? <>No deal has been tagged {names(a.asked)}.</>
              : <>I&rsquo;ve got nothing on that &mdash; and I don&rsquo;t invent.</>}
          </div>
          {a.kind === 'none_tagged' && (
            <p className="text-[11.5px] text-faint mt-1.5 leading-snug">
              That does not mean we have never done one. It means nobody has tagged one yet.
            </p>
          )}
          {a.kind === 'not_understood' && (
            <p className="text-[11.5px] text-faint mt-1.5 leading-snug">
              Right now I can only answer from deals somebody has tagged, so I only know the
              words on those tags.
            </p>
          )}
          <div className="border border-line-soft rounded-[10px] p-2 mt-2 bg-card">
            <div className="text-[9px] font-bold uppercase tracking-wider text-faint mb-1">What I can see</div>
            <Count n={a.counts.tagged} what="deals tagged" />
            <Count n={a.counts.untagged} what="deals not tagged yet" />
            <Count n={a.counts.policies} what="lender policies loaded" />
            <Count n={a.counts.bdmNotes} what="BDM notes" />
          </div>
        </>
      )}

      {a.missing.length > 0 && (
        <p className="text-[11px] text-faint mt-2 leading-snug border-t border-line-soft pt-1.5">
          {a.missing.includes('policy') && a.missing.includes('bdm')
            ? 'I have no lender policy and no BDM note on this.'
            : a.missing.includes('policy') ? 'I have no lender policy on this.' : 'I have no BDM note on this.'}
        </p>
      )}
    </>
  )
}

function Count({ n, what }: { n: number; what: string }) {
  return (
    <div className="flex gap-2 text-[11.5px] text-muted py-[1px]">
      <span className="font-bold text-ink min-w-[22px] text-right">{n}</span>{what}
    </div>
  )
}
