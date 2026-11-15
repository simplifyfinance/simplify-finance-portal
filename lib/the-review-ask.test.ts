import { describe, it, expect } from 'vitest'
import { reviewButton, reviewText, REVIEW_URL } from './the-review-ask'

describe('the review button', () => {
  const html = reviewButton()

  it('carries the link', () => {
    expect(html).toContain(REVIEW_URL)
  })

  // THE WRITE-A-REVIEW FORM, NOT THE LISTING, and not a shortener that can die.
  it('goes straight to the review box on Google, by place id', () => {
    expect(REVIEW_URL).toContain('search.google.com/local/writereview')
    expect(REVIEW_URL).toContain('placeid=')
    expect(REVIEW_URL, 'a shortener can expire or be re-pointed outside the portal')
      .not.toContain('rebrand.ly')
  })

  // WORD PAINTS A CELL FROM THE ATTRIBUTE AND THROWS AWAY THE CSS ONE.
  it('paints the cell with a bgcolor attribute, not only CSS', () => {
    expect(html).toContain('bgcolor="#2DBEFF"')
  })

  // WORD KEEPS A COLOUR ON A RUN AND DROPS ONE ON A PARAGRAPH.
  it('puts the text colour on the anchor', () => {
    expect(html).toMatch(/<a [^>]*style="color:#343333/)
  })

  // WHITE ON #2DBEFF IS 2.1 TO 1 AND ARRIVES AS A PALE WASH.
  it('is charcoal on the blue, never white', () => {
    expect(html).not.toContain('color:#fff')
    expect(html).not.toContain('color:#FFFFFF')
  })

  it('tells them to press it, and has the arrow', () => {
    expect(html).toContain('helps us more than you would think')
    expect(html).toContain('&rarr;')
  })

  // A BUTTON THAT DOES NOTHING IS WORSE THAN NO BUTTON.
  it('draws nothing at all without a link', () => {
    expect(reviewButton('')).toBe('')
    expect(reviewText('')).toBe('')
  })

  it('the plain text version carries the link in full', () => {
    expect(reviewText()).toContain(REVIEW_URL)
  })

  // Fabio: "make it a button so it's not that ridiculous link... So we don't
  // have to worry about people clicking on that link and looks ugly like that."
  it('the raw link is never printed where a client can read it', () => {
    expect(html).not.toMatch(/>\s*https:\/\//)
    // The URL appears once, in the href, and nowhere else in the markup.
    expect(html.split(REVIEW_URL).length - 1).toBe(1)
    expect(html).toContain(`href="${REVIEW_URL}"`)
  })
})
