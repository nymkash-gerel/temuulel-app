import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPatientSchema, parsePagination } from '@/lib/validations'
import { toJson } from '@/lib/supabase/json'

/**
 * GET /api/patients
 *
 * List patients for the store. Supports search on first_name/last_name via ilike.
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
  const search = searchParams.get('search')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('patients')
    .select(`
      id, first_name, last_name, date_of_birth, gender, blood_type, phone, email, allergies, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/patients
 *
 * Create a new patient.
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

  const { data: body, error: validationError } = await validateBody(request, createPatientSchema)
  if (validationError) return validationError

  const { data: patient, error } = await supabase
    .from('patients')
    .insert({
      store_id: store.id,
      first_name: body.first_name,
      last_name: body.last_name,
      customer_id: body.customer_id || null,
      date_of_birth: body.date_of_birth || null,
      gender: body.gender || null,
      blood_type: body.blood_type || null,
      phone: body.phone || null,
      email: body.email || null,
      emergency_contact: toJson(body.emergency_contact || {}),
      allergies: body.allergies || [],
      insurance_info: toJson(body.insurance_info || {}),
    })
    .select(`
      id, first_name, last_name, date_of_birth, gender, blood_type, phone, email, allergies, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(patient, { status: 201 })
}
