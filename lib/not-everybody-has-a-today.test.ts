// NOT EVERYBODY HAS A TODAY PAGE.
//
// 17 Nov 2026. Fabio: "not everyone needs a Today Page so deactive Today tab
// from settlem ent staff for now - any chnace we can remove from the left hand
// side so it doesnt confuse them?"
//
// THE SHORTCUT THAT WAS NOT TAKEN, AND WHY.
//
// The obvious rule was "hide Today from anybody who sees the settlements
// board". The database says that would have taken it off nine people:
//
//   Belle Nunez, Julian Kok          settlements - correct
//   Dinisha Devadason                CREDIT, and on maternity leave with her
//                                    page waiting for her - wrong
//   Cris Po, Ellesse Cabuga, Ellie,
//   Ria, Wella Avila                 staff, nobody asked - wrong
//
// sees_settlements means "can open that board" and thirteen people hold it,
// four of them admins. A permission that means one thing must not be read as
// though it means another, so this is a tick of its own.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const SIDEBAR = readFileSync('components/Sidebar.tsx', 'utf8')
const TEAM = readFileSync('components/TeamSection.tsx', 'utf8')
const DASH = readFileSync('app/(app)/dashboard/page.tsx', 'utf8')

describe('the tick', () => {
  it('is its own flag, set in Settings, Team', () => {
    expect(TEAM).toContain("['no_today', 'No Today page'")
    expect(TEAM).toContain("'sees_settlements' | 'no_today'")
  })

  it('and is never inferred from the settlements permission', () => {
    expect(SIDEBAR, 'reading one permission as though it were another is the bug this avoids')
      .not.toMatch(/notWithoutToday[^\n]*sees_settlements/)
    expect(DASH).not.toMatch(/no_today[^\n]*sees_settlements/)
  })
})

describe('what it does', () => {
  it('drops the tab from the sidebar', () => {
    expect(SIDEBAR).toContain('notWithoutToday: true')
    expect(SIDEBAR).toContain('.filter(item => !(item as any).notWithoutToday || !profile?.no_today)')
  })

  // HIDING THE TAB IS NOT ENOUGH. app/page.tsx redirects everything to
  // /dashboard, so without this they open the portal onto the one page they
  // are not meant to use, every morning, with no way back to it in the nav.
  it('and sends them to the screen they actually work out of', () => {
    expect(DASH).toContain("if (!viewingId && (profile as any)?.no_today) redirect('/settlements')")
  })

  // An admin reading somebody else's Today is looking AT that person, not
  // using their own page, and must not be bounced out of it.
  it('but never bounces an admin who is viewing somebody else', () => {
    expect(DASH).toContain('!viewingId &&')
  })

  it('the sidebar asks the database for it', () => {
    expect(SIDEBAR).toContain('sees_settlements, no_today')
  })
})
