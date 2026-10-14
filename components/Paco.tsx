'use client'
import { useEffect, useRef, useState } from 'react'
import { tierLabel, isOfficial, attribution, caveatFor, TYPEABLE_TIERS, type TypeableTier } from '@/lib/paco-knowledge'
import { HOLA, type Answer } from '@/lib/paco'
import { sourceOf, NOTE_BESIDE_POLICY, type Answer as PolicyAnswer } from '@/lib/paco-answers-from-policy'
import { type SectionAnswer, type FoundSection } from '@/lib/paco-reads-the-section'
import { citation, leansOn } from '@/lib/policy-rules'
import { offeringToTell, YES_TELL_ME, NOT_THE_LIBRARY } from '@/lib/paco-takes-a-note'

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

type Turn = { mine: boolean; text?: string; a?: Answer; error?: string; offer?: boolean }

const SUGGEST = ['Limited title', 'Casual income', 'SMSF', 'Construction']

export default function Paco() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [counts, setCounts] = useState<Answer['counts'] | null>(null)
  const [telling, setTelling] = useState(false)
  // Which bank the note starts against, when he asked and you said yes.
  const [tellAbout, setTellAbout] = useState('')
  const startTelling = (lender: string) => { setTellAbout(lender); setTelling(true) }
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

    // BEING OFFERED SOMETHING IS NOT BEING ASKED SOMETHING.
    //
    // 13 Oct 2026. Fabio typed "Can I give you the answer and you file on
    // library?" and Paco matched the word savings and handed back an unrelated
    // NAB rule. He was offered knowledge and went looking for it instead.
    //
    // Checked here, before the question is sent anywhere, so he cannot answer
    // over the top of somebody trying to help him. No model, no guessing about
    // lending - just who was doing the telling. See lib/paco-takes-a-note.ts.
    if (offeringToTell(said).offered) {
      setTurns(t => [...t, { mine: false, offer: true }])
      startTelling(offeringToTell(said, []).lender)
      return
    }

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
      <button type="button" onClick={() => setOpen(true)}
        aria-label={turns.length ? 'Open Paco - he is holding a conversation' : 'Ask Paco'}
        className="fixed right-5 bottom-5 z-40 w-[58px] h-[58px] rounded-full bg-card border border-card-line
                   shadow-[0_10px_26px_rgba(0,0,0,0.2)] flex items-center justify-center hover:scale-105 transition">
        <Bird size={44} />
        {/* MINIMISED HOLDING SOMETHING, OR MINIMISED EMPTY. Without this they
            are the same circle, and the only way to find out is to open him. */}
        {turns.length > 0 && (
          <span aria-hidden
            className="absolute top-0.5 right-0.5 w-[13px] h-[13px] rounded-full bg-info border-2 border-card" />
        )}
      </button>
    )
  }

  return (
    // BIG ENOUGH TO READ. Fabio, 12 Oct 2026: "I like the box just need the pop
    // up box to be slighlty larger hard to read on current size", and again the
    // same night when it had not changed - the first time I sized the move-on
    // dialog instead, which was the box on screen when he asked, not the box he
    // meant.
    //
    // 560 rather than 420 - Fabio tried the middle size on 13 Oct and asked for
    // the biggest of the three. A floor under the height so an empty Paco is
    // the same shape as a full one, and the type a point larger throughout. The
    // max-width and max-height still win on a small screen, so it can never be
    // taller or wider than the window.
    <div className="fixed right-5 bottom-5 z-40 w-[560px] max-w-[calc(100vw-2rem)]
                    h-[620px] max-h-[calc(100vh-3rem)] bg-card border border-card-line rounded-2xl
                    shadow-[0_20px_50px_rgba(0,0,0,0.26)] flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#0F1115] text-white">
        <Bird size={30} />
        <div className="min-w-0">
          <b className="text-[13.5px] block leading-tight">Paco</b>
          <span className="text-[10.5px] text-white/55">Repeats. Never invents.</span>
        </div>
        {/* A MINUS, BECAUSE THAT IS WHAT IT DOES.
            *
            * Paco is in the app layout, so he never unmounts while you move
            * between deals - closing him only swapped the panel for the bubble
            * and the conversation was still sitting there. A cross means
            * discard everywhere else, so nobody believed it had survived and
            * nobody tried. Fabio, 13 Oct 2026: "if we close pco is opens on the
            * last chat or should we have a minus button to be safe".
            *
            * AND A MINUS NEEDS A WAY OUT. If hiding never clears it, a
            * conversation never ends - you would scroll past Tuesday to find
            * today. Start again is the only honest companion to a minus.
            *
            * NOTHING IS STORED. The conversation is state in this one browser
            * window: it does not reach the server, it does not reach anybody
            * else, and a refresh clears it. Two people on the same deal get
            * their own. That is also why it is not restored after a refresh -
            * restoring it would mean keeping it somewhere, and somewhere is
            * where it could end up in front of the wrong person. */}
        <div className="ml-auto flex items-center gap-1">
          {turns.length > 0 && (
            <button onClick={() => { setTurns([]); setTelling(false); setTellAbout('') }}
              className="text-[11px] text-white/60 hover:text-white border border-white/20
                         hover:border-white/40 rounded-md px-2 py-[3px] transition">
              Start again
            </button>
          )}
          <button onClick={() => setOpen(false)} aria-label="Minimise Paco"
            title="Minimise. Your conversation is kept."
            className="text-white/55 hover:text-white text-[17px] leading-none font-bold px-1.5">&minus;</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 bg-panel">
        <Bubble>
          {HOLA}
          {counts && counts.tagged === 0 && (
            <p className="text-[12.5px] text-faint mt-1.5 leading-snug">
              No deal has been tagged yet, so there is not much I can answer. Tag one on its
              Lending Options tab and I will remember it.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SUGGEST.map(s => (
              <button key={s} onClick={() => ask(`Who have we used for ${s.toLowerCase()}?`)}
                className="text-[13px] text-info bg-info-bg border border-info-edge rounded-full px-2.5 py-1">
                {s}
              </button>
            ))}
          </div>
        </Bubble>

        {turns.map((t, i) => t.mine ? (
          <div key={i} className="flex justify-end mb-3">
            <div className="bg-[#0F1115] text-white/90 rounded-[14px_14px_4px_14px] px-3 py-2 text-[14.5px] max-w-[390px]">
              {t.text}
            </div>
          </div>
        ) : (
          <Bubble key={i}>
            {t.offer ? (
              <>
                <p className="m-0 text-[14.5px] text-ink leading-snug">{YES_TELL_ME}</p>
                <p className="m-0 mt-1.5 text-[12.5px] text-muted leading-relaxed">{NOT_THE_LIBRARY}</p>
              </>
            ) : t.error ? <span className="text-chase">{t.error}</span> : <Said a={t.a!} onTell={startTelling} />}
          </Bubble>
        ))}

        {busy && <Bubble><span className="text-faint text-[14.5px]">&hellip;</span></Bubble>}
        <div ref={endRef} />
      </div>

      {telling && <Tell about={tellAbout} onDone={() => { setTelling(false); setTellAbout(''); setCounts(null) }} />}

      <div className="border-t border-line-soft p-2.5 bg-card">
        <div className="flex items-center gap-2 border border-card-line rounded-full px-3 py-1.5">
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(q) }}
            placeholder="Ask Paco something…" aria-label="Ask Paco something"
            className="flex-1 min-w-0 text-[14.5px] bg-transparent focus:outline-none" />
          <button onClick={() => ask(q)} disabled={busy || !q.trim()} aria-label="Ask"
            className="w-[22px] h-[22px] rounded-full bg-brand text-white text-[12px] font-bold
                       flex items-center justify-center disabled:opacity-40">&uarr;</button>
        </div>
        <p className="text-[10.5px] text-faint text-center mt-1.5">
          Policies &middot; what you tell me &middot; our own deals. Nothing else.
          {' '}
          <button onClick={() => startTelling('')} className="text-info underline">Tell me something</button>
        </p>
      </div>
    </div>
  )
}

// WHAT THE TEAM HAS TOLD HIM, WORD FOR WORD.
//
// The note is reproduced exactly as it was typed. It is never shortened, never
// tidied, never blended with the one below it - the moment Paco starts writing
// about lending he stops being a parrot. The only thing around it is the stamp:
// who, when, and how firm. See lib/paco-knowledge.ts.
function Notes({ a }: { a: Answer }) {
  const notes = a.notes || []
  if (notes.length === 0) return null
  return (
    <div className="mt-2">
      <div className="text-[10.5px] text-faint mb-1">
        {notes.length === 1 ? 'Someone here told me:' : `${notes.length} things the team has told me:`}
      </div>
      {a.notesDisagree && (
        <div className="text-[11px] text-chase bg-chase-bg border border-chase-edge rounded-[8px] px-2 py-1.5 mb-1.5">
          These do not agree with each other. Both are below &mdash; I am not picking one.
        </div>
      )}
      {notes.map(n => (
        <div key={n.id} className="border border-line-soft rounded-[10px] p-2 mb-1.5 bg-panel">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[12.5px] font-[650] text-ink">{n.lender}</span>
            <span className={`ml-auto text-[9px] font-bold uppercase tracking-wide rounded-full px-2 py-[2px] border ${
              isOfficial(n.tier) ? 'bg-done-bg text-done border-done-edge'
                                 : 'bg-info-bg text-info border-info-edge'}`}>
              {tierLabel(n.tier)}
            </span>
          </div>
          {/* Quoted, so it can never read as Paco's own sentence. */}
          <div className="text-[14px] text-ink leading-[1.5]">&ldquo;{n.said}&rdquo;</div>
          <div className="text-[10.5px] text-faint mt-1">{attribution(n)}</div>
          {n.source && <div className="text-[10.5px] text-faint">{n.source}</div>}
          {caveatFor(n) && <div className="text-[10.5px] text-chase mt-0.5">{caveatFor(n)}</div>}
        </div>
      ))}
    </div>
  )
}

// TELLING PACO SOMETHING. Anyone, any time, live the moment it is saved.
function Tell({ onDone, about }: { onDone: () => void; about?: string }) {
  const [lender, setLender] = useState(about || '')
  const [said, setSaid] = useState('')
  const [tier, setTier] = useState<TypeableTier>('D')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!lender.trim() || !said.trim() || saving) return
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/paco', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lender: lender.trim(), said: said.trim(), tier, source: source.trim() }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j?.error || 'I could not write that down.'); setSaving(false); return }
      onDone()
    } catch { setErr('I could not write that down just then.'); setSaving(false) }
  }

  const inp = 'w-full text-[12.5px] border border-card-line rounded-lg px-2.5 py-1.5 bg-card focus:outline-none focus:border-brand'
  return (
    <div className="p-3 bg-panel border-t border-line-soft">
      <div className="text-[11.5px] text-muted mb-2">
        Tell me something and I will repeat it, with your name on it.
      </div>
      <input className={inp + ' mb-1.5'} value={lender} onChange={e => setLender(e.target.value)}
        placeholder="Which lender" aria-label="Which lender" />
      <textarea className={inp + ' mb-1.5 min-h-[62px] resize-y'} value={said} onChange={e => setSaid(e.target.value)}
        placeholder="What do you know? I will quote this exactly." aria-label="What do you know" />
      <div className="flex gap-1.5 mb-1.5">
        {TYPEABLE_TIERS.map(t => (
          <button key={t} type="button" onClick={() => setTier(t)}
            className={`text-[11px] rounded-full px-2.5 py-1 border ${tier === t
              ? 'bg-ink text-page border-ink' : 'border-card-line text-muted'}`}>
            {tierLabel(t)}
          </button>
        ))}
      </div>
      <input className={inp} value={source} onChange={e => setSource(e.target.value)}
        placeholder="Where from? e.g. email from BDM John, 3 Oct" aria-label="Where from" />
      {err && <div className="text-[11px] text-chase mt-1.5">{err}</div>}
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="text-[12px] text-muted px-3 py-1.5">Cancel</button>
        <button onClick={save} disabled={saving || !lender.trim() || !said.trim()}
          className="ml-auto text-[12px] bg-ink text-page rounded-lg px-3.5 py-1.5 font-medium disabled:opacity-40">
          {saving ? 'Writing it down…' : 'Tell Paco'}
        </button>
      </div>
    </div>
  )
}

function Bubble({ children }: { children: any }) {
  return (
    <div className="flex gap-2 mb-3 items-start">
      <Bird size={26} />
      <div className="bg-card border border-line-soft rounded-[14px_14px_14px_4px] px-3 py-2
                      text-[14.5px] text-body max-w-[430px] leading-[1.55]">{children}</div>
    </div>
  )
}

// WHAT HE SAYS, DRAWN FROM THE ANSWER AND NOTHING ELSE.
//
// There is no branch here that writes a claim about a lender. Every string is
// either a field off a deal or one of Paco's own lines from lib/paco.ts.
// THE LENDER'S OWN POLICY, SAID FIRST AND QUOTED.
//
// 13 Oct 2026. It outranks our deals and our notes - blueprint section 2 - so
// it is at the top. And it is QUOTED, not described: the sentence or the table
// row it came out of, with the section, so the person asking can open the
// manual at that section and read it themselves.
//
// A citation you cannot open is not a citation, and a paraphrase with a section
// number beside it is the dangerous output - it reads exactly like one.
// SOMEBODY READ IT AND IT IS WRONG.
//
// 13 Oct 2026. The review list is gone - a line read out of a document is in,
// and the sentence it came from sits under every answer. That quote is the
// check, and this is what happens when the check fails.
//
// It is deliberately the only correction there is, and it lives where the
// mistake is found rather than in a queue. One click, by somebody who was
// already reading it, with their name and the time on it. The line is never
// deleted and never edited: it stops answering, and stays readable.
function Wrong({ id, what }: { id: string; what: 'line' | 'note' }) {
  const [gone, setGone] = useState(false)
  const [busy, setBusy] = useState(false)
  if (gone) {
    return (
      <div className="text-[10.5px] text-muted mt-1.5">
        Gone, with your name and the time on it. It stays readable, it just stops answering.
      </div>
    )
  }
  return (
    <button type="button" disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await fetch('/api/paco', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(what === 'line' ? { wrong: id } : { retire: id, why: 'Not right any more' }),
          })
          setGone(true)
        } finally { setBusy(false) }
      }}
      className="text-[10.5px] text-muted underline mt-1.5 disabled:opacity-40">
      {what === 'line' ? 'That is not what it says' : 'That is wrong now'}
    </button>
  )
}

// THE LENDER'S OWN SECTION, WHOLE.
//
// 14 Oct 2026. The pre-chopped rules below this are four fragments that were
// separated from each other the day a document was dropped. A section is the
// thing the lender actually wrote, with its heading and its tables still
// attached, found when somebody asked.
//
// IT LEADS, because where a section exists it is the better answer. The rules
// stay underneath rather than being deleted - every lender already read has
// hundreds of them and they are still true.
function Sections({ s }: { s: SectionAnswer | null | undefined }) {
  if (!s) return null
  if (s.kind === 'nothing') {
    // NOT A DEAD END. The honest next line is who does know.
    return <div className="mb-3 text-[13px] text-body leading-relaxed">{s.says}</div>
  }

  // A LOOSENED SEARCH IS NOT AN ANSWER, AND MUST NOT LOOK LIKE ONE.
  //
  // Measured 14 Oct 2026 against the real document: asked about crypto - a
  // word that appears nowhere in Macquarie's guidelines - the loose pass
  // matches "deposit" and returns the section about genuine savings. So the
  // closest sections wear the quiet treatment and the sentence above them says
  // the question was not matched, rather than the blue "what the bank wrote"
  // band that means this IS the policy.
  const near = s.kind === 'closest'
  const list: FoundSection[] = near ? s.closest : s.sections

  return (
    <div className="mb-3">
      <div className={`text-[13px] leading-relaxed mb-2 ${near ? 'text-body' : 'text-ink font-semibold'}`}>
        {s.says}
      </div>
      {list.map(x => (
        <div key={x.sectionId}
             className={near
               ? 'mb-2.5 border border-card-line bg-page rounded-[10px] px-3 py-2'
               : 'mb-2.5 border-l-[3px] border-info bg-info-bg rounded-r-[10px] px-3 py-2'}>
          <div className={`text-[9.5px] font-bold tracking-[.06em] uppercase mb-1 ${near ? 'text-faint' : 'text-info'}`}>
            {near ? 'Closest section' : 'What the bank wrote'}
          </div>
          <div className="text-[13.5px] font-semibold text-ink leading-snug">
            {x.number ? `${x.number} ${x.title}` : x.title}
            {x.part && <span className="font-normal text-faint"> (part {x.part})</span>}
          </div>
          {/* THE SECTION'S OWN WORDS, AND NOTHING ELSE. whitespace-pre-wrap
              because the line breaks are the lender's - a table flattened into
              a paragraph is how two numbers get swapped. */}
          <div className="text-[13px] text-body leading-[1.55] mt-1.5 whitespace-pre-wrap">{x.body}</div>
          {x.path && x.path !== x.title && (
            <div className="text-[10.5px] text-faint mt-1.5">{x.path}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function Policy({ p }: { p: PolicyAnswer | null | undefined }) {
  if (!p) return null
  if (p.policy.length === 0 && p.coming.length === 0) return null
  return (
    <div className="mb-3">
      {p.policy.map((r: any) => {
        const src = sourceOf(r)
        // AN UNCHECKED LINE ANSWERS, AND SAYS SO. It is the bank's own
        // sentence either way; what nobody has done is read it back against
        // the document. That is a fact about us, not about the rule, and it
        // belongs on the answer rather than in the way of it.
        return (
          <div key={r.id} className="mb-2.5 border-l-[3px] border-info bg-info-bg rounded-r-[10px] px-3 py-2">
            <div className="text-[9.5px] font-bold tracking-[.06em] uppercase text-info mb-1">
              {r.lenderName ? `${r.lenderName} — what the bank wrote` : 'What the bank wrote'}
            </div>
            <div className="text-[13.5px] font-semibold text-ink leading-snug">{r.says}</div>
            {src && 'quote' in src && (
              <div className="text-[13px] text-body leading-[1.55] mt-1.5">&ldquo;{src.quote}&rdquo;</div>
            )}
            {src && 'cells' in src && (
              <table className="text-[12.5px] text-body mt-1.5">
                <tbody>
                  {src.headers.map((h: string, i: number) => (
                    <tr key={i}>
                      <td className="pr-4 py-[1px] text-faint align-top whitespace-nowrap">{h}</td>
                      <td className="py-[1px] align-top">{src.cells[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(r.excludes || []).length > 0 && (
              <ul className="text-[12px] text-body mt-1.5 mb-0 pl-4">
                {r.excludes.map((x: string, i: number) => <li key={i}>not {x}</li>)}
              </ul>
            )}
            <div className="text-[10.5px] text-faint mt-1.5">
              {citation(r, r.lenderName ? `${r.lenderName}'s policy` : 'the lender document')}
              {leansOn(r).length > 0 && ` — also read ${leansOn(r).join(', ')}`}
            </div>
            {/* THE ONLY CORRECTION THERE IS, and it is used in anger rather
                than in bulk. Nobody goes hunting for things to fix; you fix it
                when you trip over it, while you are already reading the quote
                that shows it is wrong. Your name and the time go on it. */}
            <Wrong id={r.id} what="line" />
          </div>
        )
      })}

      {/* LENDERS ANNOUNCE IN OCTOBER FOR NOVEMBER. Held, and said - "nothing
          recorded" and "one starts in three weeks" are different answers. */}
      {p.coming.map((r: any) => (
        <div key={r.id} className="mb-2.5 border-l-[3px] border-waiting bg-waiting-bg rounded-r-[10px] px-3 py-2">
          <div className="text-[9.5px] font-bold tracking-[.06em] uppercase text-waiting mb-1">
            Starts {String(r.effectiveFrom || '').slice(0, 10)}
          </div>
          <div className="text-[13px] text-ink leading-snug">{r.says}</div>
          <div className="text-[10.5px] text-faint mt-1">Not in force yet. Today&rsquo;s answer is above.</div>
        </div>
      ))}

      {/* OUR OWN EXPERIENCE NEVER SILENTLY OVERWRITES THE POLICY. It is shown
          with it and said to be ours. */}
      {p.disagrees && (
        <div className="text-[11.5px] text-muted mb-1.5">{NOTE_BESIDE_POLICY}</div>
      )}
    </div>
  )
}

function Said({ a, onTell }: { a: Answer; onTell: (lender: string) => void }) {
  const total = a.lenders.reduce((t, l) => t + l.deals.length, 0)
  const names = (x: string[]) => x.map(s => s.toLowerCase()).join(', ')

  return (
    <>
      <Sections s={(a as any).sections} />
      <Policy p={(a as any).policy} />

      {a.kind === 'found' && total === 0 && (
        <>
          {/* A NOTE IS AN ANSWER WITH NO DEAL BEHIND IT. Somebody writing down
              what a BDM told them is the whole point of the notebook. */}
          <div className="font-semibold text-ink">
            &iexcl;Eso! Nothing in our deals, but someone has told me this.
          </div>
          <Notes a={a} />
        </>
      )}

      {a.kind === 'found' && total > 0 && (
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

          <Notes a={a} />

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
          {/* HE ASKS. THAT IS THE WHOLE THING.
              13 Oct 2026, Fabio: "Parco needs to be conversational. It needs
              to be able to reply back and say, I don't have the answer. Um,
              then maybe a box that we can tick and say, we, we do know the
              answer and then we can add it."
              The bank he was asked about comes back with the answer, so nobody
              types it in twice. */}
          <p className="text-[12.5px] text-body mt-2 leading-relaxed">
            <b className="text-ink">Do you know?</b> Tell me and I will remember it, with your
            name and the date on it.
          </p>
          <button type="button" onClick={() => onTell((a as any).askedAbout || '')}
            className="text-[12.5px] bg-ink text-page rounded-full px-3 py-1.5 font-medium mt-2">
            Yes, I know this one
          </button>

          <div className="border border-line-soft rounded-[10px] p-2 mt-2.5 bg-card">
            <div className="text-[9px] font-bold uppercase tracking-wider text-faint mb-1">What I can see</div>
            <Count n={a.counts.tagged} what="deals tagged" />
            <Count n={a.counts.untagged} what="deals not tagged yet" />
            <Count n={a.counts.policies} what="lines from lender policies" />
            <Count n={a.counts.bdmNotes} what="things the team has told me" />
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
