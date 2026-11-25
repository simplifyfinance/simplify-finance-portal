import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { SEATS, SEAT_LABEL } from './the-run-through'

// "HIS LAPTOP, HIS VIEW, AND WHAT I'M PRESSING ON MY VIEW THAT SAYS ALAN
// HEMMINGS IS DIFFERENT."
//
// 25 Nov 2026. Fabio, with three screenshots of the same screen: his own, his
// own viewing as Alan Hemmings, and Alan's actual laptop. They looked
// different, and he had been reporting it for weeks.
//
// THE DATA WAS NEVER DIFFERENT. The counts across all three screenshots were
// identical - 17, 10, 6, 24, 3 - because the answers live on the DEAL. When
// Kylie presses "Next" on a file it is next week for Kylie, Mark, Catherine,
// Alan and Fabio, because there is one answer and they are all reading it.
// Fabio: "that box in the middle... it's a common box."
//
// WHAT DIFFERED WAS WHERE EACH PERSON WAS STANDING. components/RunThrough.tsx:
//
//     const [seat, setSeat] = useState<Seat>('nobody')
//
// The run-through opened on "Nobody has said" every load, for everyone,
// forever. Alan had clicked This week. Fabio's had reset. Two people looking at
// one shared list from two different tabs, each concluding the other's data was
// wrong - for weeks, over a screen whose entire purpose is that the admin team
// sees the same thing.
//
// AND IT BROKE THE ONE TOOL THAT WOULD HAVE FOUND IT. Fabio: "the only reason I
// created this view as Alan, view as Catherine, view as Kylie is because I've
// been building all these things and I'm saying it works. When they log in, it
// shows nothing like we discussed." Viewing as Alan reset to the first tab too,
// so the check could never show what Alan actually had open.
//
// So the tab is remembered against the login - not the browser, because Fabio's
// browser cannot read what Alan's remembered - and looking at somebody is
// read-only, because a check that rewrites what it is checking is not a check.

const PAGE = readFileSync('app/(app)/dashboard/page.tsx', 'utf8')
const RUN  = readFileSync('components/RunThrough.tsx', 'utf8')
const SQL  = readFileSync('docs/the-week-tab-is-the-teams.sql', 'utf8')

// ===========================================================================
// SECOND ATTEMPT, 25 Nov 2026, AND THE FIRST ONE IS THE LESSON.
//
// The first fix remembered the tab AGAINST EACH LOGIN. It stopped the
// resetting, every test passed, and it did not fix what Fabio reported:
//
//   "See the section? It's still not sharing everyone's section. Alan has the
//    this week ticked and it's different to this."
//
// He had said it plainly before a line was written - "that box is shared with
// all admin people... the same screen for everyone" - and the build went the
// other way on the strength of four words in an earlier message. A per-person
// memory is a DIFFERENT FEATURE from a shared one, and it fails in exactly the
// way the original complaint describes.
//
// There is ONE tab now. Not one each.
// ===========================================================================

describe('there is one tab, and it belongs to the team', () => {
  it('the page reads it from settings, not from a person', () => {
    expect(PAGE).toContain("from('settings').select('week_tab').eq('id', 'singleton')")
    expect(PAGE).toContain('openOn={weekTab}')
  })

  it('and no longer reads a per-person tab off the profile', () => {
    // user_profiles.today_seat is left on the table deliberately - dropping a
    // column on a live database buys nothing - but nothing may read it.
    expect(PAGE).not.toContain('today_seat')
  })

  it('so viewing as somebody shows the same tab as your own, because there is only one', () => {
    // The whole reason "view as" exists: checking the portal works for Alan.
    // A check that shows a different tab from his cannot do that.
    expect(PAGE).not.toContain('remember={!viewingId}')
    expect(RUN).not.toContain('if (!remember) return')
  })
})

describe('moving it moves it for everyone', () => {
  it('writes through set_the_week_tab, never at the table', () => {
    expect(RUN).toContain("rpc('set_the_week_tab', { p_tab: s })")
    expect(RUN).not.toContain("from('settings').update")
    expect(RUN).not.toContain("from('settings').upsert")
  })

  it('the button moves it rather than only setting local state', () => {
    expect(RUN).toContain('onClick={() => { chooseSeat(s); setProblem(\'\') }}')
  })
})

describe('the tab still opens where the team left it', () => {
  it('does not open on "nobody" regardless', () => {
    expect(RUN).not.toContain("useState<Seat>('nobody')")
  })

  it('opens on the shared tab, and falls back to the first one', () => {
    expect(RUN).toContain('SEATS.includes(openOn as Seat)')
    expect(RUN).toContain("? (openOn as Seat) : 'nobody'")
  })
})

describe('the migration matches what the code expects', () => {
  it('adds the column the page selects', () => {
    expect(SQL).toContain('add column if not exists week_tab text')
  })

  it('REFUSES A VALUE THAT IS NOT A TAB', () => {
    // A stored value that is not one of the five would open every admin on an
    // empty meeting with the counts still showing above it.
    expect(SQL).toContain("('nobody', 'this_week', 'next_week', 'client', 'lodged')")
    expect(SQL).toContain('raise exception')
  })

  it('writes one column and cannot reach the rate notice or the brands', () => {
    expect(SQL).toContain('update public.settings set week_tab = p_tab')
    expect(SQL).not.toContain('rate_notice =')
    expect(SQL).not.toContain('brands =')
  })

  it('stays shut to anon', () => {
    expect(SQL).toContain('revoke all on function public.set_the_week_tab(text) from anon, public')
    expect(SQL).toContain('grant execute on function public.set_the_week_tab(text) to authenticated')
  })
})

describe('the tabs themselves are unchanged', () => {
  it('still the same five, in the same order', () => {
    expect(SEATS).toEqual(['nobody', 'this_week', 'next_week', 'client', 'lodged'])
    expect(SEAT_LABEL.nobody).toBe('Nobody has said')
    expect(SEAT_LABEL.this_week).toBe('This week')
  })
})
