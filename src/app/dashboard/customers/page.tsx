import { createClient } from '@/lib/supabase/server'
import { resolveStore } from '@/lib/resolve-store'
import { redirect } from 'next/navigation'
import CustomersClient from './customers-client'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const store = await resolveStore(supabase, user.id)
  if (!store) redirect('/login')

  const { data: customers } = await supabase
    .from('customers')
    .select(`
      id, name, phone, email, messenger_id, instagram_id, whatsapp_id, channel, created_at,
      orders(id, total_amount, status)
    `)
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  // Fetch return requests and interactions separately
  const customerIds = (customers || []).map(c => c.id)

  // Supabase chained .in() causes "Type instantiation is excessively deep" — suppress
  let returns: { id: string; customer_id: string }[] = []
  let interactions: { id: string; customer_id: string; interaction_type: string }[] = []
  if (customerIds.length > 0) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    // Supabase .in()/.filter() on customer_interactions triggers TS deep type instantiation — use any
    const rRes = await (supabase as any).from('return_requests').select('id, customer_id').eq('store_id', store.id).in('customer_id', customerIds)
    returns = rRes.data ?? []
    const iRes = await (supabase as any).from('customer_interactions').select('id, customer_id, interaction_type').eq('store_id', store.id).in('customer_id', customerIds)
    interactions = iRes.data ?? []
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  // Build lookup maps
  const returnsMap = new Map<string, { id: string }[]>()
  for (const r of returns || []) {
    if (!returnsMap.has(r.customer_id)) returnsMap.set(r.customer_id, [])
    returnsMap.get(r.customer_id)!.push({ id: r.id })
  }

  const interactionsMap = new Map<string, { id: string; interaction_type: string }[]>()
  for (const i of interactions || []) {
    if (!interactionsMap.has(i.customer_id)) interactionsMap.set(i.customer_id, [])
    interactionsMap.get(i.customer_id)!.push({ id: i.id, interaction_type: i.interaction_type })
  }

  const enriched = (customers || []).map(c => ({
    ...c,
    return_requests: returnsMap.get(c.id) || [],
    customer_interactions: interactionsMap.get(c.id) || [],
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <CustomersClient initialCustomers={enriched as any} />
}
