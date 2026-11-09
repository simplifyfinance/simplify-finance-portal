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

// THE BROKER IS TOLD WHEN COMPLIANCE PREP STARTS. 17 Aug 2026.
//
// Alan's November brief, item 4. Fired HERE rather than from the compliance
// screen, because both handovers come through this function - "I'll take it"
// and "put it in the queue" - and hooking one of the two would leave the other
// quietly telling nobody. Same reason the clipboard rule lives in one file.
//
// Never awaited and never allowed to fail the handover. A deal that could not
// be handed over because an email did not send is the tail wagging the dog.
// See lib/a-handover-tells-the-broker.ts for the wording.
function tellTheBroker(dealId: string, stage: Stage): void {
  if (String(stage) !== 'compliance') return
  try {
    void fetch('/api/notify-broker-stage-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, stage: 'COMPLIANCE' }),
    }).catch(() => {})
  } catch { /* the handover has already happened */ }
}

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
    // Told only once the handover is a fact. An email about a save that was
    // refused is worse than no email.
    tellTheBroker(dealId, stage)
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
  tellTheBroker(dealId, stage)
  return { ok: true, name: out?.officerName }
}
