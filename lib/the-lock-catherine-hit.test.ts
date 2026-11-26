import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { canUnlock, unlockNote, reasonIsEnough, isLocked } from './deal-lock'
import { can } from './permissions'
import {
  rememberUnlock, unlockIsRemembered, forgetUnlock, unlockKey,
} from './the-unlock-survives-a-reload'

// ONE EMAIL, THREE SEPARATE FAULTS.
//
// 26 Nov 2026. Catherine, on Simone Howland - a Macquarie refinance changed
// right after lodgement, one split that had to become two:
//
//   "I may need your help with the best way to do that as it kept locking and
//    when I hit edit on the single loan split, it only let me update that $
//    value, not add an additional split/product. Credit (Mel) isn't able to
//    edit even when I unlock FYI - remains locked for her."
//
// Three things, and only one of them was a bug in the ordinary sense:
//
//   1. the unlock did not survive a page reload          — a bug
//   2. no way to ADD a split from where she was standing — a dead end, by design,
//                                                          with nothing on screen
//                                                          saying where to go
//   3. credit could not unlock at all                    — the design, changed
//                                                          by Fabio that day
//
// None of them were visible to anybody except the person trying to do the work.

// ---------------------------------------------------------------------------
// 1. "IT KEPT LOCKING"
// ---------------------------------------------------------------------------

function fakeStore(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size },
  } as unknown as Storage
}

describe('the unlock survives a reload', () => {
  let store: Storage
  beforeEach(() => { store = fakeStore() })

  it('is remembered once it is granted', () => {
    expect(unlockIsRemembered('deal-1', store)).toBe(false)
    rememberUnlock('deal-1', store)
    expect(unlockIsRemembered('deal-1', store)).toBe(true)
  })

  it('and leaving the deal still re-locks it', () => {
    rememberUnlock('deal-1', store)
    forgetUnlock('deal-1', store)
    expect(unlockIsRemembered('deal-1', store)).toBe(false)
  })

  // UNLOCKING ONE LODGED DEAL MUST NOT UNLOCK THE NEXT ONE SOMEBODY OPENS.
  it('is per deal, never a switch for the whole portal', () => {
    rememberUnlock('deal-1', store)
    expect(unlockIsRemembered('deal-2', store)).toBe(false)
    expect(unlockKey('deal-1')).not.toBe(unlockKey('deal-2'))
  })

  it('a browser that refuses to store it simply re-locks, rather than breaking', () => {
    const hostile = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    } as unknown as Storage
    expect(() => rememberUnlock('deal-1', hostile)).not.toThrow()
    expect(() => forgetUnlock('deal-1', hostile)).not.toThrow()
    expect(unlockIsRemembered('deal-1', hostile)).toBe(false)
  })

  it('the deal page clears it on the way out, not on a reload', () => {
    // A reload does not unmount anything; navigating away does. If this
    // cleanup ever moves out of the unmount, the unlock starts following
    // somebody around the portal.
    const src = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
    expect(src).toContain('return () => forgetUnlock(deal.id)')
    expect(src).toContain('rememberUnlock(dealData.id)')
  })
})

// ---------------------------------------------------------------------------
// AND THE ONE FABIO ASKED FOR AFTER READING ALL THREE
// ---------------------------------------------------------------------------
//
//   "I want to be able to lock and unlock... And then once that's done, how do
//    we know it's locked again?"
//
// You could not know. Once the unlock worked the bar vanished, the form went
// live, and a lodged deal standing open looked exactly like a deal that was
// never locked. It re-locked when you left, silently, and there was no way to
// close it on purpose.

describe('an open deal says so, and one button shuts it', () => {
  const src = readFileSync('components/TabLock.tsx', 'utf8')

  it('shows a bar while a lodged deal is unlocked', () => {
    expect(src).toContain('Unlocked &mdash; this deal is lodged.')
  })

  it('with a button that locks it there and then', () => {
    expect(src).toContain('Lock it again')
    expect(src).toContain('onClick={onRelock}')
  })

  // THE BAR MUST NOT APPEAR ON AN ORDINARY DEAL. `locked` is false both for a
  // deal that was never locked and for a lodged one standing open; only the
  // second gets the bar.
  it('and never on a deal that was simply never locked', () => {
    expect(src).toContain('if (!lodged || !onRelock) return <>{children}</>')
  })

  it('the deal page hands it both the state and the way back', () => {
    const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
    expect(page).toContain('lodged={isLocked(dealData)}')
    expect(page).toContain('setDealUnlocked(false); forgetUnlock(dealData.id)')
  })

  // THE OLD SENTENCE STAYS, because it is still true - leaving the deal does
  // re-lock it. lib/nothing-is-lost.test.ts holds every word on this page
  // against a locked list, and it was right to stop me rewriting that line:
  // the fault was never that the sentence was wrong, it was that it described
  // the ONLY way back.
  it('and the dialog now names both ways back, not just one', () => {
    expect(src).toContain('re-locks when you leave it.')
    expect(src).toContain('While it is open there is a Lock it again button')
  })
})

// ---------------------------------------------------------------------------
// 2. "IT ONLY LET ME UPDATE THAT $ VALUE"
// ---------------------------------------------------------------------------

describe('the screen says where a split is added', () => {
  const src = readFileSync('components/DealStructure.tsx', 'utf8')

  it('points at the BC when the Add split button is not drawn', () => {
    expect(src).toContain('adding or removing a split is done on the BC')
  })

  // The dead end was never a missing feature - the BC owns the structure and
  // always has. It was a screen that offered an Edit which changes one figure
  // and said nothing at all about the thing she actually needed.
  it('and the BC still owns the structure - this adds a signpost, not a second door', () => {
    expect(src).toContain('const canEditStructure: boolean = false')
  })
})

// ---------------------------------------------------------------------------
// 3. "CREDIT ISN'T ABLE TO EDIT EVEN WHEN I UNLOCK"
// ---------------------------------------------------------------------------

describe('who may unlock a lodged deal', () => {
  // Fabio, 26 Nov 2026: "I don't mind credit being able to unlock it. as long
  // we are recording everyhting on file notes history."
  it('credit can, as of 26 Nov 2026', () => {
    expect(canUnlock('staff')).toBe(true)
    expect(can('staff', 'unlockLodgedDeal')).toBe(true)
  })

  it('so can a broker and an admin, as before', () => {
    expect(canUnlock('admin')).toBe(true)
    expect(canUnlock('broker')).toBe(true)
  })

  it('and somebody with no role at all still cannot', () => {
    expect(canUnlock(null)).toBe(false)
    expect(canUnlock('')).toBe(false)
    expect(canUnlock('nonsense')).toBe(false)
  })

  // THE CONDITION FABIO PUT ON IT, AND THE REASON THIS IS SAFE.
  //
  // The record was never what was holding credit out. An unlock has always
  // needed a typed reason, and TabLock refuses to unlock at all when the file
  // note cannot be written. Widening WHO may unlock changes none of that - and
  // if any of it is ever weakened, this fails.
  it('every unlock still has to say why, and still goes on the file', () => {
    expect(reasonIsEnough('')).toBe(false)
    expect(reasonIsEnough('   ')).toBe(false)
    expect(reasonIsEnough('typo')).toBe(true)
    expect(unlockNote('split structure changed after lodgement'))
      .toBe('Deal unlocked and edited. split structure changed after lodgement')
  })

  it('and an unlock that cannot be written to the file does not happen', () => {
    const src = readFileSync('components/TabLock.tsx', 'utf8')
    expect(src).toContain('NOT UNLOCKED - the file note could not be saved')
    // The guard, not just the message: nothing is unlocked on that path.
    expect(src).toMatch(/if \(error \|\| !data\?\.length\) \{[\s\S]*?return\n/)
  })

  it('and a deal that is not with the lender was never locked in the first place', () => {
    expect(isLocked({ lodged_at: null })).toBe(false)
  })
})
