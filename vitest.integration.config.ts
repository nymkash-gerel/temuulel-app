import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

/**
 * Integration test config. These tests under tests/ require a running + seeded
 * local Supabase (`supabase start` + `npx tsx scripts/seed-local.ts`) and hit the
 * real DB/network, so they are kept OUT of the default `npm test` unit run to keep
 * it deterministic. Run them explicitly with `npm run test:integration`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
