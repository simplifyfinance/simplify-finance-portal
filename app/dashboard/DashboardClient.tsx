'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'

type Deal = {
  id: string
  deal_name: string
  stage: 'BC' | 'LO' | 'Compliance' | string
  client_proceeded?: boolean
  bc_completed_at?: string | null
  lo_completed_at?: string | null
  compliance_completed_at?: string | null
  assigned_broker?: string | null
  clients?: { first_name?: string; last_name?: string } | null
}

type Props = {
  deals: Deal[]
  fullName: string | null
  brokerKey: string | null
  allowToggle: boolean
}

const stageColor: Record<string, string> = {
  BC: 'bg-blue-100 text-blue-600',
  LO: 'bg-purple-100 text-purple-600',
  Compliance: 'bg-green-100 text-green-600',
}

type ActionType = 'proceeded' | 'bc_to_lo' | 'lo_to_compliance'

const actionLabel: Record<ActionType, string> = {
  proceeded: 'Client confirmed ready to proceed',
  bc_to_lo: 'BC complete — start LO',
  lo_to_compliance: 'LO complete — Compliance pending',
}

const actionColor: Record<ActionType, string> = {
  proceeded: 'bg-green-100 text-green-700',
  bc_to_lo: 'bg-blue-100 text-blue-700',
  lo_to_compliance: 'bg-purple-100 text-purple-700',
}

export default function DashboardClient({ deals, fullName, brokerKey, allowToggle }: Props) {
  const [view, setView] = useState<'team' | 'mine'>('team')

  const filteredDeals = useMemo(() => {
    if (allowToggle && view === 'mine' && brokerKey) {
      return deals.filter(d => d.assigned_broker?.toLowerCase() === brokerKey.toLowerCase())
    }
    return deals
  }, [deals, allowToggle, view, brokerKey])

  const actionItems = useMemo(() => {
    const items: { deal: Deal; type: ActionType }[] = []
    for (const d of filteredDeals) {
      if (d.client_proceeded) items.push({ deal: d, type: 'proceeded' })
      else if (d.bc_completed_at && !d.lo_completed_at) items.push({ deal: d, type: 'bc_to_lo' })
      else if (d.lo_completed_at && !d.compliance_completed_at) items.push({ deal: d, type: 'lo_to_compliance' })
    }
    return items
  }, [filteredDeals])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { BC: 0, LO: 0, Compliance: 0 }
    for (const d of filteredDeals) {
      if (counts[d.stage] !== undefined) counts[d.stage]++
    }
    return counts
  }, [filteredDeals])

  const total = filteredDeals.length
  const recent = filteredDeals.slice(0, 8)

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#343333]">
            Welcome back, {fullName?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {allowToggle && view === 'mine' ? 'Here is what is happening across your deals' : 'Here is what is happening across the team'}
          </p>
        </div>

        {allowToggle && (
          <div className="flex bg-gray-100 rounded-lg p-1 text-sm flex-shrink-0">
            <button
              onClick={() => setView('mine')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                view === 'mine' ? 'bg-white text-[#343333] shadow-sm' : 'text-gray-500'
              }`}>
              My deals
            </button>
            <button
              onClick={() => setView('team')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                view === 'team' ? 'bg-white text-[#343333] shadow-sm' : 'text-gray-500'
              }`}>
              Team deals
            </button>
          </div>
        )}
      </div>

      {/* Needs your action */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Needs your action</div>
        </div>
        {actionItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Nothing needs your attention right now
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {actionItems.slice(0, 6).map(({ deal, type }) => (
              <Link key={`${deal.id}-${type}`} href={`/deals/${deal.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                <div>
                  <div className="text-sm font-medium text-[#343333]">{deal.deal_name}</div>
                  <div className="text-xs text-gray-400">
                    {deal.clients?.first_name} {deal.clients?.last_name}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColor[type]}`}>
                  {actionLabel[type]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline funnel */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">Total deals</div>
          <div className="text-2xl font-semibold text-[#343333]">{total}</div>
        </div>
        {(['BC', 'LO', 'Compliance'] as const).map(stage => (
          <div key={stage} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">{stage} stage</div>
            <div className="text-2xl font-semibold text-[#343333]">{stageCounts[stage] || 0}</div>
          </div>
        ))}
      </div>

      {/* Recent deals */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent deals</div>
          <Link href="/deals" className="text-xs text-[#2DBEFF] hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No deals yet</div>
        ) : (
          recent.map(deal => {
            const initials = `${deal.clients?.first_name?.[0] || ''}${deal.clients?.last_name?.[0] || ''}`.toUpperCase()
            return (
              <Link key={deal.id} href={`/deals/${deal.id}`}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition">
                <div style={{ background: 'rgba(45,190,255,0.12)', color: '#2DBEFF' }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {initials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#343333] truncate">{deal.deal_name}</div>
                  <div className="text-xs text-gray-400">
                    {deal.clients?.first_name} {deal.clients?.last_name}
                    {deal.assigned_broker && <> · {deal.assigned_broker}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {deal.client_proceeded && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ready to proceed</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColor[deal.stage] || 'bg-gray-100 text-gray-500'}`}>
                    {deal.stage}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
