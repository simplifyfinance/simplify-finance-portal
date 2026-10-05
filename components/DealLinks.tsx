'use client'
import Link from 'next/link'

// SALESTREKKER & LINKS, IN THE RAIL.
//
// one-inside-the-deal-v4.html puts the three ways OUT of the portal together,
// as a rail box with Open on the right of each. They were a joined pill in the
// header and a second pill beside it, so the header carried five controls and
// the rail carried none of them.
//
// They are links out. Nothing here does anything to the deal.

export default function DealLinks({ deal }: { deal: any }) {
  const rows = [
    { label: 'OneDrive', href: deal?.onedrive_link || '', out: true },
    { label: 'SalesTrekker', href: deal?.salestrekker_link || '', out: true },
    { label: 'Summary page', href: `/deals/${deal?.id}/summary`, out: false },
  ].filter(r => r.href)

  if (rows.length === 0) return null

  return (
    <div className="bg-card border border-card-line rounded-xl mb-3 px-3.5 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-faint">
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" />
        </svg>
        <span className="text-[9.5px] font-bold tracking-[.09em] uppercase text-faint">SalesTrekker &amp; links</span>
      </div>
      <div>
        {rows.map(r => (
          <div key={r.label} className="flex items-baseline gap-2 py-[3px]">
            <span className="text-[12.5px] text-body">{r.label}</span>
            {r.out ? (
              <a href={r.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.label}`}
                className="ml-auto text-[11.5px] font-[650] text-info hover:underline">Open</a>
            ) : (
              <Link href={r.href} target="_blank" aria-label={`Open ${r.label}`}
                className="ml-auto text-[11.5px] font-[650] text-info hover:underline">Open</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
