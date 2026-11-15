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
const TODAY = readFileSync('components/TodayPlan.tsx', 'utf8')
const MYDAY = readFileSync('components/MyDay.tsx', 'utf8')

describe('two boxes for credit, one list for everybody else', () => {
  it('credit gets the new one, every other view keeps the old', () => {
    expect(TODAY).toContain("const DayComponent = view === 'credit' ? PickTheDay : MyDay")
    expect(MYDAY, 'the old day list is still there for brokers').toContain('export default function MyDay')
  })

  it('and the left box is headed by what it holds, not by a day', () => {
    expect(TODAY).toContain("'2 — Everything with you'")
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

describe('the left box never reorders itself under her', () => {
  it('it is grouped into bands and the groups follow the draft', () => {
    expect(PICK).toContain('function bandOf(')
    expect(PICK).toContain("if (d.rework) return 'Sent back'")
    expect(PICK).toContain("if (d.priority) return 'A broker asked'")
  })

  // The box stops growing rather than the list being cut short.
  it('and it scrolls instead of running down the page', () => {
    expect((PICK.match(/overflow-y-auto/g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('nothing sitting with her is still a sentence, not an empty box', () => {
    expect(PICK).toContain('Nothing is sitting with you. Enjoy it.')
  })
})
