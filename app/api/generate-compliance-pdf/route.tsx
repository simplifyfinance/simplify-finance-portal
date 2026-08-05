import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 4, fontWeight: 700 },
  subtitle: { fontSize: 9, color: '#999', marginBottom: 16 },
  section: { marginBottom: 10, padding: 10, borderRadius: 4, borderLeftWidth: 3 },
  sectionTitle: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  line: { marginBottom: 3, color: '#444', lineHeight: 1.4 },
  subCard: { backgroundColor: '#F5F5F4', borderRadius: 4, padding: 8, marginBottom: 6 },
  applicantName: { fontWeight: 700, marginBottom: 3 },
  row: { flexDirection: 'row', marginBottom: 2 },
  rowLabel: { color: '#666', width: '55%' },
  rowValue: { fontWeight: 700, width: '45%' },
})

function fmtMoney(v: any): string {
  const n = Number(v)
  if (!v || isNaN(n)) return '0'
  return '$' + n.toLocaleString('en-AU')
}

const RISK_LABELS: { key: string; label: string }[] = [
  { key: 'adverseChanges', label: 'Anticipates adverse changes in circumstances' },
  { key: 'beneficialChanges', label: 'Anticipates beneficial changes in circumstances' },
  { key: 'retirementAge', label: 'Retirement age' },
  { key: 'repaymentMethod', label: 'Repayment method beyond retirement' },
  { key: 'financialExperience', label: 'Financial experience' },
  { key: 'interestRateConcern', label: 'Concern re: interest rate rises' },
  { key: 'loanFlexibility', label: 'Need for loan flexibility' },
  { key: 'jobSecurity', label: 'Job security' },
  { key: 'propertyValueConcern', label: 'Concern re: property value fluctuation' },
  { key: 'emergencyFund', label: 'Has emergency fund' },
  { key: 'maintainLifestyle', label: 'Can maintain lifestyle after repayments' },
  { key: 'adequateInsurance', label: 'Has adequate insurance' },
  { key: 'hasWill', label: 'Has a will' },
  { key: 'circumstancesImpact', label: 'Circumstances may impact ability to repay' },
  { key: 'problemsMeetingCommitments', label: 'History of problems meeting commitments' },
  { key: 'officerInLiquidation', label: 'Officer of a company in liquidation' },
  { key: 'unsatisfiedJudgements', label: 'Unsatisfied judgements against them' },
  { key: 'simultaneousApplications', label: 'Simultaneous applications with other lenders' },
  { key: 'declaredBankrupt', label: 'Previously declared bankrupt' },
]

const PRODUCT_LABELS: { key: string; label: string }[] = [
  { key: 'fixedRate', label: 'Fixed rate' },
  { key: 'variableRate', label: 'Variable rate' },
  { key: 'fixedAndVariable', label: 'Fixed and variable split' },
  { key: 'principalAndInterest', label: 'Principal & interest' },
  { key: 'interestOnly', label: 'Interest only' },
  { key: 'interestInAdvance', label: 'Interest in advance' },
  { key: 'lineOfCredit', label: 'Line of credit' },
  { key: 'offsetAccount', label: 'Offset account' },
  { key: 'redraw', label: 'Redraw' },
  { key: 'otherRequirements', label: 'Other requirements' },
  { key: 'lowestCost', label: 'Importance: lowest cost' },
  { key: 'approvedQuickly', label: 'Importance: approved quickly' },
  { key: 'specificFeatures', label: 'Importance: specific features' },
  { key: 'lenderPolicy', label: 'Importance: lender policy fit' },
  { key: 'branchFrequency', label: 'Branch visit frequency' },
]

const EXPENSE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'groceries', label: 'Groceries' },
  { key: 'clothingPersonalCare', label: 'Clothing and personal care' },
  { key: 'petCare', label: 'Pet care' },
  { key: 'phoneInternetSubscriptions', label: 'Phone, internet and subscriptions' },
  { key: 'other', label: 'Other' },
  { key: 'privateSchoolingTuition', label: 'Private schooling and tuition' },
  { key: 'childcare', label: 'Childcare' },
  { key: 'publicEducation', label: 'Public education' },
  { key: 'higherEducationTraining', label: 'Higher education and training' },
  { key: 'recreationEntertainment', label: 'Recreation and entertainment' },
  { key: 'sicknessAccidentLifeInsurance', label: 'Sickness, accident and life insurance' },
  { key: 'medicalHealth', label: 'Medical and health' },
  { key: 'healthInsurance', label: 'Health insurance' },
  { key: 'generalBasicInsurances', label: 'General basic insurances' },
  { key: 'transport', label: 'Transport' },
  { key: 'secondaryResidenceRunningCosts', label: 'Secondary residence running costs' },
  { key: 'primaryResidenceRunningCosts', label: 'Primary residence running costs' },
  { key: 'investmentPropertyRunningCosts', label: 'Investment property running costs' },
  { key: 'primaryResidenceBodyCorp', label: 'Primary residence body corp' },
  { key: 'childSpousalMaintenance', label: 'Child and spousal maintenance' },
  { key: 'rent', label: 'Rent' },
  { key: 'board', label: 'Board' },
]

export async function POST(req: NextRequest) {
  try {
    const { dealId } = await req.json()
    const supabase = await createSupabaseServer()
    const { data: deal } = await supabase.from('deals').select('*, clients(first_name, last_name)').eq('id', dealId).single()
    if (!deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

    const c = deal.compliance_data || {}
    const applicants = c.applicants || []
    const risks = c.risks || {}
    const productReqs = c.productReqs || {}
    const expenses = c.expenses || {}
    const totalExpenses = EXPENSE_CATEGORIES.reduce((sum, cat) => sum + (Number(expenses[cat.key]?.monthlyAmount) || 0), 0)

    const doc = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Compliance Summary — {deal.deal_name}</Text>
          <Text style={styles.subtitle}>Generated {new Date().toLocaleString('en-AU')}</Text>

          {/* Needs & Objectives */}
          <View style={[styles.section, { backgroundColor: '#F5F0FA', borderLeftColor: '#9333EA' }]}>
            <Text style={[styles.sectionTitle, { color: '#9333EA' }]}>Needs &amp; Objectives</Text>
            <Text style={styles.line}>Requirements type: {c.requirementsType || 'Not set'}</Text>
            {c.needsPrimary && <Text style={styles.line}>Primary need: {c.needsPrimary}</Text>}
            {c.needsImmediate && <Text style={styles.line}>Immediate goals (2 years): {c.needsImmediate}</Text>}
            {c.needsLongTerm && <Text style={styles.line}>Long-term goals (10 years): {c.needsLongTerm}</Text>}
          </View>

          {/* Risk Assessment */}
          {applicants.length > 0 && (
            <View style={[styles.section, { backgroundColor: '#FEF2F2', borderLeftColor: '#DC2626' }]}>
              <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>Risk Assessment</Text>
              {applicants.map((a: any, i: number) => {
                const r = risks[a.name] || {}
                return (
                  <View key={i} style={styles.subCard}>
                    <Text style={styles.applicantName}>{a.name}</Text>
                    {RISK_LABELS.map(rl => r[rl.key] ? (
                      <View key={rl.key} style={styles.row}>
                        <Text style={styles.rowLabel}>{rl.label}</Text>
                        <Text style={styles.rowValue}>{r[rl.key]}</Text>
                      </View>
                    ) : null)}
                  </View>
                )
              })}
            </View>
          )}

          {/* Product Requirements */}
          <View style={[styles.section, { backgroundColor: '#EAF6FF', borderLeftColor: '#2DBEFF' }]}>
            <Text style={[styles.sectionTitle, { color: '#2DBEFF' }]}>Product Requirements</Text>
            {PRODUCT_LABELS.map(pl => productReqs[pl.key] ? (
              <View key={pl.key} style={styles.row}>
                <Text style={styles.rowLabel}>{pl.label}</Text>
                <Text style={styles.rowValue}>{productReqs[pl.key]}</Text>
              </View>
            ) : null)}
          </View>

          {/* Broker Comments & Client Agreement */}
          <View style={[styles.section, { backgroundColor: '#EAFBF1', borderLeftColor: '#16A34A' }]}>
            <Text style={[styles.sectionTitle, { color: '#16A34A' }]}>Broker Comments &amp; Client Agreement</Text>
            {c.clientAgreedLender && (
              <Text style={[styles.line, { fontWeight: 700 }]}>
                {c.clientAgreedLender === 'Yes'
                  ? 'Client agreed with the recommended lender.'
                  : `Client chose a different lender: ${c.clientChosenLender === '__other__' ? c.clientChosenLenderOther : c.clientChosenLender}${c.clientChosenLenderReason ? ` (Reason: ${c.clientChosenLenderReason})` : ''}`}
              </Text>
            )}
            {c.analysisComment && <Text style={styles.line}>Analysis: {c.analysisComment}</Text>}
            {c.optionsComment && <Text style={styles.line}>Options considered: {c.optionsComment}</Text>}
            {c.borrowingPowerComment && <Text style={styles.line}>Borrowing power: {c.borrowingPowerComment}</Text>}
            {c.depositComment && <Text style={styles.line}>Deposit: {c.depositComment}</Text>}
            {c.creditHistoryComment && <Text style={styles.line}>Credit history: {c.creditHistoryComment}</Text>}
            {c.securityComment && <Text style={styles.line}>Security: {c.securityComment}</Text>}
            {c.applicationSubmissionComment && <Text style={styles.line}>Application submission: {c.applicationSubmissionComment}</Text>}
          </View>

          {/* Expenses */}
          <View style={[styles.section, { backgroundColor: '#FEF6E7', borderLeftColor: '#D97706' }]}>
            <Text style={[styles.sectionTitle, { color: '#D97706' }]}>Expenses</Text>
            {EXPENSE_CATEGORIES.map(cat => {
              const amt = Number(expenses[cat.key]?.monthlyAmount) || 0
              if (!amt) return null
              return (
                <View key={cat.key} style={styles.row}>
                  <Text style={styles.rowLabel}>{cat.label}</Text>
                  <Text style={styles.rowValue}>{fmtMoney(amt)}/month</Text>
                </View>
              )
            })}
            <View style={[styles.row, { marginTop: 4, borderTopWidth: 1, borderTopColor: '#E5D5B8', paddingTop: 4 }]}>
              <Text style={[styles.rowLabel, { fontWeight: 700 }]}>Total monthly expenses</Text>
              <Text style={styles.rowValue}>{fmtMoney(totalExpenses)}/month</Text>
            </View>
          </View>
        </Page>
      </Document>
    )

    const buffer = await renderToBuffer(doc)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${deal.deal_name}-compliance.pdf"`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
