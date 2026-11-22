'use client'
import { createSupabaseBrowser } from './supabase-browser'

// SENDING A DOCUMENT TO BE READ, HOWEVER BIG IT IS.
//
// 22 Nov 2026. Belle, on the unsigned and signed loan documents for a
// refinance:
//
//     Unexpected token 'R', "Request En"... is not valid JSON
//
// Two faults, one on top of the other.
//
// THE FIRST IS THE CEILING. Every drop zone in the portal read the PDF into
// base64 and posted it as JSON. Vercel refuses a request body over 4.5 MB and
// answers in PLAIN TEXT - "Request Entity Too Large". Base64 is a third bigger
// than the file it encodes, so the real limit was a PDF of about 3.3 MB. A
// signed loan document pack is routinely bigger. The biggest job the
// settlements team has was the one the portal could not do.
//
// THE SECOND IS WHAT IT SAID. The screen called res.json() on that plain text
// and showed the parser's complaint. A settlements officer reads "Unexpected
// token 'R'" and concludes the portal is broken - which is fair, because
// nothing on screen mentions a size.
//
// IT WAS IN FOUR PLACES. Loan contracts, signed loan documents, the fact find
// and payslips all did the same thing. So this is one function and they all
// call it.
//
// HOW A BIG ONE GETS THROUGH. The browser puts it straight into the
// reading-room bucket, which Vercel is not in the middle of, and posts the
// PATH instead of the file. The reader picks it up, reads it, and deletes it
// before it answers. See docs/the-reading-room.sql.
//
// THE FILE IS STILL NOT KEPT. Fabio, 17 Nov 2026: "we dont need to store the
// documents after reading but obviously we retain all data." It exists for the
// length of one read, which he approved on 22 Nov, and three separate things
// make sure of it - the finally in the reader, the sweep in the database, and
// lib/the-reading-room-is-emptied.test.ts.

// WHAT FITS DOWN THE ORDINARY ROAD.
//
// Vercel's limit is 4.5 MB of request body. Base64 is 4 bytes per 3, plus the
// JSON around it. 3 MB of PDF lands at about 4.1 MB posted, which leaves room
// and is a round number to say out loud.
export const STRAIGHT_THROUGH = 3 * 1024 * 1024

/** The size nobody should be asked to send at all. A pack this big is wrong. */
export const TOO_BIG_FULL_STOP = 80 * 1024 * 1024

export type Sent =
  | { body: { pdfBase64: string }; path: null }
  | { body: { readingRoomPath: string }; path: string }

const base64Of = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve((r.result as string).split(',')[1])
  r.onerror = () => reject(new Error('That file could not be opened.'))
  r.readAsDataURL(file)
})

/**
 * WHAT TO POST FOR THIS FILE.
 *
 * Small ones go as they always have, so nothing about the common case
 * changes. A big one is put in the reading room first and only its path is
 * posted.
 *
 * Throws with a sentence a person can act on. Never with a parser's complaint.
 */
export async function sendToBeRead(file: File): Promise<Sent> {
  if (file.size > TOO_BIG_FULL_STOP) {
    throw new Error(
      `${mb(file.size)} is too big to read. Send the splits as separate files.`)
  }

  if (file.size <= STRAIGHT_THROUGH) {
    return { body: { pdfBase64: await base64Of(file) }, path: null }
  }

  const supabase = createSupabaseBrowser()
  const { data: me } = await supabase.auth.getUser()
  const uid = String(me?.user?.id || '')
  if (!uid) throw new Error('You are signed out. Reload the page and try again.')

  // THE FOLDER IS THE CALLER'S OWN UID, and the database checks it - see the
  // insert policy in docs/the-reading-room.sql. The name is random so two
  // people dropping the same contract at the same moment cannot collide.
  const path = `${uid}/${crypto.randomUUID()}.pdf`
  const { error } = await supabase.storage.from('reading-room')
    .upload(path, file, { contentType: 'application/pdf', upsert: false })

  if (error) {
    throw new Error(
      `That file (${mb(file.size)}) could not be sent to be read - ${error.message}. `
      + 'Nothing has been recorded.')
  }
  return { body: { readingRoomPath: path }, path }
}

/** "7.2 MB". For saying a size out loud rather than in bytes. */
export function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * READING AN ANSWER BACK WITHOUT TRUSTING IT TO BE JSON.
 *
 * This is the other half of Belle's error. A route that fails BEFORE our code
 * runs - Vercel's own 413, a gateway timeout, a deploy mid-request - answers
 * in plain text or HTML, and res.json() turns that into "Unexpected token".
 *
 * So the body is read as text and parsed in a try. What comes back is either
 * the answer or a sentence about what actually happened.
 */
export async function readAnswer(res: Response): Promise<{ ok: true; out: any } | { ok: false; why: string }> {
  const text = await res.text()
  let out: any = null
  try { out = JSON.parse(text) } catch { /* not JSON, which is the point */ }

  if (out && typeof out === 'object') {
    return res.ok
      ? { ok: true, out }
      : { ok: false, why: String(out.error || 'That could not be read.') }
  }

  // NOT JSON. Say what the status actually means.
  if (res.status === 413) {
    return { ok: false, why: 'That file was too big to send. Nothing has been recorded.' }
  }
  if (res.status === 504 || res.status === 408) {
    return { ok: false, why: 'Reading that took too long and was cut off. Nothing has been recorded.' }
  }
  return {
    ok: false,
    why: `That could not be read - the server answered ${res.status}. Nothing has been recorded.`,
  }
}
