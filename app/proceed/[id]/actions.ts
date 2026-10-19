'use server'
import { revalidatePath } from 'next/cache'
import { markProceeded, markWantsCall } from '@/lib/proceed-flow'
import type { LenderOnOffer } from '@/lib/client-lender-choice'

// The write, and the only way to reach it.
//
// A server action is a POST, so a scanner or a preview crawler following the
// link cannot trigger it — only a person pressing the button on the page can.
// This page is the client's own, so anything that reaches here is the client.
//
// IT HANDS BACK WHAT HAPPENED. 24 Sep 2026: this used to throw the answer away.
// When the write failed - which it did for every client, for a month, because
// the deal was read as a visitor who was not signed in - the page simply
// re-rendered looking exactly the same. To the client the button did nothing,
// and nothing anywhere said otherwise.
export type ProceedState = { ok: boolean; error?: string; offer?: LenderOnOffer | null }

export async function confirmProceed(
  dealId: string, stage: 'BC' | 'LO', option: 1 | 2 | null, _prev: ProceedState, _form: FormData,
): Promise<ProceedState> {
  try {
    // The option is bound on the server when the page is built, from a value
    // already checked into 1, 2 or nothing. Nothing the browser posts decides
    // it - a form field would be one more thing a person could edit.
    const result = await markProceeded(dealId, stage, { source: 'client' }, option)
    if (!result.ok) {
      console.error('[proceed] the client pressed it and it did not save:', result.error)
      return { ok: false, error: 'That did not save. Please give us a call and we will sort it out.' }
    }
    revalidatePath(`/proceed/${dealId}`)
    return { ok: true }
  } catch (e: any) {
    console.error('[proceed] the client pressed it and it threw', e)
    return { ok: false, error: 'Something went wrong at our end. Please give us a call and we will sort it out.' }
  }
}

// THE WRITE THE PAGE MAKES FOR ITSELF. 19 Oct 2026.
//
// Fabio: "if I already pressed the button saying proceed with St George, why
// does the second page ask confirm St George? I don't understand the point of
// the second page. It should just be a landing page." Fair - the client has
// already answered, and asking twice reads like the first press did not work.
//
// SO WHY IS THERE STILL A POST HERE AT ALL.
//
// Because of what happened on 31 Aug 2026, when opening this page WAS the
// write. Mail security scanners follow every link in an email before it reaches
// the inbox, so deals moved a stage, allocated a credit officer and emailed two
// people for clients who had not read the message. The fix was the button, and
// the button is what Fabio has now asked to remove.
//
// This is not that. The write does not hang off the LINK - it hangs off the
// rendered page, called from the browser once the page is actually on screen
// (see RecordOnLoad.tsx). A scanner fetches the HTML and stops; it does not run
// the page and it does not POST. The August bug cannot come back through this
// door.
//
// It is still weaker than a person pressing a button, and the thing it records
// is a client agreeing to a lender. Fabio was shown that and chose this, 19 Oct
// 2026. The honest mitigation is on the page itself: the client is told which
// bank they have just agreed to, and given a line that flags it to the broker
// if they did not mean to.
export async function confirmOnArrival(
  dealId: string, stage: 'BC' | 'LO',
): Promise<ProceedState> {
  try {
    // The lender is worked out on the server from the deal's own recommendation
    // - see markProceeded. Nothing the browser sends decides which bank was
    // agreed to, for the same reason the BC's option is bound server-side.
    const result = await markProceeded(dealId, stage, { source: 'client' }, null)
    if (!result.ok) {
      console.error('[proceed] the page loaded and it did not save:', result.error)
      return { ok: false, error: 'That did not save. Please give us a call and we will sort it out.' }
    }
    revalidatePath(`/proceed/${dealId}`)
    // The bank, product and loan amount go back with the answer rather than
    // the page reading the lending options record for itself - see loadProceed.
    return { ok: true, offer: result.offer ?? null }
  } catch (e: any) {
    console.error('[proceed] the page loaded and it threw', e)
    return { ok: false, error: 'Something went wrong at our end. Please give us a call and we will sort it out.' }
  }
}

// "I'd rather talk it through first", and "I pressed that by mistake".
//
// Records the request, moves nothing, and emails the broker - see markWantsCall
// in lib/proceed-flow.ts for why moving nothing is the point rather than a
// shortcut.
export async function requestCall(dealId: string): Promise<ProceedState> {
  try {
    const result = await markWantsCall(dealId, { source: 'client' })
    if (!result.ok) {
      console.error('[proceed] the client asked for a call and it did not save:', result.error)
      return { ok: false, error: 'That did not save. Please give us a call and we will sort it out.' }
    }
    revalidatePath(`/proceed/${dealId}`)
    return { ok: true }
  } catch (e: any) {
    console.error('[proceed] the client asked for a call and it threw', e)
    return { ok: false, error: 'Something went wrong at our end. Please give us a call and we will sort it out.' }
  }
}
