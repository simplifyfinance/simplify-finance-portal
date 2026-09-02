// The Fact Find.
//
// This was a "Deal Summary" that showed a handful of lines per section and
// printed most of the money on the file as "0" - because the forms store money
// as formatted strings and `Number("5,250,000")` is NaN. See lib/money.ts.
//
// It is now the whole fact find, section by section in the order the tabs run.
// Fabio, 2 Sep 2026: "I want every section of the FF tab personal details
// income employment other assets properties liabilities ALL of it".
//
// LOOK AND FEEL. This is a data-entry document - somebody reads a field here
// and types it into SalesTrekker. So the eye has to find the edge of a section
// without reading. Fabio, 2 Sep 2026: "the boxes are more in line, they're
// separated... applicants should be a different colour... address history a
// completely separate field... make those things pop".
//
// So: every section owns a colour. The section band, the left edge of each of
// its cards, and each card's header strip are all that one colour, and the
// colour changes at every section boundary. Nothing else on the page is
// coloured, so the colour only ever means "this is where you are".
//
// The recommended product is marked the way the lending options email marks it,
// because staff already read it there: sorted to the front, an amber card, a
// filled RECOMMENDED pill. (No star glyph - Helvetica in react-pdf has no
// U+2605 and prints a bare box. Same trap as the HEM dots in the handover.)
//
// Named for the client, not for the deal record.
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import { money, moneyOrBlank, withFrequency, readMoney } from '@/lib/money'
import { notWorking, selfEmployed, currentEmployment, currentAddress, fullName,
         annualIncome, position, stillToConfirm, dateAU } from '@/lib/fact-find'
import { applicantNamesOf } from '@/lib/applicants'
import { shortDate } from '@/lib/push-answers'
import { rowLegalFeeLabel } from '@/lib/lender-fees'

const INK = '#141C24', MUTE = '#7C8894', BODY = '#3D4750'
const RULE = '#E3E7EA', SOFT = '#F6F8FA', SKY = '#7FD3FF'
const REDBG = '#FDF0EF', AMB = '#FDF6E7', AMBB = '#EBD9BE', AMBI = '#8A6218'

// One accent per section. `edge` is the 3-4px rail, `tint` the header strip,
// `ink` the type on that strip. Neighbouring sections never share one.
type Accent = { edge: string; tint: string; ink: string }
const A: Record<string, Accent> = {
  blue:   { edge: '#2DBEFF', tint: '#EAF6FD', ink: '#0B5E8A' },
  teal:   { edge: '#14A08B', tint: '#E6F5F2', ink: '#0C6355' },
  violet: { edge: '#7C6BD6', tint: '#F1EEFB', ink: '#463A8C' },
  green:  { edge: '#22A559', tint: '#EAF7EF', ink: '#15803D' },
  slate:  { edge: '#8B9AA8', tint: '#F1F4F7', ink: '#3E4C59' },
  navy:   { edge: '#2F5D8C', tint: '#EBF1F8', ink: '#1F3D5C' },
  amber:  { edge: '#D9A441', tint: '#FDF6E7', ink: '#8A6218' },
  red:    { edge: '#E06A62', tint: '#FDF0EF', ink: '#B23A34' },
}

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

  // The section band. Wide, filled, its own colour - the thing you find when
  // you flick through looking for "where does address history start".
  band: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 5, borderRadius: 4,
          paddingVertical: 7, paddingHorizontal: 10, marginTop: 20, marginBottom: 8 },
  bandTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 1.4 },
  bandPill: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .7, borderWidth: 1,
              backgroundColor: '#fff', borderRadius: 9, paddingVertical: 2.5, paddingHorizontal: 7, marginLeft: 'auto' },

  // Cards carry the section's colour on the left edge and across the header
  // strip, so a card is always legible as belonging to the band above it.
  card: { borderWidth: 1, borderColor: RULE, borderLeftWidth: 3, borderRadius: 7, marginBottom: 9 },
  cardHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 11,
              borderBottomWidth: 1, borderBottomColor: RULE },
  cardTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  cardTag: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .7, marginLeft: 'auto',
             borderRadius: 3, paddingVertical: 2.5, paddingHorizontal: 6 },
  cardBody: { paddingVertical: 9, paddingHorizontal: 11 },

  // CURRENT / PREVIOUS and the like: a chip, not a floating label, so two
  // addresses inside one card do not read as one address.
  sub: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .9, alignSelf: 'flex-start',
         borderRadius: 3, paddingVertical: 2.5, paddingHorizontal: 6, marginTop: 8, marginBottom: 4 },

  row: { flexDirection: 'row', marginBottom: 3 },
  k: { flex: 1, backgroundColor: SOFT, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, color: BODY },
  v: { width: 230, backgroundColor: SOFT, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' },
  note: { fontSize: 8.5, color: AMBI, backgroundColor: AMB, borderWidth: 1, borderColor: AMBB, borderRadius: 6, padding: 8, marginBottom: 5, lineHeight: 1.5 },
  body: { fontSize: 9, lineHeight: 1.6, color: BODY },
  foot: { position: 'absolute', bottom: 20, left: 34, right: 34, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EEF2F5', paddingTop: 6 },
  footText: { fontSize: 7, color: '#A9B7C2' },
})

const Sec = ({ t, pill, a, first }: { t: string; pill?: string; a: Accent; first?: boolean }) => (
  <View style={[s.band, { backgroundColor: a.tint, borderLeftColor: a.edge, marginTop: first ? 12 : 20 }]} wrap={false}>
    <Text style={[s.bandTitle, { color: a.ink }]}>{t.toUpperCase()}</Text>
    {pill ? <Text style={[s.bandPill, { color: a.ink, borderColor: a.edge }]}>{pill.toUpperCase()}</Text> : null}
  </View>
)

// A row with nothing in it is dropped rather than printed as a dash: a page of
// dashes reads as data lost.
const KV = ({ rows }: { rows: [string, any][] }) => (<>
  {rows.filter(([, v]) => String(v ?? '').trim() !== '').map(([k, v]) => (
    <View style={s.row} key={k} wrap={false}><Text style={s.k}>{k}</Text><Text style={s.v}>{String(v)}</Text></View>
  ))}
</>)

const Sub = ({ t, a }: { t: string; a: Accent }) => (
  <Text style={[s.sub, { backgroundColor: a.tint, color: a.ink }]}>{t.toUpperCase()}</Text>
)

// A CARD STAYS WHOLE.
//
// Same reason as the handover's boxes: staff read a card here and type it into
// SalesTrekker, and a card split over two pages is half a card. Fabio, 2 Sep
// 2026: "dont want this break in page remeber my staff need to copy and paste
// into a system".
//
// `wrap={false}` means a card that does not fit in the space left moves down
// whole. The only card allowed to break is one TALLER THAN A PAGE, which kept
// whole would have nowhere to go and would draw on top of itself. Call sites
// pass `rows` (and `chars` for prose) so we can tell the two apart before
// layout runs - react-pdf offers no measurement pass. The estimate is
// deliberately generous: calling a card too tall merely splits it, calling it
// short when it is not overlaps it, so we round up.
const ROW_H = 23        // a key/value row: 8.5pt type, 5pt padding each side, 3pt gap
const CARD_CHROME = 50  // header strip + body padding
const CARD_BUDGET = 680 // points of usable height on a content page

function cardFitsOnAPage(rows = 0, chars = 0): boolean {
  return CARD_CHROME + rows * ROW_H + Math.ceil(chars / 100) * 15 <= CARD_BUDGET
}

const Card = ({ t, a, tag, tagFill, strong, rows, chars, children }:
  { t: string; a: Accent; tag?: string; tagFill?: boolean; strong?: boolean
    rows?: number; chars?: number; children: any }) => {
  const whole = cardFitsOnAPage(rows, chars)
  return (
  <View style={[s.card, { borderLeftColor: a.edge },
                strong ? { borderWidth: 2, borderColor: a.edge, borderLeftWidth: 5 } : {}]}
        wrap={!whole} minPresenceAhead={whole ? 0 : 26}>
    <View style={[s.cardHead, { backgroundColor: a.tint }]} wrap={false}>
      <Text style={[s.cardTitle, { color: a.ink }]}>{t}</Text>
      {tag ? <Text style={[s.cardTag, tagFill
        ? { backgroundColor: a.edge, color: '#fff' }
        : { backgroundColor: '#fff', color: a.ink, borderWidth: 1, borderColor: a.edge }]}>{tag.toUpperCase()}</Text> : null}
    </View>
    <View style={s.cardBody}>{children}</View>
  </View>
  )
}

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

// Start and end as two rows, both dd/mm/yyyy. SalesTrekker has two fields, and
// a date with a word in front of it cannot be pasted into either. Fabio, 2 Sep
// 2026: "dates should be dd/mm/yyyy no works 'from' or 'age'".
const dates = (from: any, to: any): [string, any][] =>
  [['Start date', dateAU(from)], ['End date', dateAU(to)]]

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

  // Sorted the way the lending options email sorts them: the recommendation
  // first, so nobody has to hunt for it.
  const loLenders = (lo.lenders || []).filter((l: any) => l.lenderName)
  const isRec = (l: any) => !!lo.recommendedLender && l.lenderName === lo.recommendedLender
  const sortedLenders = [...loLenders].sort((x, y) => (isRec(x) ? -1 : 0) - (isRec(y) ? -1 : 0))

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

          <Sec t="Applicants" a={A.blue} first
               pill={`${applicants.length}${ff.dependants ? ` · ${ff.dependants} dependants` : ''}`} />
          {applicants.map((a: any, i: number) => {
            return (
              <Card key={i} a={A.blue}
                    t={[a.title, fullName(a)].filter(Boolean).join(' ') || `Applicant ${i + 1}`}
                    tag={`Applicant ${i + 1}`}>
                <KV rows={[
                  ['Date of birth', dateAU(a.dob)],
                  ['Gender', a.gender], ['Preferred name', a.preferredName], ['Previous name', a.previousName],
                  ['Mobile', a.phoneMobile], ['Email', a.emailPersonal],
                ]} />
              </Card>
            )
          })}

          <Sec t="Address history" a={A.teal} />
          {applicants.map((a: any, i: number) => (
            <Card key={i} a={A.teal} t={fullName(a) || `Applicant ${i + 1}`}
                  rows={(a.addresses || []).length * 5}>
              {(a.addresses || []).length === 0 ? <Text style={s.note}>No address recorded.</Text> : null}
              {(a.addresses || []).map((ad: any, j: number) => (
                <View key={j}>
                  <Sub t={ad.isCurrent ? 'Current' : 'Previous'} a={A.teal} />
                  <KV rows={[
                    ['Address', ad.address], ['Status', ad.residentialStatus],
                    ...dates(ad.startDate, ad.endDate),
                    // Only a renter or boarder is asked for this, so a home owner
                    // gets no empty row rather than a "not recorded".
                    ['Housing expense', /rent|board/i.test(String(ad.residentialStatus || ''))
                      ? (withFrequency(ad.housingExpenseAmount, ad.housingExpenseFrequency) || 'not recorded') : ''],
                  ]} />
                </View>
              ))}
            </Card>
          ))}

          <Sec t="Employment" a={A.violet} />
          {applicants.map((a: any, i: number) => (
            <Card key={i} a={A.violet} t={fullName(a) || `Applicant ${i + 1}`}
                  rows={(a.employment || []).length * 12}>
              {(a.employment || []).length === 0 ? <Text style={s.note}>No employment recorded.</Text> : null}
              {(a.employment || []).map((e: any, j: number) => (
                <View key={j}>
                  <Sub a={A.violet} t={[e.employmentPriority, e.isCurrent ? 'Current' : 'Previous'].filter(Boolean).join(' · ')} />
                  {/* Not working is an answer. Nothing further is asked of it. */}
                  {notWorking(e)
                    ? <KV rows={[['Employment type', 'Not working'], ['Occupation', e.occupation]]} />
                    : <KV rows={[
                        ['Employment type', e.employmentType], ['Occupation', e.occupation],
                        ['Basis', e.employmentBasis],
                        [selfEmployed(e) ? 'Business' : 'Employer', e.employerName],
                        ['ABN', e.employerAbn], ['ACN', e.employerAcn], ['Employer type', e.employerType],
                        ['Employer address', e.employerAddress],
                        ...dates(e.startDate, e.endDate),
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
          <Sec t="Income" pill="annualised" a={A.green} first />
          {applicants.map((a: any, i: number) => {
            const total = annualIncome(a)
            const jobs = currentEmployment(a)
            const idle = jobs.length > 0 && jobs.every(notWorking)
            return (
              <Card key={i} a={A.green} t={fullName(a) || `Applicant ${i + 1}`}
                    tag={total > 0 ? money(total) : undefined}
                    rows={(a.income || []).length * 12 + 1}>
                {idle && total === 0
                  ? <Text style={s.note}>Not working, so no income is expected. Recorded on the fact find as an answer, not as a gap.</Text>
                  : (a.income || []).length === 0
                    ? <Text style={s.note}>No income recorded.</Text>
                    : (a.income || []).map((inc: any, j: number) => (
                        <View key={j}>
                          {(a.income || []).length > 1 ? <Sub a={A.green} t={String(inc.incomeType || 'Income')} /> : null}
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

          <Sec t="Other assets" pill={String((ff.assets || []).length)} a={A.slate} />
          {(ff.assets || []).length === 0 ? <Text style={s.note}>No other assets recorded.</Text> : null}
          {(ff.assets || []).map((a: any, i: number) => (
            <Card key={i} a={A.slate} t={[a.assetType, a.description].filter(Boolean).join(' — ') || 'Asset'}
                  tag={moneyOrBlank(a.value) || undefined}>
              <KV rows={[
                ['Value', moneyOrBlank(a.value)],
                ['BSB / account', [a.bsb, a.accountNumber].filter(Boolean).join(' · ')],
                ['Registration', a.regNumber], ['Membership', a.membershipNumber],
                ['Owned by', owners(a.ownership, applicants)],
              ]} />
            </Card>
          ))}

          <Sec t="Properties" pill={String((ff.properties || []).length)} a={A.violet} />
          {(ff.properties || []).length === 0 ? <Text style={s.note}>No properties recorded.</Text> : null}
          {(ff.properties || []).map((p: any, i: number) => (
            <Card key={i} a={A.violet} t={p.address || `Property ${i + 1}`}
                  tag={moneyOrBlank(p.value) || undefined}
                  rows={11 + (p.loans || []).length * 14}>
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
                  <Sub t="Linked loan" a={A.violet} />
                  <KV rows={[
                    ['Lender', l.lenderName], ['Mortgage type', l.mortgageType],
                    ['BSB / account', [l.bsb, l.accountNumber].filter(Boolean).join(' · ')],
                    ['Limit', money(l.limitAmount)], ['Balance', moneyOrBlank(l.balance)],
                    ['Interest rate', l.interestRate ? `${l.interestRate}%` : ''],
                    ['Repayment', [withFrequency(l.repaymentAmount, l.repaymentFrequency), l.repaymentType].filter(Boolean).join(' · ')],
                    ['Rate type', l.rateType],
                    ['Interest only expires', dateAU(l.interestOnlyExpiryDate)],
                    ['Loan term expires', dateAU(l.loanTermExpiryDate)],
                    ['Remaining term', l.remainingLoanTermYears ? `${l.remainingLoanTermYears} years` : ''],
                    ['Status', l.status], ['Owned by', owners(l.ownership, applicants)],
                  ]} />
                </View>
              ))}
            </Card>
          ))}

          <Sec t="Liabilities" pill="excludes property-linked loans" a={A.red} />
          {(ff.liabilities || []).length === 0 ? <Text style={s.note}>No other liabilities recorded.</Text> : null}
          {(ff.liabilities || []).map((l: any, i: number) => (
            <Card key={i} a={A.red} t={[l.liabilityType, l.lenderName].filter(Boolean).join(' — ') || 'Liability'}
                  tag={moneyOrBlank(l.balance) || undefined}>
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
          <Sec t="Borrowing capacity" pill={words(bc.template)} a={A.navy} first />
          <Card t="Scenario" a={A.navy} tag={lvr ? `${lvr}% LVR` : undefined}
                rows={20 + (bc.splits || []).length}>
            <KV rows={[
              ['Template', words(bc.template)], ['State', bc.dutyState], ['Suburb', bc.suburb],
              ['Property type', bc.propertyType], ['Loan term', bc.loanTerm ? `${bc.loanTerm} years` : ''],
            ]} />
            <Sub t="Figures" a={A.navy} />
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
            {(bc.splits || []).length ? <Sub t="Loan splits" a={A.navy} /> : null}
            <KV rows={(bc.splits || []).map((sp: any, i: number) => ([
              sp.label || `Split ${i + 1}`,
              [money(sp.amount), sp.rate ? `${sp.rate}%` : '', sp.type,
               sp.repayment ? `${money(sp.repayment)} monthly` : ''].filter(Boolean).join(' · '),
            ] as [string, string]))} />
          </Card>

          <Sec t="Lending options" pill={`${loLenders.length} lenders compared`} a={A.blue} />

          {/* The recommendation leads, exactly as it does in the lending
              options email the client already received. */}
          {lo.recommendedLender && lo.recommendationNote
            ? <Card t={`Our recommendation — ${lo.recommendedLender}`} a={A.amber} tag="Recommended" tagFill strong
                    chars={String(lo.recommendationNote).length}>
                <Text style={s.body}>{lo.recommendationNote}</Text>
              </Card>
            : null}

          {sortedLenders.map((l: any, i: number) => {
            const rate = (m: any) => m?.enabled
              ? [`${m.rate}% p.a.`, m.repayment ? `${money(m.repayment)} monthly` : '', m.loanTerm ? `${m.loanTerm} years` : ''].filter(Boolean).join(' · ')
              : ''
            const rec = isRec(l)
            return (
              <Card key={i} a={rec ? A.amber : A.slate} strong={rec}
                    tag={rec ? 'Recommended' : `Option ${i + 1}`} tagFill={rec}
                    t={[l.lenderName, l.productName].filter(Boolean).join(' — ')}>
                <KV rows={[
                  ['Variable P&I', rate(l.variablePI)],
                  ['Variable IO', rate(l.variableIO)],
                  ['Fixed P&I', rate(l.fixedPI)],
                  ['Fixed IO', rate(l.fixedIO)],
                  ['Application fee', money(l.applicationFee)], ['Annual fee', money(l.annualFee)],
                  ['Valuation fee', money(l.valuationFee)], [rowLegalFeeLabel(l), money(l.legalFee)],
                  ['Discharge fee', money(l.dischargeFee)],
                  ['Offset account', l.offsetAccount], ['Approval', l.approvalDays],
                  ['Note', l.specialNote],
                ]} />
              </Card>
            )
          })}

          {(ff.loanPurpose || ff.internalNotes) ? <Sec t="Loan purpose & notes" a={A.slate} /> : null}
          {ff.loanPurpose ? <Card t="Loan purpose" a={A.slate} chars={String(ff.loanPurpose).length}><Text style={s.body}>{ff.loanPurpose}</Text></Card> : null}
          {ff.internalNotes ? <Card t="Internal notes" a={A.slate} chars={String(ff.internalNotes).length}><Text style={s.body}>{ff.internalNotes}</Text></Card> : null}

          {toConfirm.length ? <Sec t="Still to confirm" pill={String(toConfirm.length)} a={A.amber} /> : null}
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
