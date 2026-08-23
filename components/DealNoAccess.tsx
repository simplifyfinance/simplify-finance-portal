import Link from 'next/link'

// Shown when a deal exists but this person cannot open it. Never a blank page and
// never a "not found", because both make a real deal look broken or deleted.
export default function DealNoAccess({ dealName }: { dealName?: string | null }) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/deals" className="text-sm text-[#6E665C] hover:text-[#2E2A26] inline-flex items-center gap-2 mb-6">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M7 4L3 8l4 4"/></svg>
        Back to deals
      </Link>

      <div className="bg-white border border-[#EDE7DD] rounded-2xl p-8">
        <div className="w-11 h-11 rounded-xl bg-[#FAF7F2] border border-[#E8E1D6] flex items-center justify-center mb-4">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#A29889" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3.2" y="7" width="9.6" height="6.6" rx="1.7"/><path d="M5.5 7V5.1a2.5 2.5 0 0 1 5 0V7"/>
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-[#2E2A26] mb-2">You don&apos;t have permission to open this deal</h1>
        <p className="text-sm text-[#6E665C] mb-1">
          {dealName ? <>The deal <strong className="text-[#2E2A26]">{dealName}</strong> exists</> : <>This deal exists</>},
          {' '}but it is not assigned to you and you have not been given access to the broker who owns it.
        </p>
        <p className="text-sm text-[#6E665C] mb-6">
          Nothing has gone wrong and nothing is missing — you are simply not on it.
        </p>

        <div className="bg-[#FAF7F2] border border-[#E8E1D6] rounded-xl px-4 py-3 mb-6">
          <div className="text-[12.5px] text-[#6E665C]">
            <strong className="text-[#2E2A26]">Need it?</strong> Ask Fabio or Alan to assign you to the deal, or to
            grant you access to that broker&apos;s files. It takes a moment and applies straight away.
          </div>
        </div>

        <Link href="/deals"
          className="bg-[#343333] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2a2a2a] transition inline-block">
          Back to my deals
        </Link>
      </div>
    </div>
  )
}
