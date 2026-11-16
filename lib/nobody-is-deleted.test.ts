// NOBODY IS DELETED. THEY ARE ARCHIVED.
//
// 18 Nov 2026. Fabio: "I asked you to archive when I delete, as we cant delete
// so we need to archive." Deleting a team member threw a database error on
// anybody who had ever touched a deal, and the only way it could ever have
// succeeded was by taking somebody's name off their own work.
//
// THE QUIET HALF OF THIS WAS WORSE. Switching somebody off hid them from every
// screen and left their login working - so a leaver who was "deactivated" in
// the morning could sign in that afternoon. Archiving stops the login.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'

const TEAM = readFileSync('components/TeamSection.tsx', 'utf8')
const ROUTE = readFileSync('app/api/archive-user/route.ts', 'utf8')

describe('a leaver is archived, not deleted', () => {
  it('the team screen has no delete button', () => {
    expect(TEAM).not.toContain('Permanently delete')
    expect(TEAM, 'nothing on this screen may call the delete route')
      .not.toContain("fetch('/api/delete-user'")
  })

  it('it archives and brings back through the one door', () => {
    expect(TEAM).toContain("fetch('/api/archive-user'")
    expect(TEAM).toContain('Archive')
    expect(TEAM).toContain('Bring back')
  })

  it('and says what archiving does before it does it', () => {
    expect(TEAM).toContain('cannot sign in again')
    expect(TEAM).toContain('nothing is deleted')
  })
})

describe('archiving stops the login', () => {
  it('bans the account rather than only hiding the row', () => {
    expect(ROUTE).toContain('ban_duration')
    expect(ROUTE).toContain("'876000h'")
  })

  it('and lifts the ban when somebody comes back', () => {
    expect(ROUTE).toContain("bringBack ? 'none'")
  })

  it('only an admin may do it', () => {
    expect(ROUTE).toContain("can(me as any, 'manageTeam')")
  })

  it('and never to yourself, which would lock you out of undoing it', () => {
    expect(ROUTE).toContain('You cannot archive your own account')
  })

  // A REFUSED WRITE RETURNS NO ROWS AND NO ERROR - see lib/checked-write.ts.
  it('checks the row was really written', () => {
    expect(ROUTE).toContain('.select(')
    expect(ROUTE).toContain('Nothing was written')
  })

  it('the old delete route is not wired to anything', () => {
    if (!existsSync('app/api/delete-user/route.ts')) return
    const used = readFileSync('components/TeamSection.tsx', 'utf8')
    expect(used).not.toContain('/api/delete-user')
  })
})
