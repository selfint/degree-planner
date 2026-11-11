# Production and staging on GitHub Pages

The existing Pages site now publishes two builds in **one artifact**:

- Production: https://tom.selfin.io/degree-planner/
- Staging: https://tom.selfin.io/degree-planner/staging/

Production keeps its analytics configuration. Staging sets
`PUBLIC_DEPLOYMENT_ENV=staging`: PostHog, Firebase Google Analytics and Vercel
analytics/speed insights are disabled **before initialization**, even if live
analytics keys are present. There is deliberately no browser toggle that can
accidentally send staging traffic to production analytics.

Staging is publicly accessible, just like production. It has an always-visible
English/Hebrew warning and a separately named “PlanIt Staging” installable app.
It is not an isolated database or a private preview.

## Shared Firebase is intentional

Both builds use the same Firebase project, app configuration, auth persistence,
Firestore collections and account documents. **Saving a signed-in plan on staging
changes the real production plan.** A shared login can also sign in or sign out
both apps. Use a disposable test account or export a backup before destructive
experiments. No Firebase project, authorized domain, security rule or account
setting is changed by this implementation.

The hostname is unchanged, so this second path does not require adding an auth
domain. Firebase service unit tests verify identical configuration and persistence
with telemetry disabled; built browser tests deliberately use guest fixtures and
block external account requests. A real Google sign-in and account-save round
trip still needs verification on the deployed site. Do not label fixture coverage
as a real-account test.

App-owned browser state is separate: staging prefixes guest plans (including
legacy migration keys), preferences, session dismissals, recovery flags and both
public-data IndexedDB databases with `planit.staging.`. Existing production keys
are preserved. Guest plans do not automatically appear in the other environment;
signed-in account plans do. Firebase SDK storage remains intentionally shared.

## Deployment and branch strategy

The workflow remains `.github/workflows/pages-staging.yml`. Merge this single PR
into `main` to activate it; opening the PR does not deploy anything.

Every main push builds and verifies both URLs, then publishes one combined Pages
artifact. By default both builds use main, with different base paths and telemetry
policies. This provides an analytics-free copy immediately without resurrecting
an older staging branch.

To test an unmerged candidate:

1. Branch from main **after this implementation has merged**, and push changes
   to that feature branch. An older branch without the staging safety contract
   fails assembly rather than publishing analytics-enabled staging.
2. Run the **GitHub Pages** workflow from **main**.
3. Set `deploy=true`, keep the exact approved Pages URL, and set `staging_ref`
   to the candidate branch, tag or complete commit SHA from this repository.
4. The workflow builds production from its main commit and staging from the
   resolved candidate SHA. Staging browser checks must pass before publication.
   Both SHAs are recorded in the workflow summary. Neither source branch is changed.

A one-off `staging_ref` selection lasts until the next publication. The next main
push returns staging to main by default, which is useful after promoting a
candidate. If a persistent staging branch is wanted, the owner may set the
repository Actions variable `PLANIT_STAGING_REF` to its name. An explicit dispatch
input overrides that variable. Pushes to that branch alone do not publish: run
this workflow from main to refresh it. No variable or repository setting is
changed automatically. `deploy=false` validates the current workflow ref's pair
without publication; candidate-ref validation happens in the publication job.

## One site, one safe publication

GitHub permits only one Pages site per repository. Publishing a staging-only
artifact would erase production, so `scripts/buildPagesPair.mjs` always builds
both and `scripts/combinePages.mjs` nests staging under `staging/`.

Production and staging have separate asset paths, app manifest IDs, service worker
scopes (`/degree-planner/app/` and `/degree-planner/staging/app/`), shell caches and
update locks. The environment is also part of the reproducible build identity.

GitHub Pages uses a single site-wide `404.html`, even for nested paths. The combined
404 dispatcher fetches the correct app's fallback **before running either app**.
It does not redirect or alter the URL, so dynamic course links and private shared
plan queries/fragments survive reloads. As before, a first dynamic request has
HTTP 404 status even though the client app then renders the route. The staging
fallback is never bootstrapped through production analytics.

The workflow verifies the existing destination and Actions publishing mode. It
never changes Pages settings, DNS, custom domains, environment protection rules,
Firebase configuration or branch contents. Existing `github-pages` approvals and
branch restrictions still apply. Only main can publish, and the final revision
check skips a build if either main or the selected staging ref moved while it
was building. The existing publication concurrency lock is retained.

## Local and CI verification

```sh
npm ci
npm run check
npm run lint
npm run test:unit -- --run
BASE_PATH=/degree-planner PUBLIC_POSTHOG_KEY=phc_test_only \
  PUBLIC_POSTHOG_HOST=https://posthog.example.test npm run build:pages:pair
npx playwright install --with-deps chromium
BASE_PATH=/degree-planner npx playwright test --config playwright.pages.config.ts
BASE_PATH=/degree-planner npx playwright test --config playwright.analytics.config.ts
BASE_PATH=/degree-planner npx playwright test --config playwright.staging.config.ts
```

Pages CI runs these same suites through `scripts/runPagesBrowserTests.mjs` in
Microsoft's official Playwright container, pinned by version and digest. Its
preinstalled Chromium and system dependencies avoid runtime Ubuntu mirror/DNS
failures. The static server and browser stay local inside the container; only
`CI` and `BASE_PATH` are forwarded, and failures retain their exit status.
Update the image pin with `@playwright/test` upgrades; a unit test catches drift.
Build and publication steps remain on the hosted runner with their existing
Node version, credentials, destination guards and approvals.

Repeat built tests with `BASE_PATH=''` for root-hosted compatibility. CI tests
both deployment bases. Test network routes block real analytics/account requests;
production analytics assertions intercept only a fake PostHog endpoint. Staging
tests check no telemetry attempts, saves without production guest changes, cold
share/course fallbacks, reload/history, mobile and desktop warnings, separate
manifests/workers/caches, and offline navigation. Unit tests also verify no
Firebase Analytics support probe or initialization on staging.

For a separate candidate checkout, install its dependencies and set
`STAGING_SOURCE_DIR=/absolute/path/to/candidate` when running `build:pages:pair`
from the production checkout. Build output remains in production's `build/`.
Use results from the exact PR or merged SHA, and distinguish full builds, focused
checks and real live-host authentication. Never claim a URL is deployed just
because the PR's configuration exists.

Official references:

- https://svelte.dev/docs/kit/adapter-static
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://playwright.dev/docs/docker
