// A WORKLOAD IS WHAT SOMEBODY IS CARRYING, NOT WHAT THEY HAVE EVER TOUCHED.
//
// 18 Nov 2026. Fabio, looking at the workload page: "Kylie hasn't been a broker,
// find out which deal cards she is talking about there."
//
// All four of them were lost - two were practice files under her own name. The
// page read "4" because the total counted every deal with her key, dead or
// alive, and her completed column counted a deal that died AFTER compliance had
// gone out.
//
// THREE WORDS WERE DOING THE WRONG JOB:
//   total     -> live, and what died gets its own column
//   completed -> settled is settled; compliance issued is compliance issued
//   active    -> open, and tested against a status the database has never held
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const PAGE = readFileSync('app/(app)/credit-team-workload/WorkloadClient.tsx', 'utf8')

describe('the workload page counts the living', () => {
  it('a broker row is live deals, with lost counted separately', () => {
    expect(PAGE).toContain('live: activeDeals.length')
    expect(PAGE).toContain("lost = myDeals.filter(d => d.status === 'lost').length")
    expect(PAGE, 'the old total counted the dead').not.toContain('total: myDeals.length, inBC')
  })

  it('and settled means the money landed', () => {
    expect(PAGE).toContain('settled = myDeals.filter(d => d.settled_at).length')
  })

  // NOTHING HAS EVER WRITTEN status = 'completed'. A test against it is a test
  // that always passes, which is worse than no test at all.
  it('open is not tested against a status that does not exist', () => {
    expect(PAGE).not.toContain("d.status !== 'completed'")
    expect(PAGE).toContain('open = myDeals.filter(d => !isFinished(d)).length')
  })

  it('compliance issued is named for what it is', () => {
    expect(PAGE).toContain('complianceIssued')
    expect(PAGE).toContain('Compliance issued')
  })

  // AWAY IS NOT GONE - the same rule the credit band and the settlement team use.
  it('somebody on leave keeps their row', () => {
    expect(PAGE).toContain("or('active.eq.true,on_leave.eq.true')")
    expect(PAGE).toContain('On leave')
  })

  it('and the page still reads every deal, a page at a time', () => {
    expect(PAGE).toContain('everyRow<any>')
    expect(PAGE).toContain('realDealsOnly')
  })
})
