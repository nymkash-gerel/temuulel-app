import { NextRequest, NextResponse } from 'next/server'
import { getFlowTemplate, getAllFlowTemplates } from '@/lib/flow-templates'

/**
 * GET /api/flows/templates?business_type=restaurant
 * Returns pre-built flow template(s). If business_type is specified, returns
 * that single template. Otherwise returns all.
 */
export async function GET(request: NextRequest) {
  const businessType = request.nextUrl.searchParams.get('business_type')

  if (businessType) {
    const template = getFlowTemplate(businessType)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json({ template })
  }

  const templates = getAllFlowTemplates()
  return NextResponse.json({
    templates: templates.map(t => ({
      business_type: t.business_type,
      name: t.name,
      description: t.description,
      trigger_type: t.trigger_type,
      node_count: t.nodes.length,
    })),
  })
}
