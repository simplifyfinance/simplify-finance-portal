import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE BRIDGING EMAIL CALLED THE WRONG NUMBER THE PEAK DEBT.
//
// 30 Sep 2026. The row printed splits[0] - the BRIDGING LOAN - under the label
// "Bridging loan (peak debt)". On Marcelo Valerio's deal that was $935,000 in a
// place where $1,562,983.81 belonged: the bridge and the end debt together, plus
// twelve months of capitalised interest.
//
// Every bridging email sent before today understated it by whatever that
// interest came to.

const route = readFileSync('app/api/generate-email/route.ts', 'utf8')
const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

describe('the bridging loan is called the bridging loan', () => {
  it('no longer wears the peak debt label', () => {
    expect(route,
      'splits[0] is the bridging loan - calling it the peak debt was the bug')
      .not.toContain("row('Bridging loan (peak debt)'")
    expect(route).toContain("row('Bridging loan', money(d.splits?.[0]?.amount))")
  })
})

describe('the peak debt is typed', () => {
  it('is a field on the bridging scenario', () => {
    expect(form).toContain('peakDebt')
    expect(form).toContain('label="Peak debt"')
  })

  // NOTHING CALCULATES IT. Fabio, 30 Sep 2026: "I want just a box labeleld Peak
  // Debt where the team adds the figures (system dont check)". The capitalised
  // interest is often not a figure anybody has, so a computed peak debt would be
  // a guess on a client email.
  it('and nothing works it out or argues with it', () => {
    expect(route).not.toMatch(/peakDebt\s*=\s*[^;]*\+/)
    expect(route).not.toContain('peakDebtCheck')
  })

  it('is read off the deal, never from anywhere else', () => {
    expect(route).toContain('readMoney(d.peakDebt)')
  })

  // A ROW THAT SAYS "Peak debt —" IS WORSE THAN NO ROW.
  it('leaves the row out entirely when nobody has typed one', () => {
    expect(route).toMatch(/\(readMoney\(d\.peakDebt\) \|\| 0\) > 0[\s\S]{0,600}: ''\)/)
  })

  // THE COLUMN HAS TO SURVIVE BEING READ TOP TO BOTTOM. 935 and 527 do not come
  // to 1,563, so the difference has to be explained where the figure is.
  it('says where the difference comes from, under the figure', () => {
    const i = route.indexOf("row('Peak debt'")
    expect(i).toBeGreaterThan(-1)
    const after = route.slice(i, i + 700)
    expect(after).toContain('bridging loan and end debt combined')
    expect(after).toContain('capitalised over the bridging period')
  })

  it('and it survives a reload, like every other typed figure', () => {
    expect(form).toContain('peakDebt: setPeakDebt')
  })
})
