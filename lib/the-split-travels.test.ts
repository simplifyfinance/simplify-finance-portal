// THE SPLIT IS ANSWERED ONCE AND READ EVERYWHERE.
//
// 27 Oct 2026. Fabio: "broker can seelect in Fact Find Stage what commission
// split to select so it carries accross to handover notes". Catherine, the
// same morning: "there is nowhere in compliance that we can select commissions
// for that deal".
//
// Those two sentences could be read as "put a picker on compliance too". They
// must not be. One answer, given in one place, read by every screen that needs
// it - a second place to SET it is a second answer waiting to disagree with
// the first, and then nobody knows which one the referrer gets paid on.
//
// This file holds that shape in place.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { SETTINGS_PANES } from './settings-panes'

const FACT_FIND = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')
const COMPLIANCE = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')
const DEAL_PAGE = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
const PICKER = readFileSync('components/WhoSharesThisDeal.tsx', 'utf8')
const SETTINGS = readFileSync('app/(app)/settings/SettingsClient.tsx', 'utf8')
const LIST = readFileSync('components/CommissionSplits.tsx', 'utf8')
const HANDOVER = readFileSync('lib/handover-view.ts', 'utf8')
const HANDOVER_PDF = readFileSync('app/api/generate-compliance-pdf/route.tsx', 'utf8')
const NOTES = readFileSync('lib/broker-notes.ts', 'utf8')

const codeOnly = (src: string) =>
  src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('it is answered on the fact find and nowhere else', () => {
  it('the picker is on the fact find', () => {
    expect(FACT_FIND).toContain("import WhoSharesThisDeal from '@/components/WhoSharesThisDeal'")
    expect(FACT_FIND).toContain('<WhoSharesThisDeal deal={deal}')
  })

  it('compliance SHOWS it and cannot set it', () => {
    expect(COMPLIANCE).toContain('<SharedWithBox deal={deal} />')
    expect(codeOnly(COMPLIANCE), 'compliance has grown a picker of its own')
      .not.toContain('<WhoSharesThisDeal')
  })

  it('and so does the deal page, once somebody has answered', () => {
    expect(DEAL_PAGE).toContain('<SharedWithBox deal={dealData} />')
    expect(codeOnly(DEAL_PAGE)).not.toContain('<WhoSharesThisDeal')
  })

  it('only one component writes the answer', () => {
    for (const [name, src] of [['the fact find', FACT_FIND], ['compliance', COMPLIANCE],
                               ['the deal page', DEAL_PAGE], ['the settings list', LIST]] as const) {
      expect(codeOnly(src), `${name} writes commission_split_ columns directly`)
        .not.toContain('commission_split_id:')
    }
    expect(PICKER).toContain('chooseSplitPatch(split, byName)')
  })
})

describe('the list in Settings', () => {
  it('has its own entry in the menu, under its own name', () => {
    // 27 Oct 2026. It shipped inside the Commission library pane - the
    // OPPOSITE thing - and Fabio could not find it: "where in that phots shows
    // commission library???". A page reachable only by knowing which other
    // page it hides behind is a page nobody has.
    const splits = SETTINGS_PANES.find(p => p.key === 'splits')
    expect(splits, 'the splits list has lost its own menu entry again').toBeTruthy()
    expect(splits!.label).toBe('Commission splits')
    expect(SETTINGS).toContain("pane === 'splits'")
  })

  it('and is not drawn inside the library pane any more', () => {
    const block = SETTINGS.slice(SETTINGS.indexOf("pane === 'splits'"))
    expect(block.slice(0, 400)).toContain('<CommissionSplits />')
  })

  it('both headings still say which direction the money goes', () => {
    expect(SETTINGS).toContain('Commission splits &mdash; what we pay out')
    expect(SETTINGS).toContain('Commission library &mdash; what the banks pay us')
  })

  it('can switch an arrangement off AND remove one, which are different answers', () => {
    // 27 Oct 2026. This file used to refuse a delete outright, on the reasoning
    // that a deal which used an arrangement has to keep making sense. Fabio,
    // stuck with two test rows: "you never create deelte buttons see I cant
    // delete them."
    //
    // The reasoning was wrong. A deal keeps its OWN copy of the whole
    // arrangement - see chooseSplitPatch - so removing the row cannot change a
    // deal. The two tests below are what actually protects a deal, and they
    // were always the real rule.
    expect(LIST).toContain('Stop using it')
    expect(LIST).toContain('Remove')
    expect(LIST).toContain(".delete().eq('id', r.id).select('id')")
  })

  it('and removing one asks first', () => {
    expect(LIST).toContain('No deal that used it changes.')
    expect(LIST).toContain('Keep')
  })

  it('THE DEAL IS WHAT KEEPS THE ARRANGEMENT, NOT THE ROW', () => {
    // This is why a delete is safe, and it is the thing to protect.
    const lib = readFileSync('lib/who-shares-this-deal.ts', 'utf8')
    expect(lib).toContain('commission_split_lines: split.lines')
    expect(lib).toContain('commission_split_name: split.name')
    expect(PICKER).toContain('no longer in use')
  })

  it('and checks the row came back, because RLS refuses by saying nothing', () => {
    expect(LIST).toContain('if (error || !data?.length)')
    expect(PICKER).toContain('if (error || !data?.length)')
  })
})

// A SPLIT IS A LIST OF LINES, AND THE SCREEN HAS TO LET YOU ADD ONE.
//
// 27 Oct 2026. Fabio: "we need the ability of addint lines for upfront and
// trail so line one for exmaple 20% simplify line 80% broker 1 and abilty to
// add third line".
describe('adding a line', () => {
  it('there is a button for it', () => {
    expect(LIST).toContain('+ Add a line')
    expect(LIST).toContain('addLine(r.id)')
  })

  it('and a line can be taken off again', () => {
    // "please alwasy have ability to edit and delete and add" - Fabio, 27 Oct.
    expect(LIST).toContain('dropLine(r.id, i)')
  })

  it('but never the last one, because an empty table reads as a broken screen', () => {
    expect(LIST).toContain('list.length > 1 ? list.filter')
  })

  it('every line carries its OWN upfront and trail', () => {
    expect(LIST).toContain("editLine(r.id, i, { upfront: readPct(e.target.value) })")
    expect(LIST).toContain("editLine(r.id, i, { trail: readPct(e.target.value) })")
  })

  it('the lines are what gets saved', () => {
    expect(LIST).toContain('lines: r.lines.filter(')
  })

  it('and it says whether the column adds up, without refusing to save', () => {
    expect(LIST).toContain('totalsOf(r.lines)')
    expect(LIST).toContain('addsUpWarning(r.lines)')
    expect(codeOnly(LIST), 'the splits screen now blocks a save')
      .not.toContain('disabled={!totalsOf')
  })

  it('who gets a share is TYPED, with the names already in the portal offered', () => {
    // A referrer is whoever the broker says it is. A list you are stuck
    // inside is a box nobody can fill in.
    expect(LIST).toContain('list="sf-share-names"')
    expect(LIST).toContain('<datalist id="sf-share-names">')
    expect(LIST).toContain("from('directory_people')")
  })
})

// IT REACHES THE PEOPLE WHO TYPE IT INTO SALESTREKKER.
//
// 27 Oct 2026. The split was built onto the fact find, the deal page and
// compliance, and stopped there. Fabio: "did you remeebr to add those
// commisisons splits to the handover pdf and iopne to copy so my team can input
// in salestrekker??" No. This file is so that question never has to be asked
// twice.
describe('the handover carries it', () => {
  it('Open to copy has a commission split card', () => {
    expect(HANDOVER).toContain("key: 'split', title: 'Commission split'")
    expect(HANDOVER).toContain('splitOn(deal)')
  })

  it('and so does the handover PDF', () => {
    expect(HANDOVER_PDF).toContain('<Section title="Commission split"')
    expect(HANDOVER_PDF).toContain('splitOn(deal)')
  })

  it('both read the same place, so they cannot disagree about who is paid what', () => {
    for (const [name, src] of [['the screen', HANDOVER], ['the PDF', HANDOVER_PDF]] as const) {
      expect(src, `${name} works out the share itself`).toContain('shareWords(l)')
      expect(src).toContain("from '@/lib/who-shares-this-deal'".replace('@/lib', name === 'the screen' ? '.' : '@/lib'))
    }
  })

  it('it is key and value rows, not a paragraph', () => {
    // Each one goes into its own SalesTrekker field, and the screen copies a
    // value at a time. A paragraph on the clipboard pastes into none of them.
    const card = HANDOVER.slice(HANDOVER.indexOf("key: 'split', title: 'Commission split'"))
    expect(card.slice(0, 600)).not.toContain('copyable: true')
  })

  it('AND "NOBODY" IS PRINTED, NOT LEFT OUT', () => {
    // A deal nobody has answered and a deal somebody confirmed is all ours look
    // identical in a blank space, and the person doing the handover has to be
    // able to tell them apart.
    expect(HANDOVER).toContain("Nobody - this one is all ours")
    expect(HANDOVER_PDF).toContain('Nobody')
  })

  it('and it never reaches the notes that go to the LENDER', () => {
    // lib/broker-notes.ts is pasted into a bank's web form. What we pay a
    // referrer is our business and theirs, not the bank's.
    expect(NOTES, 'the commission split is in the lender submission notes')
      .not.toContain('splitOn')
    expect(NOTES).not.toContain('commission_split')
  })

  it('and the conflicts declaration is left exactly as it was', () => {
    // Fabio, 27 Oct 2026: "dont overcomlicate the conflicrs sentecen DOES NOT
    // GET TOUCHED".
    expect(NOTES).toContain('There are no known conflicts of interest as part of this transaction.')
  })
})

describe('an arrangement that is no longer offered', () => {
  it('still shows on a deal that used it', () => {
    // Otherwise the dropdown silently reads as something else, which is worse
    // than showing a name nobody can pick any more.
    expect(PICKER).toContain('no longer in use')
  })
})

describe('unanswered is a state, not a blank', () => {
  it('the fact find says so in red', () => {
    expect(PICKER).toContain('● Required')
    expect(PICKER).toContain('Compliance cannot say who shares this deal without it')
  })

  it('and compliance sends you to the one place it can be answered', () => {
    expect(PICKER).toContain('Answer it on the fact find, under Purpose and goals.')
  })

  it('but nothing is blocked', () => {
    // A locked screen gets worked around by lunchtime. Visible gets fixed.
    expect(codeOnly(PICKER)).not.toContain('disabled={!on}')
  })
})
