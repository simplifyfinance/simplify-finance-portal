'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { TAG_GROUPS } from '@/lib/deal-tags'
import {
  NOTHING_UNUSUAL, EASIER, WHY, empty, tidy, saidSomething, whatPacoKeeps, theShortVersion,
  whatIsMissing, readyToSend, type Handover as Note, type Stage,
} from '@/lib/handover-notes'

// THE BOX THAT POPS WHEN CREDIT HANDS A DEAL OVER.
//
// 13 Oct 2026, asked for by Fabio's team. The free note is for the broker and
// Paco never reads a word of it. The taps underneath are the only part he sees,
// and they are taps rather than typing because the alternative - a "what made
// this deal hard" section sitting on the lending options - is a chore, and
// Fabio threw that version out for exactly that reason.
//
// THE BOXES GET ANSWERED. There is no way past this.
//
// 13 Oct 2026. The first version had a "Send without notes" button, which I
// put there on my own reasoning and nobody asked for. Fabio: "I never heard of
// it we never discussed so NO they need to fucking answer the boxes."
//
// The explanation that used to go in the email is the whole point of this
// screen. An opt-out means it goes back to not happening. What is required is
// small and honest - a sentence, and the one question this stage can answer -
// and "Nothing unusual" is a real answer so nobody has to invent a difficulty
// to get on with their day.

const CHIP = 'text-[11.5px] rounded-full px-2.5 py-1 border transition'
const OFF = 'border-card-line bg-page text-body hover:bg-card'
const ON_W = 'border-waiting-edge bg-waiting-bg text-waiting font-semibold'
const ON_I = 'border-info-edge bg-info-bg text-info font-semibold'
const BTN = 'text-[12px] border border-card-line bg-card rounded-lg px-3 py-1.5 text-body hover:bg-page transition'
const INP = 'w-full border border-line rounded-[10px] px-3 py-2.5 text-[12.5px] text-ink leading-relaxed bg-card focus:outline-none focus:border-brand'

function Chips({ all, picked, pick, tone = 'w' }: {
  all: readonly string[]; picked: string[]; pick: (v: string) => void; tone?: 'w' | 'i'
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {all.map(c => (
        <button key={c} type="button" onClick={() => pick(c)}
          className={`${CHIP} ${picked.includes(c) ? (tone === 'i' ? ON_I : ON_W) : OFF}`}>
          {c}
        </button>
      ))}
    </div>
  )
}

function Q({ title, why, children }: { title: string; why: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line-soft pt-3.5 mb-3.5">
      <b className="block text-[12.5px] text-ink">{title}</b>
      <span className="block text-[11px] text-muted mb-2 leading-relaxed">{why}</span>
      {children}
    </div>
  )
}

export default function HandoverBox({ dealId, stage, lenders, toWhom, onSent, onCancel }: {
  dealId: string
  stage: Stage
  /** The lenders on this deal, for the lending options handover. */
  lenders: string[]
  /** The broker's first name, so the box says who is getting it. */
  toWhom: string
  /** Called once the note is written down - the caller then does the handover. */
  onSent: () => void
  onCancel: () => void
}) {
  const supabase = createSupabaseBrowser()
  const [h, setH] = useState<Note>(empty(stage))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { setH(empty(stage)) }, [stage])

  const toggle = (key: 'hard' | 'easier') => (v: string) =>
    setH(x => ({ ...x, [key]: x[key].includes(v) ? x[key].filter(y => y !== v) : [...x[key], v] }))

  const toggleWhy = (lender: string) => (v: string) => setH(x => {
    const had = x.why[lender] || []
    return { ...x, why: { ...x.why, [lender]: had.includes(v) ? had.filter(y => y !== v) : [...had, v] } }
  })

  async function send() {
    if (busy) return
    const clean0 = tidy(h, lenders)
    if (!readyToSend(clean0, lenders)) return
    setBusy(true); setErr('')
    try {
      const clean = clean0
      if (saidSomething(clean)) {
        const { data: me } = await supabase.auth.getUser()
        const uid = me?.user?.id
        if (!uid) { setErr('You are not signed in.'); setBusy(false); return }
        const byName = (me?.user?.user_metadata as any)?.full_name || me?.user?.email || ''

        const { error } = await supabase.from('deal_handovers').insert({
          deal_id: dealId, stage: clean.stage, note: clean.note,
          hard: clean.hard, easier: clean.easier, why: clean.why,
          surprise: clean.surprise, surprise_lender: clean.surpriseLender,
          surprise_tier: clean.surpriseTier,
          said_by: uid, said_by_name: byName,
        })
        if (error) {
          const missing = /relation .* does not exist/i.test(error.message)
          setErr(missing
            ? 'The handover notes table is not set up yet. Run docs/handover-notes-schema.sql in Supabase.'
            : `That was not written down — ${error.message}`)
          setBusy(false); return
        }

        // AND THE ONE THING THAT BECOMES KNOWLEDGE. Its own row, its own name
        // and date, against the bank - never the client, never the deal.
        const keep = whatPacoKeeps(clean)
        if (keep) {
          await fetch('/api/paco', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lender: keep.lender, said: keep.said, tier: keep.tier,
              source: `Noticed on a deal, ${new Date().toLocaleDateString('en-AU')}`,
            }),
          }).catch(() => {})
        }
      }
      onSent()
    } finally { setBusy(false) }
  }

  const bc = stage === 'bc'
  const what = bc ? 'borrowing capacity' : 'lending options'
  const missing = whatIsMissing(tidy(h, lenders), lenders)

  return (
    <div className="fixed inset-0 z-50 bg-ink/45 flex items-start justify-center p-6 overflow-y-auto">
      <div className="bg-card rounded-2xl w-[600px] max-w-full shadow-[0_24px_64px_rgba(0,0,0,0.32)] overflow-hidden">
        <div className="px-5 pt-4">
          <h3 className="m-0 mb-1 text-[15.5px] font-bold text-ink">
            Sending the {what} to {toWhom || 'the broker'}
          </h3>
          <p className="m-0 mb-3.5 text-[12px] text-muted leading-relaxed">
            They get this the moment you send. It is internal — the client never sees it,
            and it is not compliance.
          </p>
        </div>

        <div className="px-5">
          <span className="block text-[10px] font-bold tracking-[.07em] uppercase text-muted mb-1.5">
            What do they need to know?
          </span>
          <textarea value={h.note} onChange={e => setH(x => ({ ...x, note: e.target.value }))}
            className={`${INP} min-h-[92px] resize-y`}
            placeholder={bc
              ? 'e.g. Capacity is really tight, we are short at the majors so I have focused on the smaller banks.'
              : 'e.g. I have led with Bankwest because they take the one year in isolation. Sell Bankwest.'} />
          <p className="mt-1.5 mb-4 text-[11px] text-faint leading-relaxed">
            For the broker. Nobody reads this but the team, and Paco never sees a word of it.
          </p>

          {bc ? (
            <>
              <Q title="Was anything hard about this one?"
                 why="Tap what applies — and Nothing unusual is a real answer. This is the only part Paco sees, and it is what makes him useful on the next deal like it.">
                {/* GROUPED, BECAUSE THE LIST GOT LONGER.
                  *
                  * 14 Oct 2026. These words came off the Lending Options tab
                  * when that duplicate question was deleted. There are 28 of
                  * them, and 28 chips in one wall is unreadable - so they keep
                  * the headings they already had on the tab they came from. */}
                {TAG_GROUPS.map(g => (
                  <div key={g.group} className="mb-2">
                    <div className="text-[9.5px] font-bold tracking-[.08em] uppercase text-faint mb-1.5">{g.group}</div>
                    <Chips all={g.tags} picked={h.hard} pick={toggle('hard')} />
                  </div>
                ))}
                {/* The honest way out, kept apart from the obstacles so it does
                  * not read as one of them. */}
                <div className="border-t border-dashed border-card-line mt-1 pt-2">
                  <Chips all={[NOTHING_UNUSUAL]} picked={h.hard} pick={toggle('hard')} />
                </div>
              </Q>
              <Q title="What would have made it easier?" why="Optional. One tap, and the broker sees it too.">
                <Chips all={EASIER} picked={h.easier} pick={toggle('easier')} />
              </Q>
            </>
          ) : (
            <>
              <Q title="Why these lenders?" why="One tap each. Paco counts these — he never repeats them as a reason.">
                {lenders.length === 0 && (
                  <p className="m-0 text-[12px] text-faint">No lenders on this deal yet.</p>
                )}
                {lenders.map(l => (
                  <div key={l} className="border border-card-line rounded-[10px] px-3 py-2.5 mb-1.5 bg-card">
                    <b className="block text-[12.5px] mb-2">{l}</b>
                    <Chips all={WHY} picked={h.why[l] || []} pick={toggleWhy(l)} tone="i" />
                  </div>
                ))}
              </Q>
              <Q title="Anything a lender did that surprised you?"
                 why="Optional, and the most valuable box on this screen. One sentence, about the bank — never about the clients.">
                <textarea value={h.surprise} onChange={e => setH(x => ({ ...x, surprise: e.target.value }))}
                  className={`${INP} min-h-[56px] resize-y mb-2`}
                  placeholder="e.g. Took the one year in isolation on a 3 year ABN — BDM confirmed first." />
                {h.surprise.trim() && (
                  <>
                    <span className="block text-[11px] text-muted mb-1.5">Which bank?</span>
                    <Chips all={lenders} picked={h.surpriseLender ? [h.surpriseLender] : []}
                      pick={v => setH(x => ({ ...x, surpriseLender: x.surpriseLender === v ? '' : v }))} />
                    <span className="block text-[11px] text-muted mt-2.5 mb-1.5">Where is it from?</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {([['B', 'The BDM, in writing'], ['D', 'We have seen it on a deal']] as const).map(([t, label]) => (
                        <button key={t} type="button" onClick={() => setH(x => ({ ...x, surpriseTier: t }))}
                          className={`${CHIP} ${h.surpriseTier === t ? ON_W : OFF}`}>{label}</button>
                      ))}
                    </div>
                  </>
                )}
              </Q>
            </>
          )}
          {err && <p className="mb-3 text-[12px] text-chase">{err}</p>}
        </div>

        <div className="flex gap-2 items-center px-5 py-3 bg-page border-t border-line-soft flex-wrap">
          <span className="flex-1 min-w-[200px] text-[11px] leading-relaxed">
            {missing.length > 0 ? (
              /* WHAT IS LEFT, NAMED. A greyed-out button with no reason beside
                 it is the thing people complain about, so it says exactly
                 which box is still empty. */
              <span className="text-chase">Still to answer: {missing.join(', ')}.</span>
            ) : (
              <span className="text-muted">
                Goes with your name and today&rsquo;s date. Nothing about the clients reaches Paco —
                only the bank and what it did.
              </span>
            )}
          </span>
          <button type="button" onClick={onCancel} className={BTN} disabled={busy}>Back</button>
          <button type="button" onClick={send} disabled={busy || missing.length > 0}
            className="text-[12px] bg-ink text-page rounded-lg px-3.5 py-1.5 font-medium disabled:opacity-40">
            {busy ? 'Sending…' : `Send to ${toWhom || 'the broker'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// WHAT THE BROKER OPENS.
//
// The note first, because that is what they need. The taps underneath, because
// the short version of "why Bankwest" is worth reading before they ring a client.
export function HandoverNotes({ dealId }: { dealId: string }) {
  const supabase = createSupabaseBrowser()
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    let alive = true
    supabase.from('deal_handovers')
      .select('id, stage, note, hard, easier, why, surprise, surprise_lender, said_by_name, created_at')
      .eq('deal_id', dealId).order('created_at', { ascending: false })
      .then(({ data }) => { if (alive) setRows(data || []) })
    return () => { alive = false }
  }, [dealId, supabase])

  if (rows.length === 0) return null
  const when = (s: any) => {
    const d = new Date(String(s || ''))
    return isNaN(d.getTime()) ? '' : d.toLocaleString('en-AU',
      { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="mb-3">
      {rows.map(r => {
        const short = theShortVersion(tidy({
          stage: r.stage, hard: r.hard, easier: r.easier, why: r.why,
        }, Object.keys(r.why || {})))
        return (
          <div key={r.id} className="mb-2 border-l-[3px] border-info bg-info-bg rounded-r-xl px-4 py-3">
            <b className="block text-[12.5px] text-ink mb-1">
              {r.said_by_name || 'Credit'} sent you the {r.stage === 'bc' ? 'borrowing capacity' : 'lending options'}
            </b>
            {r.note && (
              <p className="m-0 text-[12.5px] text-body leading-relaxed">&ldquo;{r.note}&rdquo;</p>
            )}
            {short && <p className="m-0 mt-1.5 text-[12px] text-body leading-relaxed">{short}.</p>}
            {r.surprise && (
              <p className="m-0 mt-1.5 text-[12px] text-body leading-relaxed">
                <b className="text-ink">{r.surprise_lender}:</b> {r.surprise}
              </p>
            )}
            <span className="block text-[11px] text-faint mt-1.5">
              {r.said_by_name || 'Credit'} · {when(r.created_at)} · internal, the client never sees this
            </span>
          </div>
        )
      })}
    </div>
  )
}
