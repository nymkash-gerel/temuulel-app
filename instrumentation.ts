export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')

    // After Sentry, so a fatal misconfiguration is itself reported. Throws on a
    // missing required var in production — see src/lib/env.ts.
    const { checkEnvOnBoot } = await import('./src/lib/env')
    checkEnvOnBoot()
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = async (...args: unknown[]) => {
  const { captureRequestError } = await import('@sentry/nextjs')
  // @ts-expect-error — Sentry types may not match Next.js instrumentation signature exactly
  return captureRequestError(...args)
}
