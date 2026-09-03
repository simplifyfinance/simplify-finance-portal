// THE BROKER NOTES, AS A PAGE.
//
// The third document in the pack, alongside the handover and the fact find
// summary. Unlike those two it is not an internal record: it is what gets
// pasted into the lender's application portal, and the copy that is filed in
// the lodgement folder is the evidence of what was submitted.
//
// It prints the SAVED submission notes, not a freshly composed set. The broker
// reads what was composed and edits anything that is not right, and it is that
// text - the text they approved - which goes to the bank. Re-composing here
// would produce a PDF that quietly disagreed with what was actually sent.
//
// Everything above the notes is read from the same records the deal structure
// block on screen reads, so the page and the portal cannot drift apart.
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import { dealRow, splitsOf, purposeSummary, PURPOSE_LABEL } from '@/lib/deal-structure'
import { fundsToComplete } from '@/lib/funds-to-complete'
import { relationshipLine } from '@/lib/relationship'
import { fullName } from '@/lib/fact-find'
import { money } from '@/lib/money'
import { templateLabel } from '@/lib/templates'
import { shortDate } from '@/lib/push-answers'

const INK = '#141C24', MUTE = '#7C8894', BODY = '#3D4750'
const RULE = '#E3E7EA', SOFT = '#F8F9FA', LINE = '#DCE2E7'
const GREEN = '#1E7A4A', AMBER = '#8A6218'

const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 44, paddingHorizontal: 34, fontSize: 9, fontFamily: 'Helvetica', color: BODY },

  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: INK },
  read: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.3, color: '#C4553B', marginTop: 3 },
  brand: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right', lineHeight: 1.1 },

  bar: { backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 9, marginTop: 12,
         borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.1, color: '#fff' },
  panel: { backgroundColor: SOFT, borderWidth: 1, borderColor: RULE, borderTopWidth: 0,
           borderBottomLeftRadius: 4, borderBottomRightRadius: 4, padding: 10 },

  row: { flexDirection: 'row', marginBottom: 7 },
  f: { flex: 1, paddingRight: 12 },
  k: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .8, color: MUTE, marginBottom: 2 },
  v: { fontSize: 9.5, color: INK, borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 3 },
  vb: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 3 },
  vgap: { fontSize: 9, color: AMBER, borderBottomWidth: 1, borderBottomColor: '#E3CFA6', paddingBottom: 3 },

  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 3, marginBottom: 2 },
  thc: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .7, color: MUTE },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EFF2F4', paddingVertical: 5 },
  td: { fontSize: 8.5, color: INK },
  tdb: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK },

  funds: { flexDirection: 'row', alignItems: 'flex-end' },
  fcell: { paddingRight: 14, marginRight: 14, borderRightWidth: 1, borderRightColor: '#E7EAED' },
  famt: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK },
  fgreen: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GREEN },
  ftot: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: GREEN },
  fnote: { fontSize: 6.5, color: MUTE, marginTop: 2 },

  notes: { fontSize: 8.5, color: INK, lineHeight: 1.6 },
  empty: { fontSize: 9, color: AMBER, lineHeight: 1.55 },

  foot: { position: 'absolute', bottom: 22, left: 34, right: 34, flexDirection: 'row',
          justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: RULE, paddingTop: 6 },
  footText: { fontSize: 6.5, color: MUTE },
})

const Bar = ({ children }: { children: string }) => (
  <View style={s.bar}><Text style={s.barText}>{children}</Text></View>
)

const F = ({ label, value, bold, gap, flex = 1 }:
           { label: string; value: string; bold?: boolean; gap?: boolean; flex?: number }) => (
  <View style={[s.f, { flex }]}>
    <Text style={s.k}>{label.toUpperCase()}</Text>
    <Text style={gap ? s.vgap : bold ? s.vb : s.v}>{value || ' '}</Text>
  </View>
)

export function brokerNotesFileName(who: string): string {
  return `Broker Notes - ${who}`.replace(/[\/\\:*?"<>|]/g, '-').slice(0, 180) + '.pdf'
}

export async function generateBrokerNotesPdfBuffer(dealId: string, supabase: any):
    Promise<{ buffer: Buffer; dealName: string } | null> {
  const { data: deal } = await supabase.from('deals')
    .select('*, clients(first_name, last_name)').eq('id', dealId).single()
  if (!deal) return null

  const c = deal.compliance_data || {}
  const apps = (deal.fact_find_data?.applicants || []).filter((a: any) => fullName(a))
  const row = dealRow(deal)
  const splits = splitsOf(deal)
  const funds = fundsToComplete(deal)
  const notes = String(c.applicationSubmissionComment || '').trim()

  const who = apps.length ? apps.map(fullName).join(' & ')
    : String(deal.deal_name || 'Deal').replace(/_/g, ' ')
  const purpose = [purposeSummary(deal), templateLabel(deal.bc_data?.template)].filter(Boolean).join(' — ')
  const relationship = relationshipLine(apps)

  const doc = (
    <Document title={brokerNotesFileName(who)}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.title}>Broker Submission Notes</Text>
            <Text style={s.read}>PLEASE READ</Text>
          </View>
          <Text style={s.brand}>Simplify{'\n'}Finance.</Text>
        </View>

        <Bar>APPLICANT DETAILS</Bar>
        <View style={s.panel}>
          <View style={s.row}>
            <F label="Primary applicant" value={apps[0] ? fullName(apps[0]) : ''} bold />
            <F label="Other applicant" value={apps[1] ? fullName(apps[1]) : '—'} bold />
            {/* Absent rather than blank: an empty line under a printed label
                reads as a form somebody did not finish. */}
            <F label="Relationship of applicants" value={relationship || 'Not recorded'}
               gap={!relationship} />
          </View>
          <View style={s.row}>
            <F label="Loan purpose" value={purpose} flex={2} />
            <F label="LVR" value={row.lvr !== null ? `${row.lvr}%` : 'Not known'} bold
               gap={row.lvr === null} flex={0.7} />
            <F label="Lender" value={row.lender || 'Not recorded'} bold gap={!row.lender} />
            <F label="Approval required" value={row.preApproval ? 'Pre-approval' : 'Formal'} />
          </View>
          <View style={[s.row, { marginBottom: 0 }]}>
            <F label="Security address" value={row.securityAddress || 'Not recorded'}
               gap={!row.securityAddress} flex={2.4} />
            <F label="Property value" value={row.propertyValue > 0 ? money(row.propertyValue) : 'Not recorded'}
               bold gap={row.propertyValue <= 0} />
          </View>
        </View>

        {splits.length > 0 && (
          <>
            <Bar>LOAN SPLITS</Bar>
            <View style={s.panel}>
              <View style={s.th}>
                <Text style={[s.thc, { flex: 2.1 }]}>SPLIT</Text>
                <Text style={[s.thc, { flex: 1.2 }]}>AMOUNT</Text>
                <Text style={[s.thc, { flex: .7 }]}>TERM</Text>
                <Text style={[s.thc, { flex: .7 }]}>RATE</Text>
                <Text style={[s.thc, { flex: .8 }]}>P&amp;I / IO</Text>
                <Text style={[s.thc, { flex: 1.1 }]}>PURPOSE</Text>
                <Text style={[s.thc, { flex: 1.5 }]}>PRODUCT TYPE</Text>
              </View>
              {splits.map((sp, i) => (
                <View key={sp.id} style={s.tr}>
                  <Text style={[s.td, { flex: 2.1 }]}>{i + 1} — {sp.label}</Text>
                  <Text style={[s.tdb, { flex: 1.2 }]}>{sp.amount ? money(sp.amount) : '—'}</Text>
                  <Text style={[s.td, { flex: .7 }]}>{sp.termYears ? `${sp.termYears} yrs` : '—'}</Text>
                  <Text style={[s.td, { flex: .7 }]}>{sp.rate ? `${sp.rate}%` : '—'}</Text>
                  <Text style={[s.td, { flex: .8 }]}>{sp.repaymentType || '—'}</Text>
                  <Text style={[s.td, { flex: 1.1 }]}>{sp.purpose ? PURPOSE_LABEL[sp.purpose] : '—'}</Text>
                  <Text style={[s.td, { flex: 1.5 }]}>{sp.productType || '—'}</Text>
                </View>
              ))}
              {/* One per deal, not one per split. */}
              {row.cashback ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={s.k}>PROMOTION / CASH REBATE</Text>
                  <Text style={s.v}>{row.cashback}</Text>
                </View>
              ) : null}
            </View>
          </>
        )}

        {funds.applies && funds.workable && (
          <>
            <Bar>FUNDS TO COMPLETE</Bar>
            <View style={s.panel}>
              <View style={s.funds}>
                {funds.lines.map(l => (
                  <View key={l.label} style={s.fcell}>
                    <Text style={s.k}>{l.label.toUpperCase()}</Text>
                    <Text style={l.kind === 'source' ? s.fgreen : s.famt}>{money(l.amount)}</Text>
                  </View>
                ))}
                {funds.capitalised.map(cp => (
                  <View key={cp.label} style={s.fcell}>
                    <Text style={s.k}>{cp.label.toUpperCase()}</Text>
                    <Text style={s.famt}>{money(cp.amount)}</Text>
                    <Text style={s.fnote}>capitalised</Text>
                  </View>
                ))}
                <View style={{ marginLeft: 'auto' }}>
                  <Text style={s.k}>FUNDS TO COMPLETE</Text>
                  <Text style={s.ftot}>{funds.toFind > 0 ? money(funds.toFind) : 'nil'}</Text>
                  {funds.deposit !== null && funds.depositAgrees ? (
                    <Text style={s.fnote}>
                      {deal.bc_data?.depositSource ? `from ${String(deal.bc_data.depositSource).toLowerCase()}` : 'met by the deposit'}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </>
        )}

        <Bar>BROKER SUBMISSION NOTES</Bar>
        <View style={s.panel}>
          {notes
            ? <Text style={s.notes}>{notes}</Text>
            : <Text style={s.empty}>
                Nothing has been written in the submission notes. These are the notes that go to the
                lender — compose them on the Compliance tab before this pack is sent.
              </Text>}
        </View>

        <View style={s.foot} fixed>
          <Text style={s.footText}>Simplify Finance — Mortgage Specialists Pty Ltd, ACL 387025</Text>
          <Text style={s.footText}>Broker Notes — {who} ({shortDate(new Date().toISOString().slice(0, 10))})</Text>
        </View>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(doc)
  return { buffer, dealName: `Broker Notes - ${who}` }
}

export async function POST(req: NextRequest) {
  try {
    const { dealId } = await req.json()
    if (!dealId) return NextResponse.json({ error: 'Missing dealId' }, { status: 400 })
    const supabase = await createSupabaseServer()
    const result = await generateBrokerNotesPdfBuffer(dealId, supabase)
    if (!result) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${brokerNotesFileName(result.dealName.replace('Broker Notes - ', ''))}"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
