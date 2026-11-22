import { describe, it, expect } from 'vitest'
import {
  whySimpleCannot, businessesIn, whatIsMissing, yearsCovered, twoYears,
  type ReadDocument,
} from './tax-documents'
import { columnsFor, leftOut, LINES, type Year } from './se-comparison'

// THE SIMPLE READER KNOWS ITS LIMITS.
//
// 22 Nov 2026. Fabio, before a line of this existed: "SIMPLE ONLY read company
// and individual, doesnt read trust, multiple entities etc - so we need to
// GUIDE my team."
//
// Two halves, both here. The reader stopping when it should, and the
// comparison showing only the readings that actually apply.

const doc = (p: Partial<ReadDocument>): ReadDocument => ({
  fileName: 'x.pdf', kind: 'individual_return', entityName: '', abn: '', years: [], ...p,
})

const YEAR = (fy: string, salary: number, netProfit: number, depreciation = 0): Year => ({
  fy, salary, netProfit, depreciation, interest: 0, superannuation: 0, oneOff: 0, other: 0,
})

// ===========================================================================
// WHEN IT STOPS
// ===========================================================================

describe('a trust stops it', () => {
  const docs = [
    doc({ kind: 'individual_return', entityName: 'Amy Ferraro', years: [{ fy: '2024/25' } as any] }),
    doc({ kind: 'company_financials', entityName: 'Ferraro Carpentry Pty Ltd', abn: '61004982117' }),
    doc({ kind: 'trust_return', entityName: 'Ferraro Family Trust' }),
  ]

  it('and says so rather than reading the other three', () => {
    const stop = whySimpleCannot(docs)
    expect(stop).not.toBeNull()
    expect(stop!.title).toBe('This one needs the complex route')
  })

  it('it names the trust, so nobody has to go looking for it', () => {
    expect(whySimpleCannot(docs)!.why).toContain('Ferraro Family Trust')
  })

  // THE REASON, NOT JUST THE RULE. A person told "unsupported document type"
  // learns nothing; a person told why learns the thing that matters.
  it('and says why it matters', () => {
    expect(whySimpleCannot(docs)!.why).toContain("can be most of somebody's income")
  })

  it('with a way to carry on without it', () => {
    expect(whySimpleCannot(docs)!.without).toBe('Remove the trust return and carry on')
  })
})

describe('a partnership stops it too', () => {
  it('for the same reason, in its own words', () => {
    const stop = whySimpleCannot([doc({ kind: 'partnership_return', entityName: 'Ferraro & Co' })])
    expect(stop!.why).toContain('partnership')
    expect(stop!.without).toContain('partnership')
  })
})

describe('two businesses stop it', () => {
  const two = [
    doc({ kind: 'company_financials', entityName: 'Ferraro Carpentry Pty Ltd', abn: '61004982117' }),
    doc({ kind: 'company_financials', entityName: 'Ferraro Joinery Pty Ltd', abn: '27118552913' }),
  ]

  it('and both are named', () => {
    const why = whySimpleCannot(two)!.why
    expect(why).toContain('Ferraro Carpentry Pty Ltd')
    expect(why).toContain('Ferraro Joinery Pty Ltd')
  })

  it('because the share of each is a judgement, not a reading', () => {
    expect(whySimpleCannot(two)!.why).toContain('a judgement, not a reading')
  })

  it('and it offers to read the first one alone', () => {
    expect(whySimpleCannot(two)!.without).toBe('Read Ferraro Carpentry Pty Ltd only')
  })
})

// THE SAME COMPANY, SPELLED TWO WAYS, IS ONE COMPANY.
//
// A set of financials and a company return for the same business will not
// always write its name the same way. Matching on the name alone would make
// every deal with both documents look like two businesses and stop a reader
// that should have carried on.
describe('one business written two ways is still one business', () => {
  it('matched on the ABN', () => {
    const docs = [
      doc({ kind: 'company_financials', entityName: 'Ferraro Carpentry Pty Ltd', abn: '61004982117' }),
      doc({ kind: 'company_return', entityName: 'FERRARO CARPENTRY P/L', abn: '61004982117' }),
    ]
    expect(businessesIn(docs)).toHaveLength(1)
    expect(whySimpleCannot(docs)).toBeNull()
  })

  it('and where there is no ABN, on the name', () => {
    const docs = [
      doc({ kind: 'company_financials', entityName: 'Ferraro Carpentry Pty Ltd' }),
      doc({ kind: 'company_return', entityName: 'ferraro carpentry pty ltd' }),
    ]
    expect(businessesIn(docs)).toHaveLength(1)
  })
})

describe('a clean set does not stop it', () => {
  it('two individual returns and one company', () => {
    expect(whySimpleCannot([
      doc({ kind: 'individual_return', entityName: 'Amy Ferraro' }),
      doc({ kind: 'individual_return', entityName: 'Amy Ferraro' }),
      doc({ kind: 'company_financials', entityName: 'Ferraro Carpentry Pty Ltd', abn: '61004982117' }),
      doc({ kind: 'notice_of_assessment', entityName: 'Amy Ferraro' }),
    ])).toBeNull()
  })

  it('and neither does nothing at all', () => {
    expect(whySimpleCannot([])).toBeNull()
  })
})

// A TRUST AND TWO COMPANIES IS A TRUST PROBLEM FIRST. It is the one that
// silently loses income, so it is the one named.
describe('when there is more than one thing wrong', () => {
  it('the trust is what it says', () => {
    const why = whySimpleCannot([
      doc({ kind: 'trust_return', entityName: 'Ferraro Family Trust' }),
      doc({ kind: 'company_financials', entityName: 'A Pty Ltd', abn: '1' }),
      doc({ kind: 'company_financials', entityName: 'B Pty Ltd', abn: '2' }),
    ])!.why
    expect(why).toContain('Ferraro Family Trust')
    expect(why).not.toContain('2 businesses')
  })
})

describe('not enough to read is said differently from cannot read', () => {
  it('nothing usable at all', () => {
    expect(whatIsMissing([doc({ kind: 'unknown' })]))
      .toContain('Nothing here could be read')
  })

  it('a document with no financial year on it', () => {
    expect(whatIsMissing([doc({ kind: 'company_financials', years: [] })]))
      .toContain('No financial year could be read')
  })

  it('and a readable set says nothing', () => {
    expect(whatIsMissing([
      doc({ kind: 'company_financials', years: [{ fy: '2024/25' } as any] }),
    ])).toBe('')
  })
})

// ===========================================================================
// THE YEARS
// ===========================================================================

describe('the years these documents cover', () => {
  const docs = [
    doc({ years: [{ fy: '2023/24' } as any, { fy: '2024/25' } as any] }),
    doc({ years: [{ fy: '2022/23' } as any] }),
  ]

  // OLDEST FIRST, DELIBERATELY. The portal stores the EARLIER year as year 1
  // and the later one as year 2 - picking year 1 sets year 2 to the year after
  // it. Round the wrong way, "previous year plus growth" would grow the latest
  // year, which is the wrong number in the client's favour.
  it('come back oldest first', () => {
    expect(yearsCovered(docs)).toEqual(['2022/23', '2023/24', '2024/25'])
  })

  it('and three years of financials give the latest two', () => {
    expect(twoYears(docs)).toEqual(['2023/24', '2024/25'])
  })
})

// ===========================================================================
// THE COMPARISON
// ===========================================================================

// Fabio's own worked example: 2023/24 totals $142,000 and 2024/25 totals
// $198,000, which is 39% up.
const EARLIER = YEAR('2023/24', 88_000, 41_400, 12_600)
const LATEST  = YEAR('2024/25', 92_000, 88_300, 17_700)

describe('the latest year is up', () => {
  const cols = columnsFor(EARLIER, LATEST, 20)

  it('three columns, and lower of the two is not one of them', () => {
    expect(cols.map(c => c.id)).toEqual(['latest', 'average', 'previous_plus_growth'])
  })

  it('the figures are the ones he worked through', () => {
    expect(cols.find(c => c.id === 'latest')!.total).toBe(198_000)
    expect(cols.find(c => c.id === 'average')!.total).toBe(170_000)
    expect(cols.find(c => c.id === 'previous_plus_growth')!.total).toBeCloseTo(170_400, 0)
  })

  // HIS CORRECTION, 22 NOV: "your figures dont represent previous plus 20%".
  // Every line is grown, not just the total with an allowance bolted on.
  it('and every line of the growth column is actually grown', () => {
    const g = cols.find(c => c.id === 'previous_plus_growth')!
    expect(g.lines.salary).toBeCloseTo(105_600, 0)
    expect(g.lines.netProfit).toBeCloseTo(49_680, 0)
    expect(g.lines.depreciation).toBeCloseTo(15_120, 0)
  })

  it('the average is averaged line by line, and still adds up', () => {
    const a = cols.find(c => c.id === 'average')!
    expect(a.lines.salary).toBe(90_000)
    expect(a.lines.netProfit).toBe(64_850)
    expect(a.lines.depreciation).toBe(15_150)
    expect(LINES.reduce((t, l) => t + a.lines[l.key], 0)).toBe(a.total)
  })

  it('and it says what was left out', () => {
    expect(leftOut(EARLIER, LATEST)).toContain('Lower of the two')
    expect(leftOut(EARLIER, LATEST)).toContain('2024/25 is up on 2023/24')
  })
})

describe('the latest year is down', () => {
  const down = YEAR('2024/25', 80_000, 28_000, 12_000)      // $120,000
  const up   = YEAR('2023/24', 88_000, 58_000, 14_000)      // $160,000
  const cols = columnsFor(up, down, 20)

  // HIS CONFUSION, 22 NOV, AND IT WAS FAIR: two columns reading $120,000 each.
  it('is two columns, not three, because latest and lower are the same thing', () => {
    expect(cols.map(c => c.id)).toEqual(['latest_is_lower', 'average'])
  })

  it('and the one column carries both names', () => {
    const c = cols[0]
    expect(c.title).toBe('2024/25 on its own')
    expect(c.under).toBe('the latest, and the lower')
  })

  it('it says most lenders will insist, and by how much income fell', () => {
    expect(cols[0].why).toContain('Most lenders will insist')
    expect(cols[0].why).toContain('25%')
  })

  it('the growth column is gone, because nothing grew', () => {
    expect(cols.find(c => c.id === 'previous_plus_growth')).toBeUndefined()
    expect(leftOut(up, down)).toContain('no growth to allow')
  })

  it('and the figures are right', () => {
    expect(cols[0].total).toBe(120_000)
    expect(cols[1].total).toBe(140_000)
  })
})

describe('one year only', () => {
  it('is one column, and it is one year in isolation', () => {
    const cols = columnsFor(null, LATEST, 20)
    expect(cols).toHaveLength(1)
    expect(cols[0].total).toBe(198_000)
    expect(cols[0].writes.seAssessmentMethod).toBe('One year in isolation')
  })

  it('and nothing at all is no columns rather than a zero', () => {
    expect(columnsFor(null, null)).toEqual([])
  })
})

// ===========================================================================
// WHAT PRESSING A COLUMN WRITES
// ===========================================================================
//
// The part that matters for compliance. seAssessmentMethod is read in eight
// places - the compliance notes, the broker notes, the handover, the document
// list and the income sum among them. A column that wrote the wrong one would
// put the wrong sentence in a credit file.
describe('what each column writes', () => {
  const up = columnsFor(EARLIER, LATEST, 20)
  const down = columnsFor(YEAR('2023/24', 88_000, 58_000, 14_000), YEAR('2024/25', 80_000, 28_000, 12_000))

  it('latest year on its own is one year in isolation', () => {
    expect(up.find(c => c.id === 'latest')!.writes)
      .toEqual({ seAssessmentMethod: 'One year in isolation', seGrowthMethod: '' })
  })

  it('average is last 2 financial years, averaged', () => {
    expect(up.find(c => c.id === 'average')!.writes)
      .toEqual({ seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'average' })
  })

  it('the latest and lower is last 2 financial years, latest_lower', () => {
    expect(down.find(c => c.id === 'latest_is_lower')!.writes)
      .toEqual({ seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'latest_lower' })
  })

  it('and growth carries the percentage with it', () => {
    expect(up.find(c => c.id === 'previous_plus_growth')!.writes)
      .toEqual({
        seAssessmentMethod: 'Last 2 financial years',
        seGrowthMethod: 'previous_plus_growth',
        seGrowthPercentOption: '20',
      })
  })

  // WE CHOOSE THE PERCENTAGE, NOT A LENDER. Fabio, 22 Nov: "I said 20% is
  // editable WE choose and WE find a lender - here lender does not dictate
  // this." So it is an argument to this function and it travels into the
  // field the portal already has.
  it('a different percentage changes the figures and what is written', () => {
    const fifty = columnsFor(EARLIER, LATEST, 50).find(c => c.id === 'previous_plus_growth')!
    expect(fifty.total).toBeCloseTo(213_000, 0)
    expect(fifty.writes.seGrowthPercentOption).toBe('50')
    expect(fifty.title).toBe('2023/24 plus 50%')
  })
})

// NOTHING IS CHOSEN FOR YOU.
describe('no column is picked by default', () => {
  it('nothing on a column says it is in use', () => {
    for (const c of columnsFor(EARLIER, LATEST, 20)) {
      expect(Object.keys(c)).not.toContain('selected')
      expect(Object.keys(c)).not.toContain('chosen')
    }
  })
})
