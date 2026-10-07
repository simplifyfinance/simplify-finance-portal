import TeamSection from '@/components/TeamSection'
import { PAGE_READ } from '@/lib/page-width'

export const metadata = { title: 'Team' }

export default function TeamPage() {
  return (
    <div className={PAGE_READ}>
      <h1 className="text-2xl font-bold text-ink mb-1">Team</h1>
      <p className="text-sm text-gray-500 mb-8">Invite team members, manage roles, and activate or deactivate access.</p>
      <TeamSection />
    </div>
  )
}
