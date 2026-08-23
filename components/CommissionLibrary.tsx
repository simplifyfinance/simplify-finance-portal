'use client'

// Placeholder with a purpose. It states what this screen will hold and what it is
// waiting for, rather than showing controls that do nothing.
export default function CommissionLibrary() {
  const items = [
    { h: 'Upfront and trail per lender', d: 'The rate paid on each lender, and the basis it is paid on.' },
    { h: 'Net of offset rules', d: 'Which lenders pay on the balance net of offset, and which pay on the full limit.' },
    { h: 'Clawback tapers', d: 'How much is reclaimed and for how long, per lender.' },
    { h: 'Effective dating', d: 'A rate change applies from a date. Older settlements keep the rate that applied when they settled.' },
  ]
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6">
      <div className="text-[13px] font-semibold text-[#2E2A26] mb-1">No commission schedule loaded yet</div>
      <p className="text-[12.5px] text-[#6E665C] max-w-[70ch] mb-5">
        This is where the SFG schedule goes. Once it is in, the Pipeline can turn settled volume into expected
        commission, and reconcile that against what the aggregator actually pays.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {items.map(i => (
          <div key={i.h} className="border border-[#EDE7DD] rounded-xl p-3.5 bg-[#FDFCFA]">
            <div className="text-[12.5px] font-semibold text-[#2E2A26] mb-0.5">{i.h}</div>
            <div className="text-[11.5px] text-[#A29889]">{i.d}</div>
          </div>
        ))}
      </div>
      <div className="bg-[#FAF7F2] border border-[#E8E1D6] rounded-xl px-4 py-3">
        <div className="text-[12.5px] text-[#6E665C]">
          <strong className="text-[#2E2A26]">Ready to calculate against.</strong> Ten financial years of settled
          volume are already loaded, back to February 2016 — so the first schedule you load has real history to
          work on rather than starting empty.
        </div>
      </div>
    </div>
  )
}
