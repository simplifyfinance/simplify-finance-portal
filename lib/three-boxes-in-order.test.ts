import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE THREE NOTE BOXES, NAMED AND IN ORDER.
//
// 22 Oct 2026. An audit of every note box on a deal found thirty of them and
// three reasons the team could not tell them apart:
//
//   1. The box everyone writes in was the one that leaves the building. It
//      goes to SalesTrekker, the Fact Find PDF and the assessment, and it was
//      called "Internal notes".
//   2. The two boxes built to be seen were both empty. "Important notes" is a
//      thing somebody has to DO - it has an owner, a due date and a tick, and
//      it shows on the pipeline without the deal being opened. "File notes" is
//      the only box on the deal where yesterday survives. Neither name said so.
//   3. "Important notes" collided with "Important things to note" on the BC and
//      the LO - and both of those go to the CLIENT.
//
// So: Needs action, Sales notes, File update, in that order, each with a line
// under the heading saying who reads it, and each one draggable.
//
// Fabio picked the order and two of the names; "Needs action" was my suggestion
// and he took it. This test is here so none of it drifts back.

const PAGE = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
const FILE = readFileSync('components/DealFile.tsx', 'utf8')
const RAIL = readFileSync('components/DealRail.tsx', 'utf8')
const GROW = readFileSync('components/useGrow.ts', 'utf8')

describe('the three are named for what they are', () => {
  it('Needs action, not Important notes', () => {
    expect(FILE).toContain('⚠ Needs action')
    expect(FILE, 'the old name collides with the client emails').not.toContain('⚠ Important notes')
  })

  it('Sales notes, not Internal notes', () => {
    expect(RAIL).toContain('title="Sales notes"')
    expect(RAIL).not.toContain('title="Internal notes"')
    // And the strip above the tabs carries the same data, so the same name.
    expect(readFileSync('components/InternalNotesStrip.tsx', 'utf8')).toContain('>Sales notes<')
  })

  it('File update, not File notes', () => {
    expect(FILE).toContain('🕐 File update')
    expect(FILE).not.toContain('🕐 File notes')
  })
})

describe('they come first, in Fabio’s order', () => {
  it('needs action, then sales notes, then file update', () => {
    const at = (s: string) => PAGE.indexOf(s)
    const needs = at('<DealAlerts')
    const sales = at('<RailNotes')
    // THE BOX, NOT THE TAB. 29 Oct 2026.
    //
    // This read `<FileNotes` and passed for a week. Then the File notes TAB was
    // added - <FileNotesTab> - which is drawn further up the page, matched this
    // first, and the three boxes appeared to be in the wrong order.
    //
    // Nothing had moved. The test was matching a prefix, which is the same
    // fault as a name that is a prefix of another name, and the fix is to say
    // which one: the box takes dealId as its first prop, the tab takes notes.
    const update = at('<FileNotes dealId=')
    const docs = at('<DocumentsBox')
    const pdfs = at('<DealDocuments')
    const links = at('<DealLinks')
    for (const [n, i] of Object.entries({ needs, sales, update, docs, pdfs, links })) {
      expect(i, `${n} is not on the deal page`).toBeGreaterThan(-1)
    }
    expect(needs).toBeLessThan(sales)
    expect(sales).toBeLessThan(update)
    // AND EVERYTHING ELSE BELOW THEM. File update used to sit under the
    // documents and the links, which is why it was empty on every deal -
    // nobody scrolled that far to write a line.
    expect(update).toBeLessThan(docs)
    expect(update).toBeLessThan(pdfs)
    expect(update).toBeLessThan(links)
  })

  it('and the tab is a different thing from the box', () => {
    // Two windows onto the same rows - see lib/the-file-reads-as-one.test.ts.
    // Named apart here so the prefix above can never quietly match again.
    expect(PAGE).toContain('<FileNotesTab notes={notes}')
    expect(PAGE).toContain('<FileNotes dealId=')
    expect(PAGE.indexOf('<FileNotesTab'), 'the tab is drawn inside the rail')
      .toBeLessThan(PAGE.indexOf('<DealAlerts'))
  })
})

describe('each one says who reads it', () => {
  it('and the words are not vague', () => {
    expect(RAIL, 'sales notes does not say where it goes')
      .toContain('Goes to SalesTrekker, the Fact Find PDF and the assessment')
    expect(FILE, 'needs action does not say it reaches the pipeline')
      .toContain('Shows as a red chip on the pipeline')
    expect(FILE, 'file update does not say it cannot be typed over')
      .toContain('Nothing here can be typed over')
  })
})

describe('all three can be made taller, and remember it', () => {
  it('each one uses the one rule rather than its own copy', () => {
    // A second copy of the drag is how the heights would drift apart.
    expect(GROW).toContain('export function useGrow')
    expect(RAIL).toContain('useGrow(`one.notes.h.')
    expect(FILE).toContain('useGrow(`one.needs.h.')
    expect(FILE).toContain('useGrow(`one.fileupdate.h.')
  })

  it('each one has a bar to drag', () => {
    expect((FILE.match(/cursor-ns-resize/g) || []).length,
      'needs action and file update should both have a handle').toBe(2)
    expect(RAIL).toContain('cursor-ns-resize')
  })

  it('and they open tall enough to be worth opening', () => {
    // 92 was four visible lines on a box people write paragraphs in.
    const shut = Number(/const SHUT = (\d+)/.exec(RAIL)?.[1] || 0)
    expect(shut).toBeGreaterThanOrEqual(240)
    for (const m of FILE.matchAll(/useGrow\(`[^`]+`, (\d+), (\d+)\)/g)) {
      expect(Number(m[1]), 'a box opens too short').toBeGreaterThanOrEqual(220)
      expect(Number(m[2]), 'taller is not much taller').toBeGreaterThan(Number(m[1]) * 1.5)
    }
  })
})
