'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'

type Deal = {
  id: string
  deal_name: string
  stage: 'BC' | 'LO' | 'Compliance' | string
  client_proceeded?: boolean
  lo_client_proceeded?: boolean
  bc_completed_at?: string | null
  bc_sent_at?: string | null
  lo_completed_at?: string | null
  lo_sent_at?: string | null
  compliance_completed_at?: string | null
  assigned_broker?: string | null
  assigned_credit_officer?: string | null
  clients?: { first_name?: string; last_name?: string } | null
}

type Props = {
  deals: Deal[]
  fullName: string | null
  brokerKey: string | null
  creditOfficerId: string | null
  allowToggle: boolean
  defaultView: 'team' | 'mine'
}

const stageColor: Record<string, string> = {
  BC: 'bg-blue-100 text-blue-600',
  LO: 'bg-purple-100 text-purple-600',
  Compliance: 'bg-green-100 text-green-600',
}

type ActionType = 'proceeded_to_lo' | 'proceeded_to_compliance' | 'bc_to_lo' | 'lo_to_compliance'

const actionLabel: Record<ActionType, string> = {
  proceeded_to_lo: 'Client confirmed ready to proceed to LO',
  proceeded_to_compliance: 'Client confirmed ready to proceed to Compliance',
  bc_to_lo: 'BC ready for your review & send',
  lo_to_compliance: 'LO ready for your review & send',
}

const actionColor: Record<ActionType, string> = {
  proceeded_to_lo: 'bg-green-100 text-green-700',
  proceeded_to_compliance: 'bg-green-100 text-green-700',
  bc_to_lo: 'bg-blue-100 text-blue-700',
  lo_to_compliance: 'bg-purple-100 text-purple-700',
}

export default function DashboardClient({ deals, fullName, brokerKey, creditOfficerId, allowToggle, defaultView }: Props) {
  const [view, setView] = useState<'team' | 'mine'>(defaultView)
  const effectiveView = allowToggle ? view : defaultView

  const brokerSummary = useMemo(() => {
    const byBroker: Record<string, { BC: number; LO: number; Compliance: number; total: number }> = {}
    const source = effectiveView === 'mine' && (brokerKey || creditOfficerId)
      ? deals.filter(d =>
          (brokerKey && d.assigned_broker?.toLowerCase() === brokerKey.toLowerCase()) ||
          (creditOfficerId && d.assigned_credit_officer === creditOfficerId)
        )
      : deals
    source.forEach(d => {
      const key = d.assigned_broker || 'Unassigned'
      if (!byBroker[key]) byBroker[key] = { BC: 0, LO: 0, Compliance: 0, total: 0 }
      if (d.stage === 'BC' || d.stage === 'LO' || d.stage === 'Compliance') byBroker[key][d.stage]++
      byBroker[key].total++
    })
    return Object.entries(byBroker).sort((a, b) => b[1].total - a[1].total)
  }, [deals])

  const filteredDeals = useMemo(() => {
    if (effectiveView === 'mine' && (brokerKey || creditOfficerId)) {
      return deals.filter(d =>
        (brokerKey && d.assigned_broker?.toLowerCase() === brokerKey.toLowerCase()) ||
        (creditOfficerId && d.assigned_credit_officer === creditOfficerId)
      )
    }
    return deals
  }, [deals, allowToggle, view, brokerKey])

  const actionItems = useMemo(() => {
    const items: { deal: Deal; type: ActionType }[] = []
    for (const d of filteredDeals) {
      const isDealsBroker = !!brokerKey && d.assigned_broker?.toLowerCase() === brokerKey.toLowerCase()
      // Both "client proceeded" checks are scoped to the CURRENT stage and not-yet-completed -
      // these flags never reset once set, so without this scoping they'd stay flagged forever
      // even after the deal has long since moved past that point.
      if (d.client_proceeded && d.stage === 'LO' && !d.lo_completed_at) {
        items.push({ deal: d, type: 'proceeded_to_lo' })
      } else if (d.lo_client_proceeded && d.stage === 'Compliance' && !d.compliance_completed_at) {
        items.push({ deal: d, type: 'proceeded_to_compliance' })
      } else if (d.bc_completed_at && !d.bc_sent_at) {
        // Review-and-send is always the broker's action, regardless of who did the BC work
        if (isDealsBroker) items.push({ deal: d, type: 'bc_to_lo' })
      } else if (d.lo_completed_at && !d.lo_sent_at) {
        if (isDealsBroker) items.push({ deal: d, type: 'lo_to_compliance' })
      }
    }
    return items
  }, [filteredDeals, brokerKey])

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

      {brokerSummary.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400">Deals by broker</div>
            <div className="flex gap-3 text-xs text-gray-400">
              <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1" />BC</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-purple-500 mr-1" />LO</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-green-500 mr-1" />Compliance</span>
            </div>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(brokerSummary.length, 4)}, minmax(0, 1fr))` }}>
            {brokerSummary.map(([broker, counts]) => (
              <div key={broker} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-medium text-[#343333] mb-1">{broker}</div>
                <div className="text-xl font-medium text-[#343333] mb-2">{counts.total}</div>
                <div className="flex h-1.5 rounded-sm overflow-hidden">
                  {counts.BC > 0 && <div className="bg-blue-500" style={{ width: `${(counts.BC / counts.total) * 100}%` }} />}
                  {counts.LO > 0 && <div className="bg-purple-500" style={{ width: `${(counts.LO / counts.total) * 100}%` }} />}
                  {counts.Compliance > 0 && <div className="bg-green-500" style={{ width: `${(counts.Compliance / counts.total) * 100}%` }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span>{deal.clients?.first_name} {deal.clients?.last_name}</span>
                    {deal.assigned_broker && (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">Broker: {deal.assigned_broker}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {((deal.client_proceeded && deal.stage === 'LO' && !deal.lo_completed_at) ||
                    (deal.lo_client_proceeded && deal.stage === 'Compliance' && !deal.compliance_completed_at)) && (
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
