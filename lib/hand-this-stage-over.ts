// "I'LL DO IT" OR "PUT IT IN THE CREDIT QUEUE", ON ANY STAGE.
//
// 23 Oct 2026. Both answers in one place, because the BC and the lending
// options have to behave identically and the only way to be sure of that is
// for them to run the same code.
//
// THE BROKER NEVER PICKS A PERSON. The queue works out who covers that broker,
// who is on leave, and who is carrying the least - see lib/allocate-officer.ts.
// This only says which stage is being handed over.
import { handOver, type Stage } from './who-did-this-stage'

export type HandResult = { ok: true; name?: string } | { ok: false; error: string }

export async function handStageOver(
  supabase: any, dealId: string, stage: Stage,
  choice: 'me' | 'queue', meName: string,
): Promise<HandResult> {
  if (choice === 'me') {
    // A blocked policy returns no rows and no error, so the row is the proof.
    const { data, error } = await supabase.from('deals')
      .update({ ...handOver(stage, { officerId: null, name: meName }) })
      .eq('id', dealId).select('id')
    if (error || !data?.length) {
      return { ok: false, error: error?.message || 'That was not saved - nothing reached the database.' }
    }
    return { ok: true, name: meName }
  }

  const res = await fetch('/api/allocate-credit-officer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealId, stage }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || out?.ok === false) {
    return { ok: false, error: out?.error || 'The credit queue could not take it.' }
  }
  return { ok: true, name: out?.officerName }
}
