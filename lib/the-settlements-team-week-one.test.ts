import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { threadsOf, addPatch, trailFor, type Entry } from './the-settlement-trail'
import { phaseOf, PHASE_LABEL } from './deal-phase'
import { dealBeads } from './deal-status'
import { SENT_FROM_ITS_OWN_STEP, menuToBrowse, templateById } from './milestone-emails'

// THE SETTLEMENTS TEAM'S FIRST WEEK.
//
// 22 Nov 2026. Belle Nunez and Ellesse Cabuga sent the first feedback after a
// week of running real settlements through the portal. Seven things. This file
// holds the five that are not covered elsewhere; the upload is in
// lib/the-reading-room-is-emptied.test.ts.

// ===========================================================================
// 1. A DEAL THAT IS OPENING SAYS SO
// ===========================================================================
//
// "When I click on a deal, it doesn't open immediately. There's a bit delay
// before the deal loads."
describe('opening a deal', () => {
  const PAGE = readFileSync('app/(app)/deals/[id]/page.tsx', 'utf8')

  it('draws something the moment it is clicked', () => {
    expect(existsSync('app/(app)/deals/[id]/loading.tsx'),
      'there is no loading screen, so the browser sits on the old page').toBe(true)
  })

  it('and what it draws is the shape of the page, not a spinner', () => {
    const L = readFileSync('app/(app)/deals/[id]/loading.tsx', 'utf8')
    expect(L).toContain('Where it is')
    expect(L).toContain('The deal')
    expect(L).toContain('Opening')
  })

  // IT CANNOT READ A DEAL. Next draws it before the page's own queries have
  // answered, so anything it claimed about this deal would be invented.
  it('and it claims nothing about which deal it is', () => {
    const L = readFileSync('app/(app)/deals/[id]/loading.tsx', 'utf8')
    for (const never of ['supabase', 'createSupabase', 'deal_name', 'params']) {
      expect(L, `loading.tsx must not ${never}`).not.toContain(never)
    }
  })

  // THE OTHER HALF. Four round trips in a row became three.
  it('the role and the deal are asked for together, not one after the other', () => {
    expect(PAGE).toContain('await Promise.all([')
    const par = PAGE.slice(PAGE.indexOf('await Promise.all(['))
    const close = par.indexOf('])')
    expect(par.slice(0, close)).toContain("from('user_profiles')")
    expect(par.slice(0, close)).toContain("from('deals')")
  })
})

// ===========================================================================
// 2. THE BOARD AND THE DEAL PAGE GIVE THE SAME ANSWER
// ===========================================================================
//
// "This one shows as Contracts Returned when I open the deal, but when I go
// back to the main pipeline, the status still shows as Formal."
//
// Both were right, which is the whole problem: the board names the furthest
// step REACHED, the blue bead is the step being WAITED ON.
describe('where a formally approved deal is', () => {
  const deal = {
    lodged_at: '2026-10-21T00:00:00Z',
    preapproval_at: '2026-10-25T00:00:00Z',
    offer_accepted_at: '2026-10-29T00:00:00Z',
    formal_approval_at: '2026-11-02T00:00:00Z',
  }

  it('the board calls it Formal approval', () => {
    expect(PHASE_LABEL[phaseOf(deal)]).toBe('Formal approval')
  })

  // This is what Ellesse was reading, and it is correct - it is the next step,
  // not the current position. Locked in so nobody "fixes" the bead.
  it('and the blue bead is still the step it is waiting on', () => {
    const live = dealBeads(deal).find(b => b.current)
    expect(live?.label).toBe('Contracts returned')
  })

  it('so the deal page heading says the column out loud', () => {
    const PAGE = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
    expect(PAGE).toContain('PHASE_LABEL[phaseOf(dealData)]')
    expect(PAGE).toContain('title={`Where it is')
  })

  it('and it reads the same function the board reads', () => {
    const BOARD = readFileSync('components/DealBoard.tsx', 'utf8')
    expect(BOARD).toContain('phaseOf')
  })
})

// ===========================================================================
// 3. A PROGRESS NOTE UNDER AN ATTENTION ITEM
// ===========================================================================
//
// "Can we also add an Edit option on the right side of each attention item?
// This would allow us to easily update or add progress notes directly under
// each attention." Fabio chose Reply over Edit: nothing on this trail is typed
// over.
describe('replying to an attention note', () => {
  const first: Entry = { at: '2026-11-19T00:58:00Z', by: 'Belle Nunez', text: 'Change DD acct to Offset acct' }
  const later: Entry = { at: '2026-11-20T01:00:00Z', by: 'Fabio de Castro', text: 'Something else entirely' }
  const deal = { attn_settlements: [later, first] }

  it('the note lands under the thing it is about', () => {
    const patch = addPatch(deal, 'Confirmed with the bank', 'Ellesse Cabuga',
      new Date('2026-11-21T22:14:00Z'), 'attn_settlements', first.at)
    const trail = patch!.attn_settlements as Entry[]
    expect(trail[0].to).toBe(first.at)
    expect(trail[0].text).toBe('Confirmed with the bank')
  })

  it('and nothing already written is touched', () => {
    const patch = addPatch(deal, 'Confirmed', 'Ellesse Cabuga',
      new Date('2026-11-21T22:14:00Z'), 'attn_settlements', first.at)
    const trail = patch!.attn_settlements as Entry[]
    expect(trail).toHaveLength(3)
    expect(trail.find(e => e.at === first.at)!.text).toBe('Change DD acct to Offset acct')
    expect(trail.find(e => e.at === later.at)!.text).toBe('Something else entirely')
  })

  it('entries read newest first, replies under them read oldest first', () => {
    const r1: Entry = { at: '2026-11-20T00:00:00Z', by: 'E', text: 'first thing', to: first.at }
    const r2: Entry = { at: '2026-11-21T00:00:00Z', by: 'E', text: 'then this', to: first.at }
    const threads = threadsOf([r2, first, later, r1])
    expect(threads.map(t => t.entry.text)).toEqual(['Something else entirely', 'Change DD acct to Offset acct'])
    expect(threads[1].replies.map(r => r.text)).toEqual(['first thing', 'then this'])
  })

  // A NOTE MUST NOT VANISH because the line above it went.
  it('a reply whose entry is gone is still shown, on its own', () => {
    const orphan: Entry = { at: '2026-11-21T00:00:00Z', by: 'E', text: 'still here', to: 'a-note-that-was-removed' }
    const threads = threadsOf([first, orphan])
    expect(threads.map(t => t.entry.text)).toContain('still here')
  })

  it('and replying to something that is not there writes an ordinary entry', () => {
    const patch = addPatch(deal, 'Note', 'E', new Date('2026-11-21T22:14:00Z'),
      'attn_settlements', 'no-such-entry')
    expect((patch!.attn_settlements as Entry[])[0].to).toBeUndefined()
  })

  it('an older trail with no replies in it reads exactly as it always did', () => {
    const threads = threadsOf(trailFor(deal, 'attn_settlements'))
    expect(threads).toHaveLength(2)
    expect(threads.every(t => t.replies.length === 0)).toBe(true)
  })

  it('the screen offers Reply, and never Edit', () => {
    const UI = readFileSync('components/SettlementTrail.tsx', 'utf8')
    expect(UI).toContain('Reply')
    expect(UI, 'an Edit would type over what somebody wrote').not.toContain('>Edit<')
    expect(UI).toContain('Add a progress note under this')
  })
})

// ===========================================================================
// 4. WHERE THE OTHER SIX EMAILS LIVE
// ===========================================================================
//
// "I couldn't find where the six client email templates are located?"
describe('the client emails menu', () => {
  const UI = readFileSync('components/MilestoneEmails.tsx', 'utf8')

  it('there are exactly six kept out of it, which is the six she was hunting', () => {
    expect(SENT_FROM_ITS_OWN_STEP).toHaveLength(6)
  })

  it('and the menu now says where they are', () => {
    expect(UI).toContain('The other six are sent from their own step.')
  })

  // NAMED FROM THE LIST, NOT RETYPED. A seventh added to
  // SENT_FROM_ITS_OWN_STEP must not leave this line quietly saying six names.
  it('it names them off the list itself', () => {
    expect(UI).toContain('SENT_FROM_ITS_OWN_STEP.map(id => templateById(id)?.name)')
  })

  it('every one of the six has a name to print', () => {
    for (const id of SENT_FROM_ITS_OWN_STEP) {
      expect(templateById(id)?.name, `${id} has no name`).toBeTruthy()
    }
  })

  it('and none of them is in the menu, which is why the line is needed', () => {
    const deal = { formal_approval_at: '2026-11-14T00:00:00Z', offer_accepted_at: '2026-10-29T00:00:00Z' }
    const shown = menuToBrowse(deal).map(i => i.id)
    for (const id of SENT_FROM_ITS_OWN_STEP) expect(shown).not.toContain(id)
  })
})

// ===========================================================================
// 5. A FOLDED COLUMN THAT CANNOT SAVE SAYS SO
// ===========================================================================
//
// "Can we make each column collapsible and retain its last state? Currently,
// all columns unfold again whenever I return to the main pipeline."
//
// It always meant to. The only UPDATE policy on user_profiles is the admin
// one, so the write was refused - silently, by matching zero rows - for
// everybody who is not an admin.
describe('remembering a folded column', () => {
  const HOOK = readFileSync('lib/use-column-folds.ts', 'utf8')
  const FILTERS = readFileSync('lib/use-board-filters.ts', 'utf8')
  const SQL = readFileSync('docs/my-own-board-is-mine.sql', 'utf8')

  it('the save goes through a function, not straight at the table', () => {
    expect(HOOK).toContain("rpc('save_my_board_view'")
    expect(HOOK, 'the table write is what the admin-only policy refused')
      .not.toContain("from('user_profiles')\n          .update(")
  })

  it('the filters beside it go the same way, for the same reason', () => {
    expect(FILTERS).toContain("rpc('save_my_board_view'")
  })

  it('and a refusal is no longer invisible', () => {
    expect(HOOK).toContain('setRefused(true)')
    const BOARD = readFileSync('components/DealBoard.tsx', 'utf8')
    expect(BOARD).toContain('foldsRefused')
    expect(BOARD).toContain('refused to\n          remember them')
  })

  // THE POINT OF THE WHOLE EXERCISE. user_profiles holds role and broker_key,
  // so a policy letting a person update their own row would let anybody make
  // themselves an admin.
  it('the fix does not open the table', () => {
    expect(SQL).toContain('security definer')
    // No policy is created at all - not on user_profiles, not anywhere. The
    // table is left exactly as locked as it was and the WRITE is narrowed
    // instead.
    //
    // The comments are stripped before this is checked, because the file
    // DELIBERATELY quotes the one-line policy that would have been the easy
    // fix, next to the reason it is not - and a test that cannot tell an
    // explanation from a statement would force that explanation out.
    const ran = SQL.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').toLowerCase()
    expect(ran, 'this must not create a policy on user_profiles')
      .not.toContain('create policy')
    expect(SQL).toContain('UPDATE policies on user_profiles')
  })

  it('it writes only the two view columns, for the caller alone', () => {
    const fn = SQL.slice(SQL.indexOf('create or replace function public.save_my_board_view'))
    const body = fn.slice(0, fn.indexOf('$$;'))
    expect(body).toContain('where id = auth.uid()')
    expect(body, 'an id argument is something a browser can change')
      .not.toContain('p_id')
    for (const never of ['role', 'broker_key', 'email', 'full_name']) {
      expect(body, `${never} must not be writable here`).not.toContain(` ${never} =`)
    }
  })

  it('and a stranger cannot run it', () => {
    expect(SQL).toContain('revoke all on function public.save_my_board_view(jsonb, jsonb) from anon')
    expect(SQL).toContain('grant execute on function public.save_my_board_view(jsonb, jsonb) to authenticated')
  })
})
