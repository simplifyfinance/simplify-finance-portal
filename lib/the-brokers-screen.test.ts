// THE BROKER'S TODAY, AS IT WAS MOCKED AND APPROVED.
//
// 12 Nov 2026. Keanen and Justin had no screen of their own. Fabio approved
// the mock the same day, with three things named explicitly:
//
//   "New deal card must work, clickable client names, and That is my week
//    raises a red mark for admin."
//
// And the reason the page exists at all:
//
//   "The Monday ask is the whole point. His four answers are exactly what
//    fills your Simplify Finance Brokers section on the admin page - same
//    three buttons, same three answers, written to the same place."
//
// These tests hold the wiring. The rules themselves are in
// lib/the-brokers-monday.test.ts.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const TODAY = readFileSync('components/TodayPlan.tsx', 'utf8')
const WEEK = readFileSync('components/BrokerWeek.tsx', 'utf8')
const WHERE = readFileSync('components/WhereMyDealsAre.tsx', 'utf8')
const DEALS = readFileSync('app/(app)/deals/page.tsx', 'utf8')

describe('the Monday ask', () => {
  it('is on the broker\'s page', () => {
    expect(TODAY).toContain('<BrokerWeek deals={askThisWeek} />')
  })

  // THE WHOLE POINT. A second copy of the write is how a broker's answer stops
  // reaching the meeting - the duplicate guard caught exactly that on 12 Nov.
  it('and writes through the same function the meeting reads', () => {
    expect(WEEK).toContain("from '@/lib/use-say-the-week'")
    expect(WEEK, 'the answer must not be written a second way here')
      .not.toContain('.update(')
  })

  it('with the same three answers', () => {
    expect(WEEK).toContain("const KEYS: AnswerKey[] = ['this', 'next', 'client']")
  })

  // Fabio, 12 Nov: "clickable client names".
  it('and the client names open the deal', () => {
    expect(WEEK).toContain('href={`/deals/${d.id}`}')
  })

  // NOTHING ON THIS PAGE PUSHES HIM. No target, no league table, no red.
  // Checked on the code rather than the file, because the note at the top of
  // that file says so in words and would match itself.
  it('and nothing on it chases him', () => {
    const code = WEEK.split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n').toLowerCase()
    expect(code).not.toContain('target')
    expect(code).not.toContain('overdue')
    expect(code).not.toContain('behind')
    // The only red on the card is a save that failed, which is not a chase.
    expect((WEEK.match(/text-chase/g) || []).length).toBeLessThanOrEqual(1)
  })
})

describe('where my deals are', () => {
  it('is on the page, and is given his whole book', () => {
    expect(TODAY).toContain('<WhereMyDealsAre deals={wholeBook} officerName={officerName} />')
  })

  // THE TWO LISTS ARE DIFFERENT ON PURPOSE. `mine` leaves out whatever credit
  // is carrying so a file is not counted twice; this card exists precisely to
  // show him which of our credit team is holding each file.
  it('his whole book, not the list that hides what credit is carrying', () => {
    expect(TODAY).toContain('const wholeBook = useMemo(')
    expect(TODAY).not.toContain('<WhereMyDealsAre deals={mine}')
  })

  it('and every line says who is holding it', () => {
    expect(WHERE).toContain('whoHasIt(d, officerName)')
  })
})

// Fabio, 12 Nov: the New deal card "must work".
describe('starting one', () => {
  it('the button is on his page', () => {
    expect(TODAY).toContain('href="/deals?new=1"')
    expect(TODAY).toContain('+ New deal card')
  })

  // Read on mount rather than with useSearchParams(), which makes this page
  // un-prerenderable without wrapping the whole of it in Suspense. The build
  // refuses it outright - that is where this was caught.
  it('and arriving that way opens the form rather than a list to hunt through', () => {
    expect(DEALS).toContain("new URLSearchParams(window.location.search).get('new') === '1'")
    expect(DEALS).toContain('setShowModal(true)')
    // The note above the code explains why not, so the check reads the code.
    const code = DEALS.split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect(code, 'useSearchParams() breaks the build on this page')
      .not.toContain('useSearchParams')
  })
})

// AND IT IS HIS ANSWER, NOT SOMEBODY LOOKING AT HIS PAGE.
// 12 Nov 2026 - see lib/view-as.ts. Fabio can read this screen; he cannot
// answer it, because the answer is the broker's own.
describe('somebody looking at it cannot answer it', () => {
  it('the ask is not drawn at all while being looked at', () => {
    expect(TODAY).toContain("{view === 'broker' && !readOnly && <BrokerWeek")
  })

  it('and nor is the button that starts a new deal', () => {
    expect(TODAY).toContain("{view === 'broker' && !readOnly && (")
  })
})
