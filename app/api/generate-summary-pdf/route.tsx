import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import { calculateSeAssessableIncome } from '@/lib/income-calculations'

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 4, fontWeight: 700 },
  subtitle: { fontSize: 9, color: '#999', marginBottom: 16 },
  section: { marginBottom: 10, padding: 10, borderRadius: 4, borderLeftWidth: 3 },
  sectionTitle: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  applicantBlock: { marginBottom: 8 },
  applicantName: { fontWeight: 700, marginBottom: 2 },
  line: { marginBottom: 1, color: '#444' },
  subCard: { backgroundColor: '#F5F5F4', borderRadius: 4, padding: 8, marginBottom: 6 },
  badge: { fontSize: 8, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, marginLeft: 6 },
})

function fmtMoney(v: any): string {
  const n = Number(v)
  if (!v || isNaN(n)) return '0'
  return '$' + n.toLocaleString('en-AU')
}

function freqLabel(f: string): string {
  return f === 'Fortnightly' ? 'fortnight' : f === 'Weekly' ? 'week' : 'month'
}

export async function generateSummaryPdfBuffer(dealId: string, supabase: any): Promise<{ buffer: Buffer; dealName: string } | null> {
    const { data: deal } = await supabase.from('deals').select('*, clients(first_name, last_name)').eq('id', dealId).single()
    if (!deal) return null

    const ff = deal.fact_find_data || {}
    const applicants = ff.applicants || []
    const properties = ff.properties || []
    const liabilities = ff.liabilities || []
    const bc = deal.bc_data || {}
    const lo = deal.lo_data || {}
    const totalLoanAmount = (bc.splits || []).reduce((sum: number, s: any) => sum + (Number((s.amount || '').toString().replace(/,/g, '')) || 0), 0)
    const purchasePriceNum = Number((bc.purchasePrice || '').toString().replace(/,/g, '')) || 0
    const simpleLvr = purchasePriceNum > 0 && totalLoanAmount > 0 ? Math.round((totalLoanAmount / purchasePriceNum) * 1000) / 10 : null

    const doc = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Deal Summary — {deal.deal_name}</Text>
          <Text style={styles.subtitle}>Generated {new Date().toLocaleString('en-AU')}</Text>

          {/* Applicants */}
          <View style={[styles.section, { backgroundColor: '#F5F0FA', borderLeftColor: '#9333EA' }]}>
            <Text style={[styles.sectionTitle, { color: '#9333EA' }]}>Applicants</Text>
            {applicants.map((a: any, i: number) => {
              const jobs = a.employment || []
              const incomes = a.income || []
              return (
                <View key={i} style={styles.applicantBlock}>
                  <Text style={styles.applicantName}>{a.title ? a.title + ' ' : ''}{a.firstName} {a.lastName}</Text>
                  {jobs.map((job: any, ji: number) => (
                    <Text key={ji} style={styles.line}>{job.occupation || 'Occupation not provided'} at {job.employerName || 'Employer not provided'} ({job.employmentBasis || 'basis not provided'})</Text>
                  ))}
                  {incomes.map((inc: any, ii: number) => {
                    if (inc.incomeType === 'Self-employed') {
                      const assessed = calculateSeAssessableIncome ? calculateSeAssessableIncome(inc) : null
                      return <Text key={ii} style={styles.line}>Self-employed — assessed income: {assessed ? fmtMoney(Math.round(assessed)) : 'not calculated'} p.a.</Text>
                    }
                    return <Text key={ii} style={styles.line}>{inc.incomeType || 'Income'}: {fmtMoney(inc.grossSalary)} {inc.grossSalaryFrequency || ''}</Text>
                  })}
                </View>
              )
            })}
          </View>

          {/* Properties */}
          {properties.length > 0 && (
            <View style={[styles.section, { backgroundColor: '#FEF6E7', borderLeftColor: '#D97706' }]}>
              <Text style={[styles.sectionTitle, { color: '#D97706' }]}>Properties</Text>
              {properties.map((prop: any, i: number) => (
                <View key={i} style={styles.subCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                    <Text style={{ fontWeight: 700 }}>{prop.address || 'Property'}</Text>
                    <Text style={[styles.badge, prop.ownershipType === 'Investment'
                      ? { backgroundColor: '#EDE9FE', color: '#5B21B6' }
                      : { backgroundColor: '#FEF3C7', color: '#92400E' }]}>
                      {prop.ownershipType || 'Owner occupied'}
                    </Text>
                  </View>
                  <Text style={styles.line}>Value: {fmtMoney(prop.value)}</Text>
                  {prop.ownershipType === 'Investment' && prop.rentalIncome && (
                    <Text style={styles.line}>Rental income: {fmtMoney(prop.rentalIncome)}/week</Text>
                  )}
                  {(prop.loans || []).map((loan: any, li: number) => (
                    <Text key={li} style={styles.line}>Linked loan: {loan.lenderName || 'Lender'} — Balance {fmtMoney(loan.balance)}</Text>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Liabilities */}
          {liabilities.length > 0 && (
            <View style={[styles.section, { backgroundColor: '#FEF2F2', borderLeftColor: '#DC2626' }]}>
              <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>Liabilities</Text>
              {liabilities.map((liab: any, i: number) => (
                <View key={i} style={styles.subCard}>
                  <Text style={{ fontWeight: 700, marginBottom: 3 }}>{liab.liabilityType}</Text>
                  {liab.liabilityType === 'Credit card' && <Text style={styles.line}>Limit: {fmtMoney(liab.limitAmount)}</Text>}
                  {liab.liabilityType === 'HECS' && <Text style={styles.line}>Balance: {fmtMoney(liab.balance)}</Text>}
                  {liab.liabilityType === 'Health Insurance' && <Text style={styles.line}>{fmtMoney(liab.repaymentAmount)}/{freqLabel(liab.repaymentFrequency)}</Text>}
                  {!['Credit card', 'HECS', 'Health Insurance'].includes(liab.liabilityType) && (
                    <Text style={styles.line}>Repayment: {fmtMoney(liab.repaymentAmount)}/{freqLabel(liab.repaymentFrequency)}, Balance: {fmtMoney(liab.balance)}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* BC */}
          {Object.keys(bc).length > 0 && (
            <View style={[styles.section, { backgroundColor: '#EAF6FF', borderLeftColor: '#2DBEFF' }]}>
              <Text style={[styles.sectionTitle, { color: '#2DBEFF' }]}>BC — Borrowing Capacity</Text>
              <Text style={styles.line}>Template: {(bc.template || '').replace(/_/g, ' ') || 'Not set'}</Text>
              {bc.purchasePrice && <Text style={styles.line}>Purchase price: {fmtMoney(bc.purchasePrice)}</Text>}
              {bc.deposit && <Text style={styles.line}>Deposit: {fmtMoney(bc.deposit)}{bc.depositSource ? ` (${bc.depositSource})` : ''}</Text>}
              {totalLoanAmount > 0 && <Text style={styles.line}>Loan amount: {fmtMoney(totalLoanAmount)}</Text>}
              {simpleLvr !== null && <Text style={styles.line}>LVR (est.): {simpleLvr}%</Text>}
            </View>
          )}

          {/* LO */}
          {(lo.lenders || []).length > 0 && (
            <View style={[styles.section, { backgroundColor: '#EAFBF1', borderLeftColor: '#16A34A' }]}>
              <Text style={[styles.sectionTitle, { color: '#16A34A' }]}>LO — Lending Options</Text>
              {lo.lenders.map((l: any, i: number) => {
                const rateText = l.variablePI?.enabled ? `${l.variablePI.rate}% variable P&I`
                  : l.variableIO?.enabled ? `${l.variableIO.rate}% variable IO`
                  : l.fixedPI?.enabled ? `${l.fixedPI.rate}% fixed P&I` : 'Rate not set'
                return (
                  <Text key={i} style={styles.line}>
                    {l.lenderName}{l.productName ? ` — ${l.productName}` : ''}: {rateText}{l.annualFee ? `, ${fmtMoney(l.annualFee)} annual fee` : ''}
                  </Text>
                )
              })}
              {lo.recommendedLender && (
                <Text style={[styles.line, { marginTop: 4, fontWeight: 700 }]}>
                  Recommended: {lo.recommendedLender}
                  {lo.clientAgreedLender === 'Yes' ? '  (Client agreed)' : lo.clientAgreedLender === 'No' ? `  (Client chose: ${lo.clientChosenLender === '__other__' ? lo.clientChosenLenderOther : lo.clientChosenLender})` : ''}
                </Text>
              )}
            </View>
          )}
        </Page>
      </Document>
    )

    const buffer = await renderToBuffer(doc)
    return { buffer, dealName: deal.deal_name }
}

export async function POST(req: NextRequest) {
  try {
    const { dealId } = await req.json()
    const supabase = await createSupabaseServer()
    const result = await generateSummaryPdfBuffer(dealId, supabase)
    if (!result) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.dealName}-summary.pdf"`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
