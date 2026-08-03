'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowLeft } from 'lucide-react'

export default function ClientProfilePage() {
  const params = useParams()
  const clientId = params.id as string
  const supabase = createSupabaseBrowser()
  const [client, setClient] = useState<any>(null)

  useEffect(() => {
    if (client?.first_name) document.title = `${client.first_name} ${client.last_name} — Simplify Finance`
  }, [client])
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: clientData } = await supabase.from('clients').select('*').eq('id', clientId).single()
      setClient(clientData)
      const { data: primaryDeals } = await supabase.from('deals').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
      const { data: jointDeals } = await supabase.from('deals').select('*').contains('fact_find_data->applicants', [{ clientId }]).order('created_at', { ascending: false })

      const merged = [...(primaryDeals || [])]
      for (const d of (jointDeals || [])) {
        if (!merged.some(existing => existing.id === d.id)) merged.push(d)
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setDeals(merged)
      setLoading(false)
    }
    load()
  }, [clientId])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>
  if (!client) return <div className="p-8 text-sm text-gray-400">Client not found</div>

  const activeDeals = deals.filter(d => d.status !== 'completed')
  const closedDeals = deals.filter(d => d.status === 'completed')
  const initials = `${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}`.toUpperCase()

  const hasSmsfOpportunity = (client.position_assets || []).some((a: any) => a.assetType === 'Super' && Number(a.value || 0) >= 250000)
  const hasCarLoan = (client.position_liabilities || []).some((l: any) => l.liabilityType === 'Car loan')

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link href="/clients" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={14} /> Back to clients
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <div style={{ background: 'rgba(45,190,255,0.12)', color: '#2DBEFF' }}
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold flex-shrink-0">
          {initials || '?'}
        </div>
        <div>
          <p className="text-lg font-semibold text-[#343333]">{client.first_name} {client.last_name}</p>
          <p className="text-sm text-gray-400">{client.email}{client.phone ? ` · ${client.phone}` : ''}</p>
          {(hasSmsfOpportunity || hasCarLoan) && (
            <div className="flex gap-2 mt-2">
              {hasSmsfOpportunity && (
                <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">SMSF opportunity</span>
              )}
              {hasCarLoan && (
                <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Car loan present</span>
              )}
            </div>
          )}
        </div>
      </div>

      {activeDeals.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Active deal{activeDeals.length > 1 ? 's' : ''}</p>
          <div className="flex flex-col gap-2">
            {activeDeals.map(d => (
              <Link key={d.id} href={`/deals/${d.id}`}
                className="bg-gray-50 rounded-lg px-4 py-3 flex justify-between items-center hover:bg-gray-100 transition">
                <div>
                  <p className="text-sm font-medium text-[#343333]">{d.deal_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.deal_type} · Broker: {d.assigned_broker}</p>
                </div>
                <span className="text-xs font-medium bg-[#2DBEFF]/10 text-[#2DBEFF] px-2.5 py-1 rounded-full">{d.stage} →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {closedDeals.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Closed deals ({closedDeals.length})</p>
          <div className="flex flex-col gap-1">
            {closedDeals.map(d => (
              <Link key={d.id} href={`/deals/${d.id}`}
                className="rounded-lg px-4 py-2 flex justify-between items-center hover:bg-gray-50 transition">
                <span className="text-sm">{d.deal_name} · <span className="text-gray-400">Broker: {d.assigned_broker}</span></span>
                <span className="text-xs text-gray-400">View →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {deals.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-sm text-gray-400">
          No deals for this client yet.
        </div>
      )}

      {client.position_updated_at && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-[#343333]">Financial position</p>
            <span className="text-xs text-gray-400">Last updated {new Date(client.position_updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>

          {(client.position_properties || []).length > 0 && (
            <div className="bg-white border border-gray-100 border-l-4 border-l-amber-400 rounded-xl p-5 mb-3">
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-3">Properties</p>
              <div className="flex flex-col gap-2">
                {client.position_properties.map((p: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium text-[#343333]">{p.address || 'Address not set'}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.ownershipType === 'Owner occupied' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                        {p.ownershipType}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Value: {p.value ? `$${Number(p.value).toLocaleString('en-AU')}` : 'Not provided'}</p>
                    {(p.loans || []).map((loan: any, li: number) => (
                      <p key={li} className="text-xs text-gray-500">{loan.lenderName || 'Lender not set'} — balance ${Number(loan.balance || 0).toLocaleString('en-AU')}{loan.interestRate ? `, ${loan.interestRate}%` : ''}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(client.position_liabilities || []).length > 0 && (
            <div className="bg-white border border-gray-100 border-l-4 border-l-red-400 rounded-xl p-5">
              <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-3">Liabilities</p>
              <div className="flex flex-col gap-2">
                {client.position_liabilities.map((l: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">{l.liabilityType}</span>
                    <span className="text-sm text-gray-600 flex-1">
                      {l.liabilityType === 'Credit card' ? `Limit $${Number(l.limitAmount || 0).toLocaleString('en-AU')}` : `Balance $${Number(l.balance || 0).toLocaleString('en-AU')}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
