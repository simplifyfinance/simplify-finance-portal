import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// AN APPLICANT IS WRITTEN TO BY NAME, NOT BY POSITION.
//
// 3 Nov 2026. Fabio: "when we upload payslips for applicant 2 it is deleting
// applicant one - remember similar issue to bank statements, we need to ensure
// it is per applicant."
//
// updateApplicant() did two things with two different ideas of who it was
// working on:
//
//   the VALUE came from `applicant` - d.applicants[activeApplicant] as it was
//     when that render happened, captured in the handler's closure
//   the DESTINATION was apps[activeApplicant], read when the write actually ran
//
// The same applicant, right up until they are not. The payslip card writes
// back from an EFFECT: it reads several files and then reports what it found,
// so the write can land after somebody has clicked across to the other
// applicant. The value is then applicant 1's income list and the destination
// is applicant 2's slot. Applicant 2 is overwritten with applicant 1's income,
// applicant 1's own reading lands nowhere, and nothing says a word.
//
// A race this narrow cannot be caught by calling the functions in order, which
// is exactly why it survived the bank statement version of itself. What CAN be
// pinned is the shape that makes it impossible: the write is addressed.

const FF = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')
const block = (name: string) => {
  const at = FF.indexOf(`function ${name}(`)
  return at < 0 ? '' : FF.slice(at, FF.indexOf('\n  }', at))
}

describe('THE WRITE IS ADDRESSED', () => {
  it('updateApplicant finds its applicant by id', () => {
    const src = block('updateApplicant')
    expect(src).toContain('a?.id === who')
  })

  it('AND NO LONGER WRITES INTO A SLOT BY NUMBER', () => {
    // apps[activeApplicant] = ... is the whole fault in one line: the index is
    // read when the write runs, the value when the render happened.
    expect(block('updateApplicant')).not.toContain('apps[activeApplicant] =')
  })

  it('AND THE INCOME LIST COMES OFF THE RECORD, NOT THE RENDER', () => {
    // applicant.income is the list as it was when the handler was made. A
    // payslip reports seconds later, and mapping over the old list writes
    // anything added since straight back out again.
    const src = block('updateIncomeFields')
    expect(src).not.toContain('applicant.income.map')
    expect(src).toContain('(a?.income || []).map')
  })

  it('and it changes only the income line it was given', () => {
    const src = block('updateIncomeFields')
    expect(src).toContain("x?.id === id ? { ...x, ...patch } : x")
  })
})

describe('AND A RECORD FROM BEFORE APPLICANTS HAD IDS STILL SAVES', () => {
  it('position is the fall-back, and only then', () => {
    // Refusing to write to an old record would be a worse fault than the one
    // being fixed.
    for (const name of ['updateApplicant', 'updateIncomeFields']) {
      expect(block(name), `${name} has no fall-back for an applicant with no id`)
        .toContain('who ? a?.id === who : i === activeApplicant')
    }
  })
})

describe('AND THE FILE STILL SAYS WHOSE RECORD CHANGED', () => {
  it('both writes mark the applicant dirty by id', () => {
    // The save machinery works out what to send from these marks. A write
    // that moves to an id without saying so would save the wrong half.
    expect(block('updateApplicant')).toContain('markDirty(ownRef.current, `applicants#${who}.')
    expect(block('updateIncomeFields')).toContain('markDirty(ownRef.current, `applicants#${who}.income`)')
  })
})
