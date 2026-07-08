'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import Link from 'next/link'

type Client = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  created_at: string
}

type ClientWithDeal = Client & {
  deal_name?: string
  deal_id?: string
  assigned_broker?: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase
      .from('clients')
      .select('*, deals(id, deal_name, assigned_broker)')
      .order('first_name')
      .then(({ data }) => {
        if (data) {
          setClients(data.map((c: any) => ({
            ...c,
            deal_name: c.deals?.[0]?.deal_name,
            deal_id: c.deals?.[0]?.id,
            assigned_broker: c.deals?.[0]?.assigned_broker,
          })))
        }
        setLoading(false)
      })
  }, [])

  const filtered = clients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#343333] mb-1">Clients</h1>
        <p className="text-sm text-gray-500">All clients across your deals.</p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading clients...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">No clients found.</p>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {filtered.map((client, i) => {
            const initials = `${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}`.toUpperCase()
            return (
              <div key={client.id}
                className={`flex items-center gap-4 px-5 py-3 ${i < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div style={{ background: 'rgba(45,190,255,0.12)', color: '#2DBEFF' }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {initials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#343333]">{client.first_name} {client.last_name}</p>
                  <p className="text-xs text-gray-400">
                    {client.email}{client.phone ? ` · ${client.phone}` : ''}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  {client.deal_id ? (
                    <Link href={`/deals/${client.deal_id}`}
                      className="text-xs text-[#2DBEFF] hover:underline">
                      {client.deal_name}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-300">No deal</span>
                  )}
                  {client.assigned_broker && (
                    <p className="text-xs text-gray-400 mt-0.5">{client.assigned_broker}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
