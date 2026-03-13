import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

/**
 * GET /api/cron/reactivate-delayed
 *
 * Vercel Cron handler — runs every 30 minutes.
 * Finds deliveries with status='delayed' whose estimated_delivery_time has passed,
 * transitions them back to 'pending' so they appear on the delivery page for reassignment.
 *
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  // Find delayed deliveries whose estimated time has passed
  const { data: delayedDeliveries, error: fetchErr } = await supabase
    .from('deliveries')
    .select('id, delivery_number, store_id, driver_id, estimated_delivery_time')
    .eq('status', 'delayed')
    .not('estimated_delivery_time', 'is', null)
    .lte('estimated_delivery_time', now)

  if (fetchErr) {
    console.error('[cron/reactivate-delayed] Fetch error:', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!delayedDeliveries || delayedDeliveries.length === 0) {
    return NextResponse.json({ ok: true, reactivated: 0 })
  }

  let reactivatedCount = 0

  for (const delivery of delayedDeliveries) {
    const del = delivery as Record<string, unknown>

    // Reactivate: set status back to 'pending', clear driver assignment
    // so it appears in needs_action on the delivery page
    const { error: updateErr } = await supabase
      .from('deliveries')
      .update({
        status: 'pending',
        driver_id: null,
        notes: `Хойшлуулсан хугацаа дууслаа — дахин хүргэлтэнд бэлэн`,
        updated_at: now,
      })
      .eq('id', del.id as string)

    if (updateErr) {
      console.error(`[cron/reactivate-delayed] Update failed for ${del.id}:`, updateErr)
      continue
    }

    // Log the status change
    await supabase.from('delivery_status_log').insert({
      delivery_id: del.id,
      status: 'pending',
      changed_by: 'system/cron',
      notes: 'Хойшлуулсан хугацаа дууслаа — автоматаар идэвхжүүлэв',
    }).then(null, () => {})

    // Notify store
    await supabase.from('notifications').insert({
      store_id: del.store_id,
      type: 'delivery_assigned',
      title: `🔔 Хойшлуулсан хүргэлт бэлэн боллоо`,
      body: `#${del.delivery_number} — хойшлуулсан хугацаа дууслаа. Жолооч оноож хүргүүлнэ үү.`,
      metadata: { delivery_id: del.id, reason: 'delayed_reactivated' },
    }).then(null, () => {})

    reactivatedCount++
  }

  console.log(`[cron/reactivate-delayed] Reactivated ${reactivatedCount}/${delayedDeliveries.length} delayed deliveries`)
  return NextResponse.json({ ok: true, reactivated: reactivatedCount })
}
