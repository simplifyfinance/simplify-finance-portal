import { describe, it, expect } from 'vitest'
import { dealMatches, searchWords, dealHaystack } from './deal-search'

const alexis = {
  deal_name: 'Alexis_Janes_Refinance_2026',
  clients: { first_name: 'Alexis', last_name: 'Janes' },
  deal_type: 'Refinance',
  assigned_broker: 'Fabio',
}

describe('finding a deal', () => {
  // The one that started it.
  it('finds it by the surname buried in an underscored name', () => {
    expect(dealMatches(alexis, 'Janes')).toBe(true)
    expect(dealMatches({ deal_name: 'Alexis_Janes_Refinance_2026' }, 'janes')).toBe(true)
  })

  it('finds it by the first name', () => {
    expect(dealMatches(alexis, 'Alexis')).toBe(true)
  })

  it('does not care about the underscores', () => {
    expect(dealMatches({ deal_name: 'Alexis_Janes_Refinance_2026' }, 'Alexis Janes')).toBe(true)
  })

  it('does not care what order the words are typed in', () => {
    expect(dealMatches(alexis, 'refinance janes')).toBe(true)
    expect(dealMatches(alexis, 'janes refinance')).toBe(true)
  })

  it('needs every word to be there', () => {
    expect(dealMatches(alexis, 'janes purchase')).toBe(false)
  })

  it('finds it by broker or by type', () => {
    expect(dealMatches(alexis, 'fabio')).toBe(true)
    expect(dealMatches(alexis, 'refinance')).toBe(true)
  })

  // Names arrive by copy and paste, and bring things with them.
  it('is not defeated by an accent or an odd space', () => {
    const odd = { deal_name: 'André_Janés Refinance_2026' }
    expect(dealMatches(odd, 'andre')).toBe(true)
    expect(dealMatches(odd, 'janes')).toBe(true)
  })

  it('shows everything when nothing is typed', () => {
    expect(dealMatches(alexis, '')).toBe(true)
    expect(dealMatches(alexis, '   ')).toBe(true)
  })

  it('copes with a deal that has almost nothing on it', () => {
    expect(dealMatches({}, 'janes')).toBe(false)
    expect(dealMatches({}, '')).toBe(true)
  })
})

describe('the pieces', () => {
  it('splits what was typed into words', () => {
    expect(searchWords('  Alexis_Janes ')).toEqual(['alexis', 'janes'])
    expect(searchWords('')).toEqual([])
  })

  it('flattens everything worth searching into one string', () => {
    expect(dealHaystack(alexis)).toBe('alexis janes refinance 2026 alexis janes refinance fabio')
  })
})
