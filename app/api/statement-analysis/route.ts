import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { parseCashDeck, StatementParseError } from '@/lib/statement-parse'
import { analyse, ANALYSIS_VERSION } from '@/lib/statement-analysis'

export const maxDuration = 60

// Upload, parse, store and analyse one CashDeck workbook against a deal.
//
// Who may do this is decided by the database, not here: the deal is read with the
// signed-in user's own client, so row level security answers the question. Only
// once that read succeeds does the admin client write, and every write is counted
// rather than assumed - Postgres returns zero rows and no error when a policy
// blocks an insert, and a success message on top of that is a lie.

async function dealFor(req: NextRequest, dealId: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) }
  if (!dealId) return { error: NextResponse.json({ error: 'No deal was given.' }, { status: 400 }) }

  const { data: deal } = await supabase
    .from('deals').select('id, deal_name, fact_find_data').eq('id', dealId).maybeSingle()
  if (!deal) {
    return { error: NextResponse.json({ error: 'That deal could not be opened with your access.' }, { status: 403 }) }
  }
  return { user, deal }
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const dealId = String(form.get('dealId') || '')
  const got = await dealFor(req, dealId)
  if ('error' in got) return got.error
  const { user, deal } = got

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file was sent.' }, { status: 400 })

  let parsed
  try {
    parsed = await parseCashDeck(await file.arrayBuffer())
  } catch (e: any) {
    const msg = e instanceof StatementParseError ? e.message : `That file could not be read: ${e?.message || 'unknown error'}`
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const analysis = analyse(parsed, deal.fact_find_data || {})
  const admin = createSupabaseAdmin()

  // One upload row per file. Replacing an analysis means removing the old one
  // first, which the Remove button does, so nothing is silently overwritten.
  const { data: uploadRows, error: upErr } = await admin
    .from('deal_statement_uploads')
    .insert([{
      deal_id: dealId,
      file_name: file.name,
      source: parsed.source,
      uploaded_by: user.id,
      uploaded_by_email: user.email || null,
      client_name: [parsed.client.firstName, parsed.client.lastName].filter(Boolean).join(' ') || null,
      period_from: parsed.periodFrom,
      period_to: parsed.periodTo,
      days: parsed.days,
      txn_count: parsed.transactions.length,
      institutions: parsed.institutions,
      accounts: analysis.coverage.accounts,
      coverage_complete: analysis.coverage.complete,
      score: analysis.score.total,
      analysis_version: ANALYSIS_VERSION,
      analysis,
    }])
    .select('id')

  if (upErr) return NextResponse.json({ error: `The analysis could not be saved: ${upErr.message}` }, { status: 500 })
  if (!uploadRows || uploadRows.length === 0) {
    return NextResponse.json({ error: 'The analysis was not saved — the database accepted the request but wrote no row. Nothing has been stored.' }, { status: 500 })
  }
  const uploadId = uploadRows[0].id

  // Every transaction is stored so the drill-downs still work months later
  // without the original file. Inserted in chunks, and every chunk is counted.
  const rows = parsed.transactions.map(t => ({
    upload_id: uploadId, deal_id: dealId,
    external_id: t.externalId, txn_date: t.date, description: t.description,
    merchant: t.merchant, account_number: t.accountNumber, account_name: t.accountName,
    institution: t.institution, category: t.category, summary_category: t.summaryCategory,
    category_type: t.categoryType, amount: t.amount,
  }))
  let written = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { data, error } = await admin.from('deal_statement_transactions').insert(chunk).select('id')
    if (error) {
      await admin.from('deal_statement_uploads').delete().eq('id', uploadId)
      return NextResponse.json({ error: `The transactions could not be saved: ${error.message}. Nothing was kept.` }, { status: 500 })
    }
    written += (data || []).length
  }
  if (written !== rows.length) {
    await admin.from('deal_statement_uploads').delete().eq('id', uploadId)
    return NextResponse.json({
      error: `Only ${written} of ${rows.length} transactions were saved, so the analysis would not have matched the file. Nothing was kept.`,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, uploadId, written, analysis, warnings: analysis.warnings })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uploadId = searchParams.get('uploadId') || ''
  const dealId = searchParams.get('dealId') || ''
  const got = await dealFor(req, dealId)
  if ('error' in got) return got.error
  if (!uploadId) return NextResponse.json({ error: 'No upload was given.' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: txns, error: txErr } = await admin
    .from('deal_statement_transactions').delete().eq('upload_id', uploadId).eq('deal_id', dealId).select('id')
  if (txErr) return NextResponse.json({ error: `The transactions could not be removed: ${txErr.message}` }, { status: 500 })

  const { data: ups, error: upErr } = await admin
    .from('deal_statement_uploads').delete().eq('id', uploadId).eq('deal_id', dealId).select('id')
  if (upErr) return NextResponse.json({ error: `The analysis could not be removed: ${upErr.message}` }, { status: 500 })
  if (!ups || ups.length === 0) {
    return NextResponse.json({ error: 'Nothing was removed — no analysis with that id belongs to this deal.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, removedTransactions: (txns || []).length, removedUploads: ups.length })
}
