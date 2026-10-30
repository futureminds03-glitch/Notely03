# Notely — Release and Deployment Process

## Release policy

Notely is pre-1.0. The package version is the project version marker; production deployments are managed separately by Vercel. A Git commit, queued deployment, or successful build step alone is not proof that a production release is live.

## Standard release sequence

1. **Scope and risk**
   - Identify user-facing behavior, data migrations, configuration changes, and rollback risks.
   - Update product documentation and CHANGELOG.md alongside implementation.
2. **Code review**
   - Review the diff for correctness, authorization, secrets, dependencies, and regression risk.
   - Confirm the repository is futureminds03-glitch/Notely03 and the branch is main.
3. **Local validation**
   - Install from the pnpm lockfile with a frozen install.
   - Run the production build.
   - Run Playwright regression tests and focused tests for changed behavior.
4. **Merge and deploy**
   - Merge approved changes to main.
   - Wait for the corresponding Vercel deployment to reach a terminal state.
   - Confirm deployment is READY and corresponds to the expected commit.
5. **Production smoke checks**
   - Confirm the production URL returns HTTP 200.
   - Check browser console/network and core flows: create/edit/save, switch notes, reload, search, Time Travel/restore, export, and auth/cloud flows where credentials are available.
   - Confirm API-dependent features behave with configured and missing optional services.
6. **Release record**
   - Add a dated CHANGELOG.md entry with user-facing changes, fixes, and known limitations.
   - Publish a GitHub Release only after validation and an intentional version/tag choice.
   - Record commit SHA, deployment ID/status, CI run, and smoke-test outcomes.

## Rollback

For a bad deployment, identify the last known-good deployment and compare the failing commit and runtime evidence. Use Vercel's supported rollback/promotion workflow after assessing database compatibility. Do not roll back code independently of an incompatible irreversible schema migration without a recovery plan.

## Definition of done

A release is verified only when:
- the intended commit is identified;
- required CI/E2E checks have terminal successful results;
- Vercel deployment is READY and linked to that commit;
- production smoke checks pass;
- changelog and release metadata accurately describe what shipped.

If any check is blocked, report the exact blocker and mark the release as not fully verified.
