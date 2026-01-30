import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ChatWidget from '@/components/ui/ChatWidget'

interface EmbedPageProps {
  params: Promise<{ storeId: string }>
}

export default async function EmbedPage({ params }: EmbedPageProps) {
  const { storeId } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: store } = await supabase
    .from('stores')
    .select('name, chatbot_settings')
    .eq('id', storeId)
    .single()

  if (!store) {
    notFound()
  }

  const settings = (store.chatbot_settings || {}) as Record<string, unknown>
  const accentColor = (settings.accent_color as string) || '#3b82f6'
  const welcomeMessage = (settings.welcome_message as string) || undefined

  return (
    <ChatWidget
      storeId={storeId}
      storeName={store.name}
      accentColor={accentColor}
      welcomeMessage={welcomeMessage}
    />
  )
}
