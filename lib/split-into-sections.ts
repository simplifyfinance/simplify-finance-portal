// A DOCUMENT COMES APART INTO THE SECTIONS IT ALREADY HAS.
//
// 13 Oct 2026, the morning after the Macquarie afternoon. Fabio dropped one
// document, got "0 lines" four times, and asked the question this whole file
// exists to answer: "how do i know Macqaurie is done???"
//
// The old way carved a document into hundreds of one-sentence rules in a single
// model call at drop time. One call, hundreds of rules, no second chances. When
// it ran out of room the JSON came back cut in half and every rule in it was
// thrown away - with the document sitting in storage, complete, unreadable.
//
// THE MEASUREMENT THAT CHANGED THE DESIGN. Split on the headings the lender
// already wrote and you get:
//
//   Macquarie Credit Guidelines v14.1 -> 24 sections, median ~560 tokens
//   NAB broker credit policy, 12 chapters -> 132 sections, median ~200 tokens
//
// Every one of those is a complete, named, quotable rule set. "1A. Equity
// release and cash out" IS the answer to a cash out question, tables and
// exceptions still attached. We never needed to mince it.
//
// THE RULE THIS FILE KEEPS. It never returns nothing. A document with no
// headings at all comes back as one section holding the whole text, because a
// document we can read badly is worth more than a document we cannot read.
// Splitting is allowed to do a poor job. It is not allowed to lose the text.
//
// No model is called here. It is a function of the text and nothing else, so
// it gives the same answer every time and can be tested without a network.

/** One piece of a document, whole and quotable on its own. */
export type Section = {
  /** Where it sits in the document, from 1. Ordering is the document's. */
  ordinal: number
  /** "10.7", "1A", "" - the lender's own address for it, where they gave one. */
  number: string
  /** "Self Employed Income". Never empty; falls back to the document name. */
  title: string
  /** The section's own words, headings stripped, blank lines tidied. */
  body: string
  /** "10 > 10.7" where a document nests. One level means just the section. */
  path: string
  /** Set when one oversized section had to be cut: "2 of 3". Else "". */
  part: string
  chars: number
}

/** How a document marks its own headings. Detected, never assumed. */
export type HeadingStyle = 'marker' | 'markdown' | 'numbered' | 'shouted' | 'none'

// A section bigger than this is cut on a paragraph boundary. ~6,000 tokens:
// comfortably inside a prompt alongside four others, the question and a reply.
// NAB's largest real section is 17,958 characters, so this bites rarely - it
// is here for the lender who publishes a 60,000 character chapter with one
// heading on top, which is a thing that will happen eventually.
export const MAX_CHARS = 24_000

const clean = (s: string): string => s.replace(/\r\n?/g, '\n').replace(/ /g, ' ')
const tidy = (s: string): string => s.replace(/\n{3,}/g, '\n\n').trim()

// WHAT A HEADING LOOKS LIKE, in the four shapes lender documents actually use.
//
// Each returns [number, title] or null. They are deliberately strict: a line
// that is merely short and capitalised is not a heading, because a document
// where every other line is a "heading" is worse than one with none at all.
const STYLES: Record<Exclude<HeadingStyle, 'none'>, (line: string) => [string, string] | null> = {
  // OURS. Put there by the reader when a document arrives as plain text with
  // its structure visible to a person but not to a parser.
  marker: (l) => {
    const m = /^@@\s*(.+?)\s*$/.exec(l)
    if (!m) return null
    return splitNumberOffTitle(m[1])
  },

  // Markdown. How the NAB chapters arrived.
  markdown: (l) => {
    const m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(l)
    if (!m) return null
    return splitNumberOffTitle(m[2])
  },

  // A line that is only a number and a name. "10.7 Self Employed Income",
  // "4.2.1 Rental", "1A. Loan Purpose". The title must start with a letter and
  // the line must not end in a full stop, which is what keeps ordinary
  // numbered prose - "1. In an upward trend a maximum income is..." - out.
  numbered: (l) => {
    const m = /^\s{0,3}(\d{1,2}(?:\.\d{1,2}){0,3}[A-Z]?)[.)]?\s+([A-Za-z][^\n]{2,90})$/.exec(l)
    if (!m) return null
    const title = m[2].trim()
    if (/[.;,:]$/.test(title)) return null
    // Prose dressed as a heading: a real heading rarely runs to twelve words.
    if (title.split(/\s+/).length > 12) return null
    return [m[1], title]
  },

  // SHOUTED. "EQUITY RELEASE AND CASH OUT" on its own line. Last resort, and
  // held to a short line so a capitalised sentence does not qualify.
  shouted: (l) => {
    const t = l.trim()
    if (t.length < 4 || t.length > 70) return null
    if (!/^[A-Z0-9][A-Z0-9 ,'()/&-]+$/.test(t)) return null
    if (!/[A-Z]{3}/.test(t)) return null
    return ['', t.replace(/\s+/g, ' ')]
  },
}

/** "1A. Loan Purpose" -> ["1A", "Loan Purpose"]. "Overview" -> ["", "Overview"]. */
function splitNumberOffTitle(raw: string): [string, string] {
  const t = raw.trim()
  const m = /^(\d{1,2}(?:\.\d{1,2}){0,3}[A-Z]?)[.)]?\s+(.+)$/.exec(t)
  if (m) return [m[1], m[2].trim()]
  return ['', t]
}

// HOW MANY HEADINGS BEFORE WE BELIEVE A CONVENTION, which is really a question
// about how easily each one is faked by ordinary writing.
const NEEDED: Record<Exclude<HeadingStyle, 'none'>, number> = {
  // We put these there ourselves when a document arrives as plain text. One is
  // a deliberate act, not a coincidence.
  marker: 1,
  // A lone "# Credit Guidelines" at the top is the document's own name, and
  // honouring it costs nothing - the words underneath are the same either way.
  markdown: 1,
  // "4.1 Residency" alone could be a line in a contents list, so two.
  numbered: 2,
  // And a shouted line is very often just emphasis inside a paragraph, so
  // three before it is allowed to carve up a document.
  shouted: 3,
}

/**
 * Which convention this document uses.
 *
 * THE FIRST ONE THAT CLEARS ITS BAR WINS, in order of how deliberate it is -
 * not the one with the most matches. A document with three markdown headings
 * and forty shouted lines is a markdown document with some emphasis in it, and
 * counting matches would have got that exactly backwards.
 *
 * Styles are never mixed. Splitting on two conventions at once cuts mid-rule,
 * and half a rule about income shading is worse than no rule at all.
 */
export function detectStyle(text: string): HeadingStyle {
  const lines = clean(text).split('\n')
  for (const style of ['marker', 'markdown', 'numbered', 'shouted'] as const) {
    let n = 0
    for (const l of lines) if (STYLES[style](l)) n += 1
    if (n >= NEEDED[style]) return style
  }
  return 'none'
}

/**
 * A document, in the pieces it already came in.
 *
 * `name` is the document's own name and is used as the title of the opening
 * run of text before the first heading, and as the single section's title when
 * a document has no headings at all. It is never left blank, because a section
 * with no title cannot be cited and an uncitable quote is one we will not show.
 */
export function splitIntoSections(text: string, name = 'Document'): Section[] {
  const whole = clean(text)
  const style = detectStyle(whole)

  // NO HEADINGS, OR NOT ENOUGH TO TRUST. One section, the whole text. This is
  // the branch that means a badly formatted document still answers questions.
  if (style === 'none') return cutOversize([raw(1, '', name, whole, name)])

  const read = STYLES[style]
  const lines = whole.split('\n')

  // EVERY HEADING IS KEPT HERE, INCLUDING THE EMPTY ONES.
  //
  // A heading with no words under it is not a section - it would only ever
  // match on its own title - but it IS structure. NAB writes "11.5 Mature age
  // borrowers" as a bare heading and then puts the words in "11.5.1 Repayment
  // at retirement" underneath. Dropping the empty one at this stage filed
  // 11.5.1 under 11.4, and the parent's name goes into the search text, so a
  // search for mature age found the wrong chapter. They are dropped after the
  // paths are built, not before.
  const heads: Section[] = []
  let number = ''
  let title = name
  let buf: string[] = []

  const flush = () => {
    heads.push(raw(heads.length + 1, number, title, tidy(buf.join('\n')), name))
    buf = []
  }

  for (const line of lines) {
    const head = read(line)
    if (head) {
      flush()
      number = head[0]
      title = head[1] || name
      continue
    }
    buf.push(line)
  }
  flush()

  const out = withPaths(heads).filter(s => s.body.length > 0)
  if (out.length === 0) return cutOversize([raw(1, '', name, tidy(whole), name)])
  return cutOversize(out)
}

function raw(ordinal: number, number: string, title: string, body: string, name: string): Section {
  return { ordinal, number, title: title || name, body, path: '', part: '', chars: body.length }
}

/**
 * "10 > 10.7". Where a lender numbers their sections, a sub-section carries
 * its parent's name, because "10.7 Self Employed Income" read alone does not
 * say it sits under Income - and a broker searching "income" should find it.
 */
function withPaths(secs: Section[]): Section[] {
  const seen: { number: string; title: string }[] = []
  for (const s of secs) {
    if (!s.number) { s.path = s.title; continue }
    const depth = s.number.split('.').length
    // Drop anything at or below this depth; what is left are its parents.
    while (seen.length && seen[seen.length - 1].number.split('.').length >= depth) seen.pop()
    s.path = [...seen.map(p => `${p.number} ${p.title}`), `${s.number} ${s.title}`].join(' > ')
    seen.push({ number: s.number, title: s.title })
  }
  return secs
}

/**
 * One enormous section becomes several, cut on blank lines, each keeping the
 * heading so every piece is still citable. "2 of 3" is said out loud so a
 * quote is never presented as a whole section when it is a third of one.
 */
function cutOversize(secs: Section[]): Section[] {
  if (!secs.some(s => s.chars > MAX_CHARS)) return renumber(secs)
  const out: Section[] = []
  for (const s of secs) {
    if (s.chars <= MAX_CHARS) { out.push(s); continue }
    const pieces = breakOnBlankLines(s.body)
    pieces.forEach((body, i) => out.push({
      ...s, body, chars: body.length, part: `${i + 1} of ${pieces.length}`,
    }))
  }
  return renumber(out)
}

function breakOnBlankLines(body: string): string[] {
  const paras = body.split(/\n{2,}/)
  const out: string[] = []
  let buf: string[] = []
  let n = 0
  for (const p of paras) {
    // A single paragraph longer than the cap is cut on its own, hard, rather
    // than being allowed through - one 40,000 character wall of text would
    // otherwise defeat the whole cap.
    if (p.length > MAX_CHARS) {
      if (buf.length) { out.push(buf.join('\n\n')); buf = []; n = 0 }
      for (let i = 0; i < p.length; i += MAX_CHARS) out.push(p.slice(i, i + MAX_CHARS))
      continue
    }
    if (n + p.length > MAX_CHARS && buf.length) { out.push(buf.join('\n\n')); buf = []; n = 0 }
    buf.push(p); n += p.length + 2
  }
  if (buf.length) out.push(buf.join('\n\n'))
  return out.length ? out : [body]
}

const renumber = (secs: Section[]): Section[] =>
  secs.map((s, i) => ({ ...s, ordinal: i + 1 }))

/**
 * What goes into the search index for one section.
 *
 * THE CONTEXT LINE IS THE POINT. A section reading "Maximum LVR is 90%" is
 * nearly useless on its own - 90% for what, at which lender? Both briefs call
 * this contextual retrieval and both suggest a model write the context. It
 * does not need one. The lender, the document and the section's own path say
 * it exactly, for nothing, with no call to go wrong.
 */
export function searchTextFor(s: Section, lender: string, document: string): string {
  const head = [lender, document, s.path || s.title].filter(Boolean).join(' — ')
  return `${head}\n\n${s.body}`
}

/** How a quote from this section is addressed, in a broker's words. */
export function citeSection(s: Section, lender: string, document: string): string {
  const where = s.number ? `${s.number} ${s.title}` : s.title
  const part = s.part ? ` (part ${s.part})` : ''
  return `${lender} — ${document} — ${where}${part}`
}
