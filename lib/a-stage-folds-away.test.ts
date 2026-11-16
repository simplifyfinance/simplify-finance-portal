import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { GROUPS, GROUP_FOLD_KEYS, LANE_KEYS, groupFoldKey } from './the-board-columns'

// A WHOLE STAGE FOLDS AWAY, BY PRESSING ITS BAR.
//
// 17 Nov 2026. Fabio: "when settlements is looking at one, they don't care
// about new inquiries, BC, LO, they don't care about that. They just focus on
// settlements. And credit don't care about settlements. I want to be able to
// press a button on the black bar and that black bar will fold."
//
// PER PERSON, PER BROWSER, ANY COMBINATION. Asked whether Credit and
// Settlements should be saved views anybody could pick: "I don't want any
// rules... they choose what they want to fold, they do whatever they want."

const BOARD = readFileSync('components/DealBoard.tsx', 'utf8')
const FOLDS = readFileSync('lib/use-column-folds.ts', 'utf8')

describe('every stage can be folded, and remembers it', () => {
  it('every group has a key of its own', () => {
    const keys = GROUPS.map(g => g.key)
    expect(keys.every(Boolean), 'a group with no key cannot be folded').toBe(true)
    expect(new Set(keys).size, 'two groups share a key').toBe(keys.length)
  })

  it('all seven of them', () => {
    expect(GROUP_FOLD_KEYS.length).toBe(GROUPS.length)
    expect(GROUP_FOLD_KEYS.length).toBeGreaterThanOrEqual(7)
  })

  // THE BUG THE PREFIX EXISTS TO STOP. 'lead' is a group AND a column. One
  // list holds both kinds of key, so without the prefix folding the New lead
  // stage would fold the New lead column instead and nothing else.
  it('a stage key can never be mistaken for a column key', () => {
    for (const k of GROUP_FOLD_KEYS) {
      expect(LANE_KEYS, `${k} collides with a column`).not.toContain(k)
      expect(k.startsWith('group:'), `${k} is not prefixed`).toBe(true)
    }
    expect(groupFoldKey(GROUPS[0])).toBe(`group:${GROUPS[0].key}`)
  })

  it('the fold list accepts them, or nothing would ever be remembered', () => {
    expect(FOLDS).toContain('GROUP_FOLD_KEYS')
    expect(FOLDS, 'a stage fold would be thrown away as an unknown key')
      .toMatch(/REAL_COLUMNS[^\n]*GROUP_FOLD_KEYS/)
  })

  it('and it is still written against the person, not the team', () => {
    expect(FOLDS).toContain("from('user_profiles')")
    expect(FOLDS).toContain('board_folds')
  })
})

describe('the bar itself', () => {
  it('is a button, so it can be pressed', () => {
    expect(BOARD).toContain('onClick={() => toggle(foldKey)}')
    expect(BOARD, 'a screen reader cannot tell whether a stage is open')
      .toContain('aria-expanded={!shut}')
  })

  it('a folded stage keeps its count and its total', () => {
    // The whole reason folding is safe: you can still read "22 · $15.6m"
    // without opening it.
    const i = BOARD.indexOf('const foldKey = groupFoldKey(g)')
    const block = BOARD.slice(i, i + 3000)
    expect(block).toContain('const count = ')
    expect(block).toContain('{count}')
  })

  it('and loses its columns, which is the point', () => {
    expect(BOARD).toContain('{shut ? null : (<>')
    expect(BOARD, 'a folded stage still takes a column of room').toContain("w-[44px]")
  })
})
