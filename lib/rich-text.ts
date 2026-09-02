// Text a person typed, turned into email HTML that keeps the shape they typed.
//
// The broker summary notes box is a plain textarea. Whatever is typed in it was
// dropped straight into ONE `<p>`, and HTML does not care about newlines - so
// four paragraphs a broker had laid out carefully arrived at the client as a
// single wall of text. Fabio, 2 Sep 2026: "when I include a space for the
// paragraph its not keeping it, so it just becomes one big sentence."
//
// Four places did the same thing: the BC preview, the BC email actually sent,
// and the same pair for Lending Options. They all come here now.

// A single line, safe to put inside HTML.
//
// This is not decoration. An ampersand or a less-than in a broker's note used to
// go into the email raw: "&" is tolerated by most clients, but a "<" swallows
// everything after it until the next ">" - so a note reading "equity < 80%"
// would silently eat the rest of the paragraph on its way to the client.
export function escapeHtml(text: any): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type ParagraphOptions = {
  size?: string      // font-size
  colour?: string    // set on the <p> AND an inner <span>, because Outlook
                     // strips colour off block elements
  gap?: string       // space between paragraphs
  trailing?: boolean // keep the gap under the last one, for text with more below it
}

// Blank line -> new paragraph. Single newline -> a line break inside the same
// paragraph. That is what everyone means when they press Enter twice, and it is
// what the textarea already shows them on screen.
export function emailParagraphs(text: any, opts: ParagraphOptions = {}): string {
  const size = opts.size || '14px'
  const colour = opts.colour || '#333333'
  const gap = opts.gap || '14px'

  const blocks = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map(b => b.replace(/^\n+|\n+$/g, '').trim())
    .filter(Boolean)

  if (blocks.length === 0) return ''

  return blocks.map((b, i) => {
    const last = i === blocks.length - 1
    const margin = last && !opts.trailing ? '0' : `0 0 ${gap}`
    const inner = escapeHtml(b).replace(/\n/g, '<br>')
    return `<p style="font-size:${size};color:${colour};margin:${margin};line-height:1.6">`
         + `<span style="color:${colour};">${inner}</span></p>`
  }).join('')
}

// Email HTML read back as plain text, for the clipboard's text/plain half and
// for anything that cannot take HTML. Line breaks have to survive the trip or
// the fix above is undone the moment somebody pastes into a plain editor.
export function htmlToPlainText(html: string): string {
  return String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    // A paragraph ends with a BLANK line, not one newline. Collapsing it to one
    // is how the paragraph breaks we just fixed in the HTML got flattened again
    // the moment somebody pasted into a plain editor.
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/(tr|table|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&bull;/g, '-')
    .replace(/&#10003;/g, '*')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Last, or it would turn "&amp;lt;" into "<".
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
