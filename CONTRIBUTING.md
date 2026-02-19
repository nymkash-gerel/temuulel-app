# Contributing to Temuulel

## Branch Naming

Use prefixes to categorize your work:

- `feat/` — new features (e.g., `feat/loyalty-points`)
- `fix/` — bug fixes (e.g., `fix/order-total-calc`)
- `chore/` — maintenance, deps, CI (e.g., `chore/upgrade-next`)
- `docs/` — documentation changes

## PR Workflow

1. Create a branch from `main`
2. Make your changes and commit
3. Push and open a Pull Request against `main`
4. CI must pass (tests, lint, type-check, build, E2E)
5. Get at least 1 approval
6. Merge via **squash merge**

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add loyalty points redemption
fix: correct order total calculation with discounts
chore: upgrade Next.js to 16.1
docs: update API endpoint reference
```

## Development

```bash
npm install              # install dependencies
npm run dev              # start dev server (localhost:3000)
```

## Testing

```bash
npm test                 # run unit tests (Vitest)
npm run test:e2e         # run E2E tests (Playwright, requires .env.local)
npm run test:e2e:ui      # run E2E tests with Playwright UI
```

## Before Pushing

```bash
npx tsc --noEmit         # type-check (must be zero errors)
npm run lint             # ESLint
npm run build            # production build
```

## Database Changes

If your PR includes Supabase migration files:

1. Test locally with `supabase db reset`
2. Regenerate types: `npm run gen:types`
3. Include the updated `src/lib/database.types.ts` in your commit
4. Include a `-- ROLLBACK:` comment block in your migration (see below)
5. Deploy to staging first, then production via `workflow_dispatch`

### Migration Rollback Template

Every migration file should include a rollback comment block at the top:

```sql
-- ROLLBACK:
-- To undo this migration, run the following SQL:
--   DROP TABLE IF EXISTS new_table;
--   ALTER TABLE existing_table DROP COLUMN IF EXISTS new_column;
```

### Migration Deployment Order

1. **Staging first** — Go to Actions > Deploy Migrations > target: `staging` > type "migrate"
2. **Verify on staging** — Check the Vercel preview deployment works correctly
3. **Production** — Go to Actions > Deploy Migrations > target: `production` > type "migrate"

## Environments

| Environment | Supabase | App URL | Deploy Trigger |
|-------------|----------|---------|----------------|
| **Local** | `localhost:54321` (supabase start) | `localhost:3000` | `npm run dev` |
| **Staging** | `phppcaouxkzkebnmbnfv.supabase.co` | Vercel Preview URLs | Push to PR branch |
| **Production** | `yglemwhbvhupoqniyxog.supabase.co` | Production domain | Merge to `main` |

### Environment Variables

- **Local** — `.env.local` (not committed)
- **Staging (Preview)** — Vercel project settings, Preview scope
- **Production** — Vercel project settings, Production scope
- **CI** — GitHub repository secrets
