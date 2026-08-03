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

  useEffect(() => {
    if (deal?.deal_name) document.title = `Summary — ${deal.deal_name}`
  }, [deal])
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
  const bc = deal.bc_data || {}
  const lo = deal.lo_data || {}
  const totalLoanAmount = (bc.splits || []).reduce((sum: number, s: any) => sum + (Number((s.amount || '').toString().replace(/,/g, '')) || 0), 0)
  const purchasePriceNum = Number((bc.purchasePrice || '').toString().replace(/,/g, '')) || 0
  const simpleLvr = purchasePriceNum > 0 && totalLoanAmount > 0 ? Math.round((totalLoanAmount / purchasePriceNum) * 1000) / 10 : null

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

      {(ff.liabilities || []).length > 0 && (
        <div className="bg-white border border-gray-100 border-l-4 border-l-red-400 rounded-xl p-5">
          <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-3">Liabilities</p>
          <div className="flex flex-col gap-2">
            {ff.liabilities.map((l: any) => {
              const badgeColors: Record<string, string> = {
                'Credit card': 'bg-red-100 text-red-700',
                'Car loan': 'bg-purple-100 text-purple-700',
                'Personal loan': 'bg-purple-100 text-purple-700',
                'HECS': 'bg-blue-100 text-blue-700',
                'Health insurance': 'bg-teal-100 text-teal-700',
              }
              const badgeClass = badgeColors[l.liabilityType] || 'bg-gray-100 text-gray-700'
              const owners = Object.entries(l.ownership || {})
                .filter(([, v]) => !!v)
                .map(([applicantId]) => applicants.find((a: any) => a.id === applicantId)?.firstName)
                .filter(Boolean)
                .join(' / ')
              const detail = l.liabilityType === 'Credit card'
                ? `Limit ${fmtMoney(l.limitAmount) || 'not provided'}`
                : `Balance ${fmtMoney(l.balance) || 'not provided'}${l.repaymentAmount ? `, ${fmtMoney(l.repaymentAmount)}/${l.repaymentFrequency || ''}` : ''}`
              return (
                <div key={l.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badgeClass}`}>{l.liabilityType}</span>
                  <span className="text-sm text-gray-600 flex-1">{detail}{l.lenderName ? ` — ${l.lenderName}` : ''}</span>
                  {owners && <span className="text-sm font-medium">{owners}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {Object.keys(bc).length > 0 && (
        <div className="bg-white border border-gray-100 border-l-4 border-l-[#2DBEFF] rounded-xl p-5 mb-4">
          <p className="text-xs font-medium text-[#2DBEFF] uppercase tracking-wider mb-3">BC — borrowing capacity</p>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="text-gray-500 py-1 pr-2" style={{ width: '35%' }}>Template</td><td className="py-1">{(bc.template || '').replace(/_/g, ' ') || 'Not set'}</td></tr>
              {bc.purchasePrice && <tr><td className="text-gray-500 py-1 pr-2">Purchase price</td><td className="py-1 font-medium">{fmtMoney(bc.purchasePrice)}</td></tr>}
              {bc.deposit && <tr><td className="text-gray-500 py-1 pr-2">Deposit</td><td className="py-1 font-medium">{fmtMoney(bc.deposit)}{bc.depositSource ? ` (${bc.depositSource})` : ''}</td></tr>}
              {totalLoanAmount > 0 && <tr><td className="text-gray-500 py-1 pr-2">Loan amount</td><td className="py-1 font-medium">{fmtMoney(totalLoanAmount)}</td></tr>}
              {simpleLvr !== null && <tr><td className="text-gray-500 py-1 pr-2">LVR (est.)</td><td className="py-1 font-medium">{simpleLvr}%</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {(lo.lenders || []).length > 0 && (
        <div className="bg-white border border-gray-100 border-l-4 border-l-green-500 rounded-xl p-5">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-3">LO — lending options</p>
          <table className="w-full text-sm mb-3">
            <tbody>
              {lo.lenders.map((l: any, i: number) => (
                <tr key={i}>
                  <td className="text-gray-500 py-1 pr-2" style={{ width: '40%' }}>{l.lenderName}{l.productName ? ` — ${l.productName}` : ''}</td>
                  <td className="py-1">
                    {l.variablePI?.enabled ? `${l.variablePI.rate}% variable P&I` : l.variableIO?.enabled ? `${l.variableIO.rate}% variable IO` : l.fixedPI?.enabled ? `${l.fixedPI.rate}% fixed P&I` : 'Rate not set'}
                    {l.annualFee ? `, ${fmtMoney(l.annualFee)} annual fee` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lo.recommendedLender && (
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="text-sm">Recommended: <b className="font-medium">{lo.recommendedLender}</b></span>
              {lo.clientAgreedLender && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${lo.clientAgreedLender === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {lo.clientAgreedLender === 'Yes' ? 'Client agreed' : `Client chose: ${lo.clientChosenLender === '__other__' ? lo.clientChosenLenderOther : lo.clientChosenLender}`}
                </span>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
