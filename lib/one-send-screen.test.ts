import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { TEMPLATES } from './milestone-emails'

// ONE SEND SCREEN, TWO DOORS INTO IT.
//
// The milestone emails are reachable from the deal card and from the Templates
// page. The tempting shortcut is a second screen on the Templates side, and it
// would drift: the one on the deal would get the next fix and the other would
// keep the bug. That is the mistake this codebase has paid for more than once -
// the lender name, the duty state, the settings menu.

const strip = readFileSync('components/MilestoneEmails.tsx', 'utf8')
const door = readFileSync('components/MilestoneFromTemplates.tsx', 'utf8')
const page = readFileSync('app/(app)/templates/TemplatesClient.tsx', 'utf8')

describe('the Templates page opens the screen that already exists', () => {
  it('the screen is exported rather than copied', () => {
    expect(strip).toContain('export function SendScreen')
  })

  it('and the Templates door imports it', () => {
    expect(door).toContain("import { SendScreen } from '@/components/MilestoneEmails'")
    expect(door).toContain('<SendScreen')
  })

  // THE GUARD. A second screen over here is the failure this test exists for.
  it('and does not build one of its own', () => {
    expect(door).not.toContain('function SendScreen')
    expect(door).not.toContain('send-milestone-email')
  })
})

describe('the three on the page are the three on the deal', () => {
  it('come from the one list, so neither side can gain or lose one', () => {
    expect(page).toContain("from '@/lib/milestone-emails'")
    expect(page).toContain('MILESTONE_TEMPLATES.map(')
  })

  it('and every one of them has words on the card', () => {
    for (const t of TEMPLATES) {
      expect(page, `${t.id} has no blurb on the Templates page`).toContain(`${t.id}:`)
    }
  })
})

describe('the picker behaves like the strip on the deal', () => {
  it('lists what cannot send yet rather than hiding it', () => {
    expect(door).toContain("item?.state !== 'not_yet'")
    expect(door).toContain('item?.note')
  })

  it('ready first, then sent, then not yet', () => {
    expect(door).toContain("s === 'ready' ? 0 : s === 'sent' ? 1 : 2")
  })

  it('and never offers a test deal as if it were business', () => {
    expect(door).toContain('realDealsOnly(')
  })
})
