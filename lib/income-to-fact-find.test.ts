// FROM THE ASSESSMENT ONTO THE FACT FIND.
//
// This is the part that writes, so this is the part worth being hardest on.
// Every name and figure is invented.
import { describe, it, expect } from 'vitest'
import { assess, type PayLine } from './annualise-income'
import { toFactFind, unsettled, whatHappened, EMPTY_FIELDS } from './income-to-fact-find'

const d = (s: string) => new Date(`${s}T00:00:00`)
const TO = d('2026-10-12')

const PRIYA: PayLine[] = [
  { key: 'base', label: 'Ordinary Hours', ytd: 29903 },
  { key: 'allowance', label: 'Car Allowance', ytd: 1851 },
  { key: 'overtime', label: 'Overtime 1.5', ytd: 5184 },
  { key: 'commission', label: 'Sales Commission', ytd: 9071 },
  { key: 'bonus', label: 'Performance Bonus', ytd: 13500, oneOff: true },
  { key: 'other', label: 'Travel Reimbursement', ytd: 412, notIncome: true },
]
const A = assess({ lines: PRIYA, to: TO })

describe('the six boxes, from the full column', () => {
  const f = toFactFind(A, 'full')

  it('fills the six the fact find already has', () => {
    expect(f).toEqual({
      grossSalary: '104948',
      allowanceAmount: '6496',
      overtimeEssentialAmount: '',
      overtimeNonEssentialAmount: '18194',
      commissionAmount: '31836',
      bonusAmount: '13500',
    })
  })

  it('BASE AND ALLOWANCE STAY IN TWO BOXES', () => {
    // Adding them would still total right, and would quietly tell every lender
    // downstream that a car allowance is salary.
    expect(f.grossSalary).toBe('104948')
    expect(f.allowanceAmount).toBe('6496')
    expect(Number(f.grossSalary) + Number(f.allowanceAmount)).toBe(111444)
  })

  it('and the bonus goes in at what was paid, not at what annualising claimed', () => {
    expect(f.bonusAmount).toBe('13500')
  })
})

describe('the six boxes, from the 80% column', () => {
  const f = toFactFind(A, 'shaded')

  it('shades only the volatile ones', () => {
    expect(f.grossSalary).toBe('104948')       // unchanged
    expect(f.allowanceAmount).toBe('6496')     // unchanged
    expect(f.overtimeNonEssentialAmount).toBe('14555')
    expect(f.commissionAmount).toBe('25469')
    expect(f.bonusAmount).toBe('10800')
  })

  it('and a different rate carries all the way through to the box', () => {
    const half = assess({ lines: PRIYA, to: TO, rate: 0.5 })
    expect(toFactFind(half, 'shaded').commissionAmount).toBe('15918')
    expect(toFactFind(half, 'shaded').grossSalary).toBe('104948')
  })
})

describe('OVERTIME — THE ONE THING A PAYSLIP CANNOT ANSWER', () => {
  // A payslip says "Overtime" and stops. Whether this is an ambulance officer
  // or a warehouse is on the file, not on the payslip.
  it('goes in as non-essential unless somebody says otherwise', () => {
    const f = toFactFind(A, 'full')
    expect(f.overtimeNonEssentialAmount).toBe('18194')
    expect(f.overtimeEssentialAmount).toBe('')
  })

  it('and moves across when they do', () => {
    const f = toFactFind(A, 'full', { essentialOvertime: true })
    expect(f.overtimeEssentialAmount).toBe('18194')
    expect(f.overtimeNonEssentialAmount).toBe('')
  })

  it('IT IS NEVER IN BOTH BOXES AT ONCE', () => {
    // Which would double somebody's overtime on every lender's servicing sheet.
    for (const essential of [true, false]) {
      const f = toFactFind(A, 'full', { essentialOvertime: essential })
      expect(Boolean(f.overtimeEssentialAmount && f.overtimeNonEssentialAmount)).toBe(false)
    }
  })

  it('and the default direction is downwards', () => {
    // Non-essential is the shaded one. The only way overtime moves up is by
    // hand, by somebody who knows the job.
    expect(toFactFind(A, 'full').overtimeEssentialAmount).toBe('')
  })
})

describe('lines of the same kind are added, not overwritten', () => {
  it('two allowances make one figure', () => {
    const a = assess({
      lines: [
        { key: 'allowance', label: 'Car Allowance', ytd: 1851 },
        { key: 'allowance', label: 'Tool Allowance', ytd: 640 },
      ],
      to: TO,
    })
    expect(toFactFind(a, 'full').allowanceAmount).toBe('8742')
  })

  it('and overtime at two different rates makes one figure', () => {
    const a = assess({
      lines: [
        { key: 'overtime', label: 'Overtime 1.5', ytd: 5184 },
        { key: 'overtime', label: 'Overtime 2.0', ytd: 1200 },
      ],
      to: TO,
    })
    expect(toFactFind(a, 'full').overtimeNonEssentialAmount).toBe('22406')
  })
})

describe('nothing is written as a nought', () => {
  it('a box with no money in it is left empty, not filled with 0', () => {
    const a = assess({ lines: [{ key: 'base', label: 'Ordinary Hours', ytd: 29903 }], to: TO })
    const f = toFactFind(a, 'full')
    expect(f.grossSalary).toBe('104948')
    expect(f.commissionAmount).toBe('')
    expect(f.bonusAmount).toBe('')
    expect(f.allowanceAmount).toBe('')
  })

  it('a reimbursement reaches no box at all', () => {
    // It is in the lines, it is on the screen with a line through it, and it
    // touches nothing here.
    const a = assess({
      lines: [{ key: 'other', label: 'Travel Reimbursement', ytd: 412, notIncome: true }], to: TO,
    })
    expect(toFactFind(a, 'full')).toEqual(EMPTY_FIELDS)
  })

  it('and nothing at all is six empty boxes rather than a crash', () => {
    expect(toFactFind(assess({ lines: [], to: TO }), 'full')).toEqual(EMPTY_FIELDS)
  })
})

describe('A LINE NOBODY HAS PLACED STOPS THE PRESS', () => {
  // There is no box for "Site Uplift 7B". Folding it into Allowance to get the
  // button working would put UNSHADED money on a file on the strength of a name
  // nobody recognised.
  const lines = [
    { label: 'Ordinary Hours', ytd: 29903, recognised: true },
    { label: 'Site Uplift 7B', ytd: 2400, recognised: false },
  ]

  it('names it, so the screen can ask', () => {
    expect(unsettled(lines)).toEqual(['Site Uplift 7B'])
  })

  it('a line with no figure on it is not in the way', () => {
    // It cannot change a total, so stopping for it would be an empty hurdle.
    expect(unsettled([{ label: 'Site Uplift 7B', ytd: null, recognised: false }])).toEqual([])
  })

  it('and one somebody has already called not income is settled', () => {
    expect(unsettled([
      { label: 'Site Uplift 7B', ytd: 2400, recognised: false, notIncome: true },
    ])).toEqual([])
  })

  it('a payslip it understood end to end stops nothing', () => {
    expect(unsettled([{ label: 'Ordinary Hours', ytd: 29903, recognised: true }])).toEqual([])
  })

  it('and nothing at all does not throw', () => {
    expect(unsettled([])).toEqual([])
    expect(unsettled(null as any)).toEqual([])
  })
})

describe('the line that goes in the file', () => {
  it('CARRIES BOTH TOTALS, NOT JUST THE ONE THAT WAS USED', () => {
    // Six months later the question is not what the figure was - that is on the
    // fact find - it is what else was on the table when somebody chose it.
    const s = whatHappened(A, 'full', { payslips: 2 })
    expect(s).toContain('2 payslips')
    expect(s).toContain('12 October 2026')
    expect(s).toContain('$174,974')
    expect(s).toContain('$162,268')
    expect(s).toContain('Full used')
  })

  it('and says which way round it was', () => {
    expect(whatHappened(A, 'shaded', { payslips: 2 })).toContain('At 80% used')
  })

  it('one payslip is a payslip, not payslips', () => {
    expect(whatHappened(A, 'full', { payslips: 1 })).toContain('1 payslip ')
  })

  it('a changed rate is named in the file, not left as 80', () => {
    const half = assess({ lines: PRIYA, to: TO, rate: 0.5 })
    expect(whatHappened(half, 'shaded')).toContain('at 50%')
  })

  it('AND A SHORT YEAR TO DATE USED ANYWAY SAYS SO PLAINLY', () => {
    // The single most useful thing this line can ever say.
    const short = assess({ lines: PRIYA, to: d('2026-08-10') })
    const s = whatHappened(short, 'full')
    expect(s).toContain('41 days')
    expect(s).toContain('Used anyway')
  })

  it('and a full one does not say it', () => {
    expect(whatHappened(A, 'full')).not.toContain('Used anyway')
  })
})
