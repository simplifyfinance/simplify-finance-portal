// THE PURCHASE HANDOVER.
//
// A second document, not a replacement. The handover is the position the file
// was ASSESSED on and it stays exactly as it is; this is the purchase as the
// clients actually made it. Fabio, 21 Oct 2026: "remenr this is a new docuemtn
// on document tabs do not delete old handover".
//
// SAME LOOK, DELIBERATELY. Same masthead, same section rules, same numbered
// boxes, same question-and-answer rows as generate-compliance-pdf, because
// somebody holding both should see two pages from the same file rather than two
// documents from two systems. The styles are a copy at the values, not an
// import, so a change made for one cannot silently move the other.
//
// WHAT IT KNOWS, IT IS TOLD. Every word on the page comes from
// lib/purchase-handover.ts. Nothing is decided in here, which is what makes it
// testable - a figure invented inside a PDF component is a figure nobody ever
// reads again.
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import { purchaseHandover, applicantNamesOf, type Row } from '@/lib/purchase-handover'
import { purchaseHandoverName } from '@/lib/the-purchase-handover'
import { parseBlocks } from '@/lib/handover'
import { shortDate } from '@/lib/push-answers'
import { Section } from '@/lib/pdf-section'

export const runtime = 'nodejs'

const INK = '#141C24', MUTE = '#7C8894', BODY = '#3D4750'
const RULE = '#E3E7EA', SOFT = '#F6F8FA', SKY = '#7FD3FF'
const REDBG = '#FDF0EF', REDINK = '#8A3A3A'

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 42, paddingHorizontal: 0, fontSize: 9.5, fontFamily: 'Helvetica', color: BODY },
  inner: { paddingHorizontal: 34 },

  mast: { backgroundColor: INK, paddingHorizontal: 34, paddingTop: 22, paddingBottom: 18, marginBottom: 16 },
  mastKicker: { fontSize: 7.5, color: SKY, letterSpacing: 1.8, fontFamily: 'Helvetica-Bold' },
  mastName: { fontSize: 18, color: '#fff', fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 5 },
  mastMeta: { fontSize: 8.5, color: '#A9B7C2' },
  mastCount: { fontSize: 18, color: SKY, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  mastCountLabel: { fontSize: 6.5, color: MUTE, letterSpacing: 1, textAlign: 'right', marginTop: 3, fontFamily: 'Helvetica-Bold' },

  how: { backgroundColor: '#EEF7FD', borderWidth: 1, borderColor: '#CDE6F6', borderRadius: 6, padding: 10, marginBottom: 14 },
  howText: { fontSize: 8.5, color: '#274456', lineHeight: 1.55 },


  box: { borderWidth: 1, borderColor: RULE, borderLeftWidth: 4, borderLeftColor: INK, borderRadius: 6, marginBottom: 10 },
  boxHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FB', paddingVertical: 8, paddingHorizontal: 11 },
  boxNo: { width: 17, height: 17, borderRadius: 9, backgroundColor: INK, color: '#fff', fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingTop: 4 },
  boxTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, marginLeft: 8 },
  boxBody: { paddingVertical: 10, paddingHorizontal: 13 },
  para: { fontSize: 9, lineHeight: 1.6, marginBottom: 6 },
  hr: { borderTopWidth: 1, borderTopColor: RULE, marginTop: 3, marginBottom: 8 },
  empty: { fontSize: 9, color: MUTE, fontStyle: 'italic' },

  tRow: { flexDirection: 'row', marginBottom: 3 },
  tQ: { flex: 1, backgroundColor: SOFT, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, color: BODY },
  tA: { width: 190, backgroundColor: SOFT, paddingVertical: 5, paddingHorizontal: 9, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' },
  tAMissing: { backgroundColor: REDBG, color: REDINK, fontFamily: 'Helvetica' },

  totals: { flexDirection: 'row', marginTop: 9 },
  tot: { flex: 1, borderRadius: 7, padding: 9, marginRight: 7 },
  totLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .6 },
  totValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4 },

  warn: { marginTop: 8, borderWidth: 1, borderColor: '#F5C2C2', backgroundColor: REDBG, borderRadius: 6, padding: 8, fontSize: 8.5, color: REDINK, lineHeight: 1.55 },

  foot: { position: 'absolute', bottom: 20, left: 34, right: 34, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EEF2F5', paddingTop: 6 },
  footText: { fontSize: 7, color: '#A9B7C2' },
})


// A ROW STAYS WHOLE, same reason the handover's boxes do: a label on one page
// and its figure on the next is how somebody reads the wrong number.
function QaRows({ rows }: { rows: Row[] }) {
  return (
    <>
      {rows.map((r, i) => (
        <View key={i} style={styles.tRow} wrap={false}>
          <Text style={styles.tQ}>{r.q}</Text>
          <Text style={r.missing ? [styles.tA, styles.tAMissing] : styles.tA}>{r.a}</Text>
        </View>
      ))}
    </>
  )
}

export async function generatePurchaseHandoverBuffer(dealId: string, supabase: any):
  Promise<{ buffer: Buffer; dealName: string } | null> {
  const { data: deal } = await supabase.from('deals')
    .select('*, clients(first_name, last_name), lenders(name)').eq('id', dealId).single()
  if (!deal) return null

  const v = purchaseHandover(deal)
  const fileName = purchaseHandoverName(applicantNamesOf(deal), deal.deal_name)
  const notes = parseBlocks(v.submissionNotes)

  const doc = (
    <Document title={fileName.replace(/\.pdf$/, '')}>
      <Page size="A4" style={styles.page}>
        <View style={styles.mast}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mastKicker}>PURCHASE HANDOVER</Text>
              <Text style={styles.mastName}>{v.who}</Text>
              <Text style={styles.mastMeta}>{v.meta}</Text>
              <Text style={[styles.mastMeta, { marginTop: 3 }]}>
                Prepared {shortDate(new Date().toISOString().slice(0, 10))}
              </Text>
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.mastCount}>{v.pricePaid}</Text>
              <Text style={styles.mastCountLabel}>PRICE PAID</Text>
            </View>
          </View>
        </View>

        <View style={styles.inner}>
          <View style={styles.how}>
            <Text style={styles.howText}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>What this page is. </Text>
              The purchase as it actually is, taken from the offer accepted step. It does not replace
              the handover, which stays as the position this file was assessed on. Where the two
              differ the assessed figure is shown in brackets beside the one that was paid. Nothing
              here has been estimated — anything nobody has typed says so.
            </Text>
          </View>

          {v.sections.map(s => (
            <View key={s.no}>
              <Section title={s.title} pill={s.pill} />
              <View style={styles.box} wrap={false}>
                <View style={styles.boxHead} wrap={false}>
                  <Text style={styles.boxNo}>{s.no}</Text>
                  <Text style={styles.boxTitle}>{s.title}</Text>
                </View>
                <View style={styles.boxBody}>
                  <QaRows rows={s.rows} />
                  {/* THE THREE FIGURES A SETTLEMENTS PERSON LOOKS FOR FIRST,
                      under the loan rather than at the top, so they are read
                      with the rate and the term that produced them. */}
                  {s.no === 2 && (
                    <View style={styles.totals}>
                      {v.tiles.map(t => (
                        <View key={t.label} style={[styles.tot,
                          { backgroundColor: t.lead ? '#EEF7FD' : SOFT }]}>
                          <Text style={[styles.totLabel, { color: t.lead ? '#274456' : MUTE }]}>{t.label}</Text>
                          <Text style={[styles.totValue, { color: t.lead ? '#0B5F7D' : INK }]}>{t.value}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}

          {/* THE ONE BOX ON THE COMPLIANCE TAB THE BANK READS.
              Fabio, 21 Oct 2026, pointing at it on screen: "add this section
              from compliance that box with wording". Whoever picks this page up
              should not have to open the deal to find what was said to the
              lender. Printed as it is written, never summarised - it is the
              compliance record. */}
          <Section title="Application submission notes" pill="GOES TO THE LENDER" />
          <View style={styles.box} wrap minPresenceAhead={70}>
            <View style={styles.boxHead} wrap={false}>
              <Text style={styles.boxNo}>5</Text>
              <Text style={styles.boxTitle}>Application submission notes</Text>
            </View>
            <View style={styles.boxBody}>
              {notes.length === 0
                ? <Text style={styles.empty}>Not composed yet — Compliance tab, Application submission notes.</Text>
                : notes.map((b, i) => b.kind === 'rule'
                    ? <View key={i} style={styles.hr} />
                    : (
                      <Text key={i} style={styles.para} wrap={false}>
                        {b.runs.map((r, j) => (
                          <Text key={j} style={r.bold ? { fontFamily: 'Helvetica-Bold', color: INK } : undefined}>{r.text}</Text>
                        ))}
                      </Text>
                    ))}
            </View>
          </View>

          {v.stillToRecord.length > 0 && (
            <Text style={styles.warn}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Still to record on this deal: </Text>
              {v.stillToRecord.join(', ')}. Nothing above has been estimated to cover a blank.
            </Text>
          )}
        </View>

        <View style={styles.foot} fixed>
          <Text style={styles.footText}>Purchase handover — {v.who}</Text>
          <Text style={[styles.footText, { marginLeft: 'auto' }]}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
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

    // SIGNED IN, FIRST. The same lock the handover carries, said out loud for
    // the same reason: this page holds a client's purchase, their loan and
    // their solicitor. It reads the deal as whoever called it, so row level
    // security already refuses a stranger - but a lock made only of a side
    // effect disappears the day somebody swaps this for the master key.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const result = await generatePurchaseHandoverBuffer(dealId, supabase)
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
