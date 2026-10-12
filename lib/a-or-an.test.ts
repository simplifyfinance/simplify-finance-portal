import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { article, withArticle } from './article'

// "They own 7/22 Sample Road, Hawks Nest NSW 2324, AN UNIT."
//
// 12 Oct 2026, found reading a compliance pack back. The rule was "starts with
// a vowel letter -> an", written out four separate times - box one, box four,
// box power, box security - so the same mistake was in four documents and
// fixing it in one would have left three.
describe('a or an, by the sound', () => {
  it.each([['unit'], ['union'], ['university'], ['uniform'], ['usual'], ['used car'], ['utility'], ['European'], ['euro']])(
    '%s takes "a", because it starts with a y sound', (w) => {
      expect(article(w)).toBe('a')
    })

  // THE TRAP. "An unsecured loan" is correct and this file already wrote it.
  // A rule that said "u always takes a" would have broken box power.
  it.each([['unsecured loan'], ['unemployed'], ['uninsured'], ['uninhabitable'], ['umbrella']])(
    '%s still takes "an"', (w) => {
      expect(article(w)).toBe('an')
    })

  it.each([['hour'], ['honest mistake'], ['honour'], ['honor'], ['heir']])(
    '%s takes "an", despite the h', (w) => {
      expect(article(w)).toBe('an')
    })

  it.each([['investment'], ['apartment'], ['engineer'], ['accountant'], ['electrician'], ['office manager']])(
    '%s takes "an"', (w) => { expect(article(w)).toBe('an') })

  it.each([['townhouse'], ['terrace'], ['villa'], ['duplex'], ['nurse'], ['one-bedroom flat']])(
    '%s takes "a"', (w) => { expect(article(w)).toBe('a') })

  // "An onerous condition" is right, so the one-rule must not swallow it.
  it('does not mistake onerous for one', () => {
    expect(article('onerous condition')).toBe('an')
  })

  it('says nothing about nothing', () => {
    expect(withArticle('')).toBe('')
    expect(withArticle(null)).toBe('')
    expect(withArticle(undefined)).toBe('')
  })

  it('puts the word after the article', () => {
    expect(withArticle('unit')).toBe('a unit')
    expect(withArticle('investment terrace')).toBe('an investment terrace')
  })
})

// ONE COPY. Four was three too many.
describe('nobody keeps their own copy of the rule', () => {
  it.each([
    ['lib/box-one.ts'], ['lib/box-four.ts'], ['lib/box-power.ts'], ['lib/box-security.ts'],
  ])('%s reads it from lib/article.ts', (f) => {
    const src = readFileSync(f, 'utf8')
    expect(src).toMatch(/from '\.\/article'/)
    expect(src).not.toMatch(/\[aeiou\]/)
  })
})
