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
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { color: '#666', width: '40%' },
  value: { fontWeight: 700 },
})

function fmtMoney(v: any): string {
  const n = Number(v)
  if (!v || isNaN(n)) return ''
  return '$' + n.toLocaleString('en-AU')
}

export async function POST(req: NextRequest) {
  try {
    const { dealId } = await req.json()
    const supabase = await createSupabaseServer()
    const { data: deal } = await supabase.from('deals').select('*, clients(first_name, last_name)').eq('id', dealId).single()
    if (!deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

    const ff = deal.fact_find_data || {}
    const applicants = ff.applicants || []

    const doc = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Deal Summary — {deal.deal_name}</Text>
          <Text style={styles.subtitle}>Generated {new Date().toLocaleString('en-AU')}</Text>

          <View style={[styles.section, { backgroundColor: '#F5F0FA', borderLeftColor: '#9333EA' }]}>
            <Text style={[styles.sectionTitle, { color: '#9333EA' }]}>Applicants</Text>
            {applicants.map((a: any, i: number) => (
              <Text key={i} style={{ marginBottom: 2 }}>{a.firstName} {a.lastName}</Text>
            ))}
          </View>
        </Page>
      </Document>
    )

    const buffer = await renderToBuffer(doc)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${deal.deal_name}-summary.pdf"`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
