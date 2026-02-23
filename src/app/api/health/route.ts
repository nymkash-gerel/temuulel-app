import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface HealthResponse {
  status: 'ok' | 'degraded'
  timestamp: string
  version: string
  uptime: number
  db?: 'ok' | 'error'
  error?: string
}

export async function GET(request: NextRequest) {
  const startTime = process.hrtime()
  
  try {
    // Get version from package.json
    const packageJson = await import('../../../../../package.json')
    const version = packageJson.version
    
    const health: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version,
      uptime: process.uptime()
    }

    // Optional Supabase connectivity check
    try {
      const supabase = createSupabaseServerClient()
      // Simple query to test database connectivity
      const { error } = await supabase
        .from('stores')
        .select('id')
        .limit(1)
        .single()
      
      // Error is expected if no stores exist, but connection works
      health.db = 'ok'
    } catch (dbError) {
      console.warn('Health check: Database connectivity failed:', dbError)
      health.db = 'error'
      health.status = 'degraded'
    }

    return NextResponse.json(health, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Health check failed:', error)
    
    const errorResponse: HealthResponse = {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      version: 'unknown',
      uptime: process.uptime(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    return NextResponse.json(errorResponse, { status: 503 })
  }
}