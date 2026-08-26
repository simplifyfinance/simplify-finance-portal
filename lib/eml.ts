// A message file the browser hands to Outlook.
//
// mailto: cannot carry a formatted body or an attachment — that is the whole
// reason this exists. A .eml is simply a saved message: Windows hands it to
// whatever mail program is the default, and X-Unsent: 1 tells Outlook to open
// it as a draft to be sent rather than as something already received.
//
// Nothing is uploaded. The file is assembled here, in the tab, from files the
// sender chose, and is gone the moment they leave the page.
//
// Works: Outlook desktop on Windows and Mac. Does not work: Outlook in a
// browser, Gmail, iPhone Mail — those senders need the copy-and-paste button.

const CRLF = '\r\n'
const MAX_TOTAL = 20 * 1024 * 1024   // Exchange commonly refuses more than 25MB

function b64(bytes: Uint8Array): string {
  let s = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any)
  }
  return btoa(s)
}

// Base64 in a message body must not run past 76 characters to the line.
function wrap76(s: string): string {
  return (s.match(/.{1,76}/g) || []).join(CRLF)
}

function b64Text(t: string): string {
  return wrap76(b64(new TextEncoder().encode(t)))
}

// RFC 2047. The subject carries an em dash; sent raw it arrives as mojibake.
// An encoded word may not exceed 75 characters, so a long subject becomes
// several, folded onto continuation lines.
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value
  const enc = new TextEncoder()
  const words: string[] = []
  let buf: number[] = []
  for (const ch of Array.from(value)) {          // by character, never mid-byte
    const bytes = Array.from(enc.encode(ch))
    if (buf.length + bytes.length > 45) { words.push(b64(new Uint8Array(buf))); buf = [] }
    buf.push(...bytes)
  }
  if (buf.length) words.push(b64(new Uint8Array(buf)))
  return words.map(w => `=?UTF-8?B?${w}?=`).join(CRLF + ' ')
}

function rfc2822Date(d: Date): string {
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const pad = (n: number) => String(n).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const hh = pad(Math.floor(Math.abs(off) / 60))
  const mm = pad(Math.abs(off) % 60)
  return `${DAY[d.getDay()]}, ${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${sign}${hh}${mm}`
}

// Filenames go in the headers, so anything outside plain ASCII is replaced
// rather than encoded — a mangled attachment name is worse than a plain one.
function safeName(name: string): string {
  return name
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'attachment.pdf'
}

function boundary(tag: string): string {
  return `----=_sf_${tag}_${Math.random().toString(36).slice(2, 10)}`
}

export type EmlInput = {
  to: string
  bcc?: string
  subject: string
  html: string
  text: string
  attachments?: File[]
}

export function totalAttachmentBytes(files: File[]): number {
  return files.reduce((n, f) => n + f.size, 0)
}

export const ATTACHMENT_LIMIT_MB = Math.round(MAX_TOTAL / (1024 * 1024))

export async function buildEml(input: EmlInput): Promise<Blob> {
  const files = input.attachments || []
  if (totalAttachmentBytes(files) > MAX_TOTAL) {
    throw new Error(`The attachments come to more than ${ATTACHMENT_LIMIT_MB}MB, which most mail servers will refuse.`)
  }

  const mixed = boundary('mix')
  const alt = boundary('alt')
  const L: string[] = []

  L.push(`Date: ${rfc2822Date(new Date())}`)
  L.push(`To: ${input.to}`)
  if (input.bcc && input.bcc.trim()) L.push(`Bcc: ${input.bcc.trim()}`)
  L.push(`Subject: ${encodeHeader(input.subject)}`)
  L.push('X-Unsent: 1')                       // Outlook: open as a draft, not as received mail
  L.push('MIME-Version: 1.0')
  L.push(`Content-Type: multipart/mixed; boundary="${mixed}"`)
  L.push('')

  L.push(`--${mixed}`)
  L.push(`Content-Type: multipart/alternative; boundary="${alt}"`)
  L.push('')

  L.push(`--${alt}`)
  L.push('Content-Type: text/plain; charset="UTF-8"')
  L.push('Content-Transfer-Encoding: base64')
  L.push('')
  L.push(b64Text(input.text))
  L.push('')

  L.push(`--${alt}`)
  L.push('Content-Type: text/html; charset="UTF-8"')
  L.push('Content-Transfer-Encoding: base64')
  L.push('')
  L.push(b64Text(input.html))
  L.push('')
  L.push(`--${alt}--`)
  L.push('')

  for (const file of files) {
    const name = safeName(file.name)
    const type = file.type || 'application/octet-stream'
    const bytes = new Uint8Array(await file.arrayBuffer())
    L.push(`--${mixed}`)
    L.push(`Content-Type: ${type}; name="${name}"`)
    L.push('Content-Transfer-Encoding: base64')
    L.push(`Content-Disposition: attachment; filename="${name}"`)
    L.push('')
    L.push(wrap76(b64(bytes)))
    L.push('')
  }

  L.push(`--${mixed}--`)
  L.push('')

  return new Blob([L.join(CRLF)], { type: 'message/rfc822' })
}

// Saves the file. Nothing is sent — the sender still reads it and presses Send.
export function downloadEml(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.eml') ? filename : `${filename}.eml`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 15000)
}
