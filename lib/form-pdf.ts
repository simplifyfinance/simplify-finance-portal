// DRAWING A SIMPLIFY FORM.
//
// 24 Sep 2026. Two documents are now the same piece of paper: the Personal
// Assessment Form that goes into a client's folder, and the Fact Find that
// comes off the Compliance tab. Fabio: "i want the same style coming out of the
// fact find button on compliance tab", and then "sorry need typeable boxes".
//
// So the drawing is here, once. Where every label and box goes is decided by
// lib/assessment-form.ts; what goes in each one is decided by a content file
// per document. Both of those are pure and tested. This file only draws, and
// there is nothing in it to get wrong twice.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { layout, PAGE, MARGIN, type Item } from './assessment-form'
import { SIMPLIFY_LOGO_PNG, LOGO_WIDTH, LOGO_HEIGHT } from './brand-logo'

const INK     = rgb(0.13, 0.13, 0.13)
const BAND    = rgb(0.16, 0.16, 0.16)
const QUIET   = rgb(0.36, 0.36, 0.36)
const LABELBG = rgb(0.937, 0.937, 0.937)
const ROWBG   = rgb(0.973, 0.973, 0.973)
const BOXBG   = rgb(0.929, 0.929, 0.929)
const BORDER  = rgb(0.78, 0.78, 0.78)
const WHITE   = rgb(1, 1, 1)

export type FormPdfOptions = {
  // The masthead, page one only. The space for it is reserved by the layout.
  title: string
  // The italic lines under it. Two at most before they crowd the first band.
  subtitles?: string[]
  // What runs along the bottom of every page, before "Page 1 of 4".
  footer: string
}

export async function renderFormPdf(items: Item[], opts: FormPdfOptions): Promise<Uint8Array> {
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
      // page. And it must be set at all, or pdf-lib sizes the text to FILL the
      // box - a short sentence comes out at 30pt.
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

    page.drawText(`${opts.footer} - Page ${i + 1} of ${pages.length}`,
      { x: MARGIN.left, y: 24, size: 6.5, font: reg, color: QUIET })
  })

  const one = drawn[0]
  one.drawText(opts.title, { x: MARGIN.left, y: PAGE.h - 34, size: 15, font: bold, color: INK })
  let y = PAGE.h - 48
  for (const line of (opts.subtitles || []).slice(0, 2)) {
    one.drawText(line, { x: MARGIN.left, y, size: 7.4, font: ital, color: QUIET })
    y -= 9
  }
  const lw = 108, lh = lw * LOGO_HEIGHT / LOGO_WIDTH
  one.drawImage(logo, { x: PAGE.w - MARGIN.right - lw, y: PAGE.h - 28 - lh, width: lw, height: lh })

  form.updateFieldAppearances(reg)
  return pdf.save()
}
