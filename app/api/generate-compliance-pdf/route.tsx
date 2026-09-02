// The handover.
//
// This was a "Compliance Summary": every field printed as one run-on line -
// "Analysis: ..." then "Options considered: ..." - with the AI's markdown
// asterisks printed raw. Nobody can copy a clean answer out of that, and the
// team's overseas staff copy every answer into the box of the same name in
// SalesTrekker.
//
// So it is a list of numbered BOXES now, named exactly as the SalesTrekker
// fields are named, in the order they appear on screen, each one whole and each
// one copyable. Fabio, 2 Sep 2026.
//
// The route path stays as it is - it is called from the deal page and from the
// push-to-SalesTrekker email - and only what it produces has changed.
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import { boxFitsOnAPage, NEEDS_BOXES, COMMENT_BOXES, parseBlocks, handoverFileName, hasContent, type Box } from '@/lib/handover'
import { titleSummary } from '@/lib/title'
import { hemStateOf, hemTotals, unansweredNote } from '@/lib/hem'
// The lists live in one place now. They used to be declared here AND in
// ComplianceForm, with a comment in this file claiming they were the same
// list. They were copies that happened to still agree.
import { EXPENSE_CATEGORIES, RISK_GROUPS, PRODUCT_GROUPS } from '@/lib/handover-view'
import { shortDate } from '@/lib/push-answers'

const INK = '#141C24', MUTE = '#7C8894', BODY = '#3D4750'
const RULE = '#E3E7EA', SOFT = '#F6F8FA', SKY = '#7FD3FF'
const RED = '#DC5B5B', REDBG = '#FDF0EF', REDINK = '#8A3A3A', GREEN = '#22c55e'

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 42, paddingHorizontal: 0, fontSize: 9.5, fontFamily: 'Helvetica', color: BODY },
  inner: { paddingHorizontal: 34 },

  mast: { backgroundColor: INK, paddingHorizontal: 34, paddingTop: 22, paddingBottom: 18, marginBottom: 16 },
  mastKicker: { fontSize: 7.5, color: SKY, letterSpacing: 1.8, fontFamily: 'Helvetica-Bold' },
  mastName: { fontSize: 18, color: '#fff', fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 5 },
  mastMeta: { fontSize: 8.5, color: '#A9B7C2' },
  mastCount: { fontSize: 20, color: SKY, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  mastCountLabel: { fontSize: 6.5, color: MUTE, letterSpacing: 1, textAlign: 'right', marginTop: 3, fontFamily: 'Helvetica-Bold' },

  how: { backgroundColor: '#EEF7FD', borderWidth: 1, borderColor: '#CDE6F6', borderRadius: 6, padding: 10, marginBottom: 14 },
  howText: { fontSize: 8.5, color: '#274456', lineHeight: 1.55 },

  secRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 9 },
  secTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.3, color: INK },
  secPill: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .7, color: MUTE, backgroundColor: '#EEF2F5', borderRadius: 9, paddingVertical: 3, paddingHorizontal: 7, marginLeft: 8 },
  secLine: { flex: 1, height: 2, backgroundColor: '#EEF2F5', marginLeft: 8 },

  // A COLUMN, not a row with a dark rail down the side. The rail looked better,
  // but a flex row cannot break across a page - so a box longer than a page was
  // crammed onto one and drawn on top of itself. See the note on BoxCard.
  box: { borderWidth: 1, borderColor: RULE, borderLeftWidth: 4, borderLeftColor: INK, borderRadius: 6, marginBottom: 10 },
  boxHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FB', paddingVertical: 8, paddingHorizontal: 11 },
  boxNo: { width: 17, height: 17, borderRadius: 9, backgroundColor: INK, color: '#fff', fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingTop: 4 },
  boxTick: { width: 12, height: 12, borderWidth: 1, borderColor: '#AEB8C0', borderRadius: 2, marginLeft: 'auto' },
  boxBody: { paddingVertical: 10, paddingHorizontal: 13 },
  boxTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, marginLeft: 8 },
  para: { fontSize: 9, lineHeight: 1.6, marginBottom: 6 },
  hr: { borderTopWidth: 1, borderTopColor: RULE, marginTop: 3, marginBottom: 8 },
  empty: { fontSize: 9, color: MUTE, fontStyle: 'italic' },

  tRow: { flexDirection: 'row', marginBottom: 3 },
  tQ: { flex: 1, backgroundColor: SOFT, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, color: BODY },
  tA: { width: 130, backgroundColor: SOFT, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' },
  groupLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTE, letterSpacing: .7, marginTop: 7, marginBottom: 4 },
  groupNote: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#8A6218', backgroundColor: '#FDF6E7', borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5 },
  noAnswers: { backgroundColor: '#FDF6E7', borderWidth: 1, borderColor: '#EBD9BE', borderRadius: 6, padding: 9, fontSize: 8.5, color: '#8A6218', marginBottom: 4 },

  eDotCell: { width: 20, paddingTop: 7, paddingLeft: 9 },
  eDot: { width: 6, height: 6, borderRadius: 3 },
  eName: { flex: 1, paddingVertical: 5, paddingHorizontal: 4, fontSize: 8.5, color: BODY },
  eAmt: { width: 66, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' },
  eState: { width: 88, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8, color: MUTE },

  totals: { flexDirection: 'row', marginTop: 9 },
  tot: { flex: 1, borderRadius: 7, padding: 9, marginRight: 7 },
  totLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .6 },
  totValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  warn: { marginTop: 8, borderWidth: 1, borderColor: '#F5C2C2', backgroundColor: REDBG, borderRadius: 6, padding: 8, fontSize: 8.5, color: REDINK },

  foot: { position: 'absolute', bottom: 20, left: 34, right: 34, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EEF2F5', paddingTop: 6 },
  footText: { fontSize: 7, color: '#A9B7C2' },
})


const money = (n: number) => '$' + Math.round(n).toLocaleString('en-AU')

function Section({ title, pill }: { title: string; pill?: string }) {
  return (
    <View style={styles.secRow}>
      <Text style={styles.secTitle}>{title.toUpperCase()}</Text>
      {pill ? <Text style={styles.secPill}>{pill.toUpperCase()}</Text> : null}
      <View style={styles.secLine} />
    </View>
  )
}

// A BOX STAYS WHOLE.
//
// The team selects a box and pastes it into SalesTrekker, so a box split over
// two pages is an answer pasted in two halves. Fabio, 2 Sep 2026: "dont want
// this break in page remeber my staff need to copy and paste into a system".
//
// So `wrap={false}`: a box that does not fit in the space left moves down to
// the next page whole. The one exception is a box TALLER THAN A PAGE - kept
// whole it would have nowhere to go and react-pdf would draw every line on top
// of the one before, which is the bug from earlier the same day. Those, and
// only those, are allowed to break, and they start on a fresh page so they
// break once instead of twice. boxFitsOnAPage() decides which is which.
function BoxCard({ n, label, text }: { n: number; label: string; text: string }) {
  const blocks = parseBlocks(text)
  const whole = boxFitsOnAPage(blocks)
  return (
    <View style={styles.box} wrap={!whole} break={!whole} minPresenceAhead={whole ? 0 : 70}>
      <View style={styles.boxHead} wrap={false}>
        <Text style={styles.boxNo}>{n}</Text>
        <Text style={styles.boxTitle}>{label}</Text>
        <View style={styles.boxTick} />
      </View>
      <View style={styles.boxBody}>
        {blocks.length === 0
          ? <Text style={styles.empty}>Not filled in.</Text>
          : blocks.map((b, i) => b.kind === 'rule'
              ? <View key={i} style={styles.hr} />
              : (
                // A paragraph stays whole. That is the unit somebody selects.
                <Text key={i} style={styles.para} wrap={false}>
                  {b.runs.map((r, j) => (
                    <Text key={j} style={r.bold ? { fontFamily: 'Helvetica-Bold', color: INK } : undefined}>{r.text}</Text>
                  ))}
                </Text>
              ))}
      </View>
    </View>
  )
}

function QaRows({ rows }: { rows: [string, string][] }) {
  return (
    <>
      {rows.map(([q, a]) => (
        <View style={styles.tRow} key={q} wrap={false}>
          <Text style={styles.tQ}>{q}</Text>
          <Text style={styles.tA}>{a}</Text>
        </View>
      ))}
    </>
  )
}

export async function generateCompliancePdfBuffer(dealId: string, supabase: any): Promise<{ buffer: Buffer; dealName: string } | null> {
  const { data: deal } = await supabase.from('deals').select('*, clients(first_name, last_name), lenders(name)').eq('id', dealId).single()
  if (!deal) return null

  const c = deal.compliance_data || {}
  const lo = deal.lo_data || {}
  const applicants: string[] = (c.applicants || []).map((a: any) => String(a?.name || '').trim()).filter(Boolean)
  const risks = c.risks || {}
  const productReqs = c.productReqs || {}
  const expenses = c.expenses || {}
  const totals = hemTotals(EXPENSE_CATEGORIES, expenses)

  // Ownership is not a text field - it is built from the tick boxes, the reason
  // and the legal advice answer. It reads as one box like all the others.
  const ownershipText = titleSummary(c.title, applicants)
  const textFor = (b: Box) => (b.key === '__title' ? ownershipText : String(c[b.key] || ''))

  const boxes: Box[] = [...NEEDS_BOXES, ...COMMENT_BOXES]
  const filled = boxes.filter(b => hasContent(textFor(b)))
  const fileName = handoverFileName(applicants, deal.deal_name)
  const who = applicants.length ? applicants.join(' & ') : String(deal.deal_name || '').replace(/_/g, ' ')

  // These are database values - "owner_occupied", "equity_release" - and they
  // were going onto the front page of a client document exactly as stored.
  const words = (v: any) => {
    const s = String(v || '').replace(/_/g, ' ').trim()
    return s ? s[0].toUpperCase() + s.slice(1) : ''
  }
  const meta = [
    // A pre-approval leads, because it explains the TBA further down.
    c.preApproval ? 'Pre-approval — no security yet' : '',
    words(deal.transaction_type),
    deal.lenders?.name || lo.recommendedLender || '',
    deal.loan_amount ? money(Number(deal.loan_amount)) : '',
    words(deal.property_use),
  ].filter(Boolean).join('  ·  ')

  let n = 0
  const doc = (
    <Document title={fileName.replace(/\.pdf$/, '')}>
      <Page size="A4" style={styles.page}>
        <View style={styles.mast} fixed={false}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mastKicker}>HANDOVER</Text>
              <Text style={styles.mastName}>{who}</Text>
              <Text style={styles.mastMeta}>{meta}</Text>
              <Text style={[styles.mastMeta, { marginTop: 3 }]}>Prepared {shortDate(new Date().toISOString().slice(0, 10))}</Text>
            </View>
            <View style={{ width: 90 }}>
              <Text style={styles.mastCount}>{filled.length}</Text>
              <Text style={styles.mastCountLabel}>BOXES TO COPY</Text>
            </View>
          </View>
        </View>

        <View style={styles.inner}>
          <View style={styles.how}>
            <Text style={styles.howText}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>How to use this document. </Text>
              Each numbered box below is the box of the same name in SalesTrekker. Work down the list,
              tick the square, copy the whole box, paste it into the field with the matching name.
              Do not retype and do not summarise — the wording is the compliance record.
            </Text>
          </View>

          <Section title="Needs & objectives" pill={`${NEEDS_BOXES.filter(b => hasContent(textFor(b))).length} boxes`} />
          {NEEDS_BOXES.filter(b => hasContent(textFor(b))).map(b => <BoxCard key={b.key} n={++n} label={b.label} text={textFor(b)} />)}

          <Section title="Broker comments" pill={`${COMMENT_BOXES.filter(b => hasContent(textFor(b))).length} boxes`} />
          {COMMENT_BOXES.filter(b => hasContent(textFor(b))).map(b => <BoxCard key={b.key} n={++n} label={b.label} text={textFor(b)} />)}

          {applicants.map(name => {
            const r = risks[name] || {}
            // An applicant with nothing recorded used to print nineteen rows of
            // dashes, which reads as data lost rather than data never entered.
            const answered = RISK_GROUPS.some(g => g.rows.some(x => String(r[x.key] || '').trim()))
            return (
              <View key={name}>
                <Section title="Risks" pill={name} />
                {!answered ? (
                  <Text style={styles.noAnswers}>
                    No risk answers have been recorded for {name}. Nothing has been lost — these
                    questions have not been asked yet, and the lender will want them.
                  </Text>
                ) : RISK_GROUPS.map(g => (
                  <View key={g.title}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.groupLabel}>{g.title.toUpperCase()}</Text>
                      {g.note ? <Text style={[styles.groupNote, { marginLeft: 6, marginTop: 5 }]}>{g.note}</Text> : null}
                    </View>
                    <QaRows rows={g.rows.map(x => [x.label, String(r[x.key] || '—')] as [string, string])} />
                  </View>
                ))}
              </View>
            )
          })}

          <Section title="Product requirements" pill="from the lending options" />
          {PRODUCT_GROUPS.map(g => (
            <View key={g.title}>
              <Text style={styles.groupLabel}>{g.title.toUpperCase()}</Text>
              <QaRows rows={g.rows.map(x => [x.label, String(productReqs[x.key] || '—')] as [string, string])} />
            </View>
          ))}

          <Section title="Living expenses" pill="household monthly" />
          {EXPENSE_CATEGORIES.map(cat => {
            const entry = expenses[cat.key]
            const state = hemStateOf(cat, entry)
            const amount = Number(String(entry?.monthlyAmount ?? '').replace(/,/g, '')) || 0
            if (!amount && state !== 'unanswered') return null
            const open = state === 'unanswered'
            const bg = open ? REDBG : SOFT
            return (
              <View style={styles.tRow} key={cat.key} wrap={false}>
                {/* Drawn rather than typed. Helvetica has no bullet or open
                    circle, so a glyph here prints as a stray accented letter. */}
                <View style={[styles.eDotCell, { backgroundColor: bg }]}>
                  <View style={[styles.eDot, open
                    ? { borderWidth: 1.5, borderColor: RED, backgroundColor: '#fff' }
                    : { backgroundColor: state === 'in' ? GREEN : RED }]} />
                </View>
                <Text style={[styles.eName, { backgroundColor: bg }]}>
                  {cat.label}
                  {open ? <Text style={{ color: REDINK, fontFamily: 'Helvetica-Bold' }}>   needs a HEM answer</Text> : null}
                </Text>
                <Text style={[styles.eAmt, { backgroundColor: bg }]}>{money(amount)}</Text>
                <Text style={[styles.eState, { backgroundColor: bg, color: open ? REDINK : MUTE }]}>
                  {open ? 'Not answered' : state === 'in' ? 'In HEM' : 'Outside HEM'}
                </Text>
              </View>
            )
          })}

          <View style={styles.totals} wrap={false}>
            <View style={[styles.tot, { backgroundColor: SOFT }]}>
              <Text style={[styles.totLabel, { color: INK }]}>TOTAL EXPENSES</Text>
              <Text style={[styles.totValue, { color: INK }]}>{money(totals.all)}</Text>
            </View>
            <View style={[styles.tot, { backgroundColor: '#EFFBF3' }]}>
              <Text style={[styles.totLabel, { color: '#15803d' }]}>IN HEM</Text>
              <Text style={[styles.totValue, { color: '#15803d' }]}>{money(totals.inHem)}</Text>
            </View>
            <View style={[styles.tot, { backgroundColor: REDBG, marginRight: 0 }]}>
              <Text style={[styles.totLabel, { color: '#dc2626' }]}>NOT IN HEM</Text>
              <Text style={[styles.totValue, { color: '#dc2626' }]}>{money(totals.notInHem)}</Text>
            </View>
          </View>
          {totals.unanswered > 0 ? <Text style={styles.warn}>{unansweredNote(totals.unanswered)}</Text> : null}
        </View>

        <View style={styles.foot} fixed>
          <Text style={styles.footText}>Handover — {who}</Text>
          <Text style={[styles.footText, { marginLeft: 'auto' }]} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(doc)
  return { buffer, dealName: fileName.replace(/\.pdf$/, '') }
}

export async function POST(req: NextRequest) {
  try {
    const { dealId } = await req.json()
    const supabase = await createSupabaseServer()
    const result = await generateCompliancePdfBuffer(dealId, supabase)
    if (!result) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        // Named for the people. The filename is what somebody searches for a
        // year later, and a deal record's name is not a client's name.
        'Content-Disposition': `attachment; filename="${result.dealName}.pdf"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
