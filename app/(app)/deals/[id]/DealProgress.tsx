'use client'

// Display only. The bar reflects timestamps already on the deal - it is not navigation,
// and clicking it does nothing. Status changes because something happened (a confirmed
// action now, the SalesTrekker API later); the bar simply shows where the deal is.
const STEPS = [
  { key: 'created_at',              label: 'Fact Find' },
  { key: 'bc_completed_at',         label: 'BC' },
  { key: 'lo_completed_at',         label: 'Lending options' },
  { key: 'compliance_completed_at', label: 'Compliance' },
  { key: 'lodged_at',               label: 'Lodged' },
  { key: 'preapproval_at',          label: 'Preapproved' },
  { key: 'formal_approval_at',      label: 'Formal' },
  { key: 'settled_at',              label: 'Settled' },
]

function fmt(v: any) {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}

export default function DealProgress({ deal }: { deal: any }) {
  const done = STEPS.map(s => Boolean(deal?.[s.key]))
  const lastDone = done.lastIndexOf(true)
  const currentIdx = Math.min(lastDone + 1, STEPS.length - 1)
  const fill = (Math.max(lastDone, 0) / (STEPS.length - 1)) * 100

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-6 pt-5 pb-3 mb-4">
      <div className="relative h-[3px] mx-[6.25%] bg-[#dfe4e9] rounded">
        <div className="absolute left-0 top-0 h-[3px] rounded bg-[#12A150]" style={{ width: `${fill}%` }} />
      </div>
      <div className="flex -mt-[11px]">
        {STEPS.map((s, i) => {
          const isDone = done[i]
          const isNow = !isDone && i === currentIdx
          return (
            <div key={s.key} className="flex-1 text-center">
              <div className={`w-[18px] h-[18px] rounded-full mx-auto flex items-center justify-center ${
                isDone ? 'bg-[#12A150]'
                : isNow ? 'bg-white border-2 border-[#2DBEFF] shadow-[0_0_0_4px_rgba(45,190,255,.16)]'
                : 'bg-white border-2 border-[#dfe4e9]'}`}>
                {isDone && (
                  <svg viewBox="0 0 12 12" className="w-[11px] h-[11px]" fill="none"
                       stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.4 L4.8 8.7 L9.5 3.6" />
                  </svg>
                )}
              </div>
              <div className={`text-[11.5px] mt-[9px] ${
                isDone ? 'text-[#5c6773] font-medium'
                : isNow ? 'text-[#2DBEFF] font-bold'
                : 'text-[#b0b7bf] font-medium'}`}>{s.label}</div>
              <div className="text-[10.5px] text-[#a8b0b8] mt-[2px] min-h-[14px]">{fmt(deal?.[s.key])}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
