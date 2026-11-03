import { PDFDocument } from 'pdf-lib'

// THE ANSWERS ARE IN THE FORM, NOT ON THE PAGE.
//
// 3 Nov 2026. Fabio, relaying his team: "information not carrying into ONE
// when Fact Find is uploaded. Team is manually updating as the workaround."
//
// The Simplify fact find is a fillable PDF. Everything a client types goes into
// the form layer; the page underneath stays blank. Pull the Cardey fact find
// apart and it has 236 boxes, 47 of them filled - both dates of birth, the
// address, residency, the employer, the NAB, FLEXI and Latitude cards, the car
// loan, the $1.2M property, uBank, the 50/50 ownership. Every one of them.
//
// Now ask that same file for its text, which is what reading a PDF normally
// means. Not one of those values comes back. Not "Elizabeth", not "KALINGA",
// not "NAB" - only the printed questions.
//
// So the importer was reading the questions and never the answers. The only
// way it could see an answer at all was as pixels in a picture of the page,
// which is why a couple of obvious things at the top came through and three
// pages of detail did not. Nothing was broken. It was looking in the wrong
// layer.
//
// THIS READS THE RIGHT LAYER. The values come out exactly as they were typed -
// no reading, no guessing - and are handed over as text beside the PDF, so the
// model's job shrinks from "find the answers in this picture" to "put these
// answers in the right boxes".
//
// THE PICTURE IS STILL SENT. The field names in this form are what a PDF
// editor left behind - 'undefined_4', 'Since_2', 'fill_62 2' - so the names
// alone say nothing about which question an answer belongs to. The page is
// what gives them meaning. Neither half is enough on its own.

export type FormAnswer = { field: string; value: string }

const txt = (v: any) => String(v ?? '').trim()

// A TICKED BOX ANSWERS WITH ITS OWN NAME, NOT WITH WORDS.
//
// The editor writes it as an export name, sometimes with a leading slash and
// sometimes with a number on the end to keep it unique on the page:
// '/Married', 'Married_2', '/Yes'. Said plainly, because "Married_2" in a list
// of answers reads like a mistake and invites the reader to discount it.
//
// The number is only ever stripped from a TICKED BOX. A typed answer is
// whatever the client typed, and "Unit 2" is not "Unit".
function tidy(raw: any, ticked = false): string {
  let v = txt(raw)
  if (v.startsWith('/')) v = v.slice(1)
  if (ticked) v = v.replace(/_\d+$/, '')
  return v === 'Off' ? '' : v
}

export function answersFrom(fields: { name: string; value: any; ticked?: boolean }[]): FormAnswer[] {
  const out: FormAnswer[] = []
  for (const f of fields || []) {
    const value = tidy(f?.value, f?.ticked === true)
    // AN EMPTY BOX IS NOT AN ANSWER. 189 of the 236 on the Cardey fact find are
    // blank, and sending them would bury the 47 that are not.
    if (!value) continue
    const field = txt(f?.name)
    if (!field) continue
    out.push({ field, value })
  }
  return out
}

// What goes in front of the model. One line per answer, in the order the form
// puts them, because that order is the only clue the names do not give.
export function answersAsText(answers: FormAnswer[]): string {
  if (!answers.length) return ''
  return answers.map(a => `${a.field}: ${a.value}`).join('\n')
}

export async function readPdfFormAnswers(pdfBase64: string): Promise<FormAnswer[]> {
  // A PDF WITH NO FORM IS NOT A FAILURE. Plenty of fact finds arrive scanned or
  // printed to PDF, and those have always gone through as pictures. They still
  // do: this returns nothing and the extractor carries on exactly as before.
  try {
    const doc = await PDFDocument.load(Buffer.from(pdfBase64, 'base64'),
      { ignoreEncryption: true, updateMetadata: false })
    const form = doc.getForm()
    const fields = form.getFields().map((f: any) => {
      const name = f.getName()
      try {
        if (typeof f.getText === 'function') return { name, value: f.getText(), ticked: false }
        if (typeof f.isChecked === 'function') return { name, value: f.isChecked() ? 'Yes' : '', ticked: true }
        if (typeof f.getSelected === 'function') {
          // A RADIO GROUP ANSWERS WITH ONE VALUE; A DROPDOWN WITH A LIST.
          //
          // Both are read through the same call and they do not agree on the
          // shape. Treating them alike cost four answers on the Cardey fact
          // find - both marital statuses, the employment basis and the asset
          // type - which are exactly the fields a person would never think to
          // check, because the obvious ones all came through.
          const picked = f.getSelected()
          return { name, value: Array.isArray(picked) ? picked.join(', ') : picked, ticked: true }
        }
      } catch {
        // One unreadable box must not cost the other 46.
      }
      return { name, value: '', ticked: false }
    })
    return answersFrom(fields)
  } catch {
    return []
  }
}
