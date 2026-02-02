import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createCaseDocumentSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/case-documents
 *
 * List case documents for the store. Supports filtering by case_id, document_type.
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
  const caseId = searchParams.get('case_id')
  const documentType = searchParams.get('document_type')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('case_documents')
    .select(`
      id, case_id, name, document_type, file_url, file_size, uploaded_by, notes, created_at, updated_at,
      legal_cases(id, title, case_number),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (caseId) {
    query = query.eq('case_id', caseId)
  }

  if (documentType) {
    query = query.eq('document_type', documentType)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/case-documents
 *
 * Create a new case document.
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

  const { data: body, error: validationError } = await validateBody(request, createCaseDocumentSchema)
  if (validationError) return validationError

  // Verify case belongs to store
  const { data: legalCase } = await supabase
    .from('legal_cases')
    .select('id')
    .eq('id', body.case_id)
    .eq('store_id', store.id)
    .single()

  if (!legalCase) {
    return NextResponse.json({ error: 'Legal case not found in this store' }, { status: 404 })
  }

  const { data: document, error } = await supabase
    .from('case_documents')
    .insert({
      store_id: store.id,
      case_id: body.case_id,
      name: body.name,
      document_type: body.document_type || undefined,
      file_url: body.file_url || null,
      file_size: body.file_size || null,
      uploaded_by: body.uploaded_by || null,
      notes: body.notes || null,
    })
    .select(`
      id, case_id, name, document_type, file_url, file_size, uploaded_by, notes, created_at, updated_at,
      legal_cases(id, title, case_number),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(document, { status: 201 })
}
