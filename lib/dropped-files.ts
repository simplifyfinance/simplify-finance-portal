// WHAT YOU CAN DROP ON A LENDER, AND WHAT HAPPENS TO IT.
//
// 13 Oct 2026. Fabio: "also want to be able to drop Zip files, pdfs excel and
// emails". Four shapes, one box.
//
//   pdf     read straight through, as it already was
//   zip     expanded; every member becomes its own document under the zip
//   sheet   each sheet becomes a markdown table, then read
//   email   the message becomes a document; each attachment its own under it
//
// THE ORIGINAL OF EVERY FILE IS KEPT AND HASHED, the zip itself included, so
// "what did we actually receive" is always answerable.
//
// A DROPPED FILE IS UNTRUSTED INPUT. Not only its text - its SHAPE. A zip says
// where it would like its members written, how many there are and how big they
// expand to, and every one of those is a claim by a stranger. None of it is
// believed here.

export type DropKind = 'pdf' | 'zip' | 'sheet' | 'email' | 'text' | 'unknown'

const EXT: Record<string, DropKind> = {
  pdf: 'pdf',
  zip: 'zip',
  xlsx: 'sheet', xlsm: 'sheet', xls: 'sheet', csv: 'sheet',
  eml: 'email', msg: 'email',
  md: 'text', txt: 'text', html: 'text', htm: 'text',
}

export function kindOf(name: any): DropKind {
  const ext = String(name ?? '').toLowerCase().split('.').pop() || ''
  return EXT[ext] || 'unknown'
}

/** What a credit manual arrives as, as opposed to what we merely store. */
export function canBeRead(k: DropKind): boolean {
  return k === 'pdf' || k === 'sheet' || k === 'email' || k === 'text'
}

// --- the tier follows where it came from, not what it says ------------------
//
// Blueprint section 3. Nobody types this. A manual is the lender's own written
// policy; an email is a written update; a product spreadsheet is indicative.
export function tierFor(k: DropKind, insideAnEmail: boolean): 'A' | 'B' | 'C' {
  if (insideAnEmail) return 'B'
  if (k === 'email') return 'B'
  if (k === 'sheet') return 'C'
  return 'A'
}

// --- a zip is a stranger describing itself ----------------------------------

export const ZIP_LIMITS = {
  members: 200,
  memberBytes: 40 * 1024 * 1024,
  totalBytes: 200 * 1024 * 1024,
}

/**
 * The name we will actually use. The member's own path is thrown away, not
 * sanitised - a member calling itself `../../etc/passwd`, or `/etc/passwd`, or
 * `C:\x`, does not get a vote on where it lands. Only the last segment is kept,
 * and only to show the person what they dropped.
 */
export function safeMemberName(raw: any): string {
  const last = String(raw ?? '').split(/[/\\]/).pop() || ''
  const cleaned = last.replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').trim()
  return cleaned || 'unnamed'
}

export type ZipMember = { path: string; bytes: number }
export type ZipPlan = { take: { name: string; from: string }[]; skipped: { name: string; why: string }[] }

/**
 * What we will take out of a zip, decided before anything is written.
 * A directory entry is not a file. A format we do not read is stored rather
 * than opened. Everything past a limit is skipped and SAID, never silently.
 */
export function planZip(members: ZipMember[]): ZipPlan {
  const take: ZipPlan['take'] = []
  const skipped: ZipPlan['skipped'] = []
  let total = 0

  for (const m of Array.isArray(members) ? members : []) {
    const raw = String(m?.path ?? '')
    const name = safeMemberName(raw)
    const bytes = Number(m?.bytes) || 0

    if (/[/\\]$/.test(raw)) continue                       // a folder, not a file
    if (take.length >= ZIP_LIMITS.members) {
      skipped.push({ name, why: `more than ${ZIP_LIMITS.members} files in the zip` }); continue
    }
    if (bytes > ZIP_LIMITS.memberBytes) {
      skipped.push({ name, why: 'that file on its own is too big' }); continue
    }
    if (total + bytes > ZIP_LIMITS.totalBytes) {
      skipped.push({ name, why: 'the zip expands to more than we will take' }); continue
    }
    const k = kindOf(name)
    if (k === 'unknown') {
      skipped.push({ name, why: 'we do not open that kind of file' }); continue
    }
    if (k === 'zip') {
      // A zip inside a zip is stored, never opened. There is no honest depth
      // limit to pick, and no lender has ever needed one.
      skipped.push({ name, why: 'a zip inside a zip is kept but not opened' }); continue
    }
    total += bytes
    take.push({ name, from: raw })
  }
  return { take, skipped }
}

// --- a sheet is a table, which is the shape we already handle ---------------

/**
 * One sheet as a markdown table. The first row is treated as the headings,
 * which is what a rate sheet or a policy matrix always does.
 * Blank trailing columns are dropped so a sheet with formatting out to column Z
 * does not arrive as twenty empty headings.
 */
export function sheetToMarkdown(name: string, rows: any[][]): string {
  const grid = (Array.isArray(rows) ? rows : [])
    .map(r => (Array.isArray(r) ? r.map(c => String(c ?? '').replace(/\|/g, '\\|').trim()) : []))
    .filter(r => r.some(c => c !== ''))
  if (grid.length === 0) return ''

  const width = Math.max(...grid.map(r => {
    let last = 0
    r.forEach((c, i) => { if (c !== '') last = i + 1 })
    return last
  }))
  if (width === 0) return ''

  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? '')
  const [head, ...body] = grid
  const lines = [
    `## ${name}`,
    '',
    `| ${pad(head).join(' | ')} |`,
    `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
    ...body.map(r => `| ${pad(r).join(' | ')} |`),
  ]
  return lines.join('\n')
}

// --- an email is a message and some files ------------------------------------

export type EmailParts = {
  from: string
  date: string
  subject: string
  body: string
  attachments: { name: string; encoding: string; data: string }[]
}

const headerOf = (head: string, name: string): string => {
  // Unfolded: a long header continues on the next line, indented.
  const m = new RegExp(`^${name}:[ \\t]*([\\s\\S]*?)(?=\\r?\\n[^ \\t]|$)`, 'im').exec(head)
  return m ? m[1].replace(/\r?\n[ \t]+/g, ' ').trim() : ''
}

/**
 * Enough of MIME to read a forwarded lender update: who sent it, when, what it
 * says, and what was attached.
 *
 * Deliberately small. Everything it returns is TEXT TO BE QUOTED - the body of
 * an email has no more authority than the body of a PDF, and the same test
 * feeds "ignore your previous instructions" through both.
 */
export function emailParts(raw: any): EmailParts {
  const s = String(raw ?? '')
  const split = s.search(/\r?\n\r?\n/)
  const head = split < 0 ? s : s.slice(0, split)
  const rest = split < 0 ? '' : s.slice(split).replace(/^\r?\n\r?\n/, '')

  const out: EmailParts = {
    from: headerOf(head, 'From'),
    date: headerOf(head, 'Date'),
    subject: headerOf(head, 'Subject'),
    body: '',
    attachments: [],
  }

  const boundary = /boundary="?([^";\r\n]+)"?/i.exec(head)?.[1]
  if (!boundary) {
    out.body = rest.trim()
    return out
  }

  for (const part of rest.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?`))) {
    const chunk = part.replace(/^\r?\n/, '')
    if (!chunk.trim()) continue
    const at = chunk.search(/\r?\n\r?\n/)
    if (at < 0) continue
    const ph = chunk.slice(0, at)
    const pb = chunk.slice(at).replace(/^\r?\n\r?\n/, '')
    const disposition = headerOf(ph, 'Content-Disposition')
    const type = headerOf(ph, 'Content-Type')
    const filename = /filename="?([^";\r\n]+)"?/i.exec(disposition + ' ' + type)?.[1]

    if (filename) {
      out.attachments.push({
        name: safeMemberName(filename),
        encoding: headerOf(ph, 'Content-Transfer-Encoding').toLowerCase(),
        data: pb.trim(),
      })
    } else if (!out.body && /text\/plain/i.test(type)) {
      out.body = pb.trim()
    }
  }
  if (!out.body) out.body = rest.trim().slice(0, 20000)
  return out
}

/** "Forwarded by Katie Amos — from policy@nab.com.au, 2 Oct 2026". */
export function emailStamp(e: EmailParts, forwardedBy: string): string {
  const bits: string[] = []
  if (forwardedBy) bits.push(`Forwarded by ${forwardedBy}`)
  if (e.from) bits.push(`from ${e.from}`)
  if (e.date) bits.push(e.date)
  return bits.join(' — ')
}
