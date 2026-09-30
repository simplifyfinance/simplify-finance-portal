import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { isLocked } from './deal-lock'

// READING A LODGED DEAL CHANGES NOTHING.
//
// 29 Sep 2026, Fabio: "its msrled as lodged but i cant open pdf".
//
// He could not. The three download buttons lived inside the Compliance tab, and
// TabLock wraps a locked tab in `<fieldset disabled>` - which disables every
// button underneath it, those included. A disabled fieldset cannot be escaped
// by nesting: there is no way to re-enable a control inside one.
//
// So a lodged deal had no reachable PDFs, and lodgement is exactly when they
// get filed. The only way through was to unlock the tab, which writes a note on
// the file saying somebody unlocked it - a record of an edit that never
// happened.
//
// lib/deal-lock.ts has always said what the lock is for: "Reading them changes
// nothing and always did... The risk was never navigation, it was that they
// stayed LIVE FORMS." The documents were caught in the net by accident.

const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
const docs = readFileSync('components/DealDocuments.tsx', 'utf8')
const lock = readFileSync('components/TabLock.tsx', 'utf8')

describe('the documents are outside the lock', () => {
  it('the lock really does disable everything under it', () => {
    // If this stops being true the rest of this file is arguing with nothing.
    expect(lock).toContain('<fieldset disabled')
  })

  it('a lodged deal is locked', () => {
    expect(isLocked({ lodged_at: '2026-09-24T00:00:00Z' })).toBe(true)
    expect(isLocked({})).toBe(false)
  })

  it('the documents are rendered before the tabs, not inside them', () => {
    const at = page.indexOf('<DealDocuments')
    const tabs = page.indexOf('{tabs.map(')
    const tabLock = page.indexOf('<TabLock')
    expect(at, 'DealDocuments is not on the deal page').toBeGreaterThan(-1)
    expect(at).toBeLessThan(tabs)
    expect(at).toBeLessThan(tabLock)
  })

  it('they do not depend on the stage, the lock or the unlock', () => {
    // The window looks BEHIND the tag as well as ahead of it. The first version
    // of this test only looked ahead, so wrapping the whole thing in
    // `{stage === 'Compliance' && ...}` - the exact bug being fixed - slid
    // straight past it. A guard that cannot catch the thing it was written for
    // is worse than none, because it reads as cover.
    const at = page.indexOf('<DealDocuments')
    const around = page.slice(Math.max(0, at - 160), at + 220)
    expect(around).not.toContain('stage ===')
    expect(around).not.toContain('unlockedTab')
    expect(around).not.toContain('isLocked')
  })
})

// THE SECOND DOOR, FOUND THE SAME AFTERNOON.
//
// Fabio, once the PDFs were out: "but why when I unlock that tab I cant get in
// the notes".
//
// The write-up collapses after compliance is sent, and "Show the write-up" is a
// button inside the same disabled fieldset. `past` - the thing that collapses
// it - and locked are the SAME condition, so on every lodged deal the write-up
// was collapsed with no way to open it.
describe('the write-up can be read on a lodged deal', () => {
  const form = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')

  it('is shown when the tab is locked, not hidden behind a dead button', () => {
    expect(form).toContain('showWriteUp || locked')
  })

  it('does not draw a toggle that cannot be pressed', () => {
    expect(form).toContain('{!locked && (')
  })

  it('locks on the same condition the deal page does', () => {
    // If these two ever drift, the write-up hides itself again on a deal whose
    // tab is still live - or draws a dead button on one that is not.
    expect(form).toContain('const locked = isLocked(deal)')
    expect(readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8'))
      .toContain('isLocked(dealData)')
  })
})

// NO TWO CLICKABLE THINGS ON THE DEAL PAGE SHARE A NAME.
//
// 29 Sep 2026. The documents shipped labelled "Fact Find", "Handover" and
// "Broker Notes", directly above a tab row whose first tab is "Fact Find". Six
// browser specs failed with "resolved to 2 elements" - the robot could no
// longer tell which one to click, and neither could a person.
describe('the documents do not collide with the tabs', () => {
  const tabLabels = [...page.matchAll(/label: '([^']+)' \}/g)].map(m => m[1])

  it('found the tab labels, so the test below is testing something', () => {
    expect(tabLabels).toContain('Fact Find')
    expect(tabLabels.length).toBeGreaterThanOrEqual(5)
  })

  it('no document button is named the same as a tab', () => {
    const docLabels = [...docs.matchAll(/label: '([^']+)'/g)].map(m => m[1])
    expect(docLabels.length).toBe(3)
    const clash = docLabels.filter(l => tabLabels.includes(l))
    expect(clash, 'a button and a tab with the same name is a trap for anybody clicking').toEqual([])
  })

  it('and each one says what it hands you', () => {
    for (const m of docs.matchAll(/label: '([^']+)'/g)) expect(m[1]).toMatch(/PDF$/)
  })
})

describe('what the buttons do, and what they leave alone', () => {
  it('build all three straight from the deal', () => {
    for (const route of ['/api/generate-summary-pdf', '/api/generate-compliance-pdf',
                         '/api/generate-broker-notes-pdf']) {
      expect(docs).toContain(route)
    }
    expect(docs).toContain('dealId: deal.id')
  })

  // THIS RULE CHANGED THE SAME DAY, AND ON PURPOSE.
  //
  // It used to say a download must never touch storage, because a push to
  // SalesTrekker was the only thing that rewrote the filed copies. Then Fabio:
  // "because the push to salestrekker is not working cna you ensure that when
  // we geenrate ff handover and broker notes they overwritte the ones in fact
  // fin" - and, looking at three months-old copies on the deal, "dont want old
  // ones in there".
  //
  // With the push broken, a deal could show a correct PDF and hold a stale one,
  // and the stale one is what anybody else opens. So generating now files it
  // too. What must NOT change is that it replaces rather than piles up.
  it('replace the filed copy in place, one per kind, never a new one per press', () => {
    // The path is what makes it a replacement. Natasha Chapman had the same
    // handover filed nine times when the path carried a timestamp.
    expect(docs).toContain('`${deal.id}/${kind}.pdf`')
    expect(docs).toContain('upsert: true')
    expect(docs).not.toContain('Date.now()')
  })

  it('only add a row when there is not one already', () => {
    // A second row pointing at the same file is a list nobody trusts.
    expect(docs).toContain("eq('file_path', filePath)")
    expect(docs).toContain('if (!already?.length)')
  })

  it('never delete anything', () => {
    // Replacing is not removing. Nothing here may take a document off a deal.
    expect(docs).not.toMatch(/\.remove\(/)
    expect(docs).not.toMatch(/\.delete\(/)
  })

  it('hand you the document before trying to file it', () => {
    // A failed upload must not cost somebody the PDF they asked for, and a
    // silent one must not let them believe the stale copy was replaced.
    const clickAt = docs.indexOf('a.click()')
    const fileAt = docs.indexOf('await fileIt(')
    expect(clickAt).toBeGreaterThan(-1)
    expect(fileAt).toBeGreaterThan(clickAt)
    expect(docs).toContain('the filed copy was NOT replaced')
  })

  it('let you open what is on file without unlocking anything', () => {
    // The deal's own document list lives on the Fact Find tab, which a lodged
    // deal disables - so on a locked deal those links are dead. These are not.
    expect(docs).toContain('createSignedUrl')
    expect(docs).toContain('On file')
  })

  it('say why when one fails, rather than just that it did', () => {
    expect(docs).toContain('Nothing was downloaded.')
    expect(docs).toContain('res.text()')
  })
})

// ONE UNLOCK FOR THE DEAL, NOT ONE PER TAB.
//
// Fabio, 30 Sep 2026: "you are lovking individual tabs if i need to reqword a
// deal card I want one button unlock and it allows me to evrythign on all tabs".
//
// Reworking a card is never one tab's worth of work: a lender change touches the
// lending options and the compliance write-up, a corrected income touches the
// fact find and the borrowing capacity. Worse, changing tab CLEARED the unlock -
// so unlocking compliance, going to lending options and coming back left it
// locked again.
describe('unlocking a deal unlocks all of it', () => {
  const dealPage = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')

  it('is one flag for the deal, not one tab remembered', () => {
    expect(dealPage).toContain('dealUnlocked')
    expect(dealPage).not.toContain('unlockedTab')
  })

  it('the lock asks only whether the deal is unlocked', () => {
    expect(dealPage).toContain('locked={isLocked(dealData) && !dealUnlocked}')
  })

  it('changing tab does not re-lock it', () => {
    // The exact behaviour Fabio ran into.
    const fn = dealPage.slice(dealPage.indexOf('function changeStage'),
                              dealPage.indexOf('function changeStage') + 700)
    expect(fn).not.toContain('setDealUnlocked')
  })

  it('and the file note stops naming a tab', () => {
    expect(readFileSync('lib/deal-lock.ts', 'utf8')).toContain('Deal unlocked and edited.')
    expect(readFileSync('components/TabLock.tsx', 'utf8')).toContain('unlockNote(reason)')
  })
})
