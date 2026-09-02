'use client'

import { useState } from 'react'
import { dealBeads, barFolds, type Bead } from '@/lib/deal-status'
import { stepLabel } from '@/lib/settlement'

// Display only. The bar reflects what has actually happened to the deal - it is not
// navigation, and clicking it does nothing except fold and unfold the written half.
//
// The rules live in lib/deal-status.ts, alongside the "waiting on" chip, because the
// two used to disagree: the bar ticked BC green the moment the credit officer finished
// typing, while the chip correctly said the BC was still sitting with the client. One
// file, one answer.
export { currentStage } from '@/lib/deal-status'

function fmt(v: any) {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}

// "Contracts returned" is the wrong words on a refinance - there are no contracts
// of sale, there are loan documents. lib/settlement.ts already knew this for the
// buttons; the bar says the same thing now that the step is a stage.
function labelOf(b: Bead, deal: any): string {
  if (b.key === 'contracts_returned') return stepLabel('contracts_returned', deal?.transaction_type)
  return b.label
}

const GREEN = '#12A150'
const PALE = '#C6DFCF'
const GREY = '#dfe4e9'

export default function DealProgress({ deal }: { deal: any }) {
  const beads = dealBeads(deal)
  // Only a lodged deal folds. Before that the written stages are the work in
  // front of you, and there is nothing to get out of the way.
  const canFold = barFolds(deal)
  const [open, setOpen] = useState(false)
  const folded = canFold && !open

  const written = beads.filter(b => b.group === 'written')
  const shown = folded ? beads.filter(b => b.group === 'tracked') : beads

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-6 pt-5 pb-3 mb-4">
      <div className="flex items-start">

        {/* The written half, folded. Four small dots on the same track, no labels,
            no colour, no box - it is the part of the deal you have finished with,
            so it should be the quietest thing on the header. */}
        {folded && (
          <button type="button" onClick={() => setOpen(true)}
            title="Show Fact Find, BC, Lending Options and Compliance"
            className="flex items-center flex-none mr-3 pr-3 group">
            <span className="flex items-center">
              {written.map((b, i) => (
                <span key={b.key} className="relative w-[15px] flex justify-center">
                  {i > 0 && <span className="absolute top-[3px] right-1/2 w-full h-[2px]" style={{ background: PALE }} />}
                  <span className="relative z-10 w-[8px] h-[8px] rounded-full"
                        style={{ background: b.done ? PALE : GREY }} />
                </span>
              ))}
            </span>
            <span className="text-[11px] text-[#a8b0b8] whitespace-nowrap ml-2.5">
              {written.length} written steps{' '}
              <span className="text-[#2DBEFF] group-hover:underline">show</span>
            </span>
          </button>
        )}

        {/* The live stages. Folded, these get the whole width - which is what
            makes room for Offer accepted, Contracts returned and Settlement
            booked without any of them wrapping to nothing. */}
        <div className="flex flex-1 min-w-0">
          {shown.map((b, i) => (
            <div key={b.key} className="relative flex-1 min-w-0 text-center">
              {i > 0 && (
                <span className="absolute top-[8px] right-1/2 w-full h-[2px]"
                      style={{ background: b.done ? GREEN : GREY }} />
              )}
              <div className={`relative z-10 w-[18px] h-[18px] rounded-full mx-auto flex items-center justify-center ${
                b.done ? 'bg-[#12A150]'
                : b.current ? 'bg-white border-2 border-[#2DBEFF] shadow-[0_0_0_4px_rgba(45,190,255,.16)]'
                : 'bg-white border-2 border-[#dfe4e9]'}`}>
                {b.done && (
                  <svg viewBox="0 0 12 12" className="w-[11px] h-[11px]" fill="none"
                       stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.4 L4.8 8.7 L9.5 3.6" />
                  </svg>
                )}
              </div>
              <div className={`text-[11px] leading-[1.25] mt-[9px] px-1 ${
                b.done ? 'text-[#5c6773] font-medium'
                : b.current ? 'text-[#2DBEFF] font-bold'
                : 'text-[#b0b7bf] font-medium'}`}>{labelOf(b, deal)}</div>
              {/* A finished stage shows when it finished. The live one shows who is holding it up. */}
              <div className={`text-[10.5px] mt-[2px] min-h-[14px] ${
                b.current ? 'text-[#2DBEFF] italic' : 'text-[#a8b0b8]'}`}>
                {b.current ? (b.state || '') : (b.done ? fmt(b.date) : '')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {canFold && open && (
        <button type="button" onClick={() => setOpen(false)}
          className="text-[10.5px] text-[#a8b0b8] hover:text-[#5c6773] hover:underline mt-1">
          Hide the written steps
        </button>
      )}
    </div>
  )
}
