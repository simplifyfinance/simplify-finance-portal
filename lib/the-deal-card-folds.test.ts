// THREE TALL COLOURED SLABS, NOW THREE LINES.
//
// 17 Nov 2026. Fabio, on a deal: "see the blue lines again dont want to change
// the strucutre as it is working just finding the deal cards too busy also the
// purple section is there a way we can make it expandable so we only see when
// we want to?"
//
// And then, on a first attempt that took the colour off as well: "I think you
// went too far in terms of blending... I do like, for example, lending options
// and doing this. It's all blue and then sent to the client. I don't have an
// issue with that being green."
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const read = (f: string) => readFileSync(f, 'utf8')
// A CHECK THAT READS A COMMENT IS NOT A CHECK. Six guards in this repo have
// passed or failed on a sentence describing the code rather than on the code.
const code = (f: string) => read(f)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const FOLD = code('components/Fold.tsx')
const HAND = code('components/Handover.tsx')
const NEED = code('components/WhatWeStillNeed.tsx')
const SHARE = code('components/WhoSharesThisDeal.tsx')
const DEAL = code('app/(app)/deals/[id]/DealPageClient.tsx')

describe('a fold keeps the colour it had', () => {
  it('the blue one is still blue and the purple one is still purple', () => {
    expect(FOLD).toContain('bg-info-bg')
    expect(FOLD).toContain('bg-waiting-bg')
    expect(FOLD).toContain('border-l-info')
    expect(FOLD).toContain('border-l-waiting')
  })

  // THE THING HE ASKED FOR, IN ONE ASSERTION.
  it('and there is no grey, blended third option', () => {
    expect(FOLD, 'a fold that goes plain is the version he turned down')
      .not.toContain('bg-line-soft')
  })

  it('it says what is inside without being opened', () => {
    expect(FOLD).toContain('{title}')
    expect(FOLD).toContain('{line}')
    expect(FOLD).toContain('{count}')
  })

  // A line that opens on any click opens by accident all day.
  it('and it is opened by a press that says what it does', () => {
    expect(FOLD).toContain('{press}')
    expect(FOLD).toContain("press = 'Show'")
    expect(FOLD).toContain('Hide')
  })
})

describe('the handover note', () => {
  it('folds through the one rule, not a rule of its own', () => {
    expect(HAND).toContain('noteStartsOpen(r.created_at, i === 0)')
    expect(HAND).toContain('noteFoldLine(r)')
    expect(HAND).toContain('<FoldLine')
  })

  it('and whatever the broker presses beats the rule', () => {
    expect(HAND).toContain('pressed[r.id] ??')
  })

  it('the open note is the block that was always there', () => {
    expect(HAND).toContain('border-l-[3px] border-info bg-info-bg')
    expect(HAND).toContain('internal, the client never sees this')
  })
})

describe('the questions block', () => {
  it('folds, in purple, with the count and the age on the shut line', () => {
    expect(NEED).toContain('tone="waiting"')
    expect(NEED).toContain('questionsFoldLine(deal, open, closed)')
    expect(NEED).toContain('questionsCount(going, open)')
  })

  it('and it opens itself rather than trusting a broker to look', () => {
    expect(NEED).toContain('questionsStartOpen(deal, open, dropped, closed)')
    expect(NEED).toContain('pressed ??')
  })

  it('the open block still carries every word it carried before', () => {
    expect(NEED).toContain('Every one of these is here because the fact find has a gap')
    expect(NEED).toContain('untick anything you already know')
    expect(NEED).toContain('already answered')
  })

  // NOTHING IN THE PROCESS MOVED. Fabio: "dont want to change the strucutre as
  // it is working".
  it('and nothing about asking, ticking or answering changed', () => {
    for (const kept of ['askedLine(', 'closeByHandPatch(', 'reopenPatch(', 'newHandQuestion(']) {
      expect(NEED, `${kept} is part of the process, not the look`).toContain(kept)
    }
  })
})

describe('who shares the deal', () => {
  it('is one line on the deal card', () => {
    expect(DEAL).toContain('<SharedWithBox deal={dealData} quiet />')
  })

  // THE RED STATE IS THE WHOLE POINT OF THE BOX.
  it('and quiet is refused outright when nobody has answered', () => {
    expect(SHARE).toContain('if (quiet && !unanswered)')
    expect(SHARE).toContain('bg-chase-bg border-chase-edge text-chase')
  })

  it('compliance keeps the full box, because that is where it gets fixed', () => {
    expect(code('app/(app)/deals/[id]/ComplianceForm.tsx'))
      .toContain('<SharedWithBox deal={deal} />')
  })
})
