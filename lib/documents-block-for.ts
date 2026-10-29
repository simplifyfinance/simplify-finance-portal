import { createSupabaseServer } from './supabase-server'
import { documentsBlock, documentItemsFor } from './documents-block'

// ONE JOB: FETCH THE DEAL.
//
// 29 Oct 2026. Everything that turns a deal into a list lives in
// lib/documents-block.ts, which imports nothing and can be tested without a
// database. This file exists only because something has to go and get the deal,
// and the moment it does it drags in next/headers. Keeping that in one small
// file is what lets the rest be tested at all - the same split as
// lib/next-steps-copy.ts.
//
// WHAT THIS CLIENT STILL OWES US, FETCHED AND TURNED INTO A BLOCK.
//
// 28 Oct 2026. One copy, because three emails want it: the lending options
// email, the email that goes out when a client agrees to proceed, and - in its
// own shape - the compliance push. lib/no-duplicate-logic.test.ts refuses a
// second copy, and rightly: a fix applied to one of three is not a fix.
//
// THE LIST IS WORKED OUT FRESH, never stored. Tick a document as arrived and it
// is gone from the next email, with nobody remembering to take it out. Exactly
// how lib/still-need-for-deal.ts handles the questions.
//
// IT NEVER STOPS AN EMAIL GOING OUT. If the deal cannot be read, or the columns
// are not there yet, the block is simply absent and the email is the email it
// was yesterday. A client waiting on their lending options must not be held up
// by a question about a rates notice.

export async function documentsStillOutFor(dealId: any, today = new Date()): Promise<string> {
  try {
    const id = String(dealId ?? '').trim()
    if (!id) return ''
    const supabase = await createSupabaseServer()
    const { data: deal } = await supabase.from('deals').select('*').eq('id', id).single()
    if (!deal) return ''
    return documentsBlock({ items: documentItemsFor(deal, today) })
  } catch {
    return ''
  }
}
