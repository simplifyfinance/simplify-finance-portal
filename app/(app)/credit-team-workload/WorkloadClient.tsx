'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type DealRow = {
  assigned_broker: string | null
  assigned_credit_officer: string | null
  bc_completed_at: string | null
  lo_completed_at: string | null
  compliance_completed_at: string | null
  credit_assigned_at: string | null
}

type BrokerStat = { name: string; total: number; inBC: number; inLO: number; inCompliance: number; completed: number }
type OfficerStat = { id: string; name: string; total: number; active: number; completed: number; avgBcDays: number | null; avgLoComplianceDays: number | null }

const BAR_COLOR = '#2DBEFF'
const DONUT_COLORS = ['#EF9F27', '#378ADD', '#639922', '#888780']

export default function WorkloadClient() {
  const supabase = createSupabaseBrowser()
  const [brokerStats, setBrokerStats] = useState<BrokerStat[]>([])
  const [officerStats, setOfficerStats] = useState<OfficerStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')

    const { data: settings } = await supabase.from('settings').select('brokers').eq('id', 'singleton').single()
    const brokerNames: string[] = (settings?.brokers || []).map((b: any) => (b.name || '').split(' ')[0]).filter(Boolean)

    const { data: officers, error: officersError } = await supabase
      .from('credit_officers')
      .select('id, name')
      .eq('active', true)
      .order('name')
    if (officersError) { setError(officersError.message); setLoading(false); return }

    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('assigned_broker, assigned_credit_officer, bc_completed_at, lo_completed_at, compliance_completed_at, credit_assigned_at')
    if (dealsError) { setError(dealsError.message); setLoading(false); return }

    const dealRows = (deals || []) as DealRow[]

    const brokers: BrokerStat[] = brokerNames.map(name => {
      const myDeals = dealRows.filter(d => d.assigned_broker === name)
      const completed = myDeals.filter(d => d.compliance_completed_at).length
      const inCompliance = myDeals.filter(d => d.lo_completed_at && !d.compliance_completed_at).length
      const inLO = myDeals.filter(d => d.bc_completed_at && !d.lo_completed_at && !d.compliance_completed_at).length
      const inBC = myDeals.filter(d => !d.bc_completed_at).length
      return { name, total: myDeals.length, inBC, inLO, inCompliance, completed }
    })

    function daysBetween(startIso: string, endIso: string): number {
      return Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60 * 60 * 24)
    }

    const officerRows: OfficerStat[] = (officers || []).map((o: any) => {
      const myDeals = dealRows.filter(d => d.assigned_credit_officer === o.id)
      const completedDeals = myDeals.filter(d => d.compliance_completed_at)
      const active = myDeals.length - completedDeals.length

      const bcTimes = myDeals
        .filter(d => d.credit_assigned_at && d.bc_completed_at && d.bc_completed_at > d.credit_assigned_at)
        .map(d => daysBetween(d.credit_assigned_at!, d.bc_completed_at!))
      const avgBcDays = bcTimes.length > 0 ? bcTimes.reduce((a, b) => a + b, 0) / bcTimes.length : null

      const loComplianceTimes = completedDeals
        .filter(d => d.credit_assigned_at)
        .map(d => daysBetween(d.credit_assigned_at!, d.compliance_completed_at!))
      const avgLoComplianceDays = loComplianceTimes.length > 0 ? loComplianceTimes.reduce((a, b) => a + b, 0) / loComplianceTimes.length : null

      return { id: o.id, name: o.name, total: myDeals.length, active, completed: completedDeals.length, avgBcDays, avgLoComplianceDays }
    })

    setBrokerStats(brokers)
    setOfficerStats(officerRows)
    setLoading(false)

    const totalDeals = dealRows.length
    const stageCounts = {
      inBC: dealRows.filter(d => !d.bc_completed_at).length,
      inLO: dealRows.filter(d => d.bc_completed_at && !d.lo_completed_at && !d.compliance_completed_at).length,
      inCompliance: dealRows.filter(d => d.lo_completed_at && !d.compliance_completed_at).length,
      completed: dealRows.filter(d => d.compliance_completed_at).length,
    }
    setStageDistribution({ total: totalDeals, ...stageCounts })
  }

  const [stageDistribution, setStageDistribution] = useState({ total: 0, inBC: 0, inLO: 0, inCompliance: 0, completed: 0 })

  function pct(n: number, total: number) {
    return total > 0 ? Math.round((n / total) * 100) : 0
  }

  const donutSegments = [
    { label: 'In BC', value: stageDistribution.inBC, color: DONUT_COLORS[0] },
    { label: 'In LO', value: stageDistribution.inLO, color: DONUT_COLORS[1] },
    { label: 'In Compliance', value: stageDistribution.inCompliance, color: DONUT_COLORS[2] },
    { label: 'Completed', value: stageDistribution.completed, color: DONUT_COLORS[3] },
  ]

  let cumulativePct = 0
  const gradientStops = donutSegments.map(seg => {
    const segPct = pct(seg.value, stageDistribution.total)
    const start = cumulativePct
    cumulativePct += segPct
    return `${seg.color} ${start}% ${cumulativePct}%`
  }).join(', ')

  const maxBrokerTotal = Math.max(1, ...brokerStats.map(b => b.total))
  const maxOfficerTotal = Math.max(1, ...officerStats.map(o => o.total))

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#343333] mb-1">Team workload</h1>
      <p className="text-sm text-gray-500 mb-8">Deal distribution and turnaround across brokers and the credit team.</p>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">{error}</div>}
      {loading && <div className="text-sm text-gray-400">Loading...</div>}

      {!loading && (
        <>
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Deals per broker</div>
              <div className="flex flex-col gap-3">
                {brokerStats.map(b => (
                  <div key={b.name}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className="font-medium text-[#343333]">{b.name}</span>
                      <span>{b.total}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(b.total / maxBrokerTotal) * 100}%`, background: BAR_COLOR }} />
                    </div>
                  </div>
                ))}
                {brokerStats.length === 0 && <div className="text-sm text-gray-400">No brokers found in Settings.</div>}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Overall stage distribution</div>
              <div className="flex items-center gap-6">
                <div style={{
                  width: 120, height: 120, borderRadius: '50%',
                  background: stageDistribution.total > 0 ? `conic-gradient(${gradientStops})` : '#eee',
                  flexShrink: 0
                }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <span style={{ fontSize: 18, fontWeight: 600, color: '#343333' }}>{stageDistribution.total}</span>
                      <span style={{ fontSize: 10, color: '#999' }}>deals</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {donutSegments.map(seg => (
                    <div key={seg.label} className="flex items-center gap-2 text-xs text-gray-600">
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, display: 'inline-block' }} />
                      {seg.label} — {seg.value} ({pct(seg.value, stageDistribution.total)}%)
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-5 mb-8">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Deals per credit officer (active vs completed)</div>
            <div className="flex flex-col gap-3">
              {officerStats.map(o => (
                <div key={o.id}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="font-medium text-[#343333]">{o.name}</span>
                    <span>{o.total} total</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="h-full" style={{ width: `${(o.active / maxOfficerTotal) * 100}%`, background: '#EF9F27' }} />
                    <div className="h-full" style={{ width: `${(o.completed / maxOfficerTotal) * 100}%`, background: '#639922' }} />
                  </div>
                </div>
              ))}
              {officerStats.length === 0 && <div className="text-sm text-gray-400">No active credit officers found.</div>}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span style={{ width: 10, height: 10, borderRadius: 2, background: '#EF9F27', display: 'inline-block' }} />Active</span>
              <span className="flex items-center gap-1.5"><span style={{ width: 10, height: 10, borderRadius: 2, background: '#639922', display: 'inline-block' }} />Completed</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {officerStats.map(o => (
              <div key={o.id} className="border border-gray-200 rounded-xl p-5 bg-white">
                <div className="font-medium text-[#343333] mb-3">{o.name}</div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Total</div>
                    <div className="text-xl font-semibold text-[#343333]">{o.total}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Active</div>
                    <div className="text-xl font-semibold text-amber-500">{o.active}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Avg. BC</div>
                    <div className="text-xl font-semibold text-[#343333]">{o.avgBcDays === null ? '—' : `${o.avgBcDays.toFixed(1)}d`}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Avg. LO + Compliance</div>
                    <div className="text-xl font-semibold text-[#343333]">{o.avgLoComplianceDays === null ? '—' : `${o.avgLoComplianceDays.toFixed(1)}d`}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
