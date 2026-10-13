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
export function pageToText(html: any): string {
  return txt(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
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
