'use client'
import { brokerLabel } from '@/lib/broker-key'
import { PAGE_WIDE } from '@/lib/page-width'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'

type Client = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  created_at: string
}

type ClientDeal = { id: string; deal_name: string; assigned_broker?: string }

type ClientWithDeal = Client & {
  deals: ClientDeal[]
  assigned_broker?: string
}

// FIVE COLUMNS, NONE OF THEM PINNED TO AN EDGE.
//
// 7 Oct 2026. The old row put the name hard left and the deal hard right with a
// third of the screen dead between them, so your eye crossed that gap on every
// line to join a person to their deal. Four fields do not need 1900px; five
// columns that each earn their place do.
//
// ONE GRID, USED BY THE HEADER AND EVERY ROW, so a column cannot drift out of
// line with its own heading.
const ROW = 'grid grid-cols-[minmax(0,230px)_minmax(0,250px)_minmax(0,1fr)_110px_110px_40px] gap-4 items-center px-5 py-2.5'

// HOW LONG THE CLIENT HAS BEEN ON THE BOOKS. The client's own created_at, which
// is real - a deal has no "last touched" column, and inventing one out of the
// timestamps that happen to be filled in would be a figure nobody could stand
// behind.
function whenAdded(iso: string): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (!Number.isFinite(days) || days < 0) return ''
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'a week ago'
  if (days < 61) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithDeal[]>([])

  async function deleteClient(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) {
      alert('Error deleting client: ' + error.message)
      return
    }
    setClients(prev => prev.filter(c => c.id !== id))
  }
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
          // EVERY DEAL, NOT THE FIRST ONE.
          //
          // The select has always asked for all of them. The screen then read
          // deals[0], so a client with three deals looked like a client with
          // one - and the other two were unreachable from here.
          setClients(data.map((c: any) => ({
            ...c,
            deals: c.deals || [],
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
    <div className={PAGE_WIDE}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">Clients</h1>
        <p className="text-sm text-gray-500">All clients across your deals.</p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading clients...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">No clients found.</p>
      ) : (
        <div className="bg-card border border-card-line rounded-xl overflow-hidden">
          <div className={ROW + ' bg-gray-50 border-b border-line text-[9.5px] font-bold tracking-[.09em] uppercase text-faint'}>
            <span>Client</span><span>Contact</span><span>Deals</span><span>Broker</span><span>Added</span><span />
          </div>
          {filtered.map((client, i) => {
            const initials = `${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}`.toUpperCase()
            return (
              <div key={client.id}
                className={`${ROW} text-[13px] ${i < filtered.length - 1 ? 'border-b border-line-soft' : ''}`}>
                <Link href={`/clients/${client.id}`} className="flex items-center gap-2.5 min-w-0">
                  <span style={{ background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)',
                         color: 'var(--color-brand-ink)' }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {initials || '?'}
                  </span>
                  <span className="font-medium text-ink truncate">{client.first_name} {client.last_name}</span>
                </Link>

                <span className="min-w-0">
                  <span className="block truncate text-body">{client.email || <i className="not-italic text-faint">no email</i>}</span>
                  <span className="block text-[12px] text-faint">{client.phone}</span>
                </span>

                {/* ALL OF THEM. A client with three deals used to show one. */}
                <span className="flex gap-1.5 flex-wrap items-center min-w-0">
                  {client.deals.length === 0
                    ? <span className="text-faint">No deal</span>
                    : client.deals.map(d => (
                        <Link key={d.id} href={`/deals/${d.id}`}
                          className="text-[12px] rounded-full border border-info-edge bg-info-bg text-info px-2.5 py-[2px] max-w-full truncate hover:opacity-80">
                          {d.deal_name}
                        </Link>
                      ))}
                </span>

                <span className="text-muted truncate">{client.assigned_broker ? brokerLabel(client.assigned_broker) : ''}</span>
                <span className="text-muted whitespace-nowrap">{whenAdded(client.created_at)}</span>

                <button onClick={() => deleteClient(client.id, `${client.first_name} ${client.last_name}`)}
                  className="w-7 h-7 rounded-full border border-gray-200 bg-card flex items-center justify-center text-gray-300 hover:text-chase hover:border-chase-edge hover:bg-chase-bg flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
