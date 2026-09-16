import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { indicatorLine, plainFailure, stampNow, FALLBACK_FAILURE, SLOW_SAVE_MS } from './save-indicator'

// THE LINE HAS TO BE ABOUT THE WORK ON SCREEN.
//
// The old one said "Autosaved 10:42" and only ever moved when a save SUCCEEDED,
// so it said the same thing after ten minutes of unsaved typing as it did the
// second a save landed. These are the rules that stop it doing that again.

describe('what the save line says', () => {
  it('says everything is saved when nothing has been typed yet', () => {
    expect(indicatorLine({ stage: 'clean' })).toMatchObject({ tone: 'quiet', text: 'All changes saved' })
  })

  it('puts a time on it only once a save has carried something', () => {
    expect(indicatorLine({ stage: 'clean', at: '10:52' }).text).toBe('Saved 10:52')
  })

  it('stops claiming to be saved the moment something changes', () => {
    const line = indicatorLine({ stage: 'saving', at: '10:52' })
    expect(line.text).toBe('Saving…')
    // The old time must not survive into the new line - that IS the bug.
    expect(line.text).not.toContain('10:52')
  })

  it('goes loud, not quiet, when a save is late', () => {
    const line = indicatorLine({ stage: 'slow', at: '10:52' })
    expect(line.tone).toBe('warn')
    expect(line.text).toMatch(/keep this tab open/i)
    expect(line.text).not.toContain('10:52')
  })

  it('goes loudest when a save failed, and never shows a saved time beside it', () => {
    const line = indicatorLine({ stage: 'failed', at: '10:52', message: 'Something went wrong.' })
    expect(line.tone).toBe('bad')
    expect(line.text).toMatch(/NOT SAVED/)
    expect(line.text).not.toContain('10:52')
    expect(line.note).toBe('Something went wrong.')
  })

  it('still tells somebody what to do when the failure arrived with no words', () => {
    expect(indicatorLine({ stage: 'failed' }).note).toBe(FALLBACK_FAILURE)
  })

  it('gives a late save long enough not to cry wolf on a slow morning', () => {
    expect(SLOW_SAVE_MS).toBeGreaterThanOrEqual(5000)
    expect(SLOW_SAVE_MS).toBeLessThanOrEqual(15000)
  })

  it('stamps the time the way the rest of the portal writes it', () => {
    // en-AU gives "09:05 am", which is what every other stamp in the portal
    // already looks like. Tested so nobody quietly switches it to 24 hour and
    // leaves the settlement panel and the targets pages reading differently.
    expect(stampNow(new Date(2026, 8, 16, 9, 5))).toMatch(/^\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i)
  })
})

describe('turning a failure into a sentence', () => {
  it('never shows a person a raw database error as the explanation', () => {
    const out = plainFailure(
      'NOT SAVED - new row violates row-level security policy for table "deals"',
      'new row violates row-level security policy for table "deals"')
    expect(out.message).toBe(FALLBACK_FAILURE)
    expect(out.message).not.toMatch(/row-level security/)
    // Kept, small and grey, so it can still reach Fabio.
    expect(out.technical).toMatch(/row-level security/)
  })

  it('leaves a message that was already written for a person alone', () => {
    const wipe = 'NOT SAVED - this would have emptied most of the BC (40 things filled in, 2 left). '
               + 'Nothing has been changed. Reload the page to get your work back on screen, and tell Fabio this happened.'
    const out = plainFailure(wipe)
    expect(out.message).toMatch(/^this would have emptied most of the BC/)
    expect(out.technical).toBeUndefined()
  })

  it('does not repeat NOT SAVED under a pill that already says it', () => {
    expect(plainFailure('NOT SAVED - your changes did not reach the database. Do not close this tab.').message)
      .toBe('your changes did not reach the database. Do not close this tab.')
  })
})

// ---------------------------------------------------------------------------
// The wiring. Four tabs, one story.

const DIR = 'app/(app)/deals/[id]/'
const TABS = ['FactFindForm.tsx', 'BCForm.tsx', 'LOForm.tsx', 'ComplianceForm.tsx']
const read = (f: string) => readFileSync(DIR + f, 'utf8')

describe('all four tabs report through the same indicator', () => {
  for (const file of TABS) {
    it(`${file} uses the shared save indicator`, () => {
      const src = read(file)
      expect(src, `${file} does not use useSaveIndicator, so it tells its own story`)
        .toContain('useSaveIndicator(onSaveStatus)')
    })

    it(`${file} says so the moment something changes, not only when a save lands`, () => {
      expect(read(file), `${file} never calls save.changed(), so its line goes stale while somebody types`)
        .toContain('save.changed()')
    })

    it(`${file} reports the outcome of every write`, () => {
      const src = read(file)
      expect(src).toContain('save.starting()')
      expect(src).toContain('save.landed(token')
      expect(src).toContain('save.failed(')
    })

    it(`${file} no longer stamps a time of its own`, () => {
      const src = read(file)
      // A form writing its own clock is how "Autosaved 10:42" outlived the work
      // it was describing.
      expect(src.replace(/\/\/[^\n]*/g, '')).not.toMatch(/setSavedAt|setSaveError/)
    })
  }

  it('the deal page shows one indicator and words none of it itself', () => {
    const src = readFileSync(DIR + 'DealPageClient.tsx', 'utf8')
    expect(src).toContain('<SaveIndicator status={saveStatus} />')
    expect(src).toContain('<SaveIndicatorNote status={saveStatus} />')
    expect(src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')).not.toMatch(/Autosaved/)
  })
})
