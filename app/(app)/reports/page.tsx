'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

function fmtMoney(v: any): string {
  const n = Number(v)
  if (!v || isNaN(n)) return ''
  return '$' + n.toLocaleString('en-AU')
}

export default function ReportsPage() {
  const supabase = createSupabaseBrowser()
  const [tab, setTab] = useState<'rate' | 'lvr'>('rate')
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
      const value = Number(p.value) || 0
      const totalBalance = (p.loans || []).reduce((sum: number, l: any) => sum + (Number(l.balance) || 0), 0)
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
    <div className="max-w-4xl mx-auto p-6">
      <p className="text-lg font-medium text-[#343333] mb-4">Reports</p>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5">
        <button onClick={() => setTab('rate')} className={`px-4 py-1.5 text-sm rounded-md font-medium transition ${tab === 'rate' ? 'bg-white text-[#343333] shadow-sm' : 'text-gray-500'}`}>Rate exposure</button>
        <button onClick={() => setTab('lvr')} className={`px-4 py-1.5 text-sm rounded-md font-medium transition ${tab === 'lvr' ? 'bg-white text-[#343333] shadow-sm' : 'text-gray-500'}`}>LVR exposure</button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : tab === 'rate' ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">Show loans with a rate above</span>
            <input type="text" value={rateThreshold} onChange={e => setRateThreshold(e.target.value)}
              className="w-16 text-sm px-2 py-1.5 border border-gray-300 rounded-lg text-center" />
            <span className="text-sm text-gray-500">%</span>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
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
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
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
