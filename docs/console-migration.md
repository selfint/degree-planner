# Console migration

## Review stages

One replacement PR preserves the direct-JSON, entity IndexedDB and PWA work
from PRs 214, 217 and 218. Those superseded PRs were closed after the replacement
preview was verified. No merge is part of this work. SAP and CI PRs stay separate.

1. Move SvelteKit console routes under same-origin `/app/`; preserve public
   bookmarks/share links with redirects and unchanged query parameters.
2. Isolate the statically rendered landing. It loads UI preferences only, with
   no Firebase, public-data initialization, analytics or PWA registration.
3. Bootstrap the client-first console with a visible loading screen and parallel
   authentication/public IndexedDB initialization. Download all courses and the
   catalog index, retain cached public data offline, and refresh on reconnect. Complete cached data opens immediately while the network refresh runs in the background.
   Degree requirements remain selected/on-demand.
4. Scope installation and the service worker to `/app/`. Preserve legacy caches
   and old open windows during migration. Never force reload an unsaved draft.
5. Make guest/account plans read-only offline, at both UI and write boundaries.
   No queue, private offline persistence migration or conflict resolver is added.
6. Verify routes, languages/mobile, offline reloads, storage continuity and startup
   requests. Document measured bundle sizes and actual browser-test evidence.

## Instrumentation

Existing console analytics are optional dynamic imports after console boot.
PostHog remains exploratory: no new provider, credential, account or paid service
is introduced. Measurements, not assumptions, determine the largest contributors.

## Mobile review

1. Open the preview landing, change language/theme, and choose Get Started.
2. The address enters `/app/` and shows a loading screen. Wait for all courses
   to be ready offline, then open a course you have not visited.
3. Disconnect, open another course and reload. Plans must remain read-only.
4. Reconnect before editing or saving. Existing saved data must remain present.
5. Install from the console with Add to Home Screen. On iOS, browser and installed
   app storage can differ; verify the expected plan before switching.

Physical iOS airplane mode, standalone cold-start and live Google login need
manual device verification. Preview Google login also requires its exact hostname
in Firebase authorized domains; this migration does not change security settings.

Existing root-scope installations receive a redirect-only compatibility worker after the /app/ shell and complete public course/catalog storage are verified. It preserves old installed /plan launches offline, does not cache landing or data, and waits for old tabs to close before activation. Fresh visits install only the /app/ worker.

## Focused deployed mobile review

Run the separate browser suite against a published HTTPS origin, without starting
or substituting a local build:

```sh
PREVIEW_URL=https://degree-planner-git-feat-console-migration-selfints-projects.vercel.app/ \
  npx playwright test --config=playwright.preview.config.ts
```

During this migration, CI runs this suite only for the same-repository
`feat/console-migration` branch that owns the preview alias. Before and after
browser checks it verifies the expected PR head is still current and has a
successful Vercel status. The branch alias is mutable; the response bytes do not
independently attest an immutable deployment SHA.

The five isolated 390px Chromium journeys cover English/Hebrew preferences and
loading, unvisited offline courses and reloads using the deployed worker, console
home navigation and Back/Forward, read-only guest actions and reconnect writes,
and iPhone-user-agent install guidance. Screenshots and sanitized QA JSON are
uploaded even on failures. No real account is used. The deliberate course-data
pause checks the loading screen, not natural startup speed. Physical iOS and
live account login remain outside this emulation; old-install migration and
controlled update transitions stay in the production-build proxy suite.
