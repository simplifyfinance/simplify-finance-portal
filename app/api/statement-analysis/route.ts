import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { parseCashDeck, StatementParseError, type ParsedStatements } from '@/lib/statement-parse'
import { analyse, ANALYSIS_VERSION } from '@/lib/statement-analysis'
import { normaliseRules } from '@/lib/statement-rules'

export const maxDuration = 60

// Upload, re-analyse and delete a statement analysis on a deal.
//
// Who may do this is decided by the database, not here: the deal is read with the
// signed-in user's own client, so row level security answers the question. Only
// once that read succeeds does the admin client write, and every write is counted
// rather than assumed - Postgres returns zero rows and no error when a policy
// blocks an insert, and a success message on top of that is a lie.

async function dealFor(dealId: string) {
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

// The rules live in Settings. An unsaved or half-saved copy falls back field by
// field, so the analysis never runs on a half-built rule set.
async function currentRules(admin: ReturnType<typeof createSupabaseAdmin>) {
  const { data } = await admin.from('settings').select('statement_rules').eq('id', 'singleton').maybeSingle()
  return normaliseRules((data as any)?.statement_rules)
}

// What a person has overruled us on: corrections made on this deal in the Audit
// tab, and standing rules that apply to every file. Both are read fresh on every
// analysis, so a correction takes effect the moment Re-analyse is pressed.
async function currentCorrections(admin: ReturnType<typeof createSupabaseAdmin>, dealId: string) {
  const [{ data: ovs }, { data: st }] = await Promise.all([
    admin.from('deal_statement_overrides')
      .select('external_id, signature, treat_as, note, created_by, created_at')
      .eq('deal_id', dealId),
    admin.from('settings').select('statement_payer_rules').eq('id', 'singleton').maybeSingle(),
  ])
  return {
    overrides: (ovs || []) as any[],
    payerRules: (((st as any)?.statement_payer_rules) || []) as any[],
  }
}

// Everything about the statements except the transactions themselves. Stored so
// a re-analysis can rebuild the picture without asking for the file again.
function metaOf(p: ParsedStatements) {
  return {
    source: p.source, client: p.client, accounts: p.accounts, institutions: p.institutions,
    periodFrom: p.periodFrom, periodTo: p.periodTo, days: p.days,
    balancesAvailable: p.balancesAvailable, warnings: p.warnings,
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const dealId = String(form.get('dealId') || '')
  const got = await dealFor(dealId)
  if ('error' in got) return got.error
  const { user, deal } = got

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file was sent.' }, { status: 400 })

  let parsed: ParsedStatements
  try {
    parsed = await parseCashDeck(await file.arrayBuffer())
  } catch (e: any) {
    const msg = e instanceof StatementParseError ? e.message : `That file could not be read: ${e?.message || 'unknown error'}`
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const rules = await currentRules(admin)
  const corrections = await currentCorrections(admin, dealId)
  const analysis = analyse(parsed, deal.fact_find_data || {}, rules, corrections)

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
      parsed_meta: metaOf(parsed),
      coverage_complete: analysis.coverage.complete,
      score: analysis.score.total,
      analysis_version: ANALYSIS_VERSION,
      rules,
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

// Re-run the findings over the transactions already stored, under the rules as
// they are now. No file, no second copy of the client's banking data, and the
// transactions themselves are never touched - they are what the bank said.
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const dealId = String(body.dealId || '')
  const uploadId = String(body.uploadId || '')
  const got = await dealFor(dealId)
  if ('error' in got) return got.error
  const { deal } = got
  if (!uploadId) return NextResponse.json({ error: 'No analysis was given to re-run.' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: up } = await admin
    .from('deal_statement_uploads').select('*').eq('id', uploadId).eq('deal_id', dealId).maybeSingle()
  if (!up) return NextResponse.json({ error: 'No analysis with that id belongs to this deal.' }, { status: 404 })

  const meta = (up as any).parsed_meta
  if (!meta || !meta.periodFrom) {
    return NextResponse.json({
      error: 'This analysis was saved before re-running was possible, so the account details it needs were not kept. Remove it and upload the file again.',
    }, { status: 409 })
  }

  const stored: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('deal_statement_transactions').select('*')
      .eq('upload_id', uploadId).order('txn_date', { ascending: true }).range(from, from + 999)
    if (error) return NextResponse.json({ error: `The stored transactions could not be read: ${error.message}` }, { status: 500 })
    stored.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  if (stored.length === 0) {
    return NextResponse.json({ error: 'No stored transactions were found for this analysis, so there is nothing to re-run.' }, { status: 409 })
  }
  if (up.txn_count && stored.length !== up.txn_count) {
    return NextResponse.json({
      error: `The stored ledger holds ${stored.length} transactions but this analysis was built from ${up.txn_count}. Re-running would not match the file, so nothing was changed.`,
    }, { status: 409 })
  }

  const parsed: ParsedStatements = {
    ...meta,
    transactions: stored.map(r => ({
      externalId: r.external_id, date: r.txn_date, description: r.description || '',
      merchant: r.merchant || '', accountNumber: r.account_number || '', accountName: r.account_name || '',
      institution: r.institution || '', category: r.category || '', summaryCategory: r.summary_category || '',
      categoryType: r.category_type || '', amount: Number(r.amount),
    })),
  }

  const rules = await currentRules(admin)
  const corrections = await currentCorrections(admin, dealId)
  const analysis = analyse(parsed, deal.fact_find_data || {}, rules, corrections)

  const { data: saved, error: saveErr } = await admin
    .from('deal_statement_uploads')
    .update({
      analysis, rules, analysis_version: ANALYSIS_VERSION,
      score: analysis.score.total,
      accounts: analysis.coverage.accounts,
      coverage_complete: analysis.coverage.complete,
      reanalysed_at: new Date().toISOString(),
    })
    .eq('id', uploadId).eq('deal_id', dealId).select('id')

  if (saveErr) return NextResponse.json({ error: `The new findings could not be saved: ${saveErr.message}` }, { status: 500 })
  if (!saved || saved.length === 0) {
    return NextResponse.json({ error: 'Nothing was updated — the database accepted the request but changed no row.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, uploadId, transactions: stored.length, analysis })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uploadId = searchParams.get('uploadId') || ''
  const dealId = searchParams.get('dealId') || ''
  const got = await dealFor(dealId)
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
