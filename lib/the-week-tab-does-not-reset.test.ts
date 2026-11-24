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
const SQL  = readFileSync('docs/the-week-tab-is-remembered.sql', 'utf8')

describe('the tab is not hard-coded any more', () => {
  it('does not open on "nobody" regardless of what the person left', () => {
    expect(RUN).not.toContain("useState<Seat>('nobody')")
  })

  it('opens on what they left, and falls back to the first tab', () => {
    expect(RUN).toContain('SEATS.includes(openOn as Seat)')
    expect(RUN).toContain("? (openOn as Seat) : 'nobody'")
  })

  it('checks the stored value is a real tab rather than trusting the column', () => {
    // It arrives from a database column nothing else validates. A tab name
    // that is not a tab would draw an empty meeting with the counts still
    // showing above it - the worst of both.
    const at = RUN.indexOf('useState<Seat>(')
    expect(at).toBeGreaterThan(-1)
    expect(RUN.slice(at, at + 160)).toContain('SEATS.includes')
  })
})

describe('it is remembered against the login, not the browser', () => {
  it('the page reads the viewed person\'s tab, not the signed-in one\'s', () => {
    expect(PAGE).toContain('no_today, today_seat')
    // whoseId is viewingId || user.id - the same id every other figure on this
    // page is worked out from.
    expect(PAGE).toContain(".eq('id', whoseId)")
    expect(PAGE).toContain("openOn={(profile as any)?.today_seat || null}")
  })

  it('writes through save_my_board_view, never at the table', () => {
    // user_profiles has one UPDATE policy and it is the admin one, so a direct
    // write is refused for everybody else - silently, matching zero rows. The
    // row also holds role and broker_key. docs/my-own-board-is-mine.sql.
    expect(RUN).toContain("rpc('save_my_board_view', { p_today_seat: s })")
    expect(RUN).not.toContain("from('user_profiles').update")
  })
})

describe('LOOKING AT SOMEBODY DOES NOT REWRITE WHAT THEY LEFT OPEN', () => {
  it('the page turns remembering off while viewing as someone', () => {
    expect(PAGE).toContain('remember={!viewingId}')
  })

  it('and the component honours it before writing anything', () => {
    const at = RUN.indexOf('const chooseSeat')
    expect(at).toBeGreaterThan(-1)
    const body = RUN.slice(at, at + 400)
    expect(body).toContain('if (!remember) return')
    expect(body.indexOf('if (!remember) return'))
      .toBeLessThan(body.indexOf('save_my_board_view'))
  })
})

describe('the migration matches what the code expects', () => {
  it('adds the column the page selects', () => {
    expect(SQL).toContain('add column if not exists today_seat text')
  })

  it('DROPS the two-argument function rather than overloading it', () => {
    // Two functions side by side and a call naming one argument becomes
    // ambiguous - "function is not unique" - and every board fold in the
    // portal stops saving.
    expect(SQL).toContain('drop function if exists public.save_my_board_view(jsonb, jsonb)')
    expect(SQL).toContain('p_today_seat text  default null')
  })

  it('keeps the old two arguments working, so folds and filters are untouched', () => {
    expect(SQL).toContain('p_folds      jsonb default null')
    expect(SQL).toContain('p_filters    jsonb default null')
  })

  it('stays shut to anon', () => {
    expect(SQL).toContain('revoke all on function public.save_my_board_view(jsonb, jsonb, text) from anon, public')
    expect(SQL).toContain('grant execute on function public.save_my_board_view(jsonb, jsonb, text) to authenticated')
  })
})

describe('the tabs themselves are unchanged', () => {
  it('still the same five, in the same order', () => {
    expect(SEATS).toEqual(['nobody', 'this_week', 'next_week', 'client', 'lodged'])
    expect(SEAT_LABEL.nobody).toBe('Nobody has said')
    expect(SEAT_LABEL.this_week).toBe('This week')
  })
})
