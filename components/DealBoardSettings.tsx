'use client'
import { useState } from 'react'
import {
  TYPE_COLOUR, USE_COLOUR, TYPE_LABEL, USE_LABEL, chipStyle,
  type TypeId, type UseId,
} from '@/lib/deal-labels'
import { PHASE_LABEL } from '@/lib/deal-phase'
import { AGEING_FROM } from '@/lib/deal-age'
import {
  AGED_PHASES, SWATCHES, WAITING_ON, readBoardSettings, draftFromThresholds,
  boardSettingsToSave, normHex, type ThresholdDraft,
} from '@/lib/board-settings'

// Settings -> Deal board. Two things, because they are the two things that
// decide what a card looks like from across the room: what colour it is, and
// whether it has gone stale.
//
// Everything here edits ONE saved value (settings.deal_board) and is written by
// the Save settings button at the top of the page - there is no second save
// behaviour to learn.

const TYPE_IDS: TypeId[] = ['purchase', 'refinance', 'equity_release', 'construction']
const USE_IDS: UseId[] = ['owner_occupied', 'investment', 'smsf']

const DOT = 'w-[22px] h-[22px] rounded-md border border-black/10 shrink-0'
const HEXFIELD = 'text-[12.5px] font-mono border border-[#E8E1D6] rounded-lg px-2 py-1 w-[92px] text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF] bg-white'

// Deliberately at module level, NOT inside DealBoardSettings. A component
// declared inside another is a new type on every render, so React unmounts and
// remounts it - and the hex box would lose focus after every character typed.
function ColourRow({ label, colour, fallback, onPick }: {
  label: string; colour: string; fallback: string; onPick: (hex: string) => void
}) {
  const changed = String(colour).toUpperCase() !== String(fallback).toUpperCase()
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#EFEAE0] last:border-b-0 flex-wrap">
      <span className="text-[12.5px] text-[#575046] min-w-[130px]">{label}</span>
      <div className="flex gap-[5px] items-center flex-wrap">
        {SWATCHES.map(sw => (
          <button key={sw} type="button" title={sw} onClick={() => onPick(sw)}
            style={{ background: sw }}
            className={`${DOT} ${String(colour).toUpperCase() === sw ? 'outline outline-2 outline-[#221F1B] outline-offset-2' : ''}`} />
        ))}
        <input className={HEXFIELD} value={colour} onChange={e => onPick(e.target.value)} placeholder="#000000" />
      </div>
      <span className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border whitespace-nowrap"
            style={chipStyle(normHex(colour) || fallback)}>{label}</span>
      {changed && (
        <button type="button" onClick={() => onPick(fallback)}
          className="text-[11px] text-[#0E8FCB] underline ml-auto">Reset</button>
      )}
    </div>
  )
}

export default function DealBoardSettings({ value, onChange }: {
  value: any
  onChange: (v: any) => void
}) {
  const initial = readBoardSettings(value)
  const [type, setType] = useState<Record<string, string>>(() => ({ ...TYPE_COLOUR, ...initial.type }))
  const [use, setUse] = useState<Record<string, string>>(() => ({ ...USE_COLOUR, ...initial.use }))
  const [draft, setDraft] = useState<ThresholdDraft>(() => draftFromThresholds(initial.thresholds))

  // Every edit hands the parent the whole saved shape, so Save settings has
  // nothing to work out and cannot save half of it.
  function push(t = type, u = use, d = draft) {
    onChange(boardSettingsToSave(t, u, d))
  }
  function setTypeColour(id: string, hex: string) {
    const next = { ...type, [id]: hex }; setType(next); push(next, use, draft)
  }
  function setUseColour(id: string, hex: string) {
    const next = { ...use, [id]: hex }; setUse(next); push(type, next, draft)
  }
  function setDay(phase: string, which: 'long' | 'nudge', v: string) {
    const row = { ...(draft as any)[phase] || { long: '', nudge: '' }, [which]: v.replace(/[^0-9]/g, '') }
    const next = { ...draft, [phase]: row } as ThresholdDraft
    setDraft(next); push(type, use, next)
  }

  const head = 'text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-3 flex items-center gap-2'

  // The live preview. Not decoration - a colour that reads fine as a swatch can
  // still disappear on a chip at 9px, and this is the only place to find that
  // out before saving it for everyone.
  const previewType = normHex(type.purchase) || TYPE_COLOUR.purchase
  const previewUse = normHex(use.owner_occupied) || USE_COLOUR.owner_occupied

  return (
    <div className="mb-10">
      <section className="mb-4">
        <h2 className={head}><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />Label colours</h2>
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white">
          <p className="text-[11.5px] text-[#A29889] mb-4 leading-[1.6]">
            The two chips on every card. Nothing here is colour alone - the word is always in the
            chip - so a printout, a colourblind reader or a phone in sunlight loses nothing.
          </p>

          <p className="text-[11px] font-semibold text-[#A29889] mb-1">What kind of deal it is</p>
          {TYPE_IDS.map(id => (
            <ColourRow key={id} label={TYPE_LABEL[id]} colour={type[id] || TYPE_COLOUR[id]}
                 fallback={TYPE_COLOUR[id]} onPick={hex => setTypeColour(id, hex)} />
          ))}

          <p className="text-[11px] font-semibold text-[#A29889] mt-5 mb-1">What the property is for</p>
          {USE_IDS.map(id => (
            <ColourRow key={id} label={USE_LABEL[id]} colour={use[id] || USE_COLOUR[id]}
                 fallback={USE_COLOUR[id]} onPick={hex => setUseColour(id, hex)} />
          ))}

          <p className="text-[11px] font-semibold text-[#A29889] mt-5 mb-2">A real card, with your colours on it</p>
          <div className="bg-[#FCFAF6] border border-[#EFEAE0] rounded-xl p-3 inline-block">
            <div className="bg-white border border-[#E5DED2] rounded-[10px] px-2.5 py-2.5 w-[248px]">
              <p className="text-[12.5px] font-[640] text-[#221F1B] m-0">Sample Client</p>
              <p className="text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889] m-0 mb-[7px]">Home loan &middot; Macquarie</p>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[14px] font-[680] text-[#221F1B] tabular-nums tracking-[-.01em]">$680k</span>
                <span className="ml-auto text-[11px] text-[#7A7266] tabular-nums">4 days</span>
              </div>
              <div className="flex gap-1 flex-wrap items-center">
                <span className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border whitespace-nowrap"
                      style={chipStyle(previewType)}>{TYPE_LABEL.purchase}</span>
                <span className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border whitespace-nowrap"
                      style={chipStyle(previewUse)}>{USE_LABEL.owner_occupied}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4">
        <h2 className={head}><span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />When a deal has sat too long</h2>
        <div className="border border-[#EDE7DD] rounded-xl p-5 bg-white">
          <p className="text-[11.5px] text-[#A29889] mb-4 leading-[1.6]">
            Two numbers per column, in <b className="text-[#6E665C]">business days</b> - a Friday
            action does not look stale on Monday. The first turns the card amber. The second turns it
            red and puts the column on the &ldquo;needs a nudge&rdquo; count. Clear both boxes and
            that column stops being aged at all.
          </p>

          <div className="border border-[#EFEAE0] rounded-lg overflow-hidden">
            <div className="grid grid-cols-[150px_86px_86px_1fr] gap-2 px-3 py-2 bg-[#FCFAF6] border-b border-[#E5DED2]">
              {['Column', 'Amber after', 'Red after', 'What we are waiting on'].map((h, i) => (
                <span key={h} className={`text-[10px] font-bold tracking-[.07em] uppercase text-[#7A7266] ${i === 1 || i === 2 ? 'text-center' : ''}`}>{h}</span>
              ))}
            </div>
            {AGED_PHASES.map(p => {
              const row = (draft as any)[p] || { long: '', nudge: '' }
              const off = !row.long || !row.nudge
              return (
                <div key={p} className="grid grid-cols-[150px_86px_86px_1fr] gap-2 px-3 py-2 items-center border-b border-[#EFEAE0] last:border-b-0">
                  <span className="text-[12.5px] font-[620] text-[#221F1B]">{PHASE_LABEL[p]}</span>
                  <input value={row.long} onChange={e => setDay(p, 'long', e.target.value)} inputMode="numeric"
                    className="w-[52px] mx-auto text-center text-[12.5px] rounded-lg py-1 border border-[#EBD9BE] bg-[#FDF6EC] text-[#946017] font-[640] focus:outline-none focus:border-[#2DBEFF]" />
                  <input value={row.nudge} onChange={e => setDay(p, 'nudge', e.target.value)} inputMode="numeric"
                    className="w-[52px] mx-auto text-center text-[12.5px] rounded-lg py-1 border border-[#EFD3CB] bg-[#FBECEC] text-[#AD4227] font-[640] focus:outline-none focus:border-[#2DBEFF]" />
                  <span className="text-[11.5px] text-[#7A7266] leading-[1.5]">
                    {off ? <i className="text-[#C3BDB2]">Not aged. </i> : null}{WAITING_ON[p] || ''}
                  </span>
                </div>
              )
            })}
            <div className="grid grid-cols-[150px_86px_86px_1fr] gap-2 px-3 py-2 items-center bg-[#FCFAF6] border-t border-[#EFEAE0]">
              <span className="text-[12.5px] font-[620] text-[#221F1B]">Settled</span>
              <span className="col-span-2 text-[11.5px] text-[#C3BDB2] text-center italic">off the clock</span>
              <span className="text-[11.5px] text-[#7A7266] leading-[1.5]">
                A settled deal is not stale. What is outstanding is the commission, which has its own screen.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#FDF6EC] border border-[#EBD9BE] rounded-lg px-3 py-2.5 mt-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#946017" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 mt-[2px]"><circle cx="8" cy="8" r="6.2"/><path d="M8 5v3.4M8 10.8v.2"/></svg>
            <span className="text-[12px] text-[#7A5F17] leading-[1.6]">
              Whatever you put here, ageing still starts from <b>{new Date(AGEING_FROM).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</b>.
              A deal that entered its stage before that date is not aged at all - otherwise the board
              opens with a screen of red cards nobody intends to chase, and everyone learns to ignore
              the colour. Everything that has moved since then is aged immediately.
            </span>
          </div>

          <p className="text-[11px] text-[#A29889] mt-3 leading-[1.6]">
            These same numbers group the List view (Needs a nudge / Running long / Moving), so a change
            here moves deals between those groups too. One set of numbers, both views agree.
          </p>
        </div>
      </section>
    </div>
  )
}
