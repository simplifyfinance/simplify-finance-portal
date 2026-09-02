import { describe, it, expect } from 'vitest'
import { escapeHtml, emailParagraphs, htmlToPlainText } from './rich-text'

describe('broker notes keep the shape they were typed in', () => {
  it('makes a paragraph out of every blank-line-separated block', () => {
    const html = emailParagraphs('First para.\n\nSecond para.\n\nThird para.')
    expect(html.match(/<p /g)).toHaveLength(3)
    expect(html).toContain('First para.')
    expect(html).toContain('Third para.')
  })

  it('keeps a single newline as a line break inside the same paragraph', () => {
    const html = emailParagraphs('Line one\nLine two')
    expect(html.match(/<p /g)).toHaveLength(1)
    expect(html).toContain('Line one<br>Line two')
  })

  it('does not care how many blank lines there are, or about trailing spaces', () => {
    expect(emailParagraphs('a\n\n\n\nb').match(/<p /g)).toHaveLength(2)
    expect(emailParagraphs('a\n   \nb').match(/<p /g)).toHaveLength(2)
  })

  it('gives back nothing at all for an empty box, so no empty paragraph is mailed', () => {
    expect(emailParagraphs('')).toBe('')
    expect(emailParagraphs(null)).toBe('')
    expect(emailParagraphs('   \n\n  ')).toBe('')
  })

  it('drops the gap under the last paragraph unless something follows it', () => {
    expect(emailParagraphs('a\n\nb')).toContain('margin:0;')
    expect(emailParagraphs('a\n\nb', { trailing: true })).not.toContain('margin:0;')
  })

  it('puts the colour on the span as well, because Outlook strips it off the p', () => {
    const html = emailParagraphs('hello', { colour: '#333333' })
    expect(html).toContain('<span style="color:#333333;">')
  })
})

describe('what a broker types cannot break the email', () => {
  it('escapes a less-than, which used to swallow the rest of the paragraph', () => {
    const html = emailParagraphs('Keep the equity release under 80% <if we can>. Then settle.')
    expect(html).toContain('&lt;if we can&gt;')
    expect(html).toContain('Then settle.')
  })

  it('escapes ampersands and quotes', () => {
    expect(escapeHtml('Smith & Sons "the best"')).toBe('Smith &amp; Sons &quot;the best&quot;')
  })

  it('cannot be used to inject markup', () => {
    const html = emailParagraphs('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('the plain-text half of the clipboard', () => {
  it('turns line breaks and paragraph ends back into newlines', () => {
    const plain = htmlToPlainText(emailParagraphs('One\nTwo\n\nThree'))
    expect(plain).toBe('One\nTwo\n\nThree')
  })

  it('unescapes back to what was typed, ampersand last', () => {
    expect(htmlToPlainText(emailParagraphs('a < b & c > d'))).toBe('a < b & c > d')
    // &amp;lt; is a literal "&lt;" the broker typed, not a less-than.
    expect(htmlToPlainText(emailParagraphs('&lt;'))).toBe('&lt;')
  })

  it('does not leave a page of blank lines behind', () => {
    expect(htmlToPlainText('<div></div><p></p><p>Hi</p>')).toBe('Hi')
  })
})
