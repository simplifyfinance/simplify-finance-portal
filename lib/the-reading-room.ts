import { createSupabaseAdmin } from './supabase-admin'

// TAKING A DOCUMENT OUT OF THE READING ROOM, AND LEAVING IT EMPTY.
//
// 22 Nov 2026. The server half of lib/send-a-document-to-be-read.ts. A PDF too
// big for Vercel's 4.5 MB request body goes straight from the browser into the
// reading-room bucket; this picks it up, hands back the base64 the readers
// already speak, and deletes it.
//
// THE DELETE IS IN A FINALLY. That is the whole promise. Fabio, 17 Nov 2026:
// "we dont need to store the documents after reading but obviously we retain
// all data." A document that could not be read is deleted exactly like one
// that could - the only thing that must never happen is a file left behind
// because something threw.
//
// IT IS ALSO BELT AND BRACES. docs/the-reading-room.sql sweeps anything over
// an hour old, for the request that never reached this code at all.
//
// A PATH IS NOT TRUSTED. It arrives from a browser, and the service role
// client used here is not bound by row level security, so the shape is checked
// here instead: one uid folder, one file, nothing clever. Without this, a path
// of "../deal-documents/something" is somebody reading a client's filed
// documents through a contract reader.
const SAFE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i

export class ReadingRoomError extends Error {}

/**
 * THE DOCUMENT AT THIS PATH, AS BASE64, AND THEN IT IS GONE.
 *
 * Throws ReadingRoomError with a sentence a person can act on. The file is
 * deleted either way.
 */
export async function takeFromTheReadingRoom(path: string): Promise<string> {
  const clean = String(path || '').trim()
  if (!SAFE.test(clean)) {
    throw new ReadingRoomError('That document could not be found. Nothing has been recorded.')
  }

  const admin = createSupabaseAdmin()
  try {
    const { data, error } = await admin.storage.from('reading-room').download(clean)
    if (error || !data) {
      throw new ReadingRoomError(
        'That document could not be picked up to be read. Nothing has been recorded.')
    }
    const bytes = Buffer.from(await data.arrayBuffer())
    return bytes.toString('base64')
  } finally {
    // IT GOES, whether it was read or not. Nothing is awaited on the way out
    // that could throw past this.
    try { await admin.storage.from('reading-room').remove([clean]) } catch { /* swept later */ }
  }
}

/**
 * THE DOCUMENT A REQUEST IS ASKING ABOUT, from whichever way it came.
 *
 * Small files still arrive as base64 in the body, exactly as they always have,
 * so nothing about the common case changes. Big ones arrive as a path.
 */
export async function documentFrom(body: any): Promise<string> {
  const direct = String(body?.pdfBase64 || '')
  if (direct) return direct

  const path = String(body?.readingRoomPath || '')
  if (path) return takeFromTheReadingRoom(path)

  throw new ReadingRoomError('No document was received.')
}
