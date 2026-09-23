// THE PERSONAL ASSESSMENT FORM.
//
// 23 Sep 2026. Fabio: "Like the data I don't like the look - I will drop my
// current version to inspire you."
//
// So this is his form, not a new one: the same sections in the same order with
// the same wording, the same black bands, the same grey label column down the
// left, Applicant 1 and Applicant 2 side by side, and the properties across the
// page as columns rather than down it as rows. The team and the clients already
// know this piece of paper. The only change is that the portal fills in what it
// already holds, and every box is still typeable.
//
// EVERYTHING HERE IS PURE. It takes a deal and returns where every rule, label
// and box goes. No pdf-lib, no fonts, no file - so the layout is tested rather
// than looked at in a viewer and hoped over.

export const PAGE = { w: 595.28, h: 841.89 }        // A4, points
export const MARGIN = { top: 40, bottom: 44, left: 34, right: 34 }
// Page one carries the title, the two italic lines and the logo. Everything
// else starts under it.
export const MASTHEAD_H = 46
export const CONTENT_W = PAGE.w - MARGIN.left - MARGIN.right

export const LABEL_COL = 196      // the grey column of question text
export const LINE_H = 19          // one line of boxes inside a row
export const PAD = 4
export const BAND_H = 17          // the black section bar
export const HEADER_ROW_H = 15    // "Applicant 1 / Applicant 2"

// ---------------------------------------------------------------------------
// WHAT A ROW IS MADE OF
// ---------------------------------------------------------------------------

export type Seg = {
  // Words printed before the box - "Mobile", "Limit", "Since".
  prefix?: string
  name?: string
  value?: string
  // Draws a $ inside the box, the way the paper form does.
  money?: boolean
  // A radio group instead of a box.
  radio?: string[]
  // Share of the line this segment takes. Omitted means share what is left.
  grow?: number
  // Taller box, for an address or a paragraph.
  tall?: number
}
export type Line = Seg[]
export type Column = Line[]

export type Band   = { kind: 'band';    title: string }
export type Heads  = { kind: 'heads';   titles: string[] }
export type RowDef = { kind: 'row';     label: string; sub?: string; cols: Column[] }
export type Note   = { kind: 'note';    text: string }
export type Item = Band | Heads | RowDef | Note

// ---------------------------------------------------------------------------
// WHAT COMES OUT
// ---------------------------------------------------------------------------

export type Field = {
  name: string; value: string
  x: number; y: number; w: number; h: number
  money?: boolean
  multiline?: boolean
}
export type Radio = { name: string; option: string; x: number; y: number; size: number; chosen: boolean }
export type Text  = { text: string; x: number; y: number; size: number; bold?: boolean; white?: boolean; italic?: boolean }
export type Fill  = { x: number; y: number; w: number; h: number; tone: 'band' | 'label' | 'row' }
export type Page  = { fills: Fill[]; texts: Text[]; fields: Field[]; radios: Radio[] }

const txt = (v: any) => (v === null || v === undefined) ? '' : String(v)

// A DOT IS NOT A CHARACTER IN A PDF FIELD NAME, IT IS A FOLDER SEPARATOR.
//
// "a1.addr.current" makes a box called `current` inside `addr` inside `a1`.
// "a1.addr.current.since" then needs `current` to be a folder, and it is
// already a box - pdf-lib throws "a field already exists with the specified
// name". Names are written with dots everywhere else in this codebase, so
// rather than ban them, they are flattened here, once, for every field and
// every radio group.
// Roughly how wide a string prints in Helvetica at a given size. Not exact -
// exact needs the font metrics, which live in the PDF layer - but close enough
// to decide where to break a line, and deliberately a little generous so a
// label wraps early rather than running past its column.
export function widthOf(text: string, size: number): number {
  let w = 0
  for (const ch of String(text || '')) {
    if (ch === ' ') w += 0.28
    else if (/[A-Z]/.test(ch)) w += 0.66
    else if (/[ilIjt.,'!|]/.test(ch)) w += 0.30
    else if (/[mwMW]/.test(ch)) w += 0.85
    else w += 0.55
  }
  return w * size
}

export function wrap(text: string, size: number, maxWidth: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? line + ' ' + word : word
    if (widthOf(next, size) <= maxWidth || !line) line = next
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

// How many lines a set of radio choices needs once they are wrapped into a
// column this wide. Used BEFORE the row is drawn, so the row can be made tall
// enough to hold them - otherwise the second line of choices lands on top of
// the next question.
export function radioLineCount(options: string[], colWidth: number): number {
  let lines = 1
  let x = 4
  for (const opt of options) {
    const need = 10 + widthOf(opt, 6.4) + 6
    if (x + need > colWidth - 4) { x = 4; lines++ }
    x += need
  }
  return lines
}

export function fieldName(raw: string): string {
  return String(raw || '').replace(/\./g, '_')
}

class Sheet {
  pages: Page[] = []
  private y = 0
  private cols = 2

  constructor() { this.newPage() }
  private newPage() {
    const firstPage = this.pages.length === 0
    this.pages.push({ fills: [], texts: [], fields: [], radios: [] })
    this.y = PAGE.h - MARGIN.top - (firstPage ? MASTHEAD_H : 0)
  }
  private p() { return this.pages[this.pages.length - 1] }
  private room(need: number) { if (this.y - need < MARGIN.bottom) this.newPage() }
  get count() { return this.pages.length }

  // The space left of the value area, and each column's width.
  // A row with no question uses the whole width - the Notes box, for one.
  // Leaving an empty grey column beside it just looks like a mistake.
  private colBox(i: number, n: number, labelled = true) {
    const left = labelled ? LABEL_COL : 0
    const area = CONTENT_W - left
    const w = area / n
    return { x: MARGIN.left + left + i * w, w }
  }

  band(title: string) {
    this.room(BAND_H + 8)
    this.y -= BAND_H
    this.p().fills.push({ x: MARGIN.left, y: this.y, w: CONTENT_W, h: BAND_H, tone: 'band' })
    this.p().texts.push({ text: title.toUpperCase(), x: MARGIN.left + 7, y: this.y + 5, size: 8.5, bold: true, white: true })
    this.y -= 3
  }

  heads(titles: string[]) {
    this.room(HEADER_ROW_H)
    this.y -= HEADER_ROW_H
    titles.forEach((t, i) => {
      const { x, w } = this.colBox(i, titles.length)
      this.p().texts.push({ text: t, x: x + w / 2 - t.length * 2.1, y: this.y + 4, size: 7.5, bold: true })
    })
  }

  note(text: string) {
    this.room(14)
    this.y -= 10
    this.p().texts.push({ text, x: MARGIN.left, y: this.y, size: 5.6 })
    // The band that follows is drawn as a filled rectangle and would sit on
    // top of this line's descenders.
    this.y -= 3
  }

  row(def: RowDef, tint: boolean) {
    const lines = Math.max(1, ...def.cols.map(c => c.length))
    const extra = Math.max(0, ...def.cols.flatMap(c => c.flatMap(l => l.map(s => (s.tall || LINE_H) - LINE_H))))
    // THE QUESTION HAS TO FIT IN ITS COLUMN.
    //
    // "Are you aware of any foreseeable circumstances..." ran straight out of
    // the grey column and across the boxes. It wraps, and if the wrapped
    // question is taller than the answer, the row grows to hold it.
    // Radios that wrap make their line taller, and the row has to know before
    // it is drawn.
    const colW = (CONTENT_W - (def.label.trim() ? LABEL_COL : 0)) / Math.max(1, def.cols.length)
    const radioExtra = Math.max(0, ...def.cols.map(c =>
      c.reduce((n, l) => n + l.reduce((m, s) =>
        m + (s.radio ? (radioLineCount(s.radio, colW) - 1) * 10 : 0), 0), 0)))
    const labelLines = wrap(def.label.toUpperCase(), 6.6, LABEL_COL - 12)
    const subLines = def.sub ? def.sub.split('\n') : []
    const labelH = labelLines.length * 8.5 + subLines.length * 7 + PAD * 2
    const h = Math.max(lines * LINE_H + extra + radioExtra + PAD * 2, labelH)
    this.room(h)
    this.y -= h

    // The grey question column, and the row behind the boxes.
    const labelled = def.label.trim() !== ''
    if (labelled) {
      this.p().fills.push({ x: MARGIN.left, y: this.y, w: LABEL_COL, h, tone: 'label' })
      if (tint) this.p().fills.push({ x: MARGIN.left + LABEL_COL, y: this.y, w: CONTENT_W - LABEL_COL, h, tone: 'row' })
    }

    let ty = this.y + h - 12
    for (const l of labelLines) {
      this.p().texts.push({ text: l, x: MARGIN.left + 6, y: ty, size: 6.6 })
      ty -= 8.5
    }
    for (const sub of subLines) {
      this.p().texts.push({ text: sub, x: MARGIN.left + 6, y: ty, size: 5.4, italic: true })
      ty -= 7
    }

    def.cols.forEach((col, ci) => {
      const { x: cx, w: cw } = this.colBox(ci, def.cols.length, labelled)
      let ly = this.y + h - PAD
      for (const line of col) {
        const lh = Math.max(...line.map(s => s.tall || LINE_H))
        ly -= lh
        // Words first, then the boxes get what is left, shared by `grow`.
        const labelW = line.reduce((n, s) => n + (s.prefix ? widthOf(s.prefix, 6.4) + 6 : 0), 0)
        const radioW = line.reduce((n, s) => n + (s.radio ? s.radio.reduce((m, o) => m + widthOf(o, 6.4) + 14, 0) : 0), 0)
        const boxes = line.filter(s => !s.radio)
        const totalGrow = boxes.reduce((n, s) => n + (s.grow || 1), 0) || 1
        const free = Math.max(20, cw - 10 - labelW - radioW)
        let x = cx + 4
        for (const s of line) {
          if (s.prefix) {
            this.p().texts.push({ text: s.prefix, x, y: ly + 5, size: 6.4 })
            x += s.prefix.length * 3.2 + 6
          }
          if (s.radio) {
            // Four choices rarely fit one line of a half-page column. When the
            // next one would cross into the neighbouring applicant's boxes it
            // drops to a second line instead.
            let ry = ly
            for (const opt of s.radio) {
              const need = 10 + widthOf(opt, 6.4) + 6
              if (x + need > cx + cw - 4) { x = cx + 4; ry -= 10 }
              this.p().radios.push({ name: fieldName(s.name!), option: opt, x, y: ry + 3, size: 7.5,
                chosen: txt(s.value).trim().toLowerCase() === opt.toLowerCase() })
              this.p().texts.push({ text: opt, x: x + 10, y: ry + 5, size: 6.4 })
              x += need
            }
            if (ry < ly) ly = ry
            continue
          }
          const w = free * ((s.grow || 1) / totalGrow)
          // THE DOLLAR SIGN SITS BESIDE THE BOX, NOT INSIDE IT.
          //
          // A form widget is painted over the page, so a $ drawn underneath one
          // simply disappears. The box starts a few points in and the $ goes in
          // the gap - which is what the paper form looks like anyway.
          const inset = s.money ? 8 : 0
          if (s.money) this.p().texts.push({ text: '$', x: x + 1, y: ly + ((s.tall || LINE_H) - 3) / 2 - 2, size: 6.5 })
          this.p().fields.push({
            name: fieldName(s.name!), value: txt(s.value),
            x: x + inset, y: ly + 1, w: Math.max(14, w - 3 - inset), h: (s.tall || LINE_H) - 3,
            money: s.money, multiline: !!s.tall && s.tall > LINE_H * 1.4,
          })
          x += w
        }
      }
    })
  }

  build(items: Item[]) {
    let tint = false
    for (const it of items) {
      if (it.kind === 'band')  { this.band(it.title); tint = false; continue }
      if (it.kind === 'heads') { this.heads(it.titles); continue }
      if (it.kind === 'note')  { this.note(it.text); continue }
      this.row(it, tint)
      tint = !tint
    }
    return this.pages
  }
}

export function layout(items: Item[]): Page[] {
  return new Sheet().build(items)
}

// ---------------------------------------------------------------------------
// CHECKS. A viewer will draw a box half off the paper and say nothing, and two
// boxes sharing a name ARE one box - type in either and both fill.
// ---------------------------------------------------------------------------

export function allFields(pages: Page[]): Field[] { return pages.flatMap(p => p.fields) }

export function duplicateFieldNames(pages: Page[]): string[] {
  const seen = new Set<string>(); const twice = new Set<string>()
  for (const f of allFields(pages)) { if (seen.has(f.name)) twice.add(f.name); seen.add(f.name) }
  // A radio GROUP shares one name across its options on purpose; a group must
  // not share a name with a text box though.
  const groups = new Set(pages.flatMap(p => p.radios.map(r => r.name)))
  for (const f of allFields(pages)) if (groups.has(f.name)) twice.add(f.name)
  return [...twice]
}

export function offThePage(pages: Page[]): Array<Field | Radio> {
  const bad: Array<Field | Radio> = []
  for (const p of pages) {
    for (const f of p.fields) {
      if (f.x < MARGIN.left - 0.5 || f.y < 0 || f.x + f.w > PAGE.w - MARGIN.right + 0.5 || f.y + f.h > PAGE.h) bad.push(f)
    }
    for (const r of p.radios) {
      if (r.x < MARGIN.left - 0.5 || r.y < 0 || r.x + r.size > PAGE.w - MARGIN.right + 0.5) bad.push(r)
    }
  }
  return bad
}
