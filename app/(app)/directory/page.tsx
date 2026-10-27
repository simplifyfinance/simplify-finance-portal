import DirectoryList from '@/components/DirectoryList'
import { PAGE_READ } from '@/lib/page-width'

// THE TEAM DIRECTORY.
//
// 27 Oct 2026. Catherine, Operations Manager, item 9 of nine: "Live group
// directory - in the portal or Teams, instead of a PDF on the shared drive."
//
// ITS OWN TAB, not a section of Team. Fabio, 27 Oct: "I want a directy tab".
// Team is an admin screen - invites, roles, turning access on and off. This is
// for everybody, including the people who never sign in at all.

export const metadata = { title: 'Directory' }

export default function DirectoryPage() {
  return (
    <div className={PAGE_READ}>
      <h1 className="text-2xl font-bold text-ink mb-1">Directory</h1>
      <p className="text-sm text-gray-500 mb-8">
        Everyone across the Simplify Group, and how to reach them. Anyone can add somebody,
        correct a number or remove a person who has left &mdash; it is live, so the change is
        everybody&rsquo;s the moment you save it.
      </p>
      <DirectoryList />
    </div>
  )
}
