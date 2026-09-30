// NOTHING PASTED INTO A FIELD MAY DESTROY A CLIENT DOCUMENT.
//
// 30 Sep 2026. The Fact Find PDF on Lucy Ilbery & Andrew Leigh would not build:
//
//   WinAnsi cannot encode "" (0xe113)
//
// U+E113 is in the Private Use Area - a character with no meaning outside
// whatever app it came from. It arrived in the internal notes with a paste and
// showed on screen as an empty box. The PDF uses Helvetica, which is WinAnsi
// encoded, so pdf-lib threw and the whole document died. One invisible character
// in a notes field, and a client's paperwork could not be produced at all.
//
// THREE RULES, IN THIS ORDER, so a name survives as a name:
//
//   1. A character the font can encode is left exactly alone. Valerio keeps its
//      accent, because WinAnsi has it.
//   2. One it cannot is flattened to its base letter. Dvorak rather than a
//      missing letter or a dead PDF.
//   3. Anything with no letter behind it at all - a private-use box, an emoji,
//      a Chinese character - is dropped.
//
// Dropping beats throwing. A document missing a decorative character is a
// document; a document that would not build is a phone call.
//
// THIS IS AT THE DRAWING LAYER on purpose. Every content file feeds text in from
// somewhere a person typed, and putting the guard in one of them would leave the
// next one free to break. See lib/form-pdf.ts, where it is applied.

// WHAT WINANSI ACTUALLY HAS. Latin-1, plus the CP1252 band at 0x80-0x9F that
// carries smart quotes, the em dash, the bullet and the euro.
const CP1252_EXTRAS = new Set([
  0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017D, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022,
  0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x017E, 0x0178,
])

export function encodable(ch: string): boolean {
  const c = ch.codePointAt(0)
  if (c === undefined) return false
  // Tab, newline and carriage return are handled by the layout, not drawn.
  if (c === 0x09 || c === 0x0A || c === 0x0D) return true
  if (c >= 0x20 && c <= 0x7E) return true          // ASCII
  if (c >= 0xA0 && c <= 0xFF) return true          // Latin-1
  return CP1252_EXTRAS.has(c)
}

// A STROKE IS NOT AN ACCENT, and decomposition cannot take one off.
//
// U+0141 is L with a bar through it. There is no combining mark to strip, so
// NFKD hands it straight back and the letter was being dropped - which took the
// first letter off a name. These are written out because there is no rule to
// derive them from.
const STROKED: Record<string, string> = {
  '\u0141': 'L', '\u0142': 'l',   // L with stroke
  '\u0110': 'D', '\u0111': 'd',   // D with stroke
  '\u0126': 'H', '\u0127': 'h',   // H with stroke
  '\u0166': 'T', '\u0167': 't',   // T with stroke
  '\u018F': 'E', '\u0259': 'e',   // schwa
  '\u0132': 'IJ', '\u0133': 'ij',
  '\u1E9E': 'SS',                 // capital sharp s
  '\u0131': 'i',                  // dotless i
}

// Step two: the same character with its accents taken off, where that leaves
// something the font has. A caron goes and the r stays - and the rest of the
// word is untouched, so an a-acute the font DOES have is still an a-acute.
function flattened(ch: string): string {
  const stroked = STROKED[ch]
  if (stroked) return stroked
  const bare = ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  if (!bare) return ''
  return [...bare].every(encodable) ? bare : ''
}

export function pdfSafe(v: any): string {
  const s = String(v ?? '')
  if (!s) return ''
  let out = ''
  for (const ch of s) {
    if (encodable(ch)) { out += ch; continue }
    out += flattened(ch)
  }
  return out
}

// WHAT WAS DROPPED, for anybody who wants to know why a document reads slightly
// differently from the screen. Not shown to a client - see the note on the
// documents strip.
export function droppedFrom(v: any): string[] {
  const s = String(v ?? '')
  const gone: string[] = []
  for (const ch of s) {
    if (encodable(ch) || flattened(ch)) continue
    const c = ch.codePointAt(0)!
    const hex = `U+${c.toString(16).toUpperCase().padStart(4, '0')}`
    if (!gone.includes(hex)) gone.push(hex)
  }
  return gone
}
