import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { SETTINGS_PANES, paneFor, isPane, DEFAULT_PANE } from './settings-panes'
import { LENDER_PANES, isLenderPane } from './lender-panes'

// A SETTINGS PAGE NOBODY CAN REACH IS A SETTINGS PAGE NOBODY HAS.
//
// 30 Sep 2026. The Rate notice page shipped, worked, and was not in the menu.
// Neither were Deal board or Statement analysis, and they had been missing since
// the day they shipped - because the sidebar kept its own hardcoded copy of the
// list and adding a pane in one place did nothing in the other.
//
// Same shape as every other bug this codebase has had: one fact, two homes,
// free to disagree. The difference is that this one is invisible - nothing
// breaks, nothing errors, the page is simply never found.

const sidebar = readFileSync('components/Sidebar.tsx', 'utf8')
const settings = readFileSync('app/(app)/settings/SettingsClient.tsx', 'utf8')
const lenders = readFileSync('app/(app)/lenders/LendersClient.tsx', 'utf8')

describe('the list', () => {
  it('has every pane the settings page can draw', () => {
    // Each one is rendered as {pane === 'key' && ...} on the page itself.
    for (const p of SETTINGS_PANES) {
      expect(settings.includes(`pane === '${p.key}'`),
        `the menu offers "${p.label}" but the page draws nothing for it`).toBe(true)
    }
  })

  it('and the page draws nothing that is not on the list', () => {
    const drawn = [...settings.matchAll(/pane === '([a-z-]+)'/g)].map(m => m[1])
    const orphans = [...new Set(drawn)].filter(k => !isPane(k))
    expect(orphans, 'this pane exists but nothing can reach it').toEqual([])
  })

  it('every key is distinct, and every one has words', () => {
    expect(new Set(SETTINGS_PANES.map(p => p.key)).size).toBe(SETTINGS_PANES.length)
    for (const p of SETTINGS_PANES) {
      expect(p.label.trim().length).toBeGreaterThan(0)
      expect(p.blurb.trim().length).toBeGreaterThan(0)
    }
  })

  it('falls back to the first pane rather than to nothing', () => {
    expect(paneFor('nonsense').key).toBe(DEFAULT_PANE)
    expect(paneFor(null).key).toBe(DEFAULT_PANE)
    expect(isPane('board')).toBe(true)
    expect(isPane('')).toBe(false)
  })
})

describe('the sidebar reads it rather than keeping a copy', () => {
  // THE GUARD. A hardcoded settings list in the sidebar is exactly what went
  // wrong, so a new one fails here rather than in six weeks when somebody
  // wonders where a page went.
  it('builds its settings menu from lib/settings-panes.ts', () => {
    expect(sidebar).toContain("from '@/lib/settings-panes'")
    expect(sidebar).toContain('SETTINGS_PANES.map(')
  })

  it('and does not list any pane by hand', () => {
    const settingsBlock = sidebar.slice(sidebar.indexOf("'/settings':"),
      sidebar.indexOf("'/settings':") + 600)
    for (const p of SETTINGS_PANES) {
      expect(settingsBlock.includes(`label: '${p.label}'`),
        `"${p.label}" is typed into the sidebar as well as the list`).toBe(false)
    }
  })

  // THE ONES THAT WERE MISSING. Named, so that if this ever regresses the test
  // says which pages went quiet and when it happened before.
  it('reaches the two that were unreachable', () => {
    for (const key of ['board', 'statements']) {
      expect(isPane(key)).toBe(true)
      expect(settings).toContain(`pane === '${key}'`)
    }
  })
})

// THE RATE NOTICE IS NOT AN ADMIN JOB.
//
// Fabio, 30 Sep 2026: "remeber the rates is a team effort once live it needs to
// be under lender library come on as not evryone can see settings".
//
// The whole design of the notice is that anybody who learns a bank's date can
// record it. Putting the switch behind Settings would have made one person the
// bottleneck on every RBA decision, and left the per-lender dates a page away
// from the thing that drives them.
describe('the rate notice lives with the lenders', () => {
  it('is a pane of the lender library', () => {
    expect(isLenderPane('rate-notice')).toBe(true)
    expect(lenders).toContain('RateNoticeSettings')
  })

  it('and is not behind Settings, where most of the team cannot go', () => {
    expect(isPane('rate-notice'),
      'the rate notice is back in Settings - not everybody can see that page').toBe(false)
    expect(settings).not.toContain('RateNoticeSettings')
  })

  it('the lender menu reads one list too', () => {
    expect(sidebar).toContain('LENDER_PANES.map(')
    for (const p of LENDER_PANES) {
      expect(lenders.includes(`pane === '${p.key}'`) || p.key === 'lenders',
        `the lender menu offers "${p.label}" but the page draws nothing for it`).toBe(true)
    }
  })
})
