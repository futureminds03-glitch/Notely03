# Contributing to Notely

Thanks for helping improve Notely. Changes should preserve the core promise: fast, dependable personal writing.

## Before changing code
- Confirm the repository is futureminds03-glitch/Notely03 and work from the current main branch.
- Read the [product brief](docs/PRODUCT_BRIEF.md) and [architecture notes](docs/ARCHITECTURE.md).
- Identify whether the change affects persistence, account isolation, history, AI, URL fetching, or deployment.

## Engineering expectations
- Keep edits focused and explain the user-visible reason in the commit message.
- Use TypeScript types and validate untrusted API input.
- Preserve authenticated ownership checks and Supabase row-level security assumptions.
- Never log secrets or add real credentials, personal note content, or production user data to tests.
- Avoid unnecessary dependencies; keep pnpm-lock.yaml in sync with package changes.
- Do not describe untested behavior as verified.
- Add or update Playwright coverage for user-facing flows and regressions.

## Validation

    pnpm install --frozen-lockfile
    pnpm build
    npx playwright install chromium
    npx playwright test tests/e2e --reporter=list

For external-service changes, test missing configuration and failure responses as well as the happy path. Review the actual GitHub Actions run and Vercel deployment after changes land.

## Pull requests
Include:
1. Problem and intended outcome.
2. Implementation summary.
3. Risk and data-migration notes.
4. Validation performed, with actual outcomes.
5. Screenshots or recordings for meaningful UI changes when available.
6. Deployment evidence for production-impacting changes.

## Versioning
Notely is pre-1.0. Choose version bumps deliberately, document user-facing changes in CHANGELOG.md, and follow the [release process](docs/RELEASE_PROCESS.md). Do not create a release tag merely because a commit has shipped.
