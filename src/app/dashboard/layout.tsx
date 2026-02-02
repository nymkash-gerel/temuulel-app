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

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', user.id)
    .single()

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
      >
        {children}
      </DashboardLayout>
      <InstallPrompt />
    </SWRProvider>
  )
}
