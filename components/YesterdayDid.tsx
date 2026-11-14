'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  STAGES_DONE, keyOf, toggleRemoved, withAdded, withoutAdded, yesterdayShown,
  type Added, type Done,
} from '@/lib/the-morning-three'
import { OFFICE } from '@/lib/same-date-everywhere'

// WHAT SHE DID YESTERDAY, AND HER CHANCE TO FIX IT.
//
// 12 Nov 2026. Fabio: "maybe there should be a button that they confirm that
// this is what they did the day before... If there's anything missing, how do
// we drag it?"
//
// The portal writes this list from what actually moved. It is right most
// mornings and wrong some of them - a stage finished late and stamped after
// midnight, a deal somebody else closed under her name, a lending options she
// did that never got marked. Until today there was no way to say so.
//
// THE SEARCH ONLY OFFERS DEALS AND STAGES. Fabio: "the definition of did is
// BC, LO, compliance... it's not like, hey, I spoke with a BDM." A day's work
// is stages finished on named deals, and keeping it to that is what makes one
// morning comparable with the next.

const CAP = 'text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted'
const SOFT = 'text-[12.5px] text-faint'
const CHIP = 'text-[11.5px] rounded-lg px-2.5 py-[2px] border border-card-line whitespace-nowrap'

export default function YesterdayDid({
  found, deals, added, removed, setAdded, setRemoved,
  savedAt, busy, onConfirm, dayWords,
}: {
  /** What the portal saw move. */
  found: Done[]
  /** Everything she could search, for the ones it missed. */
  deals: Array<{ id: string; deal_name: string }>
  added: Added[]
  removed: string[]
  setAdded: (next: Added[]) => void
  setRemoved: (next: string[]) => void
  /** When she agreed, or null. */
  savedAt: string | null
  busy: boolean
  onConfirm: () => void
  /** "Tuesday 11 November" - the day this is about. */
  dayWords: string
}) {
  const [look, setLook] = useState('')
  const shown = useMemo(() => yesterdayShown(found, added, removed), [found, added, removed])

  // AT MOST SIX, AND ONLY ONCE SHE HAS TYPED SOMETHING.
  //
  // A list of every deal in the book is not a search result, and an empty box
  // that drops open on focus hides the list underneath it.
  const hits = useMemo(() => {
    const q = look.trim().toLowerCase()
    if (q.length < 2) return []
    return (deals || [])
      .filter(d => String(d.deal_name || '').toLowerCase().includes(q))
      .slice(0, 6)
  }, [look, deals])

  const isGone = (d: Done) => removed.includes(keyOf(d.id, d.what))

  return (
    <div className={`bg-card rounded-xl px-5 py-4 mb-3 border ${
      savedAt ? 'border-done-edge' : 'border-card-line'}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={CAP}>1 &mdash; Yesterday, written from what moved</span>
        <span className="flex-1" />
        <span className={`text-[10.5px] font-bold uppercase tracking-[0.06em] ${
          savedAt ? 'text-done' : 'text-faint'}`}>
          {savedAt
            ? `✓ ${new Date(savedAt).toLocaleTimeString('en-AU', { timeZone: OFFICE, hour: 'numeric', minute: '2-digit' })}`
            : dayWords}
        </span>
      </div>

      {shown.length === 0 && found.length === 0 ? (
        <div className={SOFT}>Nothing of yours finished on {dayWords}.</div>
      ) : (
        <>
          {found.map(d => (
            <div key={keyOf(d.id, d.what)}
              className="flex items-center gap-2.5 py-[7px] border-b border-line-soft last:border-b-0">
              <span className={isGone(d) ? 'text-faint' : 'text-done'}>
                {isGone(d) ? '✕' : '✓'}
              </span>
              <Link href={`/deals/${d.id}`}
                className={`flex-1 text-[13.5px] font-semibold hover:underline truncate ${
                  isGone(d) ? 'text-faint line-through' : ''}`}>{d.name}</Link>
              <span className={SOFT}>
                {d.what} done{d.days !== null ? ` · ${d.days} days on you` : ''}
              </span>
              <button onClick={() => setRemoved(toggleRemoved(removed, d.id, d.what))}
                disabled={!!savedAt}
                className={`${CHIP} ${isGone(d) ? 'text-brand-ink font-semibold' : 'text-muted'}
                  disabled:opacity-40`}>
                {isGone(d) ? 'Put it back' : 'Not me'}
              </button>
            </div>
          ))}

          {/* HERS, UNDERNEATH, so what the portal saw and what she added are
              never confused with one another. */}
          {added.map(a => (
            <div key={keyOf(a.id, a.what)}
              className="flex items-center gap-2.5 py-[7px] border-b border-line-soft last:border-b-0">
              <span className="text-done">&#10003;</span>
              <Link href={`/deals/${a.id}`}
                className="flex-1 text-[13.5px] font-semibold hover:underline truncate">{a.name}</Link>
              <span className={SOFT}>{a.what} done &middot; added by you</span>
              <button onClick={() => setAdded(withoutAdded(added, a.id, a.what))}
                disabled={!!savedAt}
                className={`${CHIP} text-muted disabled:opacity-40`}>Take it off</button>
            </div>
          ))}
        </>
      )}

      {!savedAt && (
        <div className="mt-3">
          <input value={look} onChange={e => setLook(e.target.value)}
            placeholder="I did something else — type a client name"
            className="w-full text-[12.5px] bg-page border border-line rounded-lg px-3 py-2
              placeholder:text-faint" />
          {hits.length > 0 && (
            <div className="border border-line border-t-0 rounded-b-lg bg-card -mt-[1px]">
              {hits.map(d => (
                <div key={d.id}
                  className="flex items-center gap-2.5 px-3 py-2 border-b border-line-soft last:border-b-0">
                  <span className="flex-1 text-[13px] font-semibold truncate">{d.deal_name}</span>
                  {STAGES_DONE.map(stage => (
                    <button key={stage}
                      onClick={() => {
                        setAdded(withAdded(added, { id: d.id, name: d.deal_name, what: stage }))
                        setLook('')
                      }}
                      className="text-[11px] font-semibold rounded-md px-2.5 py-[2px] border
                        border-card-line text-muted hover:bg-page">
                      {stage === 'Lending options' ? 'LO' : stage}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2.5 items-center mt-4 flex-wrap">
        {savedAt ? (
          <span className="text-[13.5px] font-semibold text-done bg-done-bg border border-done-edge
            rounded-[10px] px-4 py-2.5">
            &#10003; That is what I did
          </span>
        ) : (
          <button onClick={onConfirm} disabled={busy}
            className="text-[14px] rounded-[10px] px-5 py-2.5 font-semibold bg-ink text-page
              disabled:opacity-40">
            {busy ? 'Saving...' : 'Yes — that is what I did'}
          </button>
        )}
        <span className="text-[12px] text-faint">
          {savedAt
            ? 'Next: pick what you are doing today, below.'
            : 'press Not me on anything that is not yours, or search for what is missing'}
        </span>
      </div>
    </div>
  )
}
