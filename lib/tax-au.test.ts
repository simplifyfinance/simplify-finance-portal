import { describe, it, expect } from 'vitest'
import {
  fyForDate, fysInPeriod, dominantFy, scaleForFy,
  incomeTax, medicareLevy, lowIncomeOffset, netFromGross, grossFromNet,
} from './tax-au'

const S2526 = scaleForFy('2025-26').scale
const S2627 = scaleForFy('2026-27').scale

describe('financial year', () => {
  it('turns over on 1 July', () => {
    expect(fyForDate('2026-06-30')).toBe('2025-26')
    expect(fyForDate('2026-07-01')).toBe('2026-27')
    expect(fyForDate('2026-12-31')).toBe('2026-27')
    expect(fyForDate('2027-01-01')).toBe('2026-27')
  })
  it('lists every year a period touches', () => {
    expect(fysInPeriod('2026-06-01', '2026-08-28')).toEqual(['2025-26', '2026-27'])
    expect(fysInPeriod('2026-07-01', '2026-09-30')).toEqual(['2026-27'])
  })
  it('picks the year holding most of the period', () => {
    // 30 days in FY25-26, 59 in FY26-27.
    expect(dominantFy('2026-06-01', '2026-08-28')).toBe('2026-27')
    expect(dominantFy('2026-04-01', '2026-07-10')).toBe('2025-26')
  })
})

describe('the rate scale', () => {
  it('taxes nothing under the tax-free threshold', () => {
    expect(incomeTax(18200, S2526).tax).toBe(0)
    expect(netFromGross(18200, S2526)).toBe(18200)
  })
  it('steps a $150,000 salary through every bracket', () => {
    const { tax } = incomeTax(150000, S2526)
    // 26,800 @ 16% + 90,000 @ 30% + 15,000 @ 37%
    expect(tax).toBeCloseTo(4288 + 27000 + 5550, 2)
  })
  it('drops the first bracket to 15% in FY 2026-27', () => {
    expect(incomeTax(45000, S2627).tax).toBeCloseTo(26800 * 0.15, 2)
    expect(incomeTax(45000, S2526).tax).toBeCloseTo(26800 * 0.16, 2)
  })
  it('shades in the Medicare levy rather than stepping it', () => {
    expect(medicareLevy(27222, S2526)).toBe(0)
    expect(medicareLevy(30000, S2526)).toBeCloseTo((30000 - 27222) * 0.10, 2)
    expect(medicareLevy(60000, S2526)).toBeCloseTo(1200, 2)
  })
  it('tapers the low income offset to nothing by $66,667', () => {
    expect(lowIncomeOffset(37500, S2526)).toBe(700)
    expect(lowIncomeOffset(45000, S2526)).toBeCloseTo(325, 2)
    expect(lowIncomeOffset(66667, S2526)).toBeCloseTo(0, 2)
    expect(lowIncomeOffset(90000, S2526)).toBe(0)
  })
  it('leaves $110,162 in hand on $150,000', () => {
    expect(netFromGross(150000, S2526)).toBeCloseTo(110162, 0)
  })
  it('never lets the offset create a refund', () => {
    expect(netFromGross(19000, S2526)).toBeLessThanOrEqual(19000)
    expect(netFromGross(19000, S2526)).toBe(19000)
  })
})

describe('grossing up', () => {
  it('is the exact inverse of the forward calculation', () => {
    for (const gross of [25000, 45000, 68000, 95000, 150000, 190000, 260000]) {
      const net = netFromGross(gross, S2526)
      expect(grossFromNet(net, '2025-26').gross).toBeCloseTo(gross, -1)
    }
  })
  it('turns $110,162 net back into $150,000 gross', () => {
    const up = grossFromNet(110162, '2025-26')
    expect(up.gross).toBeCloseTo(150000, -1)
    expect(up.medicare).toBeCloseTo(3000, 0)
    expect(up.offset).toBe(0)
  })
  it('rises with net, never falls', () => {
    let last = -1
    for (let net = 5000; net <= 300000; net += 5000) {
      const g = grossFromNet(net, '2025-26').gross
      expect(g).toBeGreaterThan(last)
      last = g
    }
  })
  it('returns zero for a client with no credits rather than guessing', () => {
    expect(grossFromNet(0, '2025-26').gross).toBe(0)
    expect(grossFromNet(-40, '2025-26').gross).toBe(0)
  })
  it('says so when it had to use a scale from a different year', () => {
    const up = grossFromNet(80000, '2040-41')
    expect(up.caveats.length).toBeGreaterThan(0)
    expect(up.caveats[0]).toMatch(/No published rate scale/)
  })
  it('warns about carried-forward levy thresholds only where they bite', () => {
    expect(grossFromNet(28000, '2026-27').caveats.join(' ')).toMatch(/Medicare levy thresholds/)
    expect(grossFromNet(120000, '2026-27').caveats.join(' ')).not.toMatch(/Medicare levy thresholds/)
  })
})
