# GitHub Pages deployment

The static Pages build publishes the merged app to the existing repository site:
https://tom.selfin.io/degree-planner/. The default non-Pages build is unchanged.
The workflow remains at `.github/workflows/pages-staging.yml` for continuity.

## Automatic deployment from main

Once this workflow is merged into `main`, every push to `main`, including a PR
merge, triggers static validation and deployment. Validation builds and
browser-tests both root and repository-prefix artifacts. Only after both checks
and the existing-site inspection pass can the deployment
job publish. Existing `github-pages` environment approvals and branch rules still
apply, so an environment approval may be required before publication completes.

Pull requests targeting `main` or `staging` run the same static build/browser
validation with production analytics disabled. Pull requests and pushes to
feature or staging branches cannot enter this workflow's deployment job.
Review and merge the combined [PR #230](https://github.com/selfint/degree-planner/pull/230)
into `main` once. It includes the app promotion, analytics changes, and Pages
automation. That merge activates automatic publication after the gates pass.
The former promotion PR #178 is superseded; there is no intermediate staging merge.

The combined PR includes the app already merged into `staging`, because the older
`main` branch does not contain the static Pages build, routes or tests. Review
the complete app diff and the Pages automation together. Opening the PR does
not deploy it.

## Build and test

```sh
npm ci
BASE_PATH=/degree-planner npm run build:pages
npx playwright install --with-deps chromium
BASE_PATH=/degree-planner npx playwright test --config playwright.pages.config.ts
```

Repeat the build and test commands with `BASE_PATH=''` for a root-hosted artifact.
The base affects app links, public JSON, share links, worker registration, offline
caches and build identity. `build/` contains the complete static app and
`storybook/`. Fixed console routes have real HTML files; dynamic course and
shared-plan URLs use `404.html` to start the client router. A first direct dynamic
request has HTTP 404 status on Pages, although the app then renders the route.
Installed offline navigations use the cached shell at `app/offline/`.

The GitHub Pages workflow runs on Ubuntu 24.04, which is supported by the pinned
Playwright release. Browser tests use a Pages-like server serving only the built
files, not a SvelteKit SSR preview. Both base-path jobs must pass independently.

## Existing site and publication gate

GitHub permits one Pages site per repository. The approved destination is
`https://tom.selfin.io/degree-planner/`, reached through the existing custom-domain
setup. Publishing this repository's Pages artifact replaces that site's content.
A branch alone is not an isolated site.

The workflow reads Pages metadata, refuses any destination mismatch, and requires
GitHub Actions as the publishing source. The built-in workflow token cannot
change that administrative setting. The workflow does not change hosting
settings, the custom domain, DNS, branch protections or Firebase configuration.

Deployment stays within the existing `github-pages` environment and its configured
approvals/branch rules. If the workflow token cannot read Pages metadata, or the
environment blocks `main`, request the specific necessary setup action. Do not
create alternate credentials or bypass environment rules. Workflow-level
concurrency prevents overlapping validation/publication runs for the same ref.
GitHub may replace pending runs and does not guarantee commit-order execution;
active runs are not cancelled. The existing `pages-staging-publish` deployment
lock is also retained to serialize publication with any already-running release.

Immediately before uploading the artifact, the deployment job reads the current
`main` SHA. If it no longer matches the run's commit, the run emits a notice and
skips both upload and deployment. This also prevents a rerun of an older commit
from replacing the current app. A newer main push can still arrive after this
check, but its deployment must wait for the active publication lock.

Manual dispatch is available once this workflow exists on the default branch.
Select `main` and leave `deploy=false` for validation only. To republish `main`,
set `deploy=true` and supply the exact approved URL. Dispatches on other branches
cannot deploy. The official configure/upload/deploy Pages actions build with the
actual base path after checking that it belongs to the approved destination.

Official references:

- https://svelte.dev/docs/kit/adapter-static
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Data and authentication

Guest plans, preferences and downloaded public data are browser-origin scoped.
A different hostname cannot read the previous origin's guest plan or login state.
Export/import or explicitly chosen account sign-in is needed; this workflow never
silently copies private browser data between origins. Path prefixes on the same
origin still share the existing localStorage/IndexedDB keys. Worker caches and
update locks are scoped to the deployment path to avoid controlling sibling sites.

Firebase project and saved-plan schema are unchanged. A newly selected hostname
must already be in Firebase Authentication's authorized domains before Google
sign-in can work. Verify sign-in and saved-plan round-trip on the approved live
host before calling the migration ready. Adding an authorized domain changes
security configuration and requires separate approval. No Firebase settings or
saved plans are modified by this deployment configuration.

## Validation evidence

Use the GitHub Actions results for the exact promotion or merged commit as the
source of truth. The Pages workflow covers static build and browser behavior at
both bases; the separate Test workflow covers types, formatting, ESLint, unit
and browser suites. Neither a workflow configuration review nor checks from an
older commit establish that all checks passed for the new commit. Live-host
sign-in and saved-plan verification are separate from static artifact QA.
