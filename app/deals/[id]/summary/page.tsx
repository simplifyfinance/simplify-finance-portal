'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { calculateSeAssessableIncome } from '@/lib/income-calculations'

function fmtMoney(v: any): string {
  const n = Number(v)
  if (!v || isNaN(n)) return ''
  return '$' + n.toLocaleString('en-AU')
}

function getApplicantIncomeLines(applicant: any): { label: string; value: string }[] {
  const employment = applicant.employment || []
  const income = applicant.income || []
  const lines: { label: string; value: string }[] = []

  const currentJobs = employment.filter((e: any) => e.isCurrent)
  const primary = currentJobs.find((e: any) => e.employmentPriority === 'Primary') || currentJobs[0]
  const secondary = currentJobs.find((e: any) => e.employmentPriority === 'Secondary')

  function describeJob(job: any) {
    if (!job) return null
    const matchedIncome = income.find((i: any) => i.employmentId === job.id)
    if (job.employmentType === 'Self-employed') {
      const finalFigure = matchedIncome ? calculateSeAssessableIncome(matchedIncome) : NaN
      return {
        role: `${job.occupation || 'Self-employed'} — ${job.employerName || ''}`.trim(),
        income: !isNaN(finalFigure) ? `${fmtMoney(finalFigure)} (assessed, ${matchedIncome?.seAssessmentMethod || 'method not set'})` : 'Not yet calculated'
      }
    }
    const base = matchedIncome ? fmtMoney(matchedIncome.grossSalary) : ''
    const freq = matchedIncome?.grossSalaryFrequency || ''
    return {
      role: `${job.employmentBasis || ''} — ${job.occupation || ''}, ${job.employerName || ''}`.trim(),
      income: base ? `${base} (${freq})` : 'Not provided'
    }
  }

  const primaryInfo = describeJob(primary)
  if (primaryInfo) {
    lines.push({ label: 'Current', value: primaryInfo.role })
    lines.push({ label: 'Income', value: primaryInfo.income })
  }
  const secondaryInfo = describeJob(secondary)
  if (secondaryInfo) {
    lines.push({ label: 'Second job', value: `${secondaryInfo.role} — ${secondaryInfo.income}` })
  }

  return lines
}

export default function DealSummaryPage() {
  const params = useParams()
  const dealId = params.id as string
  const supabase = createSupabaseBrowser()
  const [deal, setDeal] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function loadDeal() {
    const { data } = await supabase.from('deals').select('*').eq('id', dealId).single()
    if (data) setDeal(data)
    setLoading(false)
  }

  useEffect(() => {
    loadDeal()
    const channel = supabase
      .channel(`deal-summary-${dealId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals', filter: `id=eq.${dealId}` }, () => { loadDeal() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [dealId])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading summary...</div>
  if (!deal) return <div className="p-8 text-sm text-gray-400">Deal not found</div>

  const ff = deal.fact_find_data || {}
  const applicants = ff.applicants || []

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <p className="text-lg font-medium text-[#343333]">Deal summary — {deal.deal_name}</p>
        <span className="text-xs text-gray-400">Live data, always current</span>
      </div>

      <div className="bg-white border border-gray-100 border-l-4 border-l-purple-400 rounded-xl p-5 mb-4">
        <p className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-3">Applicants</p>
        <div className={`grid gap-5`} style={{ gridTemplateColumns: `repeat(${Math.min(applicants.length, 2) || 1}, minmax(0,1fr))` }}>
          {applicants.map((a: any) => (
            <div key={a.id}>
              <p className="text-sm font-medium text-[#343333] mb-2">{a.firstName} {a.lastName}</p>
              <table className="w-full text-sm">
                <tbody>
                  {getApplicantIncomeLines(a).map((line, i) => (
                    <tr key={i}>
                      <td className="text-gray-500 py-0.5 pr-2 align-top" style={{ width: '35%' }}>{line.label}</td>
                      <td className="py-0.5 font-medium">{line.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      {(ff.properties || []).length > 0 && (
        <div className="bg-white border border-gray-100 border-l-4 border-l-amber-400 rounded-xl p-5 mb-4">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-3">Properties</p>
          <div className="flex flex-col gap-2">
            {ff.properties.map((p: any) => {
              const isOwnerOcc = p.ownershipType === 'Owner occupied'
              const ownershipLabel = Object.entries(p.ownership || {})
                .map(([applicantId, pct]) => {
                  const app = applicants.find((a: any) => a.id === applicantId)
                  return app ? `${app.firstName} ${pct}%` : null
                })
                .filter(Boolean)
                .join(' / ')
              return (
                <div key={p.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-[#343333]">{p.address || 'Address not set'}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOwnerOcc ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                      {p.ownershipType}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr><td className="text-gray-500 py-0.5 pr-2" style={{ width: '35%' }}>Value</td><td className="py-0.5 font-medium">{fmtMoney(p.value) || 'Not provided'}</td></tr>
                      {p.rentalIncome && <tr><td className="text-gray-500 py-0.5 pr-2">Rental income</td><td className="py-0.5 font-medium">{fmtMoney(p.rentalIncome)}/{p.rentalIncomeFrequency || ''}</td></tr>}
                      {ownershipLabel && <tr><td className="text-gray-500 py-0.5 pr-2">Ownership</td><td className="py-0.5">{ownershipLabel}</td></tr>}
                      {(p.loans || []).map((loan: any, li: number) => (
                        <tr key={li}><td className="text-gray-500 py-0.5 pr-2">Linked loan</td><td className="py-0.5">{loan.lenderName || 'Lender not set'} — balance <b className="font-medium">{fmtMoney(loan.balance)}</b>{loan.repaymentAmount ? `, ${fmtMoney(loan.repaymentAmount)}/${loan.repaymentFrequency || ''}` : ''}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
