import { createClient } from '@/lib/supabase/server'
import DriverLayout from '@/components/driver/DriverLayout'
import LocationTracker from '@/components/driver/LocationTracker'
import ServiceWorkerRegistrar from '@/components/driver/ServiceWorkerRegistrar'
import InstallPrompt from '@/components/ui/InstallPrompt'

export const metadata = {
  title: 'Жолоочийн портал — Temuulel',
}

export default async function DriverRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // For auth pages (login/register), render without driver layout
  if (!user) {
    return <>{children}</>
  }

  // For authenticated pages, look up driver record
  const { data: driver } = await supabase
    .from('delivery_drivers')
    .select('id, name, status, vehicle_type')
    .eq('user_id', user.id)
    .single()

  // If no driver record, render without layout (handles edge cases)
  if (!driver) {
    return <>{children}</>
  }

  return (
    <DriverLayout driver={driver}>
      <ServiceWorkerRegistrar />
      <LocationTracker driverStatus={driver.status} />
      <InstallPrompt />
      {children}
    </DriverLayout>
  )
}
