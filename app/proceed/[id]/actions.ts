'use server'
import { revalidatePath } from 'next/cache'
import { markProceeded } from '@/lib/proceed-flow'

// The write, and the only way to reach it.
//
// A server action is a POST, so a scanner or a preview crawler following the
// link cannot trigger it — only a person pressing the button on the page can.
// This page is the client's own, so anything that reaches here is the client.
export async function confirmProceed(dealId: string, stage: 'BC' | 'LO') {
  await markProceeded(dealId, stage, { source: 'client' })
  revalidatePath(`/proceed/${dealId}`)
}
