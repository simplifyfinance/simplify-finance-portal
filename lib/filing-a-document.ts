// ONE ROW PER DOCUMENT, AND THE NAME FOLLOWS THE DOCUMENT.
//
// This was written inside components/DealDocuments.tsx and is lifted out
// unchanged in behaviour, because a second screen now files a PDF and a second
// copy of this is how the pile came back the first time. See
// lib/one-copy-per-deal.test.ts.
//
// THE RULE, in the words it was already written in: the PATH decides which
// document this is, not the name. Upload upserts to that path, so pressing
// build twice replaces rather than adds.
//
// AND THE NAME IS REWRITTEN EVERY TIME. 21 Oct 2026. The row was only ever
// inserted - never updated - so the name recorded on the first build stayed
// forever while the file behind it changed. With two handovers on a deal, one
// pre-approval and one actual purchase, a list that says the wrong one is worse
// than no list: somebody opens "Handover" expecting the pre-approval figures
// and gets the contract.

export type FilingProblem = string

/**
 * Upload the PDF and make the deal's document list agree with it.
 *
 * Returns an empty string when it worked, or a sentence saying what did not -
 * worded for a person, because every caller puts it straight on the screen.
 *
 * The caller hands the PDF to the browser FIRST. Filing is never allowed to
 * cost somebody the download; the reverse - a silent upload failure after a
 * clean download - is how somebody believes a stale copy has been replaced.
 */
export async function fileDocument(supabase: any, opts: {
  dealId: string
  filePath: string
  blob: Blob
  name: string
}): Promise<FilingProblem> {
  const { dealId, filePath, blob, name } = opts

  const { error: upErr } = await supabase.storage.from('deal-documents')
    .upload(filePath, blob, { contentType: 'application/pdf', upsert: true })
  if (upErr) return `Downloaded, but the filed copy was NOT replaced — ${upErr.message}`

  const { data: already, error: readErr } = await supabase.from('deal_documents')
    .select('id, file_name').eq('deal_id', dealId).eq('file_path', filePath).limit(1)
  if (readErr) return `Filed, but the list could not be read — ${readErr.message}`

  if (!already?.length) {
    const { data: wrote, error: recErr } = await supabase.from('deal_documents')
      .insert({ deal_id: dealId, file_name: name, file_path: filePath, file_type: 'application/pdf' })
      .select('id')
    // Uploaded but not listed is a file nobody can find. Said out loud.
    if (recErr || !wrote?.length) {
      return `Filed, but it was not added to the list${recErr ? ` — ${recErr.message}` : '.'}`
    }
    return ''
  }

  // THE ROW IS THERE AND THE FILE BEHIND IT HAS JUST CHANGED. Only the name can
  // be stale, so only the name is written - and only when it has actually moved,
  // so an ordinary rebuild does not touch the record at all.
  if (String(already[0]?.file_name || '') === name) return ''
  const { data: renamed, error: nameErr } = await supabase.from('deal_documents')
    .update({ file_name: name }).eq('id', already[0].id).select('id')
  if (nameErr || !renamed?.length) {
    return `Filed, but the list still shows the old name${nameErr ? ` — ${nameErr.message}` : '.'}`
  }
  return ''
}

/**
 * BUILD A PDF, HAND IT TO THE BROWSER, THEN FILE IT.
 *
 * The order is the rule, not an implementation detail: the document reaches the
 * person first, so a filing failure costs them a message rather than the file
 * they asked for. The reverse - a silent upload failure after a clean download
 * - is how somebody believes a stale copy has been replaced.
 *
 * Returns an empty string when it all worked, or a sentence for the screen.
 */
export async function buildDownloadAndFile(supabase: any, opts: {
  route: string
  dealId: string
  filePath: string
  fallbackName: string
  /** What to call it in an error message - "The purchase handover". */
  called: string
}): Promise<FilingProblem> {
  const { route, dealId, filePath, fallbackName, called } = opts
  let blob: Blob
  let name = fallbackName
  try {
    const res = await fetch(route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId }),
    })
    if (!res.ok) {
      const why = await res.text().catch(() => '')
      return `${called} could not be built${why ? ` — ${why.slice(0, 160)}` : ''}. Nothing on file was changed.`
    }
    blob = await res.blob()
    // The route names the file after the clients, so its name wins over ours.
    name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName
  } catch (e: any) {
    return `${called} could not be built — ${e?.message || 'network error'}. Nothing on file was changed.`
  }

  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.URL.revokeObjectURL(url)

  return fileDocument(supabase, { dealId, filePath, blob, name })
}
