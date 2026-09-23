'use server'
import { revalidatePath } from 'next/cache'
import { markProceeded } from '@/lib/proceed-flow'

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
export type ProceedState = { ok: boolean; error?: string }

export async function confirmProceed(
  dealId: string, stage: 'BC' | 'LO', _prev: ProceedState, _form: FormData,
): Promise<ProceedState> {
  try {
    const result = await markProceeded(dealId, stage, { source: 'client' })
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
