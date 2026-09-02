// The Fact Find.
//
// This was a "Deal Summary" that showed a handful of lines per section and
// printed most of the money on the file as "0" - because the forms store money
// as formatted strings and `Number("5,250,000")` is NaN. See lib/money.ts.
//
// It is now the whole fact find, section by section in the order the tabs run,
// in the same clothes as the handover so the two documents that travel together
// on the push email look like a pair. Fabio, 2 Sep 2026: "I want every section
// of the FF tab personal details income employment other assets properties
// liabilities ALL of it".
//
// Named for the client, not for the deal record.
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import { money, moneyOrBlank, withFrequency, readMoney } from '@/lib/money'
import { notWorking, selfEmployed, currentEmployment, currentAddress, fullName,
         ageFrom, annualIncome, position, stillToConfirm } from '@/lib/fact-find'
import { applicantNamesOf } from '@/lib/applicants'
import { shortDate } from '@/lib/push-answers'

const INK = '#141C24', MUTE = '#7C8894', BODY = '#3D4750'
const RULE = '#E3E7EA', SOFT = '#F6F8FA', SKY = '#7FD3FF'
const REDBG = '#FDF0EF', AMB = '#FDF6E7', AMBB = '#EBD9BE', AMBI = '#8A6218'

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 42, fontSize: 9.5, fontFamily: 'Helvetica', color: BODY },
  inner: { paddingHorizontal: 34 },
  mast: { backgroundColor: INK, paddingHorizontal: 34, paddingTop: 22, paddingBottom: 18, marginBottom: 14 },
  kicker: { fontSize: 7.5, color: SKY, letterSpacing: 1.8, fontFamily: 'Helvetica-Bold' },
  name: { fontSize: 18, color: '#fff', fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 5 },
  meta: { fontSize: 8.5, color: '#A9B7C2' },
  big: { fontSize: 20, color: SKY, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  bigLab: { fontSize: 6.5, color: MUTE, letterSpacing: 1, textAlign: 'right', marginTop: 3, fontFamily: 'Helvetica-Bold' },
  statRow: { flexDirection: 'row', marginBottom: 4 },
  stat: { flex: 1, borderRadius: 7, padding: 9, marginRight: 7 },
  statLab: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .6 },
  statVal: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  secRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 8 },
  secTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.3, color: INK },
  secPill: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .7, color: MUTE, backgroundColor: '#EEF2F5', borderRadius: 9, paddingVertical: 3, paddingHorizontal: 7, marginLeft: 8 },
  secLine: { flex: 1, height: 2, backgroundColor: '#EEF2F5', marginLeft: 8 },
  card: { borderWidth: 1, borderColor: RULE, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  cardTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 6 },
  sub: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: .8, color: MUTE, marginTop: 7, marginBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 3 },
  k: { flex: 1, backgroundColor: SOFT, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, color: BODY },
  v: { width: 230, backgroundColor: SOFT, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' },
  note: { fontSize: 8.5, color: AMBI, backgroundColor: AMB, borderWidth: 1, borderColor: AMBB, borderRadius: 6, padding: 8, marginBottom: 5, lineHeight: 1.5 },
  body: { fontSize: 9, lineHeight: 1.6, color: BODY },
  foot: { position: 'absolute', bottom: 20, left: 34, right: 34, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EEF2F5', paddingTop: 6 },
  footText: { fontSize: 7, color: '#A9B7C2' },
})

const Sec = ({ t, pill }: { t: string; pill?: string }) => (
  <View style={s.secRow}><Text style={s.secTitle}>{t.toUpperCase()}</Text>
    {pill ? <Text style={s.secPill}>{pill.toUpperCase()}</Text> : null}<View style={s.secLine} /></View>
)
// A row with nothing in it is dropped rather than printed as a dash: a page of
// dashes reads as data lost.
const KV = ({ rows }: { rows: [string, any][] }) => (<>
  {rows.filter(([, v]) => String(v ?? '').trim() !== '').map(([k, v]) => (
    <View style={s.row} key={k} wrap={false}><Text style={s.k}>{k}</Text><Text style={s.v}>{String(v)}</Text></View>
  ))}
</>)
// Cards WRAP, unlike the handover's boxes. A handover box is copied whole so
// splitting one risks half an answer being pasted; a fact find is read, and
// refusing to split leaves half-empty pages.
const Card = ({ t, children }: { t: string; children: any }) => (
  <View style={s.card}><Text style={s.cardTitle}>{t}</Text>{children}</View>
)
const Foot = ({ who }: { who: string }) => (
  <View style={s.foot} fixed>
    <Text style={s.footText}>Fact Find — {who}</Text>
    <Text style={[s.footText, { marginLeft: 'auto' }]} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
)

const words = (v: any) => {
  const t = String(v || '').replace(/_/g, ' ').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : ''
}
const owners = (ownership: any, applicants: any[]): string =>
  (applicants || []).filter((a: any) => {
    const v = ownership?.[a.id]
    return v === 'Yes' || (Number(v) || 0) > 0
  }).map((a: any) => fullName(a)).join(', ')

const period = (from: any, to: any): string => {
  const a = String(from || '').trim(), b = String(to || '').trim()
  if (a && b) return `${a} – ${b}`
  if (a) return `From ${a}`
  return b ? `Until ${b}` : ''
}

export async function generateSummaryPdfBuffer(dealId: string, supabase: any): Promise<{ buffer: Buffer; dealName: string } | null> {
  const { data: deal } = await supabase.from('deals')
    .select('*, clients(first_name, last_name), lenders(name)').eq('id', dealId).single()
  if (!deal) return null

  const ff = deal.fact_find_data || {}
  const bc = deal.bc_data || {}
  const lo = deal.lo_data || {}
  const applicants = ff.applicants || []
  const names = applicantNamesOf(deal, bc)
  const who = names.join(' & ')
  const pos = position(ff)
  const toConfirm = stillToConfirm(deal)
  const fileName = `Fact Find - ${who}`.replace(/[\/\\:*?"<>|]/g, '-').slice(0, 180)

  const loanAmount = readMoney(deal.loan_amount)
  const lvr = readMoney(bc.lvrPercent) ?? null
  const meta = [
    words(deal.transaction_type),
    deal.lenders?.name || lo.recommendedLender || '',
    loanAmount !== null ? money(loanAmount) : '',
    words(deal.property_use),
  ].filter(Boolean).join('  ·  ')

  const doc = (
    <Document title={fileName}>
      {/* Page 1 — who they are, where they live, what they do */}
      <Page size="A4" style={s.page}>
        <View style={s.mast}><View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>FACT FIND</Text>
            <Text style={s.name}>{who}</Text>
            {meta ? <Text style={s.meta}>{meta}</Text> : null}
            <Text style={[s.meta, { marginTop: 3 }]}>Prepared {shortDate(new Date().toISOString().slice(0, 10))}</Text>
          </View>
          {lvr ? <View style={{ width: 90 }}><Text style={s.big}>{lvr}%</Text><Text style={s.bigLab}>LVR</Text></View> : null}
        </View></View>

        <View style={s.inner}>
          <View style={s.statRow}>
            <View style={[s.stat, { backgroundColor: SOFT }]}>
              <Text style={[s.statLab, { color: INK }]}>HOUSEHOLD INCOME</Text>
              <Text style={[s.statVal, { color: INK }]}>{money(pos.income) || '—'}</Text></View>
            <View style={[s.stat, { backgroundColor: SOFT }]}>
              <Text style={[s.statLab, { color: INK }]}>ASSETS</Text>
              <Text style={[s.statVal, { color: INK }]}>{money(pos.assets) || '—'}</Text></View>
            <View style={[s.stat, { backgroundColor: REDBG }]}>
              <Text style={[s.statLab, { color: '#dc2626' }]}>LIABILITIES</Text>
              <Text style={[s.statVal, { color: '#dc2626' }]}>{money(pos.liabilities) || '—'}</Text></View>
            <View style={[s.stat, { backgroundColor: '#EFFBF3', marginRight: 0 }]}>
              <Text style={[s.statLab, { color: '#15803d' }]}>NET POSITION</Text>
              <Text style={[s.statVal, { color: '#15803d' }]}>{money(pos.net) || '—'}</Text></View>
          </View>

          <Sec t="Applicants" pill={`${applicants.length}${ff.dependants ? ` · ${ff.dependants} dependants` : ''}`} />
          {applicants.map((a: any, i: number) => {
            const age = ageFrom(a.dob)
            return (
              <Card key={i} t={[a.title, fullName(a)].filter(Boolean).join(' ') || `Applicant ${i + 1}`}>
                <KV rows={[
                  ['Date of birth', a.dob ? `${a.dob}${age !== null ? ` (${age})` : ''}` : ''],
                  ['Gender', a.gender], ['Preferred name', a.preferredName], ['Previous name', a.previousName],
                  ['Mobile', a.phoneMobile], ['Email', a.emailPersonal],
                ]} />
              </Card>
            )
          })}

          <Sec t="Address history" />
          {applicants.map((a: any, i: number) => (
            <Card key={i} t={fullName(a) || `Applicant ${i + 1}`}>
              {(a.addresses || []).length === 0 ? <Text style={s.note}>No address recorded.</Text> : null}
              {(a.addresses || []).map((ad: any, j: number) => (
                <View key={j}>
                  <Text style={s.sub}>{ad.isCurrent ? 'CURRENT' : 'PREVIOUS'}</Text>
                  <KV rows={[
                    ['Address', ad.address], ['Status', ad.residentialStatus],
                    ['Period', period(ad.startDate, ad.endDate)],
                    // Only a renter or boarder is asked for this, so a home owner
                    // gets no empty row rather than a "not recorded".
                    ['Housing expense', /rent|board/i.test(String(ad.residentialStatus || ''))
                      ? (withFrequency(ad.housingExpenseAmount, ad.housingExpenseFrequency) || 'not recorded') : ''],
                  ]} />
                </View>
              ))}
            </Card>
          ))}

          <Sec t="Employment" />
          {applicants.map((a: any, i: number) => (
            <Card key={i} t={fullName(a) || `Applicant ${i + 1}`}>
              {(a.employment || []).length === 0 ? <Text style={s.note}>No employment recorded.</Text> : null}
              {(a.employment || []).map((e: any, j: number) => (
                <View key={j}>
                  <Text style={s.sub}>{[e.employmentPriority, e.isCurrent ? 'CURRENT' : 'PREVIOUS'].filter(Boolean).join(' · ').toUpperCase()}</Text>
                  {/* Not working is an answer. Nothing further is asked of it. */}
                  {notWorking(e)
                    ? <KV rows={[['Employment type', 'Not working'], ['Occupation', e.occupation]]} />
                    : <KV rows={[
                        ['Employment type', e.employmentType], ['Occupation', e.occupation],
                        ['Basis', e.employmentBasis],
                        [selfEmployed(e) ? 'Business' : 'Employer', e.employerName],
                        ['ABN', e.employerAbn], ['ACN', e.employerAcn], ['Employer type', e.employerType],
                        ['Employer address', e.employerAddress],
                        ['Period', period(e.startDate, e.endDate)],
                        ['On probation', e.onProbation ? 'Yes' : ''],
                        ['Contact', [e.contactPersonName, e.contactPersonDetails].filter(Boolean).join(' — ')],
                      ]} />}
                </View>
              ))}
            </Card>
          ))}
        </View>
        <Foot who={who} />
      </Page>

      {/* Page 2 — what they earn and what they own */}
      <Page size="A4" style={s.page}>
        <View style={[s.inner, { paddingTop: 28 }]}>
          <Sec t="Income" pill="annualised" />
          {applicants.map((a: any, i: number) => {
            const total = annualIncome(a)
            const jobs = currentEmployment(a)
            const idle = jobs.length > 0 && jobs.every(notWorking)
            return (
              <Card key={i} t={fullName(a) || `Applicant ${i + 1}`}>
                {idle && total === 0
                  ? <Text style={s.note}>Not working, so no income is expected. Recorded on the fact find as an answer, not as a gap.</Text>
                  : (a.income || []).length === 0
                    ? <Text style={s.note}>No income recorded.</Text>
                    : (a.income || []).map((inc: any, j: number) => (
                        <View key={j}>
                          {(a.income || []).length > 1 ? <Text style={s.sub}>{String(inc.incomeType || 'INCOME').toUpperCase()}</Text> : null}
                          <KV rows={[
                            ['Gross base salary', withFrequency(inc.grossSalary, inc.grossSalaryFrequency)],
                            ['Bonus', withFrequency(inc.bonusAmount, inc.bonusFrequency)],
                            ['Overtime (essential)', withFrequency(inc.overtimeEssentialAmount, inc.overtimeEssentialFrequency)],
                            ['Overtime (non-essential)', withFrequency(inc.overtimeNonEssentialAmount, inc.overtimeNonEssentialFrequency)],
                            ['Commission', withFrequency(inc.commissionAmount, inc.commissionFrequency)],
                            ['Allowances', withFrequency(inc.allowanceAmount, inc.allowanceFrequency)],
                            ['Business', inc.seBusinessName], ['ABN', inc.seAbn],
                            ['Assessment method', inc.seAssessmentMethod],
                            ['Director salary', withFrequency(inc.seDirectorSalary, inc.seDirectorSalaryFrequency)],
                            ['Other income', inc.otherIncomeType ? withFrequency(inc.otherIncomeAmount, 'annually') + ` (${inc.otherIncomeType})` : ''],
                          ]} />
                        </View>
                      ))}
                {total > 0 ? <KV rows={[['Total, annualised', money(total)]]} /> : null}
              </Card>
            )
          })}

          <Sec t="Other assets" pill={String((ff.assets || []).length)} />
          {(ff.assets || []).length === 0 ? <Text style={s.note}>No other assets recorded.</Text> : null}
          {(ff.assets || []).map((a: any, i: number) => (
            <Card key={i} t={[a.assetType, a.description].filter(Boolean).join(' — ') || 'Asset'}>
              <KV rows={[
                ['Value', moneyOrBlank(a.value)],
                ['BSB / account', [a.bsb, a.accountNumber].filter(Boolean).join(' · ')],
                ['Registration', a.regNumber], ['Membership', a.membershipNumber],
                ['Owned by', owners(a.ownership, applicants)],
              ]} />
            </Card>
          ))}

          <Sec t="Properties" pill={String((ff.properties || []).length)} />
          {(ff.properties || []).length === 0 ? <Text style={s.note}>No properties recorded.</Text> : null}
          {(ff.properties || []).map((p: any, i: number) => (
            <Card key={i} t={p.address || `Property ${i + 1}`}>
              <KV rows={[
                ['Ownership type', p.ownershipType], ['Future use', p.futureUse],
                ['Property subtype', p.propertySubtype], ['Zoning', p.zoning],
                ['Value', moneyOrBlank(p.value)], ['Valuation method', p.valuationMethod],
                ['RP Data estimate', money(p.rpDataEstimatedValue)],
                ['Running costs', withFrequency(p.runningCosts, p.runningCostsFrequency)],
                ['Strata', withFrequency(p.bodyCorpAmount, p.bodyCorpFrequency)],
                ['Rental income', withFrequency(p.rentalIncome, p.rentalIncomeFrequency)],
                ['Owned by', owners(p.ownership, applicants)],
              ]} />
              {(p.loans || []).map((l: any, j: number) => (
                <View key={j}>
                  <Text style={s.sub}>LINKED LOAN</Text>
                  <KV rows={[
                    ['Lender', l.lenderName], ['Mortgage type', l.mortgageType],
                    ['BSB / account', [l.bsb, l.accountNumber].filter(Boolean).join(' · ')],
                    ['Limit', money(l.limitAmount)], ['Balance', moneyOrBlank(l.balance)],
                    ['Interest rate', l.interestRate ? `${l.interestRate}%` : ''],
                    ['Repayment', [withFrequency(l.repaymentAmount, l.repaymentFrequency), l.repaymentType].filter(Boolean).join(' · ')],
                    ['Rate type', l.rateType],
                    ['Interest only expires', l.interestOnlyExpiryDate],
                    ['Loan term expires', l.loanTermExpiryDate],
                    ['Remaining term', l.remainingLoanTermYears ? `${l.remainingLoanTermYears} years` : ''],
                    ['Status', l.status], ['Owned by', owners(l.ownership, applicants)],
                  ]} />
                </View>
              ))}
            </Card>
          ))}

          <Sec t="Liabilities" pill="excludes property-linked loans" />
          {(ff.liabilities || []).length === 0 ? <Text style={s.note}>No other liabilities recorded.</Text> : null}
          {(ff.liabilities || []).map((l: any, i: number) => (
            <Card key={i} t={[l.liabilityType, l.lenderName].filter(Boolean).join(' — ') || 'Liability'}>
              <KV rows={[
                ['Account', l.accountNumber],
                ['Limit', money(l.limitAmount)], ['Balance', moneyOrBlank(l.balance)],
                ['Repayment', withFrequency(l.repaymentAmount, l.repaymentFrequency)],
                ['Status', l.status], ['Owned by', owners(l.ownership, applicants)],
              ]} />
            </Card>
          ))}
        </View>
        <Foot who={who} />
      </Page>

      {/* Page 3 — the deal itself */}
      <Page size="A4" style={s.page}>
        <View style={[s.inner, { paddingTop: 28 }]}>
          <Sec t="Borrowing capacity" pill={words(bc.template)} />
          <Card t="Scenario">
            <KV rows={[
              ['Template', words(bc.template)], ['State', bc.dutyState], ['Suburb', bc.suburb],
              ['Property type', bc.propertyType], ['Loan term', bc.loanTerm ? `${bc.loanTerm} years` : ''],
            ]} />
            <Text style={s.sub}>FIGURES</Text>
            <KV rows={[
              ['Purchase price', money(bc.purchasePrice) || money(bc.newPurchasePrice)],
              ['Deposit', money(bc.deposit) ? `${money(bc.deposit)}${bc.depositSource ? ` (${bc.depositSource})` : ''}` : ''],
              ['Stamp duty', money(bc.stampDuty)],
              ['Existing loan balance', money(bc.existingLoanBal)],
              ['Property value', money(bc.propertyValue)],
              ['Equity release', money(bc.equityRelease)],
              ['Land value', money(bc.landValue)], ['Construction cost', money(bc.constructionCost)],
              ['"As if complete" valuation', money(bc.asIfCompleteValue)],
              ['Loan amount', loanAmount !== null ? money(loanAmount) : ''],
              ['LVR', lvr ? `${lvr}%${lvr <= 80 ? ' (no LMI)' : ''}` : ''],
              ['LMI', money(bc.lmi)],
            ]} />
            {(bc.splits || []).length ? <Text style={s.sub}>LOAN SPLITS</Text> : null}
            <KV rows={(bc.splits || []).map((sp: any, i: number) => ([
              sp.label || `Split ${i + 1}`,
              [money(sp.amount), sp.rate ? `${sp.rate}%` : '', sp.type,
               sp.repayment ? `${money(sp.repayment)} monthly` : ''].filter(Boolean).join(' · '),
            ] as [string, string]))} />
          </Card>

          <Sec t="Lending options" pill={`${(lo.lenders || []).length} lenders compared`} />
          {(lo.lenders || []).filter((l: any) => l.lenderName).map((l: any, i: number) => {
            const rate = (m: any, label: string) => m?.enabled
              ? [`${m.rate}% p.a.`, m.repayment ? `${money(m.repayment)} monthly` : '', m.loanTerm ? `${m.loanTerm} years` : ''].filter(Boolean).join(' · ')
              : ''
            return (
              <Card key={i} t={[l.lenderName, l.productName].filter(Boolean).join(' — ')
                + (lo.recommendedLender === l.lenderName ? '      * RECOMMENDED' : '')}>
                <KV rows={[
                  ['Variable P&I', rate(l.variablePI, 'Variable P&I')],
                  ['Variable IO', rate(l.variableIO, 'Variable IO')],
                  ['Fixed P&I', rate(l.fixedPI, 'Fixed P&I')],
                  ['Fixed IO', rate(l.fixedIO, 'Fixed IO')],
                  ['Application fee', money(l.applicationFee)], ['Annual fee', money(l.annualFee)],
                  ['Valuation fee', money(l.valuationFee)], ['Legal fee', money(l.legalFee)],
                  ['Discharge fee', money(l.dischargeFee)],
                  ['Offset account', l.offsetAccount], ['Approval', l.approvalDays],
                  ['Note', l.specialNote],
                ]} />
              </Card>
            )
          })}
          {lo.recommendationNote ? <Card t="Recommendation"><Text style={s.body}>{lo.recommendationNote}</Text></Card> : null}

          {(ff.loanPurpose || ff.internalNotes) ? <Sec t="Loan purpose & notes" /> : null}
          {ff.loanPurpose ? <Card t="Loan purpose"><Text style={s.body}>{ff.loanPurpose}</Text></Card> : null}
          {ff.internalNotes ? <Card t="Internal notes"><Text style={s.body}>{ff.internalNotes}</Text></Card> : null}

          {toConfirm.length ? <Sec t="Still to confirm" pill={String(toConfirm.length)} /> : null}
          {toConfirm.length ? (
            <View style={{ borderWidth: 1, borderColor: AMBB, backgroundColor: AMB, borderRadius: 7, padding: 10 }} wrap={false}>
              {toConfirm.map(m => <Text key={m} style={{ fontSize: 9, color: AMBI, lineHeight: 1.6 }}>{m}</Text>)}
              <Text style={{ fontSize: 8, color: '#a08a5e', marginTop: 5, lineHeight: 1.5 }}>
                Only fields the fact find actually asks for. An applicant marked Not working is not asked
                for an employer, a basis or an income, and none is listed here.
              </Text>
            </View>
          ) : null}
        </View>
        <Foot who={who} />
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(doc)
  return { buffer, dealName: fileName }
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
        'Content-Disposition': `attachment; filename="${result.dealName}.pdf"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
