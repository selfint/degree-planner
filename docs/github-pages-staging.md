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

The Pages staging workflow automatically builds and browser-tests both root and
repository-prefix artifacts. It does **not** automatically publish them.
`vercel.json` disables Vercel Git deployments for `feat/github-pages-staging`
only. Other branches retain their existing behavior.

## Existing site and publication gate

GitHub permits one Pages site per repository. At preparation time,
`https://selfint.github.io/degree-planner/` redirects to
`https://tom.selfin.io/degree-planner/`. Publishing this repository's Pages
artifact replaces that site's content. A branch alone is not an isolated site.
The current source settings were not accessible from the signed-out browser.

Do not publish until the owner explicitly approves replacing that existing site
or selects a separate repository. No production switch, DNS change, or merge is
part of this branch.

After confirming the destination, Pages must use GitHub Actions as its source
and permit the intended branch in its `github-pages` environment. Run the
workflow manually with `deploy=true` and the exact approved Pages URL as
`expected_url`. The workflow reads the current Pages metadata, refuses a URL
mismatch, rebuilds with the reported base path, uploads the Pages artifact, and
uses the official `actions/deploy-pages` action. Manual workflow dispatch
requires the workflow to exist on the repository's default branch; deciding how
to enable the initial deployment is a separate authorized setup step, not a
reason to merge this migration into production.

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
