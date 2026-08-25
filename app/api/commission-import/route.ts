import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { parseSfg } from '@/lib/sfg'

export const maxDuration = 60

// Imports one or more SFG statements. Each file says which broker, which month and
// which kind it is, so a batch can be dropped in any order. Three refusals, all
// deliberate: a statement that does not reconcile is never imported, the same
// statement is never imported twice, and a file for an unknown broker is rejected
// rather than guessed at.

function norm(s: string) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '') }

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles')
    .select('is_admin, sees_finance').eq('id', user.id).single()
  if (!profile?.is_admin && !profile?.sees_finance) {
    return NextResponse.json({ error: 'Commissions are finance only.' }, { status: 403 })
  }

  const admin = createSupabaseAdmin()

  const [{ data: lenders }, { data: brokers }, { data: profiles }] = await Promise.all([
    admin.from('lenders').select('id, name, aliases'),
    admin.from('brokers').select('broker_key, name'),
    admin.from('user_profiles').select('email, broker_key').not('broker_key', 'is', null),
  ])

  const lenderByName = new Map<string, string>()
  for (const l of (lenders || [])) {
    lenderByName.set(norm((l as any).name), (l as any).id)
    for (const a of ((l as any).aliases || [])) lenderByName.set(norm(a), (l as any).id)
  }
  const keyByEmail = new Map<string, string>()
  for (const p of (profiles || [])) {
    keyByEmail.set(String((p as any).email || '').toLowerCase(), String((p as any).broker_key).toLowerCase())
  }
  const knownKeys = new Set((brokers || []).map((b: any) => String(b.broker_key).toLowerCase()))

  const form = await req.formData()
  const files = form.getAll('files').filter(f => f instanceof File) as File[]
  if (files.length === 0) return NextResponse.json({ error: 'No files were sent.' }, { status: 400 })

  const results: any[] = []

  for (const file of files) {
    const name = file.name
    try {
      const parsed = await parseSfg(await file.arrayBuffer())

      // broker: the invoice email first, then the name on it
      let brokerKey = keyByEmail.get(parsed.brokerEmail) || ''
      if (!brokerKey) {
        const first = parsed.brokerName.trim().split(/\s+/)[0]?.toLowerCase() || ''
        if (knownKeys.has(first)) brokerKey = first
      }
      if (!brokerKey) {
        results.push({ name, status: 'rejected',
          detail: `Could not tell which broker this belongs to (invoice says "${parsed.brokerName}", ${parsed.brokerEmail || 'no email'}).` })
        continue
      }

      if (!parsed.totals.reconciled) {
        results.push({ name, status: 'rejected', broker: brokerKey,
          period: parsed.periodMonth.slice(0, 7), kind: parsed.kind,
          detail: `Does not reconcile — the lines come to ${parsed.totals.computedBanked.toFixed(2)} but the invoice says ${parsed.totals.bankedExGst.toFixed(2)}, out by ${parsed.totals.outBy.toFixed(2)}. Nothing was imported.` })
        continue
      }

      const { data: existing } = await admin.from('commission_statements')
        .select('id, uploaded_at, rows_imported')
        .eq('source', 'sfg').eq('broker_key', brokerKey)
        .eq('kind', parsed.kind).eq('period_month', parsed.periodMonth).maybeSingle()
      if (existing) {
        results.push({ name, status: 'duplicate', broker: brokerKey,
          period: parsed.periodMonth.slice(0, 7), kind: parsed.kind,
          detail: `Already loaded on ${String((existing as any).uploaded_at).slice(0, 10)} with ${(existing as any).rows_imported} rows. Skipped.` })
        continue
      }

      const { data: stmt, error: stmtErr } = await admin.from('commission_statements').insert({
        source: 'sfg', broker_key: brokerKey, kind: parsed.kind,
        period_month: parsed.periodMonth, filename: name,
        rows_imported: parsed.lines.length, uploaded_by: user.id,
        gross_ex_gst: parsed.totals.grossExGst,
        third_party_ex_gst: parsed.totals.thirdPartyExGst,
        clawback_ex_gst: parsed.totals.clawbackExGst,
        banked_ex_gst: parsed.totals.bankedExGst,
        reconciled: true,
      }).select('id').single()
      if (stmtErr || !stmt) throw new Error(stmtErr?.message || 'the statement row was refused')

      const unknownLenders = new Set<string>()
      const payload = parsed.lines.map(l => {
        const lenderId = lenderByName.get(norm(l.lenderRaw)) || null
        if (!lenderId && l.lenderRaw) unknownLenders.add(l.lenderRaw)
        const third = l.kind === 'clawback' ? 0 : (parsed.thirdParty[l.loanRef] || 0)
        const r = (l.lenderRaw || '').toLowerCase()
        const segment = /allianz|insurance/.test(r) ? 'insurance'
          : /commercial|business/.test(r) ? 'commercial' : 'residential'
        return {
          statement_id: (stmt as any).id,
          kind: l.kind,
          broker_key: brokerKey,
          lender_id: lenderId,
          lender_raw: l.lenderRaw,
          segment,
          loan_ref: l.loanRef,
          client_name: l.clientName,
          balance: l.balance,
          settlement_amount: l.settlementAmount,
          settlement_date: l.settlementDate,
          gross_ex_gst: l.grossExGst,
          gst: l.gst,
          gross_inc_gst: l.grossIncGst,
          period_month: parsed.periodMonth,
          days_in_month: parsed.daysInMonth,
          normalised_ex_gst: l.kind === 'trail'
            ? Math.round((l.grossExGst / parsed.daysInMonth) * 30.44 * 100) / 100 : null,
          split_name: parsed.splitName[l.loanRef] || null,
          third_party_ex_gst: third,
          net_ex_gst: Math.round((l.grossExGst - third) * 100) / 100,
        }
      })

      let written = 0
      for (let i = 0; i < payload.length; i += 500) {
        const chunk = payload.slice(i, i + 500)
        const { data, error } = await admin.from('commission_lines').insert(chunk).select('id')
        if (error) throw new Error(error.message)
        written += data?.length || 0
      }
      if (written !== payload.length) {
        throw new Error(`the database accepted ${written} of ${payload.length} lines`)
      }
      await admin.from('commission_statements').update({ rows_imported: written }).eq('id', (stmt as any).id)

      results.push({
        name, status: 'imported', broker: brokerKey,
        period: parsed.periodMonth.slice(0, 7), kind: parsed.kind, rows: written,
        gross: parsed.totals.grossExGst, thirdParty: parsed.totals.thirdPartyExGst,
        clawback: parsed.totals.clawbackExGst, banked: parsed.totals.bankedExGst,
        unknownLenders: Array.from(unknownLenders),
      })
    } catch (e: any) {
      results.push({ name, status: 'rejected', detail: e?.message || 'could not be read' })
    }
  }

  return NextResponse.json({ results })
}
