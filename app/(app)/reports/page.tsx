'use client'
import { useEffect, useState } from 'react'
import { PAGE_WIDE } from '@/lib/page-width'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { readMoney, money } from '@/lib/money'
import PortfolioReview from '@/components/PortfolioReview'

// Was a hand-written formatter using Number(), which turns "506,514" into
// nothing at all - the third copy of that mistake in this codebase. money() from
// lib/money.ts is the one way money is printed here.
const fmtMoney = (v: any) => money(v)

export default function ReportsPage() {
  const supabase = createSupabaseBrowser()
  // THE THIRD TAB. 15 Oct 2026 - existing clients who may be sitting on equity.
  // See components/PortfolioReview.tsx; unlike the two beside it, that one reads
  // a view rather than unpacking the whole book in the browser.
  const [tab, setTab] = useState<'rate' | 'lvr' | 'portfolio'>('rate')
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [rateThreshold, setRateThreshold] = useState('6.50')

  useEffect(() => {
    document.title = 'Reports — Simplify Finance'
  }, [])

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('clients').select('id, first_name, last_name, position_properties').not('position_properties', 'is', null)
      setClients(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const rateRows = clients.flatMap((c: any) =>
    (c.position_properties || []).flatMap((p: any) =>
      (p.loans || []).map((l: any) => ({
        clientId: c.id,
        clientName: `${c.first_name} ${c.last_name}`,
        propertyAddress: p.address || 'Address not set',
        lenderName: l.lenderName || 'Not set',
        rate: Number(l.interestRate) || 0
      }))
    )
  ).filter(r => r.rate > (Number(rateThreshold) || 0))
    .sort((a, b) => b.rate - a.rate)

  const lvrRows = clients.flatMap((c: any) =>
    (c.position_properties || []).map((p: any) => {
      // Number('620,000') is NaN, so every property whose value carried commas
      // fell to zero, its LVR came out null, and it dropped off this report
      // silently. The report looked like it had nothing to say.
      const value = readMoney(p.value) || 0
      const totalBalance = (p.loans || []).reduce((sum: number, l: any) => sum + (readMoney(l.balance) || 0), 0)
      const lvr = value > 0 ? Math.round((totalBalance / value) * 1000) / 10 : null
      return {
        clientId: c.id,
        clientName: `${c.first_name} ${c.last_name}`,
        propertyAddress: p.address || 'Address not set',
        value,
        totalBalance,
        lvr
      }
    })
  ).filter(r => r.lvr !== null)
    .sort((a, b) => (b.lvr || 0) - (a.lvr || 0))

  return (
    <div className={PAGE_WIDE}>
      <p className="text-lg font-medium text-ink mb-4">Reports</p>

      {/* The approved sub-navigation, from the mock Fabio signed off on 15 Oct
          2026. It replaces bg-gray-100 / text-gray-500, which were raw Tailwind
          greys rather than the portal's own tokens and did not follow dark
          mode. */}
      <div className="inline-flex gap-0.5 bg-track rounded-[10px] p-[3px] w-fit mb-5">
        {([['rate', 'Rate exposure'], ['lvr', 'LVR exposure'],
           ['portfolio', 'Portfolio review']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-[7px] transition ${tab === k
              ? 'bg-card text-brand-ink shadow-sm' : 'text-muted hover:text-body'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'portfolio' ? (
        <PortfolioReview />
      ) : loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : tab === 'rate' ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">Show loans with a rate above</span>
            <input type="text" value={rateThreshold} onChange={e => setRateThreshold(e.target.value)}
              className="w-16 text-sm px-2 py-1.5 border border-gray-300 rounded-lg text-center" />
            <span className="text-sm text-gray-500">%</span>
          </div>
          <div className="bg-card border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1.5fr_2fr_1fr_0.8fr] px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <span>Client</span><span>Property</span><span>Lender</span><span>Rate</span>
            </div>
            {rateRows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">No loans found above this threshold.</div>
            ) : rateRows.map((r, i) => (
              <Link key={i} href={`/clients/${r.clientId}`} className="grid grid-cols-[1.5fr_2fr_1fr_0.8fr] px-4 py-3 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                <span>{r.clientName}</span><span>{r.propertyAddress}</span><span>{r.lenderName}</span><span className="font-medium text-red-600">{r.rate}%</span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-card border border-gray-100 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_0.8fr] px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
            <span>Client</span><span>Property</span><span>Value</span><span>Loan balance</span><span>LVR</span>
          </div>
          {lvrRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">No properties with value and loan data found.</div>
          ) : lvrRows.map((r, i) => (
            <Link key={i} href={`/clients/${r.clientId}`} className="grid grid-cols-[1.5fr_2fr_1fr_1fr_0.8fr] px-4 py-3 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
              <span>{r.clientName}</span><span>{r.propertyAddress}</span><span>{fmtMoney(r.value)}</span><span>{fmtMoney(r.totalBalance)}</span>
              <span className={`font-medium ${(r.lvr || 0) >= 80 ? 'text-red-600' : 'text-gray-700'}`}>{r.lvr}%</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
