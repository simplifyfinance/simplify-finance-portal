// ASKING THE CLIENT FOR THE OUTSTANDING DOCUMENTS. ONE PLACE.
//
// 6 Oct 2026, when the prompt band at the top of the deal grew a Request them
// button of its own. Two buttons are fine; two ways of sending are not.
//
// WHAT IS SENT IS A REQUEST, NOT AN INSTRUCTION. The server loads the deal
// again and rebuilds the list before anything goes out, so a browser that has
// been open since this morning cannot ask a client for a liability that was
// deleted at lunchtime. See app/api/request-documents/route.ts.

// A FAILURE STILL CARRIES THE BODY. The server can record the request and
// then fail to send it, and the screen has to show those documents as asked
// for anyway - or the next press asks the client for the lot a second time.
export type RequestResult =
  | { ok: true; data: any }
  | { ok: false; error: string; status?: number; data?: any }

export async function requestDocuments(dealId: string, keys: string[]): Promise<RequestResult> {
  if (keys.length === 0) return { ok: false, error: 'Nothing to request.' }
  try {
    const res = await fetch('/api/request-documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, keys }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || `That did not send (${res.status}). Nothing was asked for.`,
               status: res.status, data }
    }
    return { ok: true, data }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'That did not send. Nothing was asked for.' }
  }
}
