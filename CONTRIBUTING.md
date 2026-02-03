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
