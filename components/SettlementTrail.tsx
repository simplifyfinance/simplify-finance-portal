'use client'
import { useState } from 'react'
import { trailFor, threadsOf, addPatch, type Entry } from '@/lib/the-settlement-trail'
import { OFFICE } from '@/lib/same-date-everywhere'

// A TRAIL, NOT A BOX.
//
// 17 Nov 2026. "Latest update - a trail, not a box. Every entry dated and
// named, nothing typed over. So 'what did we tell them last week' has an
// answer." The same component serves ATTN Settlements, which is the field that
// crosses the handover. See lib/the-settlement-trail.ts.
//
// AND SINCE 22 NOV, A PROGRESS NOTE UNDER ONE.
//
// Belle, after a week on the settlement process: "Can we also add an Edit
// option on the right side of each attention item? This would allow us to
// easily update or add progress notes directly under each attention." The red
// box she drew was on empty space, which is why nothing happened when she
// pressed it - there was no control there at all.
//
// It is a Reply rather than an Edit, which Fabio chose: an Edit types over
// what somebody wrote, and this trail exists precisely so that cannot happen.
// Her own words were "add progress notes directly under each attention".
// See docs/approved-looks/the-team-week-one.html.

const when = (iso: string) => {
  const d = new Date(String(iso || ''))
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-AU',
    { timeZone: OFFICE, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

const Said = ({ e }: { e: Entry }) => (
  <>
    <div className="text-[13px] leading-relaxed text-body">{e.text}</div>
    <div className="mt-[1px] text-[11px] text-faint">
      {[e.by, when(e.at)].filter(Boolean).join(' · ')}
    </div>
  </>
)

export default function SettlementTrail({
  deal, column = 'settlement_trail', me, onWrite, busy, placeholder, tone = 'plain',
}: {
  deal: any
  column?: string
  me?: string
  onWrite: (patch: Record<string, any>) => void | Promise<void>
  busy?: boolean
  placeholder?: string
  tone?: 'plain' | 'info'
}) {
  const [words, setWords] = useState('')
  // Which entry a progress note is being written under, by its `at`. Empty is
  // nobody, which is the normal state.
  const [replyTo, setReplyTo] = useState('')
  const [reply, setReply] = useState('')
  const threads = threadsOf(trailFor(deal, column))

  async function write() {
    const patch = addPatch(deal, words, me || '', new Date(), column)
    if (!patch) return
    await onWrite(patch)
    setWords('')
  }

  // THE NOTE GOES UNDER THE THING IT IS ABOUT. Same door as everything else -
  // addPatch writes the whole trail back, so two people writing at once cannot
  // eat each other's line.
  async function writeReply(to: string) {
    const patch = addPatch(deal, reply, me || '', new Date(), column, to)
    if (!patch) return
    await onWrite(patch)
    setReply('')
    setReplyTo('')
  }

  const edge = tone === 'info' ? 'border-info-edge' : 'border-line-soft'

  return (
    <div>
      <div className="flex gap-2">
        <input value={words} onChange={e => setWords(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void write() }}
          placeholder={placeholder || 'What happened — this is added to the trail, it does not replace it'}
          className="flex-1 rounded-lg border border-field-line bg-card px-3 py-2 text-[13px] focus:border-brand focus:outline-none" />
        <button type="button" onClick={() => void write()} disabled={busy || !words.trim()}
          className="whitespace-nowrap rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-page disabled:opacity-40">
          Add
        </button>
      </div>

      {threads.length === 0 ? (
        <p className="mt-2.5 mb-0 text-[12px] text-faint">Nothing written yet.</p>
      ) : (
        <div className={`mt-3 border-l-2 pl-3 ${edge}`}>
          {threads.map(({ entry, replies }) => (
            <div key={entry.at} className="mb-2.5 last:mb-0">
              <div className="flex items-start gap-2.5">
                <div className="flex-1"><Said e={entry} /></div>
                {/* REPLY, NOT EDIT. Nothing on this trail is typed over. */}
                <button type="button" disabled={busy}
                  onClick={() => { setReplyTo(t => t === entry.at ? '' : entry.at); setReply('') }}
                  aria-expanded={replyTo === entry.at}
                  className="flex-none text-[11.5px] font-semibold text-info disabled:opacity-40">
                  {replyTo === entry.at ? 'Cancel' : 'Reply'}
                </button>
              </div>

              {replies.length > 0 && (
                <div className={`mt-2 ml-4 border-l-2 pl-3 ${edge}`}>
                  {replies.map(r => (
                    <div key={r.at} className="mb-2 last:mb-0"><Said e={r} /></div>
                  ))}
                </div>
              )}

              {replyTo === entry.at && (
                <div className="mt-2 ml-4 flex gap-2">
                  <input value={reply} autoFocus onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void writeReply(entry.at) }}
                    placeholder="Add a progress note under this"
                    className="flex-1 rounded-lg border border-field-line bg-card px-2.5 py-1.5 text-[12.5px] focus:border-brand focus:outline-none" />
                  <button type="button" onClick={() => void writeReply(entry.at)}
                    disabled={busy || !reply.trim()}
                    className="whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-page disabled:opacity-40">
                    Add
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
