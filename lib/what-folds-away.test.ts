// A FOLD IS STILL A BOX. IT IS JUST A CLOSED ONE.
//
// 17 Nov 2026. Fabio: "just finding the deal cards too busy... is there a way
// we can make it expandable so we only see when we want to?" And, on the first
// attempt, which took the colour off as well: "I think you went too far in
// terms of blending."
import { questionsCount, describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  STILL_NEW, firstWords, noteFoldLine, noteStartsOpen,
  questionsFoldLine, questionsCount, questionsStartOpen,
} from './what-folds-away'

const DAY = 86400000
const NOW = new Date('2026-11-17T09:00:00+11:00')
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()

const q = (key: string, over: any = {}) => ({
  key, kind: 'gap' as any, who: '', ask: `Ask ${key}`, help: '', why: 'a gap',
  closesItself: true, ...over,
})
const deal = (marks: Record<string, any>) => ({ questions_state: marks })

describe('the first few words', () => {
  it('are cut on a word, never mid-word', () => {
    const out = firstWords('Re-checked servicing and apart from AMP only services with non bank lenders', 40)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(42)
    expect(out).not.toContain('serv…')
  })

  it('and a short note is not cut at all', () => {
    expect(firstWords('Bankwest it is.', 64)).toBe('Bankwest it is.')
    expect(firstWords('', 64)).toBe('')
    expect(firstWords(null, 64)).toBe('')
  })

  it('and it never leaves a dangling comma or dash', () => {
    expect(firstWords('one two three, four five', 14)).not.toContain(',…')
  })
})

describe('the handover note, shut', () => {
  it('says when it came and what it opens with', () => {
    const line = noteFoldLine({ created_at: ago(33), note: 'Re-checked servicing on AMP.' })
    expect(line).toContain('Oct')
    expect(line).toContain('Re-checked servicing')
  })

  it('and a note with nothing typed in it still carries its date', () => {
    expect(noteFoldLine({ created_at: ago(2), note: '' })).toContain('Nov')
  })
})

// A NOTE NOBODY HAS SEEN IS NEVER FOLDED.
describe('when a handover note opens by itself', () => {
  it('the newest one does, while it is new', () => {
    expect(noteStartsOpen(ago(0), true, NOW)).toBe(true)
    expect(noteStartsOpen(ago(1), true, NOW)).toBe(true)
  })

  it('and folds once it is a record rather than news', () => {
    expect(STILL_NEW).toBe(2)
    expect(noteStartsOpen(ago(3), true, NOW)).toBe(false)
    expect(noteStartsOpen(ago(40), true, NOW)).toBe(false)
  })

  it('an older note is folded even when it is brand new to the page', () => {
    expect(noteStartsOpen(ago(0), false, NOW)).toBe(false)
  })

  // A DATE NOBODY CAN READ IS NOT A REASON TO HIDE WHAT SOMEBODY WROTE.
  it('and a note with no date on it is shown, not swallowed', () => {
    expect(noteStartsOpen(null, true, NOW)).toBe(true)
    expect(noteStartsOpen('not a date', true, NOW)).toBe(true)
  })
})

describe('the questions, shut', () => {
  const open = [q('a'), q('b'), q('c')]

  it('say when they went and that nobody has answered', () => {
    const d = deal({ a: { askedAt: ago(17) }, b: { askedAt: ago(17) }, c: { askedAt: ago(17) } })
    const line = questionsFoldLine(d, open, [], NOW)
    expect(line).toContain('asked')
    expect(line).toContain('17 days')
    expect(line).toContain('nobody has answered')
  })

  it('and count the ones answered when there are some', () => {
    const d = deal({ a: { askedAt: ago(9) } })
    const closed = [{ key: 'z', ask: 'x', askedAt: ago(20), closedAt: ago(9), closedBy: 'Katie' }]
    expect(questionsFoldLine(d, open, closed as any, NOW)).toContain('1 answered')
  })

  it('and say plainly when nothing has gone out', () => {
    expect(questionsFoldLine(deal({}), open, [], NOW)).toBe('nothing has gone out yet')
  })

  it('one day is a day', () => {
    const d = deal({ a: { askedAt: ago(1) } })
    expect(questionsFoldLine(d, [q('a')], [], NOW)).toContain('1 day')
    expect(questionsFoldLine(d, [q('a')], [], NOW)).not.toContain('1 days')
  })

  it('the count is what is going out of what there is', () => {
    expect(questionsCount([q('a'), q('b')], open)).toBe('2 of 3')
    expect(questionsCount([], [])).toBe('0 of 0')
  })
})

// THE ONE WAY THIS COULD DO HARM, SO IT IS CHECKED HARDEST.
// THE QUESTIONS BLOCK IS ALWAYS SHUT WHEN THE PAGE DRAWS.
//
// Fabio, 16 Nov 2026: "questions going out with this email are always always
// hidden first, then we can expand if we want."
//
// It used to open itself on three conditions - a question that had never gone
// out, one somebody had just unticked, an answer less than two days old - and
// every one of them was a good argument for opening. The trouble is that on a
// BC being written all three are true at once, and the block is eight
// questions tall. It landed on top of the form on the screen where the work
// actually happens.
//
// NOTHING IS HIDDEN BY THIS, and that is what these tests now hold: the
// folded LINE still carries the count and still says in words what has gone
// out and whether anybody has answered. The three reasons live on in that
// line. They just no longer decide the height of the page.
describe('the questions block is always shut, and the line still says everything', () => {
  const open = [q('a'), q('b')]
  const allAsked = deal({ a: { askedAt: ago(17) }, b: { askedAt: ago(17) } })

  it('a question that has never gone out does NOT hold it open any more', () => {
    const d = deal({ a: { askedAt: ago(17) } })
    expect(questionsStartOpen(d, open, [], [], NOW)).toBe(false)
  })

  it('nor does one somebody has unticked', () => {
    expect(questionsStartOpen(allAsked, open, ['a'], [], NOW)).toBe(false)
  })

  it('nor does an answer that has just come in', () => {
    const fresh = [{ key: 'z', ask: 'x', askedAt: ago(20), closedAt: ago(1), closedBy: 'Katie' }]
    expect(questionsStartOpen(allAsked, open, [], fresh as any, NOW)).toBe(false)
  })

  it('all asked, all ticked, nothing new - shut, as it always was', () => {
    expect(questionsStartOpen(allAsked, open, [], [], NOW)).toBe(false)
  })

  it('and an empty deal does not crash it', () => {
    expect(questionsStartOpen(null, [], [], [], NOW)).toBe(false)
    expect(questionsFoldLine(null, [], [], NOW)).toBe('nothing has gone out yet')
  })

  // THE PART THAT MATTERS NOW. Shut is only acceptable because the one line
  // you can read without opening anything carries the facts.
  it('a question that has never gone out still says so on the folded line', () => {
    const d = deal({ a: { askedAt: ago(17) } })
    expect(questionsFoldLine(d, open, [], NOW)).toMatch(/not gone out|nothing has gone out/i)
  })

  it('and the count is on the fold, so eight is eight without opening it', () => {
    expect(questionsCount(open, open)).toBe('2 of 2')
  })
})

// IT READS THE MARKS THROUGH THE ONE DOOR. The marks live on
// deal.questions_state and this file guessed deal.question_marks on its first
// draft, which would have read as "nothing has gone out yet" on every deal in
// the business.
describe('nothing here guesses at a column name', () => {
  const SRC = readFileSync('lib/what-folds-away.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('it goes through markFor(), not into the row', () => {
    expect(SRC).toContain('markFor(')
    expect(SRC, 'reaching into the row is how this broke once already')
      .not.toContain('questions_state')
    expect(SRC).not.toContain('question_marks')
  })
})
