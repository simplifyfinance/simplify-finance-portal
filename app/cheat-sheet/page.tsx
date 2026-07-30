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
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-1">
        <p className="text-lg font-medium text-[#343333]">Rate cheat sheet</p>
        <span className="text-xs text-gray-400">Updated {new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">Based on lending options entered by your team — not advertised rates</p>

      <div className="flex gap-2 mb-6">
        {(['all', 'under500', '500to1m', 'over1m'] as LoanSizeFilter[]).map(f => (
          <button key={f} onClick={() => setLoanSizeFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${loanSizeFilter === f ? 'bg-[#2DBEFF] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {filterLabel[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : (
        SECTIONS.map(section => (
          <div key={section.label} className="mb-6">
            <p className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-3">{section.label}</p>
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[0.6fr_1fr_1fr_1fr] bg-gray-50 px-4 py-2">
                <span className="text-xs font-medium text-gray-400 uppercase">LVR</span>
                <span className="text-xs font-medium text-gray-400 uppercase text-center">#1</span>
                <span className="text-xs font-medium text-gray-400 uppercase text-center">#2</span>
                <span className="text-xs font-medium text-gray-400 uppercase text-center">#3</span>
              </div>
              {LVR_BANDS.map(band => {
                const top3 = getTopThree(section.purpose, section.repaymentType, band)
                return (
                  <div key={band} className="grid grid-cols-[0.6fr_1fr_1fr_1fr] border-t border-gray-50 items-center">
                    <span className="text-sm text-gray-500 px-4 py-3">{band}</span>
                    {top3.length === 0 ? (
                      <span className="text-xs text-gray-300 italic px-4 py-3 col-span-3">Insufficient recent pricing data</span>
                    ) : (
                      <>
                        {[0, 1, 2].map(i => (
                          <div key={i} className="text-center py-3">
                            {top3[i] ? (
                              <>
                                <p className="text-sm">{top3[i].lender_name}</p>
                                <p className={`text-base font-medium ${i === 0 ? 'text-green-600' : 'text-[#343333]'}`}>{top3[i].rate}%</p>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      <p className="text-[10px] text-gray-400 mt-4">This pricing guide is for internal use only and is based on recent lending options presented to clients. Rates, fees, eligibility and lender policies may change without notice. Brokers must confirm current pricing and suitability before making a recommendation.</p>
    </div>
  )
}
