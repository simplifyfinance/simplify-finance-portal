'use client'

import { dealBeads } from '@/lib/deal-status'

// Display only. The bar reflects what has actually happened to the deal - it is not
// navigation, and clicking it does nothing.
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

export default function DealProgress({ deal }: { deal: any }) {
  const beads = dealBeads(deal)
  const lastDone = beads.reduce((acc, b, i) => (b.done ? i : acc), -1)
  const fill = (Math.max(lastDone, 0) / (beads.length - 1)) * 100

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-6 pt-5 pb-3 mb-4">
      <div className="relative h-[3px] mx-[6.25%] bg-[#dfe4e9] rounded">
        <div className="absolute left-0 top-0 h-[3px] rounded bg-[#12A150]" style={{ width: `${fill}%` }} />
      </div>
      <div className="relative z-10 flex -mt-[11px]">
        {beads.map(b => (
          <div key={b.key} className="flex-1 text-center">
            <div className={`w-[18px] h-[18px] rounded-full mx-auto flex items-center justify-center ${
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
            <div className={`text-[11.5px] mt-[9px] ${
              b.done ? 'text-[#5c6773] font-medium'
              : b.current ? 'text-[#2DBEFF] font-bold'
              : 'text-[#b0b7bf] font-medium'}`}>{b.label}</div>
            {/* A finished stage shows when it finished. The live one shows who is holding it up. */}
            <div className={`text-[10.5px] mt-[2px] min-h-[14px] ${
              b.current ? 'text-[#2DBEFF] italic' : 'text-[#a8b0b8]'}`}>
              {b.current ? (b.state || '') : (b.done ? fmt(b.date) : '')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
