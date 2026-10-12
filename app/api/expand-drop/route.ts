import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'
import {
  kindOf, canBeRead, planZip, sheetToMarkdown, emailParts, emailStamp, safeMemberName,
  type DropKind,
} from '@/lib/dropped-files'

export const maxDuration = 300

// OPENING WHAT SOMEBODY DROPPED, WITHOUT BELIEVING ANY OF IT.
//
// 13 Oct 2026. One box on the lender's page takes four shapes. This turns any
// of them into a flat list of PARTS, each of which is either text we can read
// or a PDF we can hand to the reader.
//
// Nothing here decides anything. It does not save, it does not extract rules,
// and it does not judge what it finds - the page files each part as its own
// document and the person still ticks every rule. All this does is open things.
type Part = { name: string; kind: DropKind; text?: string; base64?: string; insideAnEmail?: boolean }

async function sheetParts(buf: ArrayBuffer, name: string): Promise<Part[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as any)
  const out: string[] = []
  wb.eachSheet(ws => {
    const rows: any[][] = []
    ws.eachRow(r => {
      const vals = Array.isArray(r.values) ? r.values.slice(1) : []
      rows.push(vals.map((v: any) => (v && typeof v === 'object' && 'text' in v ? v.text : v)))
    })
    const md = sheetToMarkdown(String(ws.name || 'Sheet'), rows)
    if (md) out.push(md)
  })
  return out.length ? [{ name, kind: 'text', text: out.join('\n\n') }] : []
}

function emailPartsToParts(raw: string, name: string): Part[] {
  const e = emailParts(raw)
  const parts: Part[] = []
  // The message itself, with its stamp at the top so whatever is read out of it
  // carries who sent it and when.
  const head = [emailStamp(e, ''), e.subject ? `Subject: ${e.subject}` : ''].filter(Boolean).join('\n')
  if (e.body) parts.push({ name, kind: 'text', text: `${head}\n\n${e.body}`.trim() })
  for (const a of e.attachments) {
    const k = kindOf(a.name)
    if (!canBeRead(k)) continue
    if (a.encoding === 'base64') {
      if (k === 'pdf') parts.push({ name: a.name, kind: 'pdf', base64: a.data.replace(/\s+/g, ''), insideAnEmail: true })
      else parts.push({ name: a.name, kind: 'text', insideAnEmail: true,
                        text: Buffer.from(a.data.replace(/\s+/g, ''), 'base64').toString('utf8') })
    } else {
      parts.push({ name: a.name, kind: 'text', text: a.data, insideAnEmail: true })
    }
  }
  return parts
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file was sent.' }, { status: 400 })

    const name = safeMemberName(file.name)
    const kind = kindOf(name)
    const buf = await file.arrayBuffer()

    if (kind === 'pdf') {
      return NextResponse.json({ kind, parts: [
        { name, kind: 'pdf', base64: Buffer.from(buf).toString('base64') },
      ], skipped: [] })
    }

    if (kind === 'text') {
      return NextResponse.json({ kind, parts: [{ name, kind: 'text', text: Buffer.from(buf).toString('utf8') }], skipped: [] })
    }

    if (kind === 'sheet') {
      return NextResponse.json({ kind, parts: await sheetParts(buf, name), skipped: [] })
    }

    if (kind === 'email') {
      return NextResponse.json({ kind, parts: emailPartsToParts(Buffer.from(buf).toString('utf8'), name), skipped: [] })
    }

    if (kind === 'zip') {
      const zip = await JSZip.loadAsync(buf)
      // EVERY LIMIT IS APPLIED TO WHAT THE ZIP CLAIMS, BEFORE ANYTHING IS READ.
      // planZip decides from the directory alone; nothing is decompressed until
      // it has said yes. See lib/dropped-files.ts.
      const members = Object.values(zip.files).map((f: any) => ({
        path: f.name,
        bytes: Number(f?._data?.uncompressedSize) || 0,
      }))
      const plan = planZip(members)
      const parts: Part[] = []
      for (const t of plan.take) {
        const f = zip.file(t.from)
        if (!f) continue
        const k = kindOf(t.name)
        if (k === 'pdf') parts.push({ name: t.name, kind: 'pdf', base64: await f.async('base64') })
        else if (k === 'sheet') parts.push(...await sheetParts(await f.async('arraybuffer'), t.name))
        else if (k === 'email') parts.push(...emailPartsToParts(await f.async('string'), t.name))
        else parts.push({ name: t.name, kind: 'text', text: await f.async('string') })
      }
      return NextResponse.json({ kind, parts, skipped: plan.skipped })
    }

    return NextResponse.json({ error: 'We do not open that kind of file.' }, { status: 415 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'That file could not be opened.' }, { status: 500 })
  }
}
