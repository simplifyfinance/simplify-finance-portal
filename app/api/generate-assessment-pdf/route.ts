// THE PERSONAL ASSESSMENT FORM, FILLED IN AND STILL TYPEABLE.
//
// 23 Sep 2026. Saved into the client's folder when a deal settles. It is
// Fabio's own paper form - same sections, same wording, same black bands - with
// whatever the portal already holds written into it, and every box still a box.
//
// Where every label and box goes is decided in lib/assessment-form.ts, and what
// goes in each one in lib/assessment-content.ts. Both are pure and tested. This
// file only draws.

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createSupabaseServer } from '@/lib/supabase-server'
import { layout, PAGE, MARGIN, MASTHEAD_H } from '@/lib/assessment-form'
import { assessmentItems } from '@/lib/assessment-content'
import { EXPENSE_CATEGORIES } from '@/lib/handover-view'
import { SIMPLIFY_LOGO_PNG, LOGO_WIDTH, LOGO_HEIGHT } from '@/lib/brand-logo'

export const runtime = 'nodejs'

const INK     = rgb(0.13, 0.13, 0.13)
const BAND    = rgb(0.16, 0.16, 0.16)
const QUIET   = rgb(0.36, 0.36, 0.36)
const LABELBG = rgb(0.937, 0.937, 0.937)
const ROWBG   = rgb(0.973, 0.973, 0.973)
const BOXBG   = rgb(0.929, 0.929, 0.929)
const BORDER  = rgb(0.78, 0.78, 0.78)
const WHITE   = rgb(1, 1, 1)

export async function POST(req: NextRequest) {
  try {
    // SIGNED IN, FIRST.
    //
    // This one is handed the fact find rather than reading it, so it cannot
    // leak a deal nobody already had. It still asks: a route that renders a
    // client's financial position onto paper is not something to leave open to
    // the internet, and one unguarded route makes the rule "most of them ask",
    // which is not a rule anybody can rely on.
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const { factFind, expenses, dealName, estimatedLoanAmount, notes } = await req.json()

    const items = assessmentItems({
      factFind,
      expenses,
      // Passed in rather than listed again, so the form cannot drift from the
      // categories the Compliance tab actually asks for.
      expenseCategories: EXPENSE_CATEGORIES.map(c => ({ key: c.key, label: c.label })),
      estimatedLoanAmount,
      notes,
    })
    const pages = layout(items)

    const pdf = await PDFDocument.create()
    const reg  = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const ital = await pdf.embedFont(StandardFonts.HelveticaOblique)
    const logo = await pdf.embedPng(SIMPLIFY_LOGO_PNG)
    const form = pdf.getForm()

    const drawn = pages.map(() => pdf.addPage([PAGE.w, PAGE.h]))

    pages.forEach((spec, i) => {
      const page = drawn[i]

      for (const f of spec.fills) {
        const colour = f.tone === 'band' ? BAND : f.tone === 'label' ? LABELBG : ROWBG
        page.drawRectangle({ x: f.x, y: f.y, width: f.w, height: f.h, color: colour })
      }
      for (const t of spec.texts) {
        page.drawText(t.text, {
          x: t.x, y: t.y, size: t.size,
          font: t.bold ? bold : t.italic ? ital : reg,
          color: t.white ? WHITE : t.bold ? INK : QUIET,
        })
      }
      for (const f of spec.fields) {
        const box = form.createTextField(f.name)
        box.setText(f.value)
        if (f.multiline) box.enableMultiline()
        box.addToPage(page, {
          x: f.x, y: f.y, width: f.w, height: f.h,
          font: reg, textColor: INK, backgroundColor: BOXBG,
          borderColor: BORDER, borderWidth: 0.5,
        })
        // AFTER addToPage: a field has no default appearance until it is on a
        // page. And it must be set at all, or pdf-lib sizes the text to FILL
        // the box - a short sentence comes out at 30pt.
        box.setFontSize(7)
      }

      // Radios share one name across their options on purpose - that is what
      // makes them one choice rather than several.
      const groups = new Map<string, any>()
      for (const r of spec.radios) {
        if (!groups.has(r.name)) groups.set(r.name, form.createRadioGroup(r.name))
        const group = groups.get(r.name)
        group.addOptionToPage(r.option, page, {
          x: r.x, y: r.y, width: r.size, height: r.size,
          borderColor: BORDER, borderWidth: 0.5,
        })
        // Never allowed to fail the whole document over one tick.
        if (r.chosen) { try { group.select(r.option) } catch { /* leave it blank */ } }
      }

      page.drawText(`Simplify Finance Personal Assessment Form - Page ${i + 1} of ${pages.length}`,
        { x: PAGE.w - MARGIN.right - 198, y: 24, size: 6.5, font: reg, color: QUIET })
    })

    // The masthead, page one only. The space for it is reserved in the layout.
    const one = drawn[0]
    one.drawText('Personal Assessment Form', { x: MARGIN.left, y: PAGE.h - 34, size: 15, font: bold, color: INK })
    one.drawText('Please complete all pages of this personal assessment form.',
      { x: MARGIN.left, y: PAGE.h - 48, size: 7.4, font: ital, color: QUIET })
    one.drawText('This will enable me to find a tailored solution to your financial goals.',
      { x: MARGIN.left, y: PAGE.h - 57, size: 7.4, font: ital, color: QUIET })
    const lw = 108, lh = lw * LOGO_HEIGHT / LOGO_WIDTH
    one.drawImage(logo, { x: PAGE.w - MARGIN.right - lw, y: PAGE.h - 28 - lh, width: lw, height: lh })

    form.updateFieldAppearances(reg)

    const bytes = await pdf.save()
    const file = String(dealName || 'Personal Assessment Form').replace(/[\/\\:*?"<>|]/g, '-').slice(0, 180)
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Simplify Finance - ${file}.pdf"`,
      },
    })
  } catch (e: any) {
    console.error('[assessment pdf]', e)
    return NextResponse.json({ error: e?.message || 'Could not build the form' }, { status: 500 })
  }
}
