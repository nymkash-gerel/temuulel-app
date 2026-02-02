import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createServicePackageSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/packages
 *
 * List service packages for the store. Supports filtering by is_active.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const isActive = searchParams.get('is_active')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('service_packages')
    .select(`
      id, name, description, price, original_price, valid_days, is_active, created_at, updated_at,
      package_services(id, service_id, quantity, services(id, name))
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (isActive === 'true') {
    query = query.eq('is_active', true)
  } else if (isActive === 'false') {
    query = query.eq('is_active', false)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/packages
 *
 * Create a new service package. Optionally include services to link.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { data: body, error: validationError } = await validateBody(request, createServicePackageSchema)
  if (validationError) return validationError

  const { services, ...packageData } = body

  const { data: pkg, error } = await supabase
    .from('service_packages')
    .insert({
      store_id: store.id,
      name: packageData.name,
      description: packageData.description || null,
      price: packageData.price,
      original_price: packageData.original_price || null,
      valid_days: packageData.valid_days || undefined,
      is_active: packageData.is_active,
    })
    .select(`
      id, name, description, price, original_price, valid_days, is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If services provided, insert package_services
  if (services && services.length > 0) {
    const packageServices = services.map((s: { service_id: string; quantity?: number }) => ({
      package_id: pkg.id,
      service_id: s.service_id,
      quantity: s.quantity || 1,
    }))

    const { error: linkError } = await supabase
      .from('package_services')
      .insert(packageServices)

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }
  }

  // Re-fetch with joins
  const { data: result } = await supabase
    .from('service_packages')
    .select(`
      id, name, description, price, original_price, valid_days, is_active, created_at, updated_at,
      package_services(id, service_id, quantity, services(id, name))
    `)
    .eq('id', pkg.id)
    .single()

  return NextResponse.json(result, { status: 201 })
}
