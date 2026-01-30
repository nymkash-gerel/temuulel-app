import postgres, { Sql } from 'postgres'

// Direct PostgreSQL connection - bypasses PostgREST schema cache
// For local Supabase: postgres://postgres:postgres@127.0.0.1:54322/postgres
// For hosted Supabase: Use the connection string from Dashboard > Settings > Database

let _sql: Sql | null = null

export function getDb(): Sql {
  if (!_sql) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
    _sql = postgres(connectionString, {
      max: 1, // Use single connection for serverless
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }
  return _sql
}
