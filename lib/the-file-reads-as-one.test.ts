// THE FILE NOTES TAB, AND THE PAGE YOU HAND AN AUDITOR.
//
// 29 Oct 2026. Fabio: "I do like a tab at the end that says file notes that we
// can actually one day, if we get audited, we can export as a PDF saying, hey,
// this is all the conversation, this is all the track record of the file."
//
// And, in the same breath, the thing this file mostly exists to hold: "I still
// want to make sure we're not double handling the file update box to the file
// notes."
//
// THERE IS ONE LOG. The box on the right and this tab are two windows onto the
// same rows, loaded once by the deal page and handed to both. If a second store
// ever appears, or the tab starts loading rows of its own, this fails.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { kindOf, FILTERS } from './file-note-kinds'

const TAB = readFileSync('components/FileNotesTab.tsx', 'utf8')
const PAGE = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
const CARDS = readFileSync('components/DealTabCards.tsx', 'utf8')
const PDF = readFileSync('app/api/generate-file-notes-pdf/route.tsx', 'utf8')
const FILE = readFileSync('components/DealFile.tsx', 'utf8')

const codeOnly = (src: string) =>
  src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('the tab is a second window, never a second store', () => {
  it('IT LOADS NOTHING OF ITS OWN', () => {
    // The whole of "not double handling", in one assertion.
    expect(codeOnly(TAB), 'the tab fetches its own notes').not.toContain("from('deal_notes')")
    expect(codeOnly(TAB), 'the tab has its own supabase client').not.toContain('createSupabaseBrowser')
  })

  it('it is handed the same array the rail is handed', () => {
    expect(PAGE).toContain('<FileNotesTab notes={notes}')
    expect(PAGE).toContain('<FileNotes dealId={dealData.id} me={me} notes={notes}')
  })

  it('and it cannot change an entry', () => {
    // A log somebody can tidy up proves nothing about what happened.
    for (const word of ['.update(', '.delete(', '.insert(']) {
      expect(codeOnly(TAB), `the tab can ${word} an entry`).not.toContain(word)
    }
  })

  it('adding a line stays in the one box that always did it', () => {
    expect(FILE).toContain("from('deal_notes').insert(")
    expect(TAB).toContain('Add a line from the box on the right.')
  })
})

describe('the sixth tab', () => {
  it('is on the list, named File notes', () => {
    expect(CARDS).toContain("{ key: 'FileNotes', label: 'File notes' }")
  })

  it('and the page will actually open it', () => {
    // A tab on the list that the page refuses to render is the fault
    // lib/settings-panes.test.ts was written for, one screen along.
    expect(PAGE).toContain("'FileNotes'")
    expect(PAGE).toContain("stage === 'FileNotes'")
  })

  it('the row of cards was widened to fit it', () => {
    // Six tabs in a five-column grid puts one on a line of its own.
    expect(CARDS).toContain('grid-cols-[repeat(6,minmax(0,1fr))_minmax(0,1.45fr)]')
  })

  it('and it has an icon like the other five', () => {
    expect(CARDS).toContain('FileNotes: History')
  })
})

describe('what kind of entry it is', () => {
  const note = (over: any) => ({ kind: 'system', body: '', detail: null, ...over })

  it('anything a person typed is theirs, whatever it says', () => {
    expect(kindOf(note({ kind: 'note', body: 'Emailed the client' }))).toBe('typed')
  })

  it('an entry carrying the wording of an email IS an email', () => {
    // The sentence can be phrased a hundred ways. The wording being there cannot.
    expect(kindOf(note({ body: 'anything at all', detail: 'BORROWING CAPACITY SENT' }))).toBe('email')
  })

  it('and one that only says it was emailed still counts', () => {
    expect(kindOf(note({ body: 'Borrowing capacity emailed to priya@example.com' }))).toBe('email')
  })

  it('the client doing something is its own kind', () => {
    expect(kindOf(note({ body: 'Client agreed to proceed on the borrowing capacity, from the email.' })))
      .toBe('client')
    expect(kindOf(note({ body: 'Priya answered 3 of 4 questions through the client link.' })))
      .toBe('client')
  })

  it('and everything else the portal wrote is the portal', () => {
    expect(kindOf(note({ body: 'Fact Find unlocked by Melissa Sedin.' }))).toBe('portal')
  })

  it('every filter has a name and they are all distinct', () => {
    expect(FILTERS[0].key).toBe('all')
    expect(new Set(FILTERS.map(f => f.key)).size).toBe(FILTERS.length)
    for (const f of FILTERS) expect(f.label.trim().length).toBeGreaterThan(0)
  })

  it('nothing throws on a row with nothing in it', () => {
    expect(() => kindOf({} as any)).not.toThrow()
    expect(kindOf({} as any)).toBe('typed')
  })
})

describe('the PDF you hand an auditor', () => {
  it('is OLDEST first, which is the opposite of the screen', () => {
    // The screen is for working the deal. A record read end to end is the other
    // way round.
    expect(PDF).toContain("order('created_at', { ascending: true })")
  })

  it('AND IT CARRIES NO FILTER AT ALL', () => {
    // A file note with a filter on it is not a file note.
    const load = PDF.slice(PDF.indexOf("from('deal_notes')"))
    expect(load.slice(0, 220), 'the export is filtering entries out').not.toContain('.eq(\'kind\'')
    expect(load.slice(0, 220), 'the export stops short of the whole file').not.toContain('.limit(')
  })

  it('it says what it is, and on every page', () => {
    expect(PDF).toContain('Australian Credit Licence 387025')
    expect(PDF).toContain('LICENCE_HOLDER')
    expect(PDF).toContain('Printed ')
    expect(PDF).toContain('fixed')
    expect(PDF).toContain('pageNumber')
  })

  it('the hour is Melbourne, not the server', () => {
    // The server is in UTC. Every time on the page would be wrong by eleven
    // hours and nothing would say so.
    expect(PDF).toContain("const AU = 'Australia/Melbourne'")
    expect(PDF).toContain('timeZone: AU')
  })

  it('and it prints the wording that was stored, never a rebuild', () => {
    expect(PDF).toContain('String(n.detail)')
    expect(codeOnly(PDF), 'the export is rebuilding the emails').not.toContain('emailAsText')
  })

  it('it is read as the person asking for it, not with the master key', () => {
    // An internal document about one deal. Only somebody who can open that deal
    // may print it.
    expect(PDF).toContain('createSupabaseServer')
    expect(PDF, 'the export uses the key that bypasses row level security')
      .not.toContain('createSupabaseAdmin')
  })

  it('AND IT ASKS WHO IS CALLING, OUT LOUD', () => {
    // This shipped the first time relying on the database rules alone, and
    // lib/every-door-is-locked.test.ts refused it. middleware.ts deliberately
    // skips /api, so an API route is protected only if it protects itself -
    // and a whole file of somebody's conversations is not a thing to leave to
    // a query that somebody might change.
    expect(PDF).toContain('auth.getUser()')
    expect(PDF).toContain("status: 401")
    expect(PDF.indexOf('auth.getUser()'),
      'the deal is read before anybody is asked who they are')
      .toBeLessThan(PDF.indexOf("from('deals')"))
  })

  it('and an empty file prints as an empty file, not as an error', () => {
    expect(PDF).toContain('Nothing has been recorded against this deal.')
  })
})
