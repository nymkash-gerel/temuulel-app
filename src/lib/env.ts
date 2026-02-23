import { z } from 'zod'

/**
 * Centralized environment variable validation.
 *
 * Validates ALL required env vars at import time so missing/invalid
 * values surface immediately on startup rather than silently at runtime.
 */

const serverSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1),

  // Resend (email)
  RESEND_API_KEY: z.string().optional(),

  // QPay
  QPAY_USERNAME: z.string().optional(),
  QPAY_PASSWORD: z.string().optional(),
  QPAY_INVOICE_CODE: z.string().optional(),

  // Facebook OAuth
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),

  // Cron
  CRON_SECRET: z.string().optional(),

  // QStash (webhook delivery)
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

  // Web Push
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  // Node env
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type ServerEnv = z.infer<typeof serverSchema>

function validateEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')

    console.error(
      `\n[env] Missing or invalid environment variables:\n${formatted}\n`
    )

    // In production, fail hard. In dev/test, warn but continue.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Environment validation failed. See logs above.')
    }
  }

  return (result.success ? result.data : serverSchema.parse({
    ...process.env,
    // Provide fallbacks for dev only so the app can still start
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-service-key',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-dev',
  })) as ServerEnv
}

export const env = validateEnv()
