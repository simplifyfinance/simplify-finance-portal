import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { draftKey, offerVerdict, shouldOffer, draftWhen, DRAFT_MAX_AGE_MS } from './draft-store'

// THE LAST HOLE IN "LETTERS DISAPPEARING".
//
// The save can still fail - wifi, sleep, a database hiccup - and while it is
// failing the typing exists only in that browser tab. The screen shouts about
// it, but the shout only works if a person reads it and obeys it.
//
// A local copy was tried once and ripped out. The note is still in LOForm: "a
// per-browser cache keyed only by deal id showed one user another user's state,
// and let a blank form overwrite a real record." Both are designed out here.

const record = { purpose: 'Buying in Chelsea', goals: 'Pay it down in ten years', notes: 'Met 14 Sep' }

describe('the key carries who', () => {
  it('never produces a key without a person on it', () => {
    // This is the whole of the first bug: a key of deal id alone is shared by
    // everybody who opens that deal on that computer.
    expect(draftKey('', 'deal-1', 'bc_data')).toBeNull()
    expect(draftKey(null, 'deal-1', 'bc_data')).toBeNull()
    expect(draftKey(undefined, 'deal-1', 'bc_data')).toBeNull()
  })

  it('needs the deal and the tab too', () => {
    expect(draftKey('kylie', '', 'bc_data')).toBeNull()
    expect(draftKey('kylie', 'deal-1', '')).toBeNull()
  })

  it('gives two people different keys on the same deal and tab', () => {
    expect(draftKey('kylie', 'deal-1', 'bc_data')).not.toBe(draftKey('melissa', 'deal-1', 'bc_data'))
  })

  it('gives one person different keys per tab', () => {
    expect(draftKey('kylie', 'deal-1', 'bc_data')).not.toBe(draftKey('kylie', 'deal-1', 'lo_data'))
  })

  it('is versioned, so an old shape can never be read back as a new one', () => {
    expect(draftKey('kylie', 'deal-1', 'bc_data')).toContain('.v1.')
  })
})

describe('what may be offered back', () => {
  const draft = (value: any, at = Date.now()) => ({ at, value })

  it('offers work the database does not have', () => {
    const mine = { ...record, purpose: 'Buying in Chelsea, subject to finance' }
    expect(offerVerdict(draft(mine), record)).toBe('offer')
    expect(shouldOffer(draft(mine), record)).toBe(true)
  })

  it('REFUSES a draft that would empty a real record', () => {
    // The second bug, refused at the door: "let a blank form overwrite a real
    // record". Same judgement a save goes through - see lib/wipe-guard.ts.
    const full = { a: '1', b: '2', c: '3', d: '4', e: '5', f: '6', g: '7', h: '8' }
    expect(offerVerdict(draft({ a: '1' }), full)).toBe('would-wipe')
  })

  it('says nothing when the database caught up', () => {
    expect(offerVerdict(draft(record), record)).toBe('same-as-saved')
  })

  it('says nothing about an empty draft', () => {
    expect(offerVerdict(draft({ purpose: '', goals: '' }), record)).toBe('empty')
    expect(offerVerdict(draft({}), record)).toBe('empty')
  })

  it('lets a draft go stale rather than haunt a deal that has moved on', () => {
    const old = draft({ ...record, purpose: 'Something from last fortnight' },
                      Date.now() - DRAFT_MAX_AGE_MS - 1000)
    expect(offerVerdict(old, record)).toBe('expired')
  })

  it('survives a weekend and a flat battery', () => {
    const friday = draft({ ...record, purpose: 'Typed on Friday evening' },
                         Date.now() - 3 * 24 * 60 * 60 * 1000)
    expect(offerVerdict(friday, record)).toBe('offer')
  })

  it('has nothing to say when there is no draft', () => {
    expect(offerVerdict(null, record)).toBe('none')
    expect(offerVerdict({ at: NaN as any, value: record }, record)).toBe('none')
  })
})

describe('telling somebody when they typed it', () => {
  it('says today in plain time', () => {
    const now = new Date(2026, 8, 16, 17, 30).getTime()
    expect(draftWhen(new Date(2026, 8, 16, 16, 52).getTime(), now)).toMatch(/^at .* today$/)
  })

  it('names the day when it was not today', () => {
    const now = new Date(2026, 8, 16, 9, 0).getTime()
    // en-AU writes it "on Fri, 11 Sept at 04:52 pm".
    expect(draftWhen(new Date(2026, 8, 11, 16, 52).getTime(), now)).toMatch(/^on \w{3},? \d+ \w+ at /)
  })
})

// ---------------------------------------------------------------------------

describe('how the forms use it', () => {
  const DIR = 'app/(app)/deals/[id]/'
  const TABS: [string, string][] = [
    ['FactFindForm.tsx', 'fact_find_data'],
    ['BCForm.tsx', 'bc_data'],
    ['LOForm.tsx', 'lo_data'],
    ['ComplianceForm.tsx', 'compliance_data'],
  ]

  for (const [file, column] of TABS) {
    const src = readFileSync(DIR + file, 'utf8')

    it(`${file} keeps a copy against its own column and its own user`, () => {
      expect(src).toContain(`column: '${column}'`)
      expect(src).toContain('meId: me?.id')
      expect(src).toContain('draft.keep(')
    })

    it(`${file} throws the copy away the moment the save lands`, () => {
      expect(src, 'a stale draft would be offered back after a successful save')
        .toContain('draft.clear()')
    })

    it(`${file} offers the draft rather than applying it`, () => {
      expect(src).toContain('<DraftBanner at={draft.offer.at}')
      expect(src).toContain('onDiscard={draft.dismiss}')
    })

    it(`${file} never writes a draft to the database`, () => {
      // Restoring puts it on screen. The ordinary autosave takes it from there,
      // through every guard it always goes through.
      const code = src.replace(/\/\/[^\n]*/g, '')
      expect(code).not.toMatch(/saveGuarded\([^)]*draft/)
      expect(code).not.toMatch(/draft\.offer[^)]*\.update\(/)
    })
  }

  it('the internal notes box keeps one too', () => {
    // Its own save path - a 900ms debounce, no keepalive - so the same hole was
    // open there after the four tabs closed theirs. It is on every deal page and
    // it has form: per scripts/ship.sh, it once "destroyed a note on one
    // keystroke".
    const notes = readFileSync('components/InternalNotes.tsx', 'utf8')
    expect(notes).toContain("column: 'internal_notes'")
    expect(notes).toContain('draft.keep(v)')
    expect(notes).toContain('draft.clear()')
    expect(notes).toContain('<DraftBanner at={draft.offer.at}')
  })

  it('every place that renders the notes box hands it the user', () => {
    // No user id, no draft. A box rendered without one silently loses its net.
    for (const f of ['app/(app)/deals/[id]/FactFindForm.tsx', 'components/InternalNotesStrip.tsx']) {
      expect(readFileSync(f, 'utf8'), `${f} renders the notes box without a user`)
        .toMatch(/<InternalNotes [^>]*meId=/)
    }
    expect(readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8'))
      .toMatch(/<InternalNotesStrip[\s\S]{0,200}meId=/)
  })

  it('the notes box does not float over what is underneath it', () => {
    // It was sticky, so it sat on top of the documents list as that scrolled
    // past. Fabio, 16 Sep 2026: "it rolls over everything underneath."
    const notes = readFileSync('components/InternalNotes.tsx', 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(notes, 'the notes card is pinned again and will cover the documents')
      .not.toMatch(/className="[^"]*\bsticky\b/)
  })

  it('the hook wraps every touch of localStorage', () => {
    const hook = readFileSync('components/useDraft.ts', 'utf8')
    // It throws in a private window, with site data blocked, and when full. A
    // form that cannot keep a draft still has to work perfectly.
    const bodies = hook.split('try {').length - 1
    expect(bodies, 'a localStorage call is not wrapped').toBeGreaterThanOrEqual(3)
  })
})
