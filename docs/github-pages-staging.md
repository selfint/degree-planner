# GitHub Pages staging

This branch starts at staging commit `38ff9f8ecbdfc61076aec61b30495ab7647e22d7`.
It adds an opt-in static build without changing the default Vercel build.

## Build and test

```sh
npm ci
BASE_PATH=/degree-planner npm run build:pages
BASE_PATH=/degree-planner npx playwright test --config playwright.pages.config.ts
```

Use `BASE_PATH=''` for a root-hosted custom domain. The base affects app links,
public JSON, share links, worker registration, offline caches and build identity.
`build/` contains the complete static app and `storybook/`. Fixed console routes
have real HTML files; dynamic course and shared-plan URLs use `404.html` to start
the client router. A first direct dynamic request has HTTP 404 status on Pages,
although the app then renders the route. Installed offline navigations use the
cached shell at `app/offline/`.

The Pages staging workflow builds and browser-tests both root and repository-prefix
artifacts on Ubuntu 24.04, which is supported by the pinned Playwright release.
Pull requests to `staging` run only static build/browser validation, with production
analytics disabled. They cannot enter the deployment job.

The owner approved replacing the existing Pages site on 2026-11-03. Only pushes
to `feat/github-pages-staging` (or its explicitly approved manual dispatch) can
publish to `https://tom.selfin.io/degree-planner/` after those checks pass.
The combined Pages and analytics PR uses `feat/posthog-analytics`; updating that
branch does not publish Pages. `vercel.json` disables Vercel Git deployments for
both feature branches. Other branches retain their existing behavior.

## Existing site and publication gate

GitHub permits one Pages site per repository. At preparation time,
`https://selfint.github.io/degree-planner/` redirects to
`https://tom.selfin.io/degree-planner/`. Publishing this repository's Pages
artifact replaces that site's content. A branch alone is not an isolated site.
The current source settings were not accessible from the signed-out browser.

The owner approved replacing this existing site with the staging app on 2026-11-03.
The workflow reads Pages metadata, refuses any destination mismatch, and requires
GitHub Actions as the publishing source. The built-in workflow token cannot
change that administrative setting. It preserves the custom
domain and does not change production hosting, DNS, or branch protections.

Deployment stays within the existing `github-pages` environment and its configured
approvals/branch rules. If the workflow token cannot read or update Pages settings,
or the environment blocks the branch, stop and request the specific necessary
setup action. Do not create alternate credentials or bypass environment rules.

Manual dispatch is also available once this workflow exists on the default branch;
it must use `deploy=true` and the exact approved URL. Initial deployment uses the
feature branch's push workflow, so no default/staging branch merge is required.
The official configure/upload/deploy Pages actions build with the actual base path.

Official references:

- https://svelte.dev/docs/kit/adapter-static
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://vercel.com/docs/project-configuration/git-configuration

## Data and authentication

Guest plans, preferences and downloaded public data are browser-origin scoped.
A different hostname cannot read the Vercel origin's guest plan or login state.
Export/import or explicitly chosen account sign-in is needed; this branch never
silently copies private browser data between origins. Path prefixes on the same
origin still share the existing localStorage/IndexedDB keys. Worker caches and
update locks are scoped to the deployment path to avoid controlling sibling sites.

Firebase project and saved-plan schema are unchanged. A newly selected hostname
must already be in Firebase Authentication's authorized domains before Google
sign-in can work. Verify sign-in and saved-plan round-trip on the approved live
host before calling the migration ready. Adding an authorized domain changes
security configuration and requires separate approval. No Firebase settings or
saved plans were modified while preparing this branch.

## Validation status before publication

The static root and repository-prefix artifacts build locally. The unit suite
passes; the built-worker integration gate is run against the root artifact.
Local browser execution is blocked by the execution sandbox's socket policy,
so the workflow runs browser checks against a Pages-like server serving only the
built files, not a SvelteKit SSR preview. Test reports remain the source of truth
for the exact published commit. The existing staging baseline has unrelated
TypeScript check failures; these are not silently suppressed.
