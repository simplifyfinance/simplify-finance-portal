import { describe, it, expect } from 'vitest'
import { handoverFileName, parseRuns, parseBlocks, plainText, hasContent,
         NEEDS_BOXES, COMMENT_BOXES, boxFitsOnAPage, estimateBoxHeight, PAGE_BUDGET } from './handover'

describe('what the file is called', () => {
  it('is named for the people, not the deal record', () => {
    expect(handoverFileName(['Natasha Chapman', 'Richard Chapman']))
      .toBe('Handover - Natasha Chapman & Richard Chapman.pdf')
    expect(handoverFileName(['Solo Buyer'])).toBe('Handover - Solo Buyer.pdf')
    expect(handoverFileName(['A One', 'B Two', 'C Three']))
      .toBe('Handover - A One, B Two & C Three.pdf')
  })

  it('falls back to the deal name, readably', () => {
    expect(handoverFileName([], 'Natasha_Chapman_Purchase_2026'))
      .toBe('Handover - Natasha Chapman Purchase 2026.pdf')
    expect(handoverFileName([])).toBe('Handover - Deal.pdf')
  })

  it('strips only what a file system will not take', () => {
    expect(handoverFileName(['A/B C:D'])).toBe('Handover - A-B C-D.pdf')
  })
})

describe('the markdown the AI writes', () => {
  it('turns **bold** into a bold run', () => {
    expect(parseRuns('Richard has **$446,428.63 per annum**, a strong salary.')).toEqual([
      { text: 'Richard has ', bold: false },
      { text: '$446,428.63 per annum', bold: true },
      { text: ', a strong salary.', bold: false },
    ])
  })

  it('handles a whole line in bold', () => {
    expect(parseRuns('**ANALYSIS**')).toEqual([{ text: 'ANALYSIS', bold: true }])
  })

  it('leaves an unmatched pair as typed rather than eating the rest of the line', () => {
    expect(parseRuns('A 5% ** rise and then some')).toEqual([
      { text: 'A 5% ** rise and then some', bold: false },
    ])
  })

  it('splits on blank lines and keeps the rules', () => {
    const blocks = parseBlocks('**ANALYSIS**\n\nFirst.\n\n---\n\n**EDUCATION**\n\nSecond.')
    expect(blocks.map(b => b.kind)).toEqual(['para', 'para', 'rule', 'para', 'para'])
  })

  it('gives nothing back for an empty field', () => {
    expect(parseBlocks('')).toEqual([])
    expect(parseBlocks(null)).toEqual([])
    expect(hasContent('   ')).toBe(false)
    expect(hasContent('x')).toBe(true)
  })

  it('reads back as plain text with no asterisks', () => {
    // This is the whole point: paste into SalesTrekker and get clean words.
    expect(plainText('**ANALYSIS**\n\nA loan of **$1.7m**.')).toBe('ANALYSIS\n\nA loan of $1.7m.')
  })
})

describe('the boxes', () => {
  it('has a label for every box and no duplicates', () => {
    const all = [...NEEDS_BOXES, ...COMMENT_BOXES]
    expect(all.every(b => b.label && b.key)).toBe(true)
    expect(new Set(all.map(b => b.key)).size).toBe(all.length)
  })
  it('keeps ownership next to security, where the same question is asked twice', () => {
    const keys = COMMENT_BOXES.map(b => b.key)
    expect(keys.indexOf('__title')).toBe(keys.indexOf('securityComment') + 1)
  })
})

// A box is kept whole so the team can paste it into SalesTrekker in one go.
// Only a box that is taller than a page is allowed to break, because a box kept
// whole with nowhere to go draws on top of itself.
describe('boxFitsOnAPage', () => {
  it('keeps a normal answer whole', () => {
    const blocks = parseBlocks('Clients are seeking to upgrade their owner occupied home.\n\nThey will sell the existing home and use the net proceeds.')
    expect(boxFitsOnAPage(blocks)).toBe(true)
  })

  it('lets a box longer than a page break', () => {
    const para = 'x'.repeat(900)
    const blocks = parseBlocks(Array(8).fill(para).join('\n\n'))
    expect(estimateBoxHeight(blocks)).toBeGreaterThan(PAGE_BUDGET)
    expect(boxFitsOnAPage(blocks)).toBe(false)
  })

  it('counts an empty box as fitting', () => {
    expect(boxFitsOnAPage(parseBlocks(''))).toBe(true)
  })
})
