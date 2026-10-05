import TeamSection from '@/components/TeamSection'

export const metadata = { title: 'Team' }

export default function TeamPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-1">Team</h1>
      <p className="text-sm text-gray-500 mb-8">Invite team members, manage roles, and activate or deactivate access.</p>
      <TeamSection />
    </div>
  )
}
