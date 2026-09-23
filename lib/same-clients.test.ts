import { describe, it, expect } from 'vitest'
import { clientIdsOn, sharesAClient, otherDealsForSameClients, splitOnCommonStart, otherDealsLine } from './same-clients'

// TWO DEALS FOR THE SAME PEOPLE.
//
// 23 Sep 2026: forty minutes went on believing a credit officer's BC had been
// wiped. It had not - there were two deals for the Hameed household whose names
// matched for the first 42 characters, and she was looking at the other one.

const deal = (o: any = {}) => ({ id: 'd1', deal_name: 'A deal 2026', client_id: 'c1', ...o })

describe('which clients a deal belongs to', () => {
  it('takes the client on the deal', () => {
    expect(clientIdsOn(deal())).toEqual(['c1'])
  })

  it('takes the applicants inside the fact find too', () => {
    // The second person on a joint deal is never deals.client_id. Matching on
    // that alone would miss every joint deal's other half.
    const d = deal({ fact_find_data: { applicants: [{ clientId: 'c1' }, { clientId: 'c2' }] } })
    expect(clientIdsOn(d).sort()).toEqual(['c1', 'c2'])
  })

  it('does not count a blank as a client', () => {
    const d = deal({ client_id: '', fact_find_data: { applicants: [{ clientId: '' }, { clientId: null }] } })
    expect(clientIdsOn(d)).toEqual([])
  })
})

describe('finding the other deal', () => {
  it('finds one that shares the primary client', () => {
    const mine = deal({ id: 'equity' })
    const other = deal({ id: 'land' })
    expect(otherDealsForSameClients(mine, [mine, other]).map(d => d.id)).toEqual(['land'])
  })

  it('finds one that shares only a joint applicant', () => {
    const mine  = deal({ id: 'a', client_id: 'c1', fact_find_data: { applicants: [{ clientId: 'c2' }] } })
    const other = deal({ id: 'b', client_id: 'c9', fact_find_data: { applicants: [{ clientId: 'c2' }] } })
    expect(otherDealsForSameClients(mine, [mine, other]).map(d => d.id)).toEqual(['b'])
  })

  it('never offers the deal you are looking at', () => {
    const mine = deal({ id: 'a' })
    expect(otherDealsForSameClients(mine, [mine])).toEqual([])
  })

  it('never offers a test deal', () => {
    const mine = deal({ id: 'a' })
    const robot = deal({ id: 'zz', is_test: true })
    expect(otherDealsForSameClients(mine, [mine, robot])).toEqual([])
  })

  it('still offers a finished deal, because that is worth knowing too', () => {
    const mine = deal({ id: 'a' })
    const done = deal({ id: 'b', status: 'completed' })
    expect(otherDealsForSameClients(mine, [mine, done]).map(d => d.id)).toEqual(['b'])
  })

  it('says nothing about a deal with no client at all', () => {
    const mine = deal({ id: 'a', client_id: null })
    const other = deal({ id: 'b', client_id: null })
    expect(otherDealsForSameClients(mine, [mine, other])).toEqual([])
  })
})

describe('the part of the name that differs', () => {
  const EQUITY = 'Hameed Abdul Jabbar & Suleka Hameed Sadiq Equity 2026'
  const LAND   = 'Hameed Abdul Jabbar & Suleka Hameed Sadiq Land/Construction 2027'

  it('picks out the bit that actually tells them apart', () => {
    expect(splitOnCommonStart(LAND, [EQUITY]).tail).toBe('Land/Construction 2027')
    expect(splitOnCommonStart(EQUITY, [LAND]).tail).toBe('Equity 2026')
  })

  it('puts the shared opening back exactly, so nothing is lost', () => {
    const { shared, tail } = splitOnCommonStart(LAND, [EQUITY])
    expect(shared + tail).toBe(LAND)
  })

  it('leaves a name alone when there is nothing to compare it to', () => {
    expect(splitOnCommonStart(LAND, []).tail).toBe(LAND)
    expect(splitOnCommonStart(LAND, []).shared).toBe('')
  })

  it('leaves a name alone when two names merely start with the same letters', () => {
    // 'Sam' and 'Samantha' share three characters. Splitting there would
    // emphasise 'antha Jones 2026', which is worse than doing nothing.
    const { shared, tail } = splitOnCommonStart('Sam Jones 2026', ['Samantha Reid 2026'])
    expect(shared).toBe('')
    expect(tail).toBe('Sam Jones 2026')
  })

  it('never cuts in the middle of a word', () => {
    const { shared } = splitOnCommonStart('Richard Lake & Letitia Lake Bridging 2026', ['Richard Lake & Letitia Lake 2026'])
    expect(shared === '' || /[\s_\-—–/]$/.test(shared)).toBe(true)
  })

  it('handles three deals at once by cutting at what all of them share', () => {
    const a = 'Ricardo Fogolin & Joanne Saliba Inv Preapp 2026'
    const b = 'Ricardo Fogolin & Joanne Saliba Inv Refi 2026'
    const c = 'Ricardo Fogolin & Joanne Saliba Purchase 2026'
    expect(splitOnCommonStart(a, [b, c]).tail).toBe('Inv Preapp 2026')
  })

  it('never returns an empty tail', () => {
    const { tail } = splitOnCommonStart('Kylie Searle 2026', ['Kylie Searle 2026'])
    expect(tail.length).toBeGreaterThan(0)
  })
})

describe('the wording', () => {
  it('counts them', () => {
    expect(otherDealsLine([])).toBe('')
    expect(otherDealsLine([{ id: 'a' }])).toBe('These clients have another deal')
    expect(otherDealsLine([{ id: 'a' }, { id: 'b' }])).toBe('These clients have 2 other deals')
  })
})

// --------------------------------------------------------------------------
// AND THAT THE SCREENS ACTUALLY USE IT.
// --------------------------------------------------------------------------
import { readFileSync } from 'fs'
import { join } from 'path'
const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('the screens show it', () => {
  it('the deal header fades the shared part of the name', () => {
    expect(read('app/(app)/deals/[id]/DealPageClient.tsx')).toContain('<DealName')
  })

  it('the deal header links the other deal', () => {
    const s = read('app/(app)/deals/[id]/DealPageClient.tsx')
    expect(s).toMatch(/otherDeals\.length > 0/)
    expect(s).toMatch(/otherDeals\.map/)
  })

  it('the deals list fades it too, without another query', () => {
    // The list already holds every deal this person may see. Going back to the
    // database for something it is already holding is how a list gets slow.
    const s = read('app/(app)/deals/page.tsx')
    expect(s).toContain('<DealName')
    expect(s).toContain('otherDealsForSameClients')
    expect(s).not.toMatch(/twins[\s\S]{0,200}supabase/)
  })

  it('the faded part is dimmed, not hidden', () => {
    // Removing it would change what the name says. It only changes weight.
    const s = read('components/DealName.tsx')
    expect(s).toContain('{shared}')
    expect(s).toContain('{tail}')
  })
})
