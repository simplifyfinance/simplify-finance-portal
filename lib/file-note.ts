import { createSupabaseAdmin } from './supabase-admin'

// A LINE IN THE FILE, WRITTEN BY THE PORTAL, FROM THE SERVER.
//
// 29 Oct 2026. components/DealFile.tsx already has addSystemNote for the
// browser. This is the same row written from a route or a server action, where
// the person doing it may have no session at all - a client pressing Proceed,
// a client answering the questions on their own page.
//
// SAME TABLE, SAME SHAPE, NO SECOND LOG. public.deal_notes is the log and
// always was. If these two ever disagree about what an entry looks like, that
// is the bug.
//
// AND IT NEVER THROWS. A file note that can fail a client's button press is a
// worse problem than a missing line, so everything here is swallowed and
// reported to the console. The caller is never asked to handle it.
export async function fileNote(
  dealId: string, body: string, who?: string, detail?: string,
): Promise<void> {
  try {
    const id = String(dealId || '').trim()
    const words = String(body || '').trim()
    if (!id || !words) return
    const supabase = createSupabaseAdmin()
    const { error } = await supabase.from('deal_notes').insert({
      deal_id: id, body: words, kind: 'system',
      author_name: String(who || '').trim() || null,
      ...(String(detail || '').trim() ? { detail } : {}),
    })
    if (error) console.error('[fileNote] not written', error)
  } catch (e) {
    console.error('[fileNote] not written', e)
  }
}
