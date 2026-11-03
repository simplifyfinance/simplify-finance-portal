import { type Page, expect } from '@playwright/test'

// THE ROBOT FINDS ITS OWN DEAL, OR IT BREEDS.
//
// 3 Nov 2026. 924 of the 1165 deals in this database were test deals, and 891
// of them were made in the last thirty days. That is about thirty a day, which
// is one per robot per ship.
//
// Both specs that make a deal were written to make ONE and reuse it. They look
// for it first and only create when it is not there. The looking stopped
// working on 2 October, when Settled, Lost and Test deals moved out of the
// toolbar and into the Filters panel: the robot was still hunting for a button
// called "Test deals (12)", found nothing, concluded its deal did not exist,
// and made another. Every run. For a month.
//
// Nothing failed. The specs passed every time - they had a deal, it was new,
// and a new deal behaves like an old one. The only sign was a number in a
// database nobody counts, until the pile grew past the thousand rows the
// database will return in one answer and started pushing real deals off the
// end of the deals screen. See lib/the-whole-book.ts.
//
// SO THE LOOKING LIVES IN ONE FILE NOW. Two copies of it is how one copy gets
// fixed. And it goes through the Filters panel the way a person does, so the
// day that moves again, this fails loudly instead of quietly making deals.

// ZZROBOT MUST NOT MATCH ZZROBOTTWO.
//
// 1 Oct 2026. new-deal-busy.spec.ts calls its client ZZROBOTTWO. That CONTAINS
// the other spec's name, so a plain substring match picks up the wrong robot's
// deal - and did, the first time the two ran together: one spec typed its goals
// into the other's deal and then failed to find them in its own.
export const theNameAlone = (first: string) => new RegExp(`${first}(?![A-Z])`, 'i')

// Turn on "Test deals only", which is where a robot's own deal lives: it ticks
// that box on the way in, and a test deal is hidden from the normal list.
export async function showTestDeals(page: Page): Promise<void> {
  const filters = page.getByRole('button', { name: /^Filters/ })
  await expect(filters,
    'The Filters button is not on the deals page any more, so the robot cannot '
    + 'reach its own deal - and an unreachable deal is a NEW deal every ship. '
    + 'That is how 891 of them appeared in thirty days.')
    .toBeVisible({ timeout: 20_000 })
  await filters.click()

  const only = page.getByText('Test deals only', { exact: true })
  await expect(only,
    'The "Test deals only" row is gone from the Filters panel. Same consequence '
    + 'as above: the robot cannot find its deal and will make a new one.')
    .toBeVisible({ timeout: 20_000 })
  await only.click()

  // Shut the panel again so it is not sitting over the list being searched.
  await page.keyboard.press('Escape')
}

// Looks in the normal list, then behind the test filter. Either is a find.
export async function findTheRobotsDeal(page: Page, first: string): Promise<boolean> {
  const look = () => page.getByText(theNameAlone(first)).first()

  const here = async (ms: number) =>
    look().waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false)

  // The deals made before any of this still sit in the normal list.
  if (await here(20_000)) { await look().click(); return true }

  await showTestDeals(page)
  // The search box keeps what was typed, and asking for test deals is a fresh
  // read of the book - see fetchDeals in app/(app)/deals/page.tsx.
  if (await here(20_000)) { await look().click(); return true }

  return false
}
