import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE SIDEBAR MUST NOT BE ABLE TO HIDE ITS OWN FOOTER.
//
// 12 Oct 2026. Katie reported that her portal had no Reload button. It had one.
// It was 135 pixels below the bottom of her screen, along with her name, the
// light/dark switch and Sign out, and there was no way to scroll down to it.
//
// WHY IT HAPPENS. The left column is h-screen and app/(app)/layout.tsx wraps the
// whole screen in overflow-hidden, so this column gets exactly the window's
// height and nothing can scroll past it. Inside it the menu list is a flex
// child, and a flex child defaults to min-height:auto - it refuses to shrink
// below its own content. So a long menu (an admin sees four more items than a
// broker, and an open sub-list adds more again) simply grows and shoves the
// footer out of the window. On a taller screen the same code looks perfect,
// which is why it went unnoticed for weeks and why only some people hit it.
//
// WHAT HAS TO STAY TRUE. The menu is the part that gives way: min-h-0 lets it
// shrink and overflow-y-auto gives it its own scroll bar. The footer sits
// outside the menu, as the last child of the column, so it is always on screen.
//
// This is a layout test read off the source rather than a browser test, because
// the failure is one missing class and a class cannot go missing quietly.
const SIDEBAR = readFileSync('components/Sidebar.tsx', 'utf8')

const NAV = /<nav className="([^"]+)"/.exec(SIDEBAR)
const ASIDE = /<aside className="([^"]+)"/.exec(SIDEBAR)

describe('the sidebar keeps its footer on screen', () => {
  it('has one menu list and one column, both findable', () => {
    expect(NAV, 'the <nav> lost its className').not.toBeNull()
    expect(ASIDE, 'the <aside> lost its className').not.toBeNull()
    expect(SIDEBAR.match(/<nav className=/g)?.length).toBe(1)
  })

  // If either of these two ever goes, the reasoning below stops applying and
  // this whole test should be rewritten rather than deleted.
  it('the column is still the full height of the window and still a column', () => {
    expect(ASIDE![1]).toContain('h-screen')
    expect(ASIDE![1]).toContain('flex-col')
  })

  it('the page outside it still cannot scroll, so nothing off the bottom is reachable', () => {
    const layout = readFileSync('app/(app)/layout.tsx', 'utf8')
    expect(layout).toContain('overflow-hidden')
  })

  it('the menu list is allowed to shrink', () => {
    expect(NAV![1], 'min-h-0 is what lets the menu give way to the footer').toContain('min-h-0')
  })

  it('the menu list scrolls inside itself rather than pushing', () => {
    expect(NAV![1], 'without its own scroll a long menu is simply unreachable').toContain('overflow-y-auto')
  })

  it('the menu list is still the part that takes up the slack', () => {
    expect(NAV![1]).toContain('flex-1')
  })

  // The three things people lose when the footer goes off the edge. Each one
  // has to be below </nav>, not inside it - inside, it scrolls away with the
  // menu and we are back where we started.
  const AFTER_NAV = SIDEBAR.slice(SIDEBAR.indexOf('</nav>'))
  it.each([
    ['the Reload button', '<NewVersion />'],
    ['the light and dark switch', '<ThemeSwitch'],
    ['Sign out', 'Sign out'],
  ])('%s sits outside the menu list', (_what, needle) => {
    expect(SIDEBAR).toContain(needle)
    expect(AFTER_NAV).toContain(needle)
  })
})
