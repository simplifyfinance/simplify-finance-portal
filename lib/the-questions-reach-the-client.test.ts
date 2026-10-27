// THE QUESTIONS GET TO THE CLIENT, AND THE DATE GETS RECORDED.
//
// 27 Oct 2026. Fabio: "I want that added to the BC email and then to the LO
// email for the ones that are still unanswered after BC email".
//
// lib/what-we-still-need.test.ts proves the LIST is right. This file proves it
// actually reaches both emails, that both tabs show the broker what is going
// out, and that the one date that cannot be worked out again is written at the
// moment it becomes true and not before.
//
// It reads source rather than running the screens, for the same reason
// lib/the-split-travels.test.ts does: the fault being guarded against is a
// shape - one of the two emails quietly losing the block, or the date being
// written when nothing was sent - and a shape is held in place by naming it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const BC_ROUTE = readFileSync('app/api/generate-email/route.ts', 'utf8')
const LO_ROUTE = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')
const BC_FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const LO_FORM = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const PANEL = readFileSync('components/WhatWeStillNeed.tsx', 'utf8')
const BLOCK = readFileSync('lib/still-need-block.ts', 'utf8')
const BUILDER = readFileSync('lib/still-need-for-deal.ts', 'utf8')

const codeOnly = (src: string) =>
  src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('both emails carry it', () => {
  for (const [name, src] of [['the BC', BC_ROUTE], ['the lending options', LO_ROUTE]] as const) {
    it(`${name} email builds the block`, () => {
      expect(src).toContain("from '@/lib/still-need-for-deal'")
      expect(src).toContain('stillNeedFor(')
    })

    it(`${name} email does NOT keep its own copy of how to build it`, () => {
      // This was written out in both routes first and
      // lib/no-duplicate-logic.test.ts refused the ship with the right words.
      // A fix applied to one copy is not a fix.
      expect(codeOnly(src), `${name} builds the block itself`)
        .not.toContain('async function stillNeedFor')
      expect(codeOnly(src), `${name} writes its own question wording`)
        .not.toContain('months of the')
    })
  }

  it('the BC prints it on EVERY template, not just the one somebody tested', () => {
    // Twenty-two scenarios end the same way. A block added to one of them is a
    // block twenty-one clients never see.
    const withBlock = (BC_ROUTE.match(/stillNeed \+ notesBox\(notes\) \+ sig\(b\)/g) || []).length
    const withoutBlock = (BC_ROUTE.match(/[^+] notesBox\(notes\) \+ sig\(b\)/g) || []).length
    expect(withBlock).toBeGreaterThan(19)
    expect(withoutBlock, 'a template still ends without the questions block').toBe(0)
  })

  it('and it is built once, above the templates, not per template', () => {
    expect(BC_ROUTE).toContain('const stillNeed = await stillNeedFor(dealId, d.questionsDropped)')
  })

  it('the lending options email puts it under the options and above the caveats', () => {
    const block = LO_ROUTE.indexOf('await stillNeedFor(')
    expect(block).toBeGreaterThan(-1)
    const notes = LO_ROUTE.indexOf('body += notesBox([...rbaLines')
    const table = LO_ROUTE.indexOf('body += buildLenderTable(')
    expect(block).toBeGreaterThan(table)
    expect(block).toBeLessThan(notes)
  })

  it('AND A QUESTION NEVER STOPS AN EMAIL GOING OUT', () => {
    // A client waiting on their numbers must not be held up by a question
    // about a car. If the deal cannot be read the block is simply not there,
    // and the email is the email it was yesterday.
    expect(BUILDER).toContain('} catch {')
    expect(BUILDER).toContain("return ''")
  })

  it('and a link that cannot be signed is no link, not no block', () => {
    // The questions are still worth asking by reply.
    expect(BUILDER).toContain("try { url = answersUrl(signAnswers(String(deal.id), today)) } catch { url = '' }")
  })
})

describe('the broker sees what is going out', () => {
  for (const [name, src] of [['the BC tab', BC_FORM], ['the lending options tab', LO_FORM]] as const) {
    it(`${name} draws the panel`, () => {
      expect(src).toContain('<WhatWeStillNeed deal={deal}')
    })

    it(`${name} sends the unticked ones with the email it generates`, () => {
      // Otherwise the panel and the preview underneath disagree, which is
      // worse than having no panel.
      expect(src).toContain('questionsDropped')
    })
  }

  it('unticking is held on the page and NEVER saved', () => {
    // It says "not in this email", not "the answer is known". If it were known
    // it would be on the fact find and the question would have gone on its own.
    for (const src of [BC_FORM, LO_FORM]) {
      expect(src).toContain('const [questionsDropped, setQuestionsDropped] = useState<string[]>([])')
      expect(codeOnly(src), 'the unticked list is being written to the deal')
        .not.toContain('questions_dropped')
    }
  })
})

describe('the date is written when the email GOES, not when it is generated', () => {
  // A preview nobody sent has asked nobody anything. A client chased for a
  // question they never received is worse than one asked twice.
  for (const [name, src, sentColumn] of [
    ['the BC', BC_FORM, 'bc_sent_at'],
    ['the lending options', LO_FORM, 'lo_sent_at'],
  ] as const) {
    it(`${name} records it beside ${sentColumn}`, () => {
      expect(src).toContain('askedPatch(deal, goingOut(deal, questionsDropped).map(q => q.key)')
      const updates = src.slice(src.indexOf(`${sentColumn}: nowIso`))
      expect(updates.slice(0, 400)).toContain('askedPatch(')
    })

    it(`${name} does NOT record it when it only builds a preview`, () => {
      const gen = src.slice(src.indexOf('async function generateEmail'))
      expect(gen.slice(0, gen.indexOf('\n  }\n')), 'generating an email marks it as asked')
        .not.toContain('askedPatch(')
    })
  }
})

describe('the panel', () => {
  it('checks the row came back, because RLS refuses by saying nothing', () => {
    expect(PANEL).toContain('if (error || !data?.length)')
  })

  it('can add a question, take one off, and tick one off', () => {
    // "please alwasy have ability to edit and delete and add" - Fabio.
    expect(PANEL).toContain('newHandQuestion(')
    expect(PANEL).toContain('closeByHandPatch(')
    expect(PANEL).toContain('reopenPatch(')
    expect(PANEL).toContain('questions_added: askedByHandRaw(deal).filter(')
  })

  it('only offers to tick off the ones a person typed', () => {
    // A gap the portal found closes itself. Offering a tick would be a second
    // answer waiting to disagree with the fact find.
    expect(PANEL).toContain('onTickOff={q.closesItself ? undefined :')
    expect(PANEL).toContain('onRemove={q.closesItself ? undefined :')
  })

  it('shows a closed question rather than hiding it', () => {
    // The only way anybody will trust the list is seeing that the last email
    // did its job.
    expect(PANEL).toContain('closedQuestions(deal)')
    expect(PANEL).toContain('closedLine(c)')
  })

  it('and says nothing loudly when there is nothing to ask', () => {
    expect(PANEL).toContain('Nothing outstanding')
  })
})

describe('the block itself', () => {
  it('lives in one file, so a fix to it is a fix for both emails', () => {
    expect(BLOCK).toContain('export function stillNeedBlock')
    expect(BUILDER).toContain("from './still-need-block'")
    for (const src of [BC_ROUTE, LO_ROUTE]) {
      expect(codeOnly(src), 'an email route is building the block by hand')
        .not.toContain('bgcolor="#F3EFFB"')
    }
  })

  it('and the fact find on screen wins over the saved one where it was sent', () => {
    // The lending options route already reads the securities live rather than
    // printing a copy that was right last week. A question about an address
    // somebody typed two minutes ago should not be asked.
    expect(BUILDER).toContain('factFind ? { ...deal, fact_find_data: factFind } : deal')
    expect(LO_ROUTE).toContain('stillNeedFor(dealId, d?.questionsDropped, ffData)')
  })
})
