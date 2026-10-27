// THE EMAIL THAT WENT OUT, AS WORDING.
//
// 29 Oct 2026. Catherine, Operations Manager, item 6: keep a record of what we
// said to a client. Fabio: "think of an idea where the file notes is
// automatically updated with our emails sent to client this for compliance".
//
// And then, on storing the emails to do it: "I don't like the idea of storage.
// So is there a way to make the HTML just wording, structured word, so it
// doesn't look like a mess on the file notes?"
//
// He is right twice over.
//
// SMALLER. A borrowing capacity email is sixty to a hundred kilobytes of markup,
// most of it the 2004-era table scaffolding Outlook needs. The same content as
// text is two or three. Thirty times smaller, kept forever, instead of one copy
// kept until the next regeneration overwrites it.
//
// AND NOT A MESS, because these emails were never prose. They are headings and
// pairs of label and figure - see lib/email-card.ts. Strip the markup and the
// structure is what is left.
//
// WHY IT READS THE HTML RATHER THAN REBUILDING FROM THE DEAL.
//
// Writing the text from the deal's own figures would be a SECOND COPY of what
// the email says, and the two would drift the first time one of the twenty-two
// templates changed. This reads the email that was actually built, so whatever
// the client was sent is what gets recorded - including a figure typed by hand
// into the preview. One source, no drift, and it works for every template
// without any of them knowing about it.

const BLOCK = /<\/(p|div|tr|table|h[1-6]|li)>|<br\s*\/?>/gi

// A row of the cream card: label on the left, figure on the right. See row() in
// lib/email-card.ts.
//
// TWO THINGS LOOK LIKE THIS ROW AND ARE NOT IT, and both of them fooled the
// first version of this file:
//
//   1. THE CARD ITSELF. A card is a table whose single cell holds the title and
//      then a table of rows. Matched loosely, the outer row swallowed the title
//      and the first figure into one line - "What you can borrow Maximum loan".
//      So neither cell may contain a cell of its own: `(?!<t[dr]\b)` makes this
//      match only the innermost rows.
//
//   2. THE COLOURED BAR down the left of a note or the questions block, which
//      is a four-pixel cell holding one space, beside a cell holding the whole
//      block. That IS two cells. It is caught below instead: a row with nothing
//      on one side is not a figure, and is handed back untouched to be read as
//      the paragraphs it actually is.
const TWO_CELL = /<tr\b[^>]*>\s*<td\b[^>]*>((?:(?!<t[dr]\b)[\s\S])*?)<\/td>\s*<td\b[^>]*>((?:(?!<t[dr]\b)[\s\S])*?)<\/td>\s*<\/tr>/gi

// A heading is a paragraph the email itself has set in capitals - a card title,
// "Important things to note", the questions block. Nothing else is uppercased,
// so nothing else is mistaken for one.
const HEADING = /<p\b[^>]*text-transform:\s*uppercase[^>]*>([\s\S]*?)<\/p>/gi

const ROW = '\u0001'
const HEAD = '\u0002'

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–').replace(/&rarr;/g, '→').replace(/&bull;/g, '•')
    .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

/** Everything inside, with the tags taken off and the spaces tidied. */
function flat(html: string): string {
  return decode(String(html).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

/**
 * THE WHOLE EMAIL, AS TEXT.
 *
 * Returns an empty string for anything that is not an email, rather than a page
 * of punctuation - a file note that reads as rubbish is worse than no file note.
 */
export function emailAsText(html: any, width = 26): string {
  const raw = String(html ?? '')
  if (!raw.trim()) return ''

  let s = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, '')

  // Pull the two-cell rows and the headings out BEFORE everything else, because
  // once the tags are gone there is no telling a figure from a sentence.
  s = s.replace(TWO_CELL, (_m, a, b) => {
    const label = flat(a), value = flat(b)
    // See note 2 above. A figure row has something on both sides of it;
    // anything else is left exactly as it was and read as prose.
    if (!label || !value) return _m
    return `\n${ROW}${label}${ROW}${value}${ROW}\n`
  })
  s = s.replace(HEADING, (_m, inner) => {
    const t = flat(inner)
    return t ? `\n\n${HEAD}${t.toUpperCase()}\n` : '\n'
  })

  s = s.replace(BLOCK, '\n')
  s = decode(s.replace(/<[^>]*>/g, ''))

  const out: string[] = []
  for (const line of s.split('\n')) {
    const t = line.replace(/[ \t ]+/g, ' ').trim()
    if (!t) { if (out.length && out[out.length - 1] !== '') out.push(''); continue }
    // FIGURES SIT TOGETHER. Every row arrives wrapped in blank lines because of
    // the table markup around it, and a card printed with a gap between each
    // figure reads as four separate things rather than one card.
    if (t.startsWith(ROW) && out.length && out[out.length - 1] === ''
        && out.length > 1 && out[out.length - 2].startsWith('  ')) out.pop()
    if (t.startsWith(HEAD)) { out.push(t.slice(1)); continue }
    if (t.startsWith(ROW)) {
      const [, label, value] = t.split(ROW)
      // A label longer than the column still gets two spaces after it. Without
      // this, "Purchase price we modelled$1,050,000" - which is what the first
      // run of this printed.
      out.push(`  ${label.length >= width ? label + '  ' : label.padEnd(width)}${value}`)
      continue
    }
    out.push(t)
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * THE HEADER THAT MAKES IT A RECORD RATHER THAN A PASTE.
 *
 * Who it went to, who sent it and when. Without those three the wording is just
 * a copy of an email nobody can place.
 */
export function sentEmailAsText(opts: {
  what: string
  subject?: string
  to?: string[] | string
  bcc?: string
  by?: string
  brand?: string
  at?: Date
  html?: any
}): string {
  const at = opts.at || new Date()
  const list = Array.isArray(opts.to) ? opts.to.filter(Boolean).join(', ') : String(opts.to || '')
  // THE HOUR, IN MELBOURNE, ALWAYS.
  //
  // Without the zone this reads the clock of whatever machine printed it - and
  // the machine that prints it is a server in UTC, so an email sent at 11:31 in
  // the morning went into the file as 12:31am the day before. A file note with
  // the wrong time on it is worse than no file note: it is a record that
  // disagrees with the client's own inbox.
  const when = at.toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).replace(/\s?([ap])m$/i, (_m, x) => x.toLowerCase() + 'm')
  const head = [
    String(opts.what || 'Email sent').toUpperCase(),
    [when, opts.by, opts.brand].map(x => String(x || '').trim()).filter(Boolean).join(' · '),
    list ? `To   ${list}` : '',
    // SAID BY NAME, NOT BY THE ADDRESS. The SalesTrekker code is seventy
    // characters of nothing a person can read, and it is the same on every line.
    opts.bcc ? 'BCC  SalesTrekker' : '',
    opts.subject ? `Subject  ${opts.subject}` : '',
  ].filter(Boolean).join('\n')

  const body = emailAsText(opts.html)
  return body ? `${head}\n\n${body}` : head
}
