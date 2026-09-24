// THE FACT FIND, ON FABIO'S FORM, AND STILL TYPEABLE.
//
// This was a "Deal Summary" that showed a handful of lines per section and
// printed most of the money on the file as "0" - because the forms store money
// as formatted strings and `Number("5,250,000")` is NaN. See lib/money.ts.
//
// It became the whole fact find, section by section in the order the tabs run.
// Fabio, 2 Sep 2026: "I want every section of the FF tab personal details
// income employment other assets properties liabilities ALL of it".
//
// 24 Sep 2026 it became the same piece of paper as the Personal Assessment
// Form. Fabio: "i want the same style coming out of the fact find button on
// compliance tab", and then "sorry need typeable boxes". So: black bands, the
// grey question column, columns across the page - and every box is a box, so a
// gap can be filled in by hand and the sheet handed on.
//
// All eleven sections that were in the coloured version are still here, in the
// same order. Where every label and box goes is lib/assessment-form.ts, what
// goes in each one is lib/factfind-form-content.ts, and the drawing is
// lib/form-pdf.ts. All three are shared with the assessment form, and the first
// two are pure and tested.
//
// Named for the client, not for the deal record.
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { readMoney } from '@/lib/money'
import { stillToConfirm } from '@/lib/fact-find'
import { applicantNamesOf } from '@/lib/applicants'
import { shortDate } from '@/lib/push-answers'
import { factFindFormItems, words } from '@/lib/factfind-form-content'
import { renderFormPdf } from '@/lib/form-pdf'

export const runtime = 'nodejs'

export async function generateSummaryPdfBuffer(dealId: string, supabase: any): Promise<{ buffer: Buffer; dealName: string } | null> {
  const { data: deal } = await supabase.from('deals')
    .select('*, clients(first_name, last_name), lenders(name)').eq('id', dealId).single()
  if (!deal) return null

  const ff = deal.fact_find_data || {}
  const bc = deal.bc_data || {}
  const lo = deal.lo_data || {}
  const names = applicantNamesOf(deal, bc)
  const who = names.join(' & ')
  const fileName = `Fact Find - ${who}`.replace(/[\/\\:*?"<>|]/g, '-').slice(0, 180)

  const meta = [
    words(deal.transaction_type),
    deal.lenders?.name || lo.recommendedLender || '',
    words(deal.property_use),
  ].filter(Boolean).join('  ·  ')

  const items = factFindFormItems({
    factFind: ff, bc, lo,
    loanAmount: readMoney(deal.loan_amount),
    lvr: readMoney(bc.lvrPercent) ?? null,
    toConfirm: stillToConfirm(deal),
    internalNotes: deal.internal_notes,
  })

  const bytes = await renderFormPdf(items, {
    title: 'Fact Find',
    subtitles: [
      `${who}${meta ? `  ·  ${meta}` : ''}`,
      `Prepared ${shortDate(new Date().toISOString().slice(0, 10))}. Every box is typeable - fill in anything we are missing.`,
    ],
    footer: `Fact Find - ${who}`,
  })

  return { buffer: Buffer.from(bytes), dealName: fileName }
}

export async function POST(req: NextRequest) {
  try {
    const { dealId } = await req.json()
    const supabase = await createSupabaseServer()

    // SIGNED IN, FIRST.
    //
    // 23 Sep 2026. This route builds a document containing a client's whole
    // financial position and hands it back. It was never open - it reads the
    // deal as whoever called it, so with no session row level security returned
    // nothing and it stopped at "deal not found".
    //
    // But that is a lock made of a side effect. Swap this query to the master
    // key one day for convenience and the lock disappears with it, silently,
    // and anyone with a deal id gets a client's finances as a PDF. Said out
    // loud, it cannot be removed by accident.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

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
