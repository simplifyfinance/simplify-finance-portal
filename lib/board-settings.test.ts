import { describe, it, expect } from 'vitest'
import {
  readBoardSettings, readThresholds, thresholdsFromDraft, draftFromThresholds,
  boardSettingsToSave, brokerColourMap, tooPaleForWhiteText, normHex, SWATCHES,
  AGED_PHASES,
} from './board-settings'
import { DEFAULT_THRESHOLDS } from './deal-age'
import { chipsFor, brokerColour } from './deal-labels'

describe('nothing saved behaves exactly as today', () => {
  it('an absent settings row gives the code defaults', () => {
    const s = readBoardSettings(null)
    expect(s.type).toEqual({})
    expect(s.use).toEqual({})
    expect(s.thresholds).toEqual(DEFAULT_THRESHOLDS)
  })

  it('rubbish in the column does not throw or half-apply', () => {
    expect(readBoardSettings('nonsense').thresholds).toEqual(DEFAULT_THRESHOLDS)
    expect(readBoardSettings({ type: 5, use: [], thresholds: 'x' }).thresholds).toEqual(DEFAULT_THRESHOLDS)
  })

  it('an empty override object still paints the default chip', () => {
    const deal = { bc_data: { template: 'oo_purchase' } }
    const plain = chipsFor(deal)
    const withEmpty = chipsFor(deal, readBoardSettings(null))
    expect(withEmpty).toEqual(plain)
  })
})

describe('colours', () => {
  it('a chosen colour reaches the chip', () => {
    const s = readBoardSettings({ type: { purchase: '#123456' } })
    const chips = chipsFor({ bc_data: { template: 'oo_purchase' } }, s)
    expect(chips.find(c => c.id === 'purchase')?.colour).toBe('#123456')
  })

  it('an invalid hex is ignored rather than painted', () => {
    const s = readBoardSettings({ type: { purchase: 'blue', refinance: '#12345' } })
    expect(s.type.purchase).toBeUndefined()
    expect(s.type.refinance).toBeUndefined()
  })

  it('a colour equal to the default is not written down', () => {
    // Otherwise changing a default in code later would never reach anyone.
    const saved = boardSettingsToSave({ purchase: '#0E6FA0' }, {}, {})
    expect(saved.type).toEqual({})
  })

  it('unknown has no chip so it can never be given a colour', () => {
    const saved = boardSettingsToSave({ unknown: '#111111' }, { unknown: '#222222' }, {})
    expect(saved.type.unknown).toBeUndefined()
    expect(saved.use.unknown).toBeUndefined()
  })
})

describe('broker colours', () => {
  it('a broker with a colour uses it; one without keeps the guess', () => {
    const map = brokerColourMap([
      { broker_key: 'Fabio', colour: '#3b5ba5' },
      { broker_key: 'mark', colour: null },
    ])
    expect(map).toEqual({ fabio: '#3B5BA5' })
    expect(brokerColour('fabio', map)).toBe('#3B5BA5')
    // mark is not in the map, so the stable guess still answers - the board has
    // never needed a colour to be set and still does not.
    expect(brokerColour('mark', map)).toBe(brokerColour('mark'))
  })

  it('a broker row with junk in the colour column is skipped', () => {
    expect(brokerColourMap([{ broker_key: 'x', colour: 'red' }])).toEqual({})
  })
})

describe('the contrast guard', () => {
  it('every swatch carries white initials', () => {
    for (const s of SWATCHES) expect(tooPaleForWhiteText(s)).toBe(false)
  })
  it('a pale yellow is called out', () => {
    expect(tooPaleForWhiteText('#F2C94C')).toBe(true)
    expect(tooPaleForWhiteText('#FFFFFF')).toBe(true)
  })
  it('a half-typed hex is not yet wrong', () => {
    expect(tooPaleForWhiteText('#F2C')).toBe(false)
    expect(tooPaleForWhiteText('')).toBe(false)
  })
  it('normHex is case-insensitive and trims', () => {
    expect(normHex('  #abcdef ')).toBe('#ABCDEF')
    expect(normHex('#abcde')).toBeNull()
  })
})

describe('thresholds', () => {
  it('a saved number overrides the default for that column only', () => {
    const t = readThresholds({ thresholds: { lodged: { long: 1, nudge: 2 } } })
    expect(t.lodged).toEqual({ long: 1, nudge: 2 })
    expect(t.bc).toEqual(DEFAULT_THRESHOLDS.bc)
  })

  it('null turns a column off - it does NOT fall back to the default', () => {
    // This is the whole point of writing null explicitly. If it fell back, there
    // would be no way to stop ageing a column at all.
    const t = readThresholds({ thresholds: { lodged: null } })
    expect(t.lodged).toBeUndefined()
    expect(t.bc).toEqual(DEFAULT_THRESHOLDS.bc)
  })

  it('an empty box turns the column off the same way', () => {
    const t = readThresholds({ thresholds: { bc: { long: '', nudge: '5' } } })
    expect(t.bc).toBeUndefined()
  })

  it('red can never come before amber', () => {
    // Typing amber 5 / red 3 would otherwise make a card turn red and then go
    // back to amber the next day.
    const t = readThresholds({ thresholds: { bc: { long: 5, nudge: 3 } } })
    expect(t.bc).toEqual({ long: 5, nudge: 5 })
  })

  it('a negative or non-numeric day count turns the column off rather than ageing backwards', () => {
    expect(readThresholds({ thresholds: { bc: { long: -2, nudge: 5 } } }).bc).toBeUndefined()
    expect(readThresholds({ thresholds: { bc: { long: 'soon', nudge: 5 } } }).bc).toBeUndefined()
  })

  it('formal ships off and stays off unless someone fills it in', () => {
    expect(readThresholds(null).formal).toBeUndefined()
    expect(readThresholds({ thresholds: { formal: { long: 10, nudge: 20 } } }).formal)
      .toEqual({ long: 10, nudge: 20 })
  })

  it('settled and lost are never editable - they are off the clock by definition', () => {
    expect(AGED_PHASES).not.toContain('settled')
    expect(AGED_PHASES).not.toContain('lost')
    // Even if something wrote them, they are not read back.
    const t = readThresholds({ thresholds: { settled: { long: 1, nudge: 2 } } })
    expect((t as any).settled).toBeUndefined()
  })
})

describe('the editor round-trips', () => {
  it('load, save, reload gives back what was on screen', () => {
    const draft = draftFromThresholds(DEFAULT_THRESHOLDS)
    expect(draft.bc).toEqual({ long: '3', nudge: '5' })
    expect(draft.formal).toEqual({ long: '', nudge: '' })

    const saved = boardSettingsToSave({ purchase: '#123456' }, { investment: '#654321' }, draft)
    const back = readBoardSettings(saved)
    expect(back.thresholds).toEqual(DEFAULT_THRESHOLDS)
    expect(back.type.purchase).toBe('#123456')
    expect(back.use.investment).toBe('#654321')
  })

  it('clearing a column on screen switches it off after a save', () => {
    const draft = draftFromThresholds(DEFAULT_THRESHOLDS)
    draft.lodged = { long: '', nudge: '' }
    const back = readBoardSettings(boardSettingsToSave({}, {}, draft))
    expect(back.thresholds.lodged).toBeUndefined()
    expect(back.thresholds.bc).toEqual(DEFAULT_THRESHOLDS.bc)
  })

  it('every aged column is written on save, so an off column stays off', () => {
    const out = thresholdsFromDraft(draftFromThresholds(DEFAULT_THRESHOLDS))
    for (const p of AGED_PHASES) expect(p in out).toBe(true)
    expect(out.formal).toBeNull()
  })
})
