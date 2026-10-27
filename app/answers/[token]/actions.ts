'use server'
import { saveAnswers } from '@/lib/answers-flow'
import type { Answer } from '@/lib/answers-from-the-client'

// THE WRITE DOES NOT HANG OFF THE LINK.
//
// Opening the page reads the deal and nothing else. Nothing is saved until the
// client presses the button, which is what stops a mail scanner following the
// link on its way to the inbox from recording answers nobody typed. The same
// rule the Proceed page learned in August.
export async function save(token: string, answers: Answer[]) {
  return await saveAnswers(token, answers)
}
