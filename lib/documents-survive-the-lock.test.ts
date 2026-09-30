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

  // 30 Sep 2026: this used to read "never delete anything", which was true when
  // the component only generated PDFs. The deal's document list moved here that
  // afternoon and removing one came with it. The rule is not "never delete" - it
  // is that GENERATING never deletes, and that removing is a deliberate act
  // which obeys the lock.
  it('generating never deletes anything', () => {
    // Replacing a filed copy is an upsert. Building a document must never take
    // one off the deal as a side effect.
    const build = docs.slice(docs.indexOf('async function buildAndFile'), docs.indexOf('async function download('))
    const file = docs.slice(docs.indexOf('async function fileIt'), docs.indexOf('async function removeFiled'))
    for (const fn of [build, file]) {
      expect(fn).not.toMatch(/\.remove\(/)
      expect(fn).not.toMatch(/\.delete\(/)
    }
  })

  it('removing one asks first, and only when the deal is open to edits', () => {
    const fn = docs.slice(docs.indexOf('async function removeFiled'), docs.indexOf('async function openFiled'))
    expect(fn).toContain('confirm(')
    // Opening is reading and is always allowed. Removing is not.
    expect(docs).toContain('{!isLocked(deal) && (')
    expect(docs).toContain('onClick={() => removeFiled(')
  })

  it('opening one is never gated on the lock', () => {
    const at = docs.indexOf('onClick={() => openFiled(')
    const around = docs.slice(Math.max(0, at - 200), at)
    expect(around).not.toContain('isLocked')
  })

  it('hand you the document before trying to file it', () => {
    // A failed upload must not cost somebody the PDF they asked for, and a
    // silent one must not let them believe the stale copy was replaced.
    //
    // Scoped to download(). There is a second caller of fileIt now - the
    // rebuild-all path, which deliberately does NOT download - and searching the
    // whole file found that one first.
    const fn = docs.slice(docs.indexOf('async function download('))
    const clickAt = fn.indexOf('a.click()')
    const fileAt = fn.indexOf('await fileIt(')
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
    // "Nothing was downloaded" went on 30 Sep 2026. It was true of the build
    // and false of the situation - there was a perfectly good copy on file the
    // whole time, and that sentence is what sent somebody to unlock a lodged
    // deal. The reason still gets said; what is said about the outcome changed.
    expect(docs).toContain('could not be rebuilt')
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
// ONE LIST, NOT TWO.
//
// Fabio, 30 Sep 2026, asked whether he wanted the Fact Find list fixed or
// removed: "B" - removed. Two lists of the same documents can disagree, and the
// one on that tab was dead on every lodged deal anyway.
describe('the deal has one document list', () => {
  const factFind = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

  it('the Fact Find tab no longer lists or opens them', () => {
    expect(factFind).not.toContain('documents.map')
    expect(factFind).not.toContain('downloadDocument')
    expect(factFind).not.toContain('deleteDocument')
  })

  it('but still adds them, because adding is an edit and belongs inside the lock', () => {
    expect(factFind).toContain('uploadDocuments')
    expect(factFind).toContain('Drop documents here')
  })

  it('and tells the list above the tabs when it has', () => {
    // Otherwise somebody uploads a file and the only list on the page does not
    // show it until a reload.
    expect(factFind).toContain('onDocumentsChanged?.()')
    expect(readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8'))
      .toContain('setDocumentsVersion(v => v + 1)')
    expect(docs).toContain('[deal.id, version]')
  })

  it('and says where they went', () => {
    // The wording changed on 30 Sep 2026 - it used to be a near-white line
    // nobody could read. What this test is for, that the tab still points at
    // the one list, is unchanged.
    expect(factFind).toContain('see them at the top of the page')
  })
})

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

// KEEPING THE FILED DOCUMENTS UP WITH THE DEAL.
//
// Fabio, 30 Sep 2026: "I want to be automatic and save on documents tab".
describe('the documents say when they are behind the deal', () => {
  it('name what moved, rather than just saying out of date', () => {
    // "Out of date" makes somebody open all three to find out what changed.
    expect(docs).toContain('behindLine(deal)')
    expect(docs).toContain('{behind}')
  })

  it('offer one press for all three, not three presses', () => {
    expect(docs).toContain('Rebuild and file all three')
    expect(docs).toContain('async function rebuildAll')
  })

  it('stop at the first failure rather than stamping the deal as current', () => {
    // A half-rebuilt set stamped as current is worse than one that is plainly
    // behind, because nothing says so afterwards.
    const fn = docs.slice(docs.indexOf('async function rebuildAll'))
    expect(fn).toContain('if (!ok) { setBusy(\'\'); return }')
    expect(fn.indexOf('documents_built_from')).toBeGreaterThan(fn.indexOf('if (!ok)'))
  })

  it('record what they were built from, and who by', () => {
    for (const f of ['documents_built_from', 'documents_built_at', 'documents_built_by']) {
      expect(docs).toContain(f)
    }
    expect(docs).toContain('builtFrom(deal)')
  })

  it('take the stamp BEFORE rebuilding, not after', () => {
    // Otherwise a box edited while the three are being built would be counted
    // as already filed, and the deal would read as current while holding a PDF
    // that never saw the edit.
    const fn = docs.slice(docs.indexOf('async function rebuildAll'))
    expect(fn.indexOf('const stamp = builtFrom(deal)')).toBeLessThan(fn.indexOf('await buildAndFile'))
  })
})

// DOWNLOADING MUST NEVER DEPEND ON A BUILD SUCCEEDING.
//
// 30 Sep 2026, fourth go at this. The three buttons always REBUILT. So when the
// Fact Find build threw on a pasted character, Fabio got nothing - while a good
// copy sat on the line directly underneath, one click away. He unlocked a lodged
// deal chasing a problem that was never the lock.
//
// "I want the ability to doownload FF Handover and Broker notes after the fact
// PERIOD."
describe('the button hands you the copy on file', () => {
  const strip = readFileSync('components/DealDocuments.tsx', 'utf8')

  it('presses through to the filed copy, not to a build', () => {
    expect(strip).toContain('const copyOf =')
    expect(strip).toContain('if (already) { openFiled(already.file_path); return }')
  })

  it('only builds where there has never been a copy', () => {
    expect(strip).toContain('`Build ${KINDS[kind].label}`')
  })

  it('rebuilding is a press of its own, not something a download does', () => {
    expect(strip).toContain('Rebuild all three')
  })

  // THE MESSAGE IS WHAT SENT HIM TO THE LOCK. "Nothing was downloaded" reads as
  // "you have nothing"; the copy on file was fine the whole time.
  it('and a failed rebuild says the filed copy is untouched', () => {
    expect(strip).toContain('The copy on file is untouched')
    expect(strip).not.toContain('Nothing was downloaded')
  })
})

describe('the fact find tab points somewhere you can read', () => {
  const ff = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

  it('no longer whispers it in near-white', () => {
    const i = ff.indexOf('see them at the top of the page')
    expect(i, 'the pointer to the document list is gone').toBeGreaterThan(-1)
    expect(ff.slice(i - 400, i)).not.toContain('text-gray-300')
  })

  it('and says how many are up there', () => {
    expect(ff).toContain('docCount')
  })
})
