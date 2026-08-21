'use client'

// Display only. The bar reflects timestamps already on the deal - it is not navigation,
// and clicking it does nothing. Status changes because something happened (a confirmed
// action now, the SalesTrekker API later); the bar simply shows where the deal is.
const STEPS = [
  { key: 'created_at',              label: 'Fact Find' },
  { key: 'bc_completed_at',         label: 'BC' },
  { key: 'lo_completed_at',         label: 'Lending' },
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
      <div className="relative h-[3px] mx-[6.25%] bg-gray-200 rounded">
        <div className="absolute left-0 top-0 h-[3px] rounded bg-[#12A150]" style={{ width: `${fill}%` }} />
      </div>
      <div className="flex -mt-[9px]">
        {STEPS.map((s, i) => {
          const isDone = done[i]
          const isNow = !isDone && i === currentIdx
          return (
            <div key={s.key} className="flex-1 text-center">
              <div className={`w-[15px] h-[15px] rounded-full mx-auto border-[3px] ${
                isDone ? 'bg-[#12A150] border-[#12A150]'
                : isNow ? 'bg-white border-[#2DBEFF] ring-4 ring-[#2DBEFF]/20'
                : 'bg-white border-gray-200'}`} />
              <div className={`text-[11.5px] mt-2 ${
                isDone ? 'text-gray-600' : isNow ? 'text-[#2DBEFF] font-semibold' : 'text-gray-300'}`}>{s.label}</div>
              <div className="text-[10.5px] text-gray-400 min-h-[14px]">{fmt(deal?.[s.key])}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
