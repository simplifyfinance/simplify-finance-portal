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
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: clientData } = await supabase.from('clients').select('*').eq('id', clientId).single()
      setClient(clientData)
      const { data: dealsData } = await supabase.from('deals').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
      setDeals(dealsData || [])
      setLoading(false)
    }
    load()
  }, [clientId])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>
  if (!client) return <div className="p-8 text-sm text-gray-400">Client not found</div>

  const activeDeals = deals.filter(d => d.status !== 'completed')
  const closedDeals = deals.filter(d => d.status === 'completed')
  const initials = `${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}`.toUpperCase()

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
    </div>
  )
}
