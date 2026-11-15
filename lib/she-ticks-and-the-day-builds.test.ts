// SHE TICKS, AND THE DAY BUILDS BESIDE HER.
//
// 16 Nov 2026. The day was one list with a line through it - above the line
// today, below it the queue, dragged across. Fabio, watching it as a credit
// assessor would: "it's going to confuse my staff... as the credit assessor is
// selecting the ones that they're doing today, that generates the actual box
// that becomes, this is my day."
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { LINE, moveInOrder, splitAtLine } from './the-days-plan'

const PICK = readFileSync('components/PickTheDay.tsx', 'utf8')

// A CHECK THAT READS A COMMENT IS NOT A CHECK. Six separate guards in this
// repo have passed or failed on a sentence describing the code rather than on
// the code, so anything asserting something is ABSENT reads this instead.
const CODE = PICK
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
const TODAY = readFileSync('components/TodayPlan.tsx', 'utf8')
const MYDAY = readFileSync('components/MyDay.tsx', 'utf8')

describe('two boxes for credit, one list for everybody else', () => {
  it('credit gets the new one, every other view keeps the old', () => {
    expect(TODAY).toContain("const DayComponent = view === 'credit' ? PickTheDay : MyDay")
    expect(MYDAY, 'the old day list is still there for brokers').toContain('export default function MyDay')
  })

  it('and the list is headed by what it holds, not by a day', () => {
    expect(TODAY).toContain("'Everything with you'")
  })
})

// NOTHING NEW IS STORED. Ticked means "above the line", in the order the old
// screen already used - so a day saved yesterday reads the same today, and the
// run-through, the morning three and the email all carry on unchanged.
describe('ticking is the move the old screen already made', () => {
  it('ticking drops it at the bottom of the day', () => {
    expect(PICK).toContain("moveInOrder(items, id, ticked(id) ? null : LINE)")
    const order = ['a', LINE, 'b']
    expect(splitAtLine(moveInOrder(order, 'b', LINE)))
      .toEqual({ today: ['a', 'b'], queue: [] })
  })

  it('and unticking puts it back on the list, never deletes it', () => {
    const order = ['a', 'b', LINE, 'c']
    const after = moveInOrder(order, 'a', null)
    expect(splitAtLine(after)).toEqual({ today: ['b'], queue: ['c', 'a'] })
    expect(after, 'a deal must never leave the screen').toContain('a')
  })

  it('the component writes nothing of its own', () => {
    for (const never of ['supabase', 'checkedWrite', '.update(', '.insert(']) {
      expect(PICK, `${never} has no place in a presentation component`).not.toContain(never)
    }
  })
})

describe('the right box is the day she will work in', () => {
  it('numbered, draggable, and each row can be dropped', () => {
    expect(PICK).toContain('dropOn(')
    expect(PICK).toContain('draggable={canEdit}')
    expect(PICK).toContain("title=\"Not today\"")
  })

  it('and it keeps the note and the on-it-now that the old screen had', () => {
    expect(PICK).toContain('setOnItNow(')
    expect(PICK).toContain('On it now')
    expect(PICK).toContain('setNote(id,')
    expect(PICK).toContain('+ note')
  })

  // 15 Nov 2026: "if it's blank, it's blank, but the boxes are there. The
  // screen is never blank."
  it('the box is there even with nothing ticked, and says so', () => {
    expect(PICK).toContain('Nothing ticked yet.')
    expect(PICK, 'an empty day must not hide the box').not.toContain('if (today.length === 0) return null')
  })

  it('and the button will not send an empty day', () => {
    expect(PICK).toContain('disabled={busy || !canEdit || today.length === 0}')
  })
})

describe('the list never reorders itself under her', () => {
  it('it is grouped into bands and the groups follow the draft', () => {
    expect(PICK).toContain('function bandOf(')
    expect(PICK).toContain("if (d.rework) return 'Sent back'")
    expect(PICK).toContain("if (d.priority) return 'A broker asked'")
  })

  // The list stops growing rather than being cut short.
  it('and it scrolls instead of running down the page', () => {
    expect(CODE).toContain('overflow-y-auto')
  })

  it('nothing sitting with her is still a sentence, not an empty box', () => {
    expect(PICK).toContain('Nothing is sitting with you. Enjoy it.')
  })
})

// 17 Nov 2026. THREE THINGS FABIO FOUND ON THE SHIPPED SCREEN.
//
//   "I can only see 5 and I can't roll it. So you missed that when you did
//    the coding."
//   "we would need tick 10 things remeber max things you cna do a day 4-5"
//   "all boxes next to it a unticked so when we tick starts arranging in
//    order THEN we confirm this is my day"
describe('the day is above the list, and it never traps her', () => {
  it('this is my day comes first on the screen', () => {
    const day = PICK.indexOf('2 &mdash; This is my day')
    const list = PICK.indexOf('{heading}')
    expect(day, 'the day box must be in the file').toBeGreaterThan(-1)
    expect(list, 'the list header must be in the file').toBeGreaterThan(-1)
    expect(day, 'the day she is building sits above the list').toBeLessThan(list)
  })

  // THE WHOLE FAULT, IN ONE LINE. The day was in a 400px column with a
  // 360px scroller inside it, so the sixth thing she ticked was unreachable.
  it('and nothing above the list is a scroller', () => {
    const above = CODE.split('{heading}')[0]
    expect(above, 'the day must never be put in a scrolling box').not.toContain('overflow-y-auto')
    expect(above, 'and it must never be capped in height').not.toMatch(/max-h-\[/)
  })

  it('exactly one thing on this screen scrolls, and it is the list', () => {
    expect((CODE.match(/overflow-y-auto/g) || []).length).toBe(1)
  })
})

describe('nothing is ticked for her, and she can find a file that is not hers', () => {
  it('the screen says so rather than leaving her to notice', () => {
    expect(PICK).toContain('Nothing is ticked for you')
  })

  it('there is a search, and it reaches past her own list', () => {
    expect(PICK).toContain('Find a deal')
    expect(PICK).toContain('Found &mdash; not on your list')
    expect(PICK).toContain('others')
  })

  it('and a deal she picks up off somebody else still draws its name', () => {
    expect(CODE, 'both lists answer "what is this deal called"')
      .toContain('new Map([...deals, ...others]')
  })

  // SEARCHING IS NOT SUGGESTING. Nothing from the rest of the book is shown
  // until she types, and nothing from it is ever ticked for her.
  it('and the rest of the book is never shown unasked', () => {
    expect(CODE).toContain('const found = looking')
  })
})
