'use client'
import { useState } from 'react'
import { trailFor, addPatch } from '@/lib/the-settlement-trail'
import { OFFICE } from '@/lib/same-date-everywhere'

// A TRAIL, NOT A BOX.
//
// 17 Nov 2026. "Latest update - a trail, not a box. Every entry dated and
// named, nothing typed over. So 'what did we tell them last week' has an
// answer." The same component serves ATTN Settlements, which is the field that
// crosses the handover. See lib/the-settlement-trail.ts.

const when = (iso: string) => {
  const d = new Date(String(iso || ''))
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-AU',
    { timeZone: OFFICE, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

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
  const entries = trailFor(deal, column)

  async function write() {
    const patch = addPatch(deal, words, me || '', new Date(), column)
    if (!patch) return
    await onWrite(patch)
    setWords('')
  }

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

      {entries.length === 0 ? (
        <p className="mt-2.5 mb-0 text-[12px] text-faint">Nothing written yet.</p>
      ) : (
        <div className={`mt-3 border-l-2 pl-3 ${tone === 'info' ? 'border-info-edge' : 'border-line-soft'}`}>
          {entries.map((e, i) => (
            <div key={`${e.at}-${i}`} className="mb-2.5 last:mb-0">
              <div className="text-[13px] leading-relaxed text-body">{e.text}</div>
              <div className="mt-[1px] text-[11px] text-faint">
                {[e.by, when(e.at)].filter(Boolean).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
