'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type LoanSizeFilter = 'all' | 'under500' | '500to1m' | 'over1m'

function lvrBand(lvr: number): string {
  if (lvr <= 60) return '≤60%'
  if (lvr <= 70) return '70%'
  if (lvr <= 80) return '80%'
  return '90%'
}

const LVR_BANDS = ['≤60%', '70%', '80%', '90%']
const SECTIONS: { purpose: string; repaymentType: string; label: string }[] = [
  { purpose: 'Owner Occupied', repaymentType: 'PI', label: 'Owner occupied — principal and interest' },
  { purpose: 'Owner Occupied', repaymentType: 'IO', label: 'Owner occupied — interest only' },
  { purpose: 'Investment', repaymentType: 'PI', label: 'Investment — principal and interest' },
  { purpose: 'Investment', repaymentType: 'IO', label: 'Investment — interest only' },
]

export default function CheatSheetPage() {
  const supabase = createSupabaseBrowser()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loanSizeFilter, setLoanSizeFilter] = useState<LoanSizeFilter>('all')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('lender_rate_observations').select('*').not('rate', 'is', null).not('lvr', 'is', null)
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filteredRows = rows.filter(r => {
    if (loanSizeFilter === 'all') return true
    const amount = Number(r.loan_amount) || 0
    if (loanSizeFilter === 'under500') return amount < 500000
    if (loanSizeFilter === '500to1m') return amount >= 500000 && amount < 1000000
    if (loanSizeFilter === 'over1m') return amount >= 1000000
    return true
  })

  function getTopThree(purpose: string, repaymentType: string, band: string) {
    return filteredRows
      .filter(r => r.purpose === purpose && r.repayment_type === repaymentType && lvrBand(r.lvr) === band)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3)
  }

  const filterLabel: Record<LoanSizeFilter, string> = {
    all: 'All', under500: '<$500k', '500to1m': '$500k–$1M', over1m: '$1M+'
  }

  return (
    <div style={{ background: '#1a1a1a', minHeight: '100vh' }} className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-1">
          <p className="text-lg font-medium text-white">Rate cheat sheet</p>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Updated {new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Based on lending options entered by your team — not advertised rates</p>

        <div className="flex gap-2 mb-6">
          {(['all', 'under500', '500to1m', 'over1m'] as LoanSizeFilter[]).map(f => (
            <button key={f} onClick={() => setLoanSizeFilter(f)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
              style={loanSizeFilter === f
                ? { background: '#2DBEFF', color: '#fff' }
                : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
              {filterLabel[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading...</div>
        ) : (
          SECTIONS.map(section => (
            <div key={section.label} className="mb-6">
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#B79CFF' }}>{section.label}</p>
              <div className="rounded-xl overflow-hidden">
                <div className="grid grid-cols-[0.6fr_1fr_1fr_1fr]" style={{ background: '#232323' }}>
                  <span className="text-xs font-medium uppercase px-3.5 py-2.5" style={{ color: 'rgba(255,255,255,0.4)' }}>LVR</span>
                  <span className="text-xs font-medium uppercase text-center px-3.5 py-2.5" style={{ color: 'rgba(255,255,255,0.4)' }}>#1</span>
                  <span className="text-xs font-medium uppercase text-center px-3.5 py-2.5" style={{ color: 'rgba(255,255,255,0.4)' }}>#2</span>
                  <span className="text-xs font-medium uppercase text-center px-3.5 py-2.5" style={{ color: 'rgba(255,255,255,0.4)' }}>#3</span>
                </div>
                {LVR_BANDS.map((band, bi) => {
                  const top3 = getTopThree(section.purpose, section.repaymentType, band)
                  return (
                    <div key={band} className="grid grid-cols-[0.6fr_1fr_1fr_1fr] items-center"
                      style={{ background: '#1a1a1a', borderTop: bi > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                      <span className="text-sm px-3.5 py-3.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{band}</span>
                      {top3.length === 0 ? (
                        <span className="text-xs italic px-3.5 py-3.5 col-span-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Insufficient recent pricing data</span>
                      ) : (
                        [0, 1, 2].map(i => (
                          <div key={i} className="text-center py-2.5 relative"
                            style={i === 0 && top3[0] ? { margin: '6px', borderRadius: 'var(--radius)', background: 'rgba(124,224,160,0.15)' } : {}}>
                            {top3[i] && (
                              <>
                                <span className="absolute top-1.5 left-2 w-4 h-4 rounded-full text-[10px] font-medium flex items-center justify-center"
                                  style={i === 0 ? { background: '#7CE0A0', color: '#0b3d1f' } : { background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                                  {i + 1}
                                </span>
                                <p className="text-sm" style={{ color: '#fff' }}>{top3[i].lender_name}</p>
                                <p className="font-medium mt-0.5" style={{ fontSize: i === 0 ? '18px' : '16px', color: i === 0 ? '#7CE0A0' : '#fff' }}>{top3[i].rate}%</p>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        <p className="text-[10px] mt-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
          This pricing guide is for internal use only and is based on recent lending options presented to clients. Rates, fees, eligibility and lender policies may change without notice. Brokers must confirm current pricing and suitability before making a recommendation.
        </p>
      </div>
    </div>
  )
}
