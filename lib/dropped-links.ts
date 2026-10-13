// A LINK IS A DROP THAT ARRIVED OVER HTTPS.
//
// 13 Oct 2026. Fabio: "I have zip file for exmaple for nab but macquarie for
// example eberyhting is on a link to a webpage so I want to speed up the
// libraryu".
//
// He is right and the library was built wrong. Macquarie's credit guidelines
// are a PDF on their website, AMP's whole policy library is web pages, and
// neither is a file anybody can be asked to go and find first. Seven banks can
// be in the library this afternoon if the drop zone takes an address.
//
// THIS IS NOT THE CRAWLING THE SPEC PARKED. docs/paco.md rules out a scheduled
// robot going round lender websites, because what each lender permits is a
// commercial question nobody has answered. One address, pasted by a person who
// is accredited with that lender, fetched once and stamped with the day, is an
// upload. The difference is a human chose it and a human can be asked why.

export type LinkKind = 'pdf' | 'page'

/** Nothing bigger than this is pulled down. A credit manual is a few MB. */
export const LINK_MAX_BYTES = 25 * 1024 * 1024

/** How long we will wait for a lender's website before giving up. */
export const LINK_TIMEOUT_MS = 60_000

const txt = (v: any): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** Trims, drops the angle brackets an email client wraps a link in. */
export function tidyLink(raw: any): string {
  return txt(raw).trim().replace(/^<+/, '').replace(/>+$/, '').trim()
}

// ADDRESSES ON OUR OWN SIDE OF THE WALL ARE NOT LENDER WEBSITES.
//
// A drop zone that fetches whatever it is given is a drop zone that will
// happily fetch our own database, our own metadata service or anything else
// reachable from the server. The lender's site is on the public internet; a
// link that is not is a mistake at best.
const PRIVATE = [
  /^localhost$/i,
  /^127\./, /^0\./, /^10\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /\.local$/i, /\.internal$/i,
]

export function isOurOwnSide(host: any): boolean {
  const h = txt(host).trim().toLowerCase()
  if (!h) return true
  return PRIVATE.some(p => p.test(h))
}

/**
 * Why this is not a link we will fetch, in words for a person. '' means fine.
 */
export function whyNotALink(raw: any): string {
  const s = tidyLink(raw)
  if (!s) return 'Paste the web address of the document.'
  let u: URL
  try { u = new URL(s) } catch { return 'That is not a web address. It should start with https.' }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return 'That has to be a web address starting with https.'
  }
  if (isOurOwnSide(u.hostname)) {
    return 'That address is on our own network rather than the lender’s website.'
  }
  if (!u.hostname.includes('.')) {
    return 'That address has no website in it.'
  }
  return ''
}

export function looksLikeALink(raw: any): boolean {
  return whyNotALink(raw) === ''
}

/** A PDF is read as a document; anything else is read as a page. */
export function kindFromLink(raw: any): LinkKind {
  const s = tidyLink(raw).toLowerCase()
  try {
    const u = new URL(s)
    return u.pathname.endsWith('.pdf') ? 'pdf' : 'page'
  } catch { return 'page' }
}

/**
 * A title a person would recognise, out of the address.
 *
 * macquarie_broker-credit-guidelines.pdf  ->  macquarie broker credit guidelines
 * distributor.amp.com.au/policies         ->  policies
 * bluestone.com.au                        ->  bluestone.com.au
 */
export function nameFromLink(raw: any): string {
  const s = tidyLink(raw)
  let u: URL
  try { u = new URL(s) } catch { return '' }
  const bits = u.pathname.split('/').filter(Boolean)
  const last = bits.length > 0 ? bits[bits.length - 1] : ''
  if (!last) return u.hostname.replace(/^www\./, '')
  let name = ''
  try { name = decodeURIComponent(last) } catch { name = last }
  name = name.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim()
  return name || u.hostname.replace(/^www\./, '')
}

/** The host, for showing beside the title so nobody has to read a URL. */
export function siteOf(raw: any): string {
  try { return new URL(tidyLink(raw)).hostname.replace(/^www\./, '') } catch { return '' }
}

// A WEB PAGE IS NOT A DOCUMENT UNTIL THE FURNITURE COMES OFF.
//
// A lender's policy page carries a nav, a cookie banner, a footer and a chat
// widget, and every one of them is text. Feeding that to the reader gets rules
// quoted out of a cookie banner. Scripts and styles go first, then tags, then
// the whitespace that is left.
// A HEADING IS MARKED ON ITS WAY THROUGH, so the page can be cut back into
// its own topics afterwards. The mark is a character no policy document
// contains, and it never reaches the reader - splitIntoTopics takes it off.
export const HEADING_MARK = '\u0001'

export function pageToText(html: any): string {
  return txt(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<h[1-6][^>]*>/gi, `\n${HEADING_MARK}`)
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
    .join('\n')
}

/** Enough of a document to be worth reading. Below this it is an error page. */
export const ENOUGH_TO_READ = 400

export function tooThinToRead(text: any): boolean {
  return txt(text).trim().length < ENOUGH_TO_READ
}

// ONE TOPIC AT A TIME, THE SAME WAY A ZIP IS ONE CHAPTER AT A TIME.
//
// 13 Oct 2026. AMP's policy library is one page carrying a hundred and
// twenty four thousand characters - thirty five topics and a whole SMSF
// section. Handed to the reader in one lump it does not fail loudly: the
// reader runs out of room to write its answer, the JSON comes back cut in
// half, nothing parses, and the page reports zero rules with no explanation.
//
// NAB only worked because the zip arrived already split into twelve chapters.
// This does the same thing to a web page, using the headings the lender wrote
// itself. Each topic is read on its own, carries its real section name, and a
// bad one costs nothing but itself.
export const TOPIC_LIMITS = {
  /** Comfortably inside what the reader can answer in one go. */
  maxChars: 18000,
  /** A heading with two lines under it is not worth a read of its own. */
  minChars: 500,
  /** Past this it stops being a document and starts being a website. */
  maxParts: 60,
}

export type Topic = { name: string; text: string }

// ONE LINE CAN BE THE WHOLE PAGE. A policy page written as one unbroken
// paragraph, or a PDF converted to text with the line ends lost, arrives as a
// single line of forty thousand characters - and splitting on line ends does
// nothing at all to it. So a line that is too big on its own is cut on sentence
// ends first, then on spaces, and only then by counting characters.
function breakUpALine(line: string): string[] {
  if (line.length <= TOPIC_LIMITS.maxChars) return [line]
  const out: string[] = []
  // Keep the full stop with the sentence it ends.
  const sentences = line.split(/(?<=[.!?])\s+/)
  let held = ''
  const push = () => { if (held.trim()) out.push(held.trim()); held = '' }
  for (const piece of sentences) {
    for (const bit of piece.length <= TOPIC_LIMITS.maxChars ? [piece] : hardCut(piece)) {
      if (held.length + bit.length + 1 > TOPIC_LIMITS.maxChars) push()
      held = held ? `${held} ${bit}` : bit
    }
  }
  push()
  return out
}

// LAST RESORT. A rule cut in half cannot quote itself, so the gate further
// down throws it away - which is wasteful but never wrong.
function hardCut(piece: string): string[] {
  const out: string[] = []
  let held = ''
  for (const word of piece.split(/\s+/)) {
    if (held.length + word.length + 1 > TOPIC_LIMITS.maxChars) {
      if (held) { out.push(held); held = '' }
      // A single "word" longer than the limit is not language. Cut it.
      let rest = word
      while (rest.length > TOPIC_LIMITS.maxChars) {
        out.push(rest.slice(0, TOPIC_LIMITS.maxChars))
        rest = rest.slice(TOPIC_LIMITS.maxChars)
      }
      held = rest
      continue
    }
    held = held ? `${held} ${word}` : word
  }
  if (held) out.push(held)
  return out
}

function chunk(name: string, body: string): Topic[] {
  if (body.length <= TOPIC_LIMITS.maxChars) return [{ name, text: body }]
  // SPLIT ON A LINE END WHERE THERE IS ONE, mid sentence only where there is not.
  const out: Topic[] = []
  let held: string[] = [], size = 0
  const close = () => {
    if (held.length === 0) return
    out.push({ name: `${name} (${out.length + 1})`, text: held.join('\n') })
    held = []; size = 0
  }
  for (const line of body.split('\n')) {
    for (const piece of breakUpALine(line)) {
      if (size + piece.length > TOPIC_LIMITS.maxChars) close()
      held.push(piece); size += piece.length + 1
    }
  }
  close()
  return out
}

/**
 * Cut a page into the topics its own headings describe.
 *
 * A page with no headings at all comes back in even pieces rather than in one,
 * because the reason for cutting it up has nothing to do with whether the
 * lender bothered to use an h2.
 */
export function splitIntoTopics(raw: any, fallbackName = 'Part'): Topic[] {
  const text = txt(raw).trim()
  if (!text) return []

  const lines = text.split('\n')
  const found: Topic[] = []
  let name = '', held: string[] = []

  const close = () => {
    const body = held.join('\n').trim()
    held = []
    if (!body) return
    // A SHORT SECTION JOINS THE ONE BEFORE IT. Thirty headings with a line
    // each is a navigation menu, not thirty topics.
    const last = found.length > 0 ? found[found.length - 1] : null
    if (last && body.length < TOPIC_LIMITS.minChars) {
      last.text = `${last.text}\n${name ? `${name}\n` : ''}${body}`
      return
    }
    for (const t of chunk(name || fallbackName, `${name ? `${name}\n` : ''}${body}`)) found.push(t)
  }

  for (const line of lines) {
    if (line.startsWith(HEADING_MARK)) {
      close()
      name = line.slice(HEADING_MARK.length).trim()
      continue
    }
    held.push(line)
  }
  close()

  const clean = found
    .map(t => ({ name: t.name.replace(new RegExp(HEADING_MARK, 'g'), '').trim() || fallbackName,
                 text: t.text.replace(new RegExp(HEADING_MARK, 'g'), '').trim() }))
    .filter(t => t.text.length > 0)

  if (clean.length === 0) return chunk(fallbackName, text.replace(new RegExp(HEADING_MARK, 'g'), ''))

  // PAST THE CAP THE TAIL IS JOINED UP rather than dropped. Sixty reads is
  // already a long wait; losing the end of a credit policy is worse.
  if (clean.length <= TOPIC_LIMITS.maxParts) return clean
  const kept = clean.slice(0, TOPIC_LIMITS.maxParts - 1)
  const rest = clean.slice(TOPIC_LIMITS.maxParts - 1)
  kept.push({ name: 'The rest of the page', text: rest.map(t => t.text).join('\n') })
  return kept
}
