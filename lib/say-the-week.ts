// ONE WRITE FOR "WHEN IS THIS LODGING".
//
// 12 Nov 2026. The Monday meeting screen needed the same three buttons the Due
// to lodge panel already had, and I copied the function across. The duplicate
// guard caught it inside a minute - see lib/no-duplicate-logic.test.ts - which
// is the whole reason that guard exists.
//
// It matters here more than most. The answer this writes is what the meeting
// runs on, what the deal card shows, and what the week's target counts. Two
// copies of it is two places to forget lodgement_week_at, and a deal that
// silently stops appearing on anybody's list.

import { patchForAnswer, type AnswerKey } from './lodging-when'
import { checkedWrite } from './checked-write'

export type SaidIt = { ok: true; patch: Record<string, any> } | { ok: false; error: string }

/**
 * SAY WHEN A DEAL IS LODGING, and hand back what changed.
 *
 * The caller keeps the patch so the row on screen moves straight away rather
 * than waiting for a reload - both screens did that already, and both did it
 * from their own copy of this.
 */
export async function sayTheWeek(
  supabase: any, dealId: any, key: AnswerKey, when: Date = new Date(),
): Promise<SaidIt> {
  const patch = patchForAnswer(key, when)
  const error = await checkedWrite(
    supabase.from('deals').update({
      ...patch,
      // WHEN SOMEBODY ANSWERED, which is not the week they answered about. It
      // is how "nobody has said anything in 22 days" is true rather than a
      // guess from the deal's own age.
      lodgement_week_at: new Date().toISOString(),
    }).eq('id', dealId),
    'The lodgement week')
  return error ? { ok: false, error } : { ok: true, patch }
}
