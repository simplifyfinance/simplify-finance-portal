// THE DEAL THAT SLIPPED THROUGH.
//
// Ellie, 26 Sep 2026, naming two deals where no document request ever arrived:
// Kathleen Stone and Sharon Zhou, both moved Lending options to Compliance.
//
// The automatic request fires at exactly one moment - BC to Lending options,
// in lib/proceed-flow.ts. A lead that came in and went straight to Lending
// options never passes through it, so a full list of documents sat ticked on
// the deal and nobody was ever asked for any of them. Silently.
//
// Fabio, 27 Sep 2026: "maybe easier if we have a button that we manual fire
// these docs as now I am depednign on humans loading docs into the portal".
//
// The button was always there. What was missing is the deal saying it needs
// pressing. This is that line.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { rowsFor, toRequest, progressOf, requestRounds } from './document-progress'

// Every file a person could put a second sender in.
function allSourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(e.name) && !e.name.includes('.test.')) out.push(full)
    }
  }
  for (const root of ['app', 'components', 'lib']) walk(root)
  return out.sort()
}

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const box = read('../components/DocumentsBox.tsx')
const code = box.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

// Just the line itself, not the whole file - the helpers at the bottom of the
// box are only ever drawn after somebody has opened it.
const stripOnly = (() => {
  const from = code.indexOf('{nudge && (')
  return from < 0 ? '' : code.slice(from, code.indexOf('</>', from))
})()

describe('what counts as never asked for', () => {
  const items = [
    { key: 'id', label: 'ID', group: 'applicant', groupKey: 'a', groupLabel: 'A', forWhat: 'lodge', round: 'proceed', auto: true },
    { key: 'payslips', label: 'Payslips', group: 'applicant', groupKey: 'a', groupLabel: 'A', forWhat: 'lodge', round: 'proceed', auto: true },
    { key: 'super', label: 'Super statement', group: 'applicant', groupKey: 'a', groupLabel: 'A', forWhat: 'compliance', round: 'proceed', auto: true },
  ] as any[]

  it('a deal nobody ever asked on has everything outstanding', () => {
    const rows = rowsFor(items, progressOf({}), {})
    expect(toRequest(rows)).toHaveLength(3)
  })

  it('and one that has been asked has nothing outstanding', () => {
    const progress = progressOf({ document_progress: {
      requests: [{ at: '2026-09-24T01:00:00Z', by: 'The portal', keys: ['id', 'payslips', 'super'] }],
    }})
    expect(toRequest(rowsFor(items, progress, {}))).toHaveLength(0)
  })

  // THE SECOND ROUND. Two added after the first went out reads as two, not as
  // eleven - and the nine already sent are left alone.
  it('a document added after the first round is the only one outstanding', () => {
    const progress = progressOf({ document_progress: {
      requests: [{ at: '2026-09-24T01:00:00Z', by: 'The portal', keys: ['id', 'payslips'] }],
    }})
    const rows = rowsFor(items, progress, {})
    expect(toRequest(rows).map(r => r.key)).toEqual(['super'])
    expect(rows.filter(r => r.requestedAt)).toHaveLength(2)
    expect(requestRounds(progress)).toHaveLength(1)
  })

  it('an unticked document is not chased', () => {
    const progress = progressOf({ document_progress: {
      decisions: { super: { ticked: false, at: '2026-09-24T01:00:00Z', by: 'Ellie' } },
    }})
    expect(toRequest(rowsFor(items, progress, {})).map(r => r.key)).toEqual(['id', 'payslips'])
  })
})

describe('the line on the deal', () => {
  it('appears only when something has never been asked for', () => {
    expect(code).toContain('const nudge = !dealFinished && pending.length > 0')
    expect(code).toContain('{nudge && (')
  })

  it('and never on a finished deal', () => {
    expect(code).toContain("deal?.status === 'completed'")
    expect(code).toContain('settled_at')
  })

  it('says it plainly when nobody has ever asked', () => {
    expect(code).toContain('Nobody has asked the client for')
  })

  it('and counts only what is outstanding once a round has gone', () => {
    expect(code).toContain('never been asked for')
    expect(code).toContain('The client is not asked twice')
  })

  it('presses the same button the list already had', () => {
    // ONE SENDER, so the line and the list can never do different things.
    //
    // 6 Oct 2026: the sender moved out to lib/request-documents.ts, because the
    // prompt band at the top of the deal grew a Request them button too. The
    // rule did not change - there is still exactly one place that sends - so
    // this now counts the sends across the whole portal rather than in one file.
    const senders = allSourceFiles()
      .filter(f => /fetch\(\s*['"`]\/api\/request-documents/.test(readFileSync(f, 'utf8')))
    expect(senders, `more than one place sends the document request: ${senders.join(', ')}`)
      .toEqual(['lib/request-documents.ts'])
    expect(code).toContain('requestDocuments(')
    expect(code).toContain('onClick={requestThem}')
  })

  // A REAL FAILURE HAS TO BE VISIBLE FROM HERE. The list's own messages are
  // inside the part that only draws when the box is open, and this line is
  // pressed with the box shut.
  it('shows what happened without opening the box', () => {
    expect(stripOnly).toContain('{err &&')
    expect(stripOnly).toContain('{sentMsg &&')
  })
})

// 24 Sep 2026 cost a day: Node says "Sept" for September and Chrome says "Sep",
// so a date drawn on both sides tears the page up and every prompt on it dies.
// This line draws on first paint, which is exactly where that bites.
describe('the date on it cannot tear the page', () => {
  it('is spelled by us, not by the operating system', () => {
    expect(stripOnly).toContain('dayMonth(')
    expect(stripOnly, 'asking the OS for a month name on a line that draws on first paint')
      .not.toContain('toLocaleDateString')
  })

  it('and the helper is imported', () => {
    expect(box).toContain("from '@/lib/same-date-everywhere'")
  })
})
