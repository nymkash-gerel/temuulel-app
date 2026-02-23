/**
 * Environment variable validation
 * Validates required env vars at import time, warns for optional ones
 */

// Required environment variables
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
  'SUPABASE_SERVICE_ROLE_KEY'
] as const

// Optional environment variables 
const OPTIONAL_ENV_VARS = [
  'UPSTASH_REDIS_REST_URL',
  'OPENAI_API_KEY', 
  'SENTRY_DSN'
] as const

export const isProduction = process.env.NODE_ENV === 'production'

/**
 * Validate environment variables
 * Throws in production if required vars are missing
 * Warns in development if required vars are missing
 */
export function validateEnv(): {
  valid: boolean
  missingRequired: string[]
  missingOptional: string[]
} {
  const missingRequired: string[] = []
  const missingOptional: string[] = []

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar)
    }
  }

  // Check optional variables
  for (const envVar of OPTIONAL_ENV_VARS) {
    if (!process.env[envVar]) {
      missingOptional.push(envVar)
    }
  }

  // Log warnings for missing required vars
  if (missingRequired.length > 0) {
    const message = `Missing required environment variables: ${missingRequired.join(', ')}`
    
    if (isProduction) {
      console.error(message)
      throw new Error(message)
    } else {
      console.warn(message)
    }
  }

  // Log warnings for missing optional vars
  if (missingOptional.length > 0) {
    console.warn(`Missing optional environment variables: ${missingOptional.join(', ')}`)
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional
  }
}

// Auto-validate at import time
validateEnv()