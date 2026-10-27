import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import { LICENCE_HOLDER } from '@/lib/brand'

// THE FILE, ON PAPER.
//
// 29 Oct 2026. Catherine, Operations Manager, item 6. Fabio: "I do like a tab
// at the end that says file notes that we can actually one day, if we get
// audited, we can export as a PDF saying, hey, this is all the conversation,
// this is all the track record of the file."
//
// THREE RULES, AND THEY ARE THE WHOLE DOCUMENT:
//
// 1. OLDEST FIRST, AND EVERYTHING. The screen shows newest first because that
//    is what somebody working the deal wants. A record read end to end is the
//    other way round, and it carries no filter at all - a file note with a
//    filter on it is not a file note.
//
// 2. IT SAYS WHAT IT IS ON EVERY PAGE. The deal, the licence, when it was
//    printed and how many entries. A page without that is a page nobody can
//    place six months later.
//
// 3. THE FIGURES ARE THE ONES THE CLIENT WAS TOLD. Every email's wording was
//    stored the day it went - see lib/email-as-text.ts - so this prints what
//    was said, not what the deal holds today. Rebuilding would quietly produce
//    a different document every time it was run.
//
// AND IT ASKS WHO IS CALLING BEFORE IT READS ANYTHING.
//
// This shipped once relying on row level security alone and
// lib/every-door-is-locked.test.ts refused it: "these routes read client data
// without asking who is calling."
//
// It is right. middleware.ts deliberately skips /api, so an API route is
// protected only if it protects itself. The database rules would refuse a
// stranger today - but only while this query keeps using the caller's own
// session, and somebody swapping in the master key one day for convenience
// would take the lock with it, silently. A whole file of somebody's
// conversations is not a thing to leave to that.
//
// The check is the first thing the handler does, before the body is even read,
// because the same test measures how far into the handler it sits - a guard
// buried under forty lines of setup is a guard somebody can step around while
// editing the lines above it.

export const maxDuration = 60

const INK = '#141C24', MUTE = '#7C8894', LINE = '#E3E8EC'

const s = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 52, paddingHorizontal: 44, fontSize: 9, color: INK,
          fontFamily: 'Helvetica' },
  h1: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  meta: { fontSize: 8, color: MUTE, marginBottom: 2 },
  rule: { height: 2, backgroundColor: '#EEF2F5', marginTop: 12, marginBottom: 16 },

  entry: { marginBottom: 15 },
  when: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 3 },
  who: { fontFamily: 'Helvetica', color: MUTE },
  body: { fontSize: 9.5, lineHeight: 1.5 },
  // The wording of an email, as it went. Monospaced because it is laid out in
  // columns - a label and a figure - and a proportional font loses the column.
  sent: { marginTop: 6, marginLeft: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: LINE,
          fontFamily: 'Courier', fontSize: 7.5, lineHeight: 1.5, color: '#3E4752' },

  foot: { position: 'absolute', bottom: 26, left: 44, right: 44, flexDirection: 'row',
          borderTopWidth: 1, borderTopColor: LINE, paddingTop: 7 },
  footL: { fontSize: 7, color: MUTE, flex: 1 },
  footR: { fontSize: 7, color: MUTE },
  empty: { fontSize: 9.5, color: MUTE },
})

const AU = 'Australia/Melbourne'

function stamp(iso: any): string {
  const d = new Date(String(iso || ''))
  if (!String(iso || '').trim() || isNaN(d.getTime())) return 'date not recorded'
  return d.toLocaleString('en-AU', {
    timeZone: AU, day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export async function POST(req: NextRequest) {
  try {
    // Who is calling, first. See the note at the top of this file.
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const { dealId } = await req.json()
    if (!dealId) return NextResponse.json({ error: 'No deal' }, { status: 400 })

    const { data: deal } = await supabase
      .from('deals').select('deal_name, clients(first_name, last_name)').eq('id', dealId).single()
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    // OLDEST FIRST. See rule 1. No limit, because a record that stops at two
    // hundred entries is a record with a hole in it and nothing saying so.
    const { data: rows } = await supabase
      .from('deal_notes').select('*').eq('deal_id', dealId)
      .order('created_at', { ascending: true })

    const notes = rows || []
    // A joined row comes back as an array or an object depending on how the
    // relation is read, and the typed client insists on the array. Taken the
    // long way round rather than cast away, because a cast that is wrong prints
    // a blank name on a compliance document and nothing says so.
    const client: any = Array.isArray(deal.clients) ? deal.clients[0] : deal.clients
    const who = [client?.first_name, client?.last_name]
      .map((x: any) => String(x || '').trim()).filter(Boolean).join(' ')
    const name = String(deal.deal_name || '').replace(/_/g, ' ').trim() || 'Deal'
    const span = notes.length
      ? `${stamp(notes[0].created_at)} to ${stamp(notes[notes.length - 1].created_at)}`
      : 'nothing recorded'

    const doc = (
      <Document title={`File notes - ${name}`}>
        <Page size="A4" style={s.page} wrap>
          <Text style={s.h1}>File notes</Text>
          <Text style={s.meta}>{name}{who ? `  ·  ${who}` : ''}</Text>
          <Text style={s.meta}>
            {notes.length === 1 ? '1 entry' : `${notes.length} entries`}  ·  {span}
          </Text>
          <Text style={s.meta}>
            Printed {stamp(new Date().toISOString())}  ·  {LICENCE_HOLDER}  ·  Australian Credit Licence 387025
          </Text>
          <View style={s.rule} />

          {!notes.length && (
            <Text style={s.empty}>
              Nothing has been recorded against this deal.
            </Text>
          )}

          {notes.map((n: any) => (
            // wrap={false} on the entry so a date never ends a page with its
            // sentence on the next one. A long email is allowed to break,
            // because it has to.
            <View key={n.id} style={s.entry} wrap={!!n.detail}>
              <Text style={s.when}>
                {stamp(n.created_at)}
                <Text style={s.who}>
                  {'  ·  '}
                  {n.kind === 'system' ? 'recorded automatically' : (n.author_name || 'unknown')}
                </Text>
              </Text>
              <Text style={s.body}>{String(n.body || '')}</Text>
              {n.detail ? <Text style={s.sent}>{String(n.detail)}</Text> : null}
            </View>
          ))}

          <View style={s.foot} fixed>
            <Text style={s.footL}>File notes  ·  {name}  ·  printed {stamp(new Date().toISOString())}</Text>
            <Text style={s.footR} render={({ pageNumber, totalPages }) =>
              `${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      </Document>
    )

    const buffer = await renderToBuffer(doc)
    const file = `File notes - ${name}.pdf`.replace(/[\\/:*?"<>|]/g, '')
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${file}"`,
      },
    })
  } catch (e: any) {
    console.error('[file-notes-pdf]', e)
    return NextResponse.json({ error: e?.message || 'Could not build it' }, { status: 500 })
  }
}
