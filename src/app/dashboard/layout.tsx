import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import SWRProvider from '@/components/providers/SWRProvider'
import InstallPrompt from '@/components/ui/InstallPrompt'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's store (as owner)
  let { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  // If not owner, check if team member
  let memberRole: string | null = null
  let memberPermissions: Record<string, boolean> | null = null
  if (!store) {
    const { data: membership } = await supabase
      .from('store_members')
      .select('store_id, role, permissions')
      .eq('user_id', user.id)
      .single()

    if (membership) {
      memberRole = membership.role
      // JSONB narrowing — permissions comes as Json from Supabase
      memberPermissions = (membership.permissions ?? null) as Record<string, boolean> | null
      const { data: memberStore } = await supabase
        .from('stores')
        .select('*')
        .eq('id', membership.store_id)
        .single()
      store = memberStore
    }
  } else {
    memberRole = 'owner'
  }

  // Get subscription
  const { data: subscription } = await supabase
    .from('store_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('store_id', store?.id ?? '')
    .single()

  return (
    <SWRProvider>
      <DashboardLayout
        user={{ email: user.email || '' }}
        store={store}
        subscription={subscription}
        memberRole={memberRole}
        memberPermissions={memberPermissions}
      >
        {children}
      </DashboardLayout>
      <InstallPrompt />
    </SWRProvider>
  )
}
