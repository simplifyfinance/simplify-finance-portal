'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { buildPeek, peekAge, type PeekSection } from '@/lib/deal-peek'
import { chipStyle } from '@/lib/deal-labels'
import { useDealFile } from '@/components/DealFile'
import { byUrgency, newestFirst, toneOf, whenLabel, dueLabel } from '@/lib/deal-notes'
import { getWaitingOnLabel } from '@/lib/deal-status'

// A look at a deal without opening it.
//
// One job: answer "does this need me today". Everything on it is already
// recorded somewhere, and NOTHING on it is editable — it is a look, not a second
// place to change things, for the same reason dragging a card opens the real
// panel rather than writing a half record.
//
// No statement figures. A score without its working is worse than no score, and
// Statements is a screen of its own — the button at the foot goes straight there.

function Section({ s }: { s: PeekSection }) {
  if (!s.fields.length) return null
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-[#7A7266] m-0 mb-2">{s.title}</p>
      {s.fields.map((f, i) => (
        <div key={f.key + i} className="flex gap-2.5 mb-1.5 text-[12.5px] leading-[1.45]">
          <span className="text-[#7A7266] w-[92px] flex-none">{f.key}</span>
          <span className={f.muted ? 'text-[#A29889]' : 'text-[#221F1B] font-[520]'}>{f.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function DealPeek({ deal, lenderName, brokerName, creditName, colours, onClose, onStep }: {
  deal: any
  lenderName?: string
  brokerName?: string
  creditName?: string
  // The same label colours the card was drawn with. Opening a quick look must
  // not repaint the chips.
  colours?: { type?: any; use?: any }
  onClose: () => void
  onStep?: (dir: -1 | 1) => void
}) {
  const router = useRouter()
  const { notes, alerts } = useDealFile(deal.id)
  const p = buildPeek(deal, { lenderName, brokerName, creditName, colours })
  const waiting = getWaitingOnLabel(deal, creditName)

  // Arrow keys walk the column without closing, so nine compliance-sent deals can
  // be looked at in a few seconds instead of opening and backing out of each one.
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); onStep?.(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); onStep?.(1) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose, onStep])

  return (
    <div onClick={onClose}
      className="fixed inset-0 z-50 bg-[#221F1B]/40 flex items-start justify-center p-6 overflow-auto">
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-[13px] w-full max-w-[660px] mt-[6vh] overflow-hidden shadow-[0_14px_40px_rgba(34,31,27,.22)]">

        <div className="px-[18px] pt-4 pb-3 border-b border-[#EFEAE0]">
          <h3 className="text-[16.5px] font-[640] tracking-[-.01em] m-0 mb-1.5 text-[#221F1B]">{p.title}</h3>
          <div className="flex gap-1.5 flex-wrap items-center">
            {p.chips.map(c => (
              <span key={c.id} className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border"
                    style={chipStyle(c.colour)}>{c.label}</span>
            ))}
            <span className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border"
                  style={chipStyle('#0E8FCB')}>{p.phaseLabel}</span>
            <span className="text-[11px] text-[#A29889]">{peekAge(deal)}</span>
          </div>
        </div>

        {waiting && (
          <div className="px-[18px] py-2.5 text-[12.5px] bg-[#FDF6EC] border-b border-[#EBD9BE] text-[#946017]">
            {waiting.text}
          </div>
        )}

        <div className="grid grid-cols-2">
          <div className="px-[18px] py-3.5">
            <Section s={p.loan} />
            <Section s={p.security} />
          </div>
          <div className="px-[18px] py-3.5 border-l border-[#EFEAE0]">
            <Section s={p.who} />
            <Section s={p.dates} />
          </div>
        </div>

        {/* What is wrong comes first. The whole point of a quick look is to
            answer "is anything on fire here" before you commit to opening it. */}
        {byUrgency(alerts).length > 0 && (
          <div className="px-[18px] pb-3">
            <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-[#946017] m-0 mb-2">Important notes</p>
            {byUrgency(alerts).slice(0, 3).map(a => {
              const red = toneOf(a) === 'red'
              return (
                <div key={a.id}
                  className={`flex gap-2 items-start rounded-lg px-2.5 py-2 mb-1.5 last:mb-0 border ${
                    red ? 'border-[#EFD3CB] bg-[#FBECEC]' : 'border-[#EBD9BE] bg-[#FDF6EC]'}`}>
                  <span className={`w-[6px] h-[6px] rounded-full shrink-0 mt-[6px] ${red ? 'bg-[#AD4227]' : 'bg-[#946017]'}`} />
                  <span className="min-w-0">
                    <span className="block text-[12px] text-[#221F1B] font-[600]">{a.title}</span>
                    <span className="block text-[10.5px] text-[#7A7266]">
                      {a.owner_name || 'nobody yet'}{a.due_on ? ` · ${dueLabel(a.due_on)}` : ''}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="px-[18px] pb-3">
          <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-[#7A7266] m-0 mb-2">Internal notes</p>
          {p.notes ? (
            <div className="text-[12px] leading-[1.55] text-[#575046] bg-[#FCFAF6] border border-[#EFEAE0] rounded-lg px-2.5 py-2 max-h-[96px] overflow-auto whitespace-pre-line">
              {p.notes}
            </div>
          ) : (
            <p className="text-[12px] text-[#A29889] m-0">Nothing written yet.</p>
          )}
        </div>

        {/* The last few things that happened, so the quick look answers "where
            is this up to" as well as "what is it". */}
        {newestFirst(notes).length > 0 && (
          <div className="px-[18px] pb-4">
            <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-[#7A7266] m-0 mb-2">
              File notes
              {notes.length > 3 && <span className="font-normal normal-case tracking-normal text-[#A29889]"> · {notes.length} in total</span>}
            </p>
            <div className="border-l-2 border-[#EFEAE0] pl-2.5 ml-[2px]">
              {newestFirst(notes).slice(0, 3).map(n => (
                <div key={n.id} className="mb-2 last:mb-0">
                  <p className="text-[10px] text-[#A29889] m-0">
                    {whenLabel(n.created_at)} · {n.kind === 'system' ? 'recorded automatically' : (n.author_name || 'unknown')}
                  </p>
                  <p className={`text-[12px] m-0 leading-[1.45] ${n.kind === 'system' ? 'text-[#7A7266] italic' : 'text-[#575046]'}`}>
                    {n.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 items-center px-[18px] py-3 border-t border-[#EFEAE0] bg-[#FCFAF6]">
          <button onClick={() => router.push(`/deals/${deal.id}`)}
            className="text-[12.5px] rounded-lg px-3 py-1.5 bg-[#0E8FCB] text-white font-semibold">Open deal</button>
          <button onClick={() => router.push(`/deals/${deal.id}?stage=Statements`)}
            className="text-[12.5px] rounded-lg px-3 py-1.5 border border-[#E5DED2] bg-white text-[#221F1B]">Open Statements</button>
          <button onClick={onClose}
            className="text-[12.5px] rounded-lg px-3 py-1.5 border border-[#E5DED2] bg-white text-[#221F1B]">Close</button>
          {onStep && <span className="ml-auto text-[11.5px] text-[#A29889]">← → to step through the column</span>}
        </div>
      </div>
    </div>
  )
}
