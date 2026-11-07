<p align="center">
  <img src="https://raw.githubusercontent.com/selfint/degree-planner/refs/heads/main/static/favicon.webp" alt="Technion degree planner logo" width="150"/>
</p>

<p align="center">
  <a href="https://github.com/selfint/degree-planner/actions/workflows/test.yml">
    <img src="https://github.com/selfint/degree-planner/actions/workflows/test.yml/badge.svg" alt="Test Status">
  </a>
  <a href="https://github.com/selfint/degree-planner/actions/workflows/data.yml">
    <img src="https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/selfint/degree-planner/actions/workflows/data.yml/runs&logo=sap&label=Data&query=$.workflow_runs[0].created_at&color=blue&style=flat" alt="Data">
  </a>
</p>

<h1><p align="center">Technion Degree Planner</p></h1>

A tool for planning an entire Technion degree.

## Why?

For fun, this is an interesting project to work on.

## Data sources

1. ~Technion student services: https://students.technion.ac.il/local/technionsearch/course~ (deprecated)
1. Cheese fork histograms: https://michael-maltsev.github.io/technion-histograms
1. Technion SAP: https://portalex.technion.ac.il
1. Technion catalogs: https://ugportal.technion.ac.il/%d7%9e%d7%99%d7%93%d7%a2-%d7%9c%d7%a1%d7%98%d7%95%d7%93%d7%a0%d7%98%d7%99%d7%9d/%d7%a7%d7%98%d7%9c%d7%95%d7%92-%d7%9c%d7%99%d7%9e%d7%95%d7%93%d7%99%d7%9d/

## Problems to solve

1. It's hard to iterate on entire degree plan:
   These are the current solutions:
   - [Sogrim](https://students.sogrim.org/) doesn't take into account course prerequisites.
   - [CheeseFork](https://cheesefork.cf/) only supports current and previous semesters.

   Both solutions also don't support **rapid** course re-ordering.

1. It's hard to find interesting courses that also have high median grades:
   - [Sogrim](https://students.sogrim.org/) has no course search capabilities
     (other than course code -> name translation).

   - [CheeseFork](https://cheesefork.cf/) has amazing data, but missing advanced query capabilities:
     1. No way to sort courses by median grade.
     1. No way to get course median by semester/professor.
     1. Course median doesn't take into account course prerequisites median
        (so you might find a high median course, but its prerequisites have low medians).

## Data model and generation

The public catalog is a versioned Git snapshot of JSON, following Planit's
simpler direct-generation approach. The app's routes and course, catalog,
faculty, program, and path IDs are unchanged.

- `static/catalogs.json`: bilingual catalog → faculty → program names.
- `static/_catalogs/<catalog>/<faculty>/<program>/requirementsData.json`:
  one complete requirement tree per program, including nested paths and courses.
- `static/courseData.json`: canonical full course records.
- `static/courseDataStripped.json` and `static/_courses/<code>`: derived course
  views, still generated at build time for existing consumers.

There is no intermediate tree of tiny `en`, `he`, and `courses` files. Degree
names come from the manifest and selected-path names come from requirement JSON.
Existing shared `/preview/...` URLs and per-program JSON URLs continue to work.
The former individual catalog text-file endpoints are no longer used or emitted.

### Normal development and builds (no SAP access needed)

`npm run generate-catalogs` validates the checked-in catalog JSON and generates
only the derived course views. `npm run build` runs this before building the app.
A fresh checkout uses the complete committed JSON snapshot; raw SAP data is not
needed for development, CI, deployment, or offline browsing.

### Refreshing upstream data

`npm run update-catalogs` fetches the bilingual raw SAP catalog into
`scripts/.cache/catalogs.raw.json`, then converts it directly to the public JSON
files. The raw response is a local cache and is not committed. For an already
saved response, run `node scripts/generateCatalogData.mjs <raw-file.json>`.

The daily data workflow commits the manifest, program JSON, and full course
JSON together. The generator validates the complete input before writing and
publishes the manifest after all referenced program files. Invalid or empty SAP
responses fail the update rather than clearing the existing snapshot.

Updates retain historical programs and requirement nodes, matching the former
additive directory pipeline. Matching nodes receive new labels and course lists;
custom fields such as `points`, `count`, `amount`, `overflow`, and `hook` remain.
This preserves existing degree/path selections when SAP omits an old program.
Intentional catalog removals should be reviewed separately, not inferred from an
incomplete upstream response.

### Editing requirements

Edit the relevant program's `requirementsData.json`. A requirement contains:

- `name`: stable requirement/path ID
- `en` and `he`: English and Hebrew labels
- `courses`: course-code strings, preserving their leading zeroes
- `nested`: child requirements
- Optional `points`, `count`, `amount`, `overflow`, and `hook` fields for more
  complex requirements, as described by `Requirement` in `src/app.d.ts`

Do not rename IDs to change a display label. Label changes belong in `en`/`he`.
Regeneration refreshes SAP-sourced labels and course lists, so changes to those
fields should also be corrected upstream where possible.

### Compatibility checks

`npm run test:catalogs` compares direct generation with a frozen copy of the
former filesystem pipeline using identical bilingual SAP fixtures. It also
covers structure wrappers, duplicate groups, historical programs, custom fields,
invalid input, repeat generation, both UI languages, and selected-path labels.
Every committed program JSON is validated without network access.

The initial migration was additionally checked against the complete output of
the old build: all 1,183 programs and their bilingual manifest matched after
reconstructing equivalent SAP-shaped input from the same directory snapshot.
This is a representation migration, not a new live SAP scrape. Saved plans,
localStorage migrations, Firestore versions, transcript imports, and preview
link encoding are unchanged.

## Public data cache

Like [Planit](https://github.com/selfint/planit), opening the production app
synchronizes the existing full `courseData.json` and bilingual `catalogs.json`.
There is no new aggregate format or generated offline bundle.

- Full courses live as individual records keyed by code in the public-only
  `degree-planner-courses` IndexedDB database. The complete dataset and its
  metadata commit atomically. Courses are not subject to a 128-item eviction cap.
- Course pages read those full records, including courses never opened before.
  Search and stripped-course views derive from the same dataset. Old or unknown
  codes retain the existing compatible lookup/placeholder behavior.
- The catalog index and selected program requirements use
  `degree-planner-public-data`. Requirement keys include catalog, faculty and
  program; English and Hebrew stay together. Opening a degree saves its complete
  requirement tree. Other degrees' requirements are **not** downloaded at startup.
- Requests use ETag and Last-Modified validators when available. Reads use a valid
  saved record immediately, then refresh stale records online. Atomic revision
  checks prevent a delayed tab from overwriting a newer snapshot.
- Invalid, failed, private/no-store, or redirected responses cannot replace the
  last good data. A failed refresh can leave old data available offline without
  claiming it is current. Storage denial or quota failure preserves online use.
- The selected-resource cache retains up to 128 resources, protecting core data
  and preferring program requirements over legacy per-course responses. Browser
  storage remains best-effort and can be cleared or evicted.

The service worker does not cache public JSON. Authentication, private plans,
Firestore sync, localStorage migrations, and shared-link encoding are separate.
Server rendering continues to use the supplied fetch without IndexedDB.

Run `npm run test:public-data` and the course-data tests for refresh, atomic
replacement, validators, storage denial, and cross-tab revision coverage.
`tests/indexeddb-data.test.ts` checks the data layer with service workers blocked;
`tests/pwa.test.ts` checks the installed shell and whole-browser offline behavior.

## Testing

Install dependencies with `npm ci`. Run `npm run check` for TypeScript and
Svelte diagnostics, and `npm run lint` for Prettier and ESLint checks of authored
source and configuration. CI also runs these checks after catalog validation.
Generated data snapshots, recording metadata, and frozen compatibility fixtures
are excluded from style checks. Their schema, data, provenance, and behavior
remain covered by the existing validation and regression suites. `npm run format`
formats authored files without rewriting those generated or frozen artifacts.

The test suites can be run independently:

- `npm run test:integration` runs the Playwright browser tests, building and serving
  the app automatically. Install browsers first with
  `npx playwright install --with-deps chromium webkit`. The full suite runs in
  Chromium; the existing parallax and native faculty-selection regressions also
  run in WebKit, including native faculty selection in mobile WebKit.
  Use `-- --project=chromium` or `-- --project="webkit*"` to run one engine.
- `npm run test:unit -- --run` runs the Vitest suite excluding the live SAP tests.
  On a fresh checkout, first run `npm run generate-catalogs && npx svelte-kit sync`.
  Omit `-- --run` for watch mode. The existing histogram-client test still needs network access.
- `npm run test:sap` runs only `scripts/SAPClient.test.mjs` against the live Technion
  SAP service. It needs network access and can fail when SAP is unavailable or its data changes.
- `npm test` runs all three suites once, sequentially, stopping on failure.

GitHub Actions runs the browser, unit, and live SAP suites in independent,
parallel jobs on pushes and pull requests to `main`. Each job reports its own
result, and a SAP failure still fails the workflow without preventing the other
jobs from running. The browser job uses a Chromium/WebKit matrix with fail-fast
turned off, so both engines finish independently. Parallax and native search
coverage are part of that browser suite rather than separate feature jobs.
Browser recordings, screenshots, and failure traces are retained for seven days.

## Acknowledgements

- [Michael Maltsev](https://github.com/michael-maltsev) for data in
  [technion-histograms](https://github.com/michael-maltsev/technion-histograms),
  and for help understanding the SAP API from
  [technion-sap-info-fetcher](https://github.com/michael-maltsev/technion-sap-info-fetcher).

- [Sogrim team](https://github.com/sogrim/technion-sogrim) for inspiration from
  their degree planner.

- Big thanks to the beta testers for their feedback:
  - [Almog Levy](https://github.com/Almoglevy2k)
  - [Yotam Freund](https://github.com/freundyotam)

## Installable app and offline use

The service worker precaches all compiled route JavaScript/CSS, the manifest,
icons, and a data-free `/offline` HTML shell. First opening automatically saves
all courses and the catalog index in IndexedDB. Wait for **All courses ready offline** before
disconnecting: readiness requires durable public data, the controlling worker's
matching app version, and every shell asset actually present in its cache.
A never-visited course can then open and reload offline. Degree requirements
remain selected/on-demand: open the relevant degree online once first.

Missing shell assets are repaired on reconnect. A waiting old worker or an
incomplete/denied cache cannot claim readiness. Shell repairs verify the HTML's
exact compiled entry URLs so a newer deployment's HTML cannot be mixed with an
older worker's scripts. Public data is never duplicated in the worker cache.

Install from your browser's menu (on iPhone/iPad, Share → Add to Home Screen;
on macOS Safari, File → Add to Dock). Browser and installed-app storage can be
separate, especially on iOS; verify your plan before switching or clearing data.

Share links use `/share/...`, outside the installed app's `/app/` scope, and
internally reuse the existing read-only preview and explicit copy/import flow.
Existing `/app/preview/...` and legacy `/preview/...` links still work. Share and
logo links open new tabs in an ordinary browser. In an installed app they use
native out-of-scope navigation instead of an app-owned popup. The operating
system chooses the browser presentation: on iOS this can be Safari View
Controller rather than a separate Safari tab, as described in
[Apple's web-app scope guidance](https://developer.apple.com/videos/play/wwdc2023/10120/).
Browser tests cover link intent and independent guest imports, not the physical
iOS Home Screen handoff.

Saved guest plans remain in existing localStorage. Account plans and sync still
require internet; this is not a private-plan IndexedDB migration. Editable planner
routes remain guarded during account loading/failure. Public search and course details stay usable offline, including for signed-in
users. Course plan actions, selected-degree membership, and personal
semester/exemption/wishlist annotations remain hidden until the correct
guest/account plan is ready. Open drafts stay mounted across reconnects.

Updates still wait for all app windows to close; there is no forced activation
or automatic reload. Controlled pages use a stable internal query marker on
public requests to bypass older workers' CacheStorage fallback during this waiting
period. Canonical persistent keys and public resource URLs do not change. Safe
activation removes only retired app-shell caches and the known legacy
`planit-public-data-v1` cache; it does not clear IDB, localStorage or unrelated caches.

Private/no-store responses are never persisted. Redirect/HTML responses are
rejected. Failed, invalid, 404 or 410 refreshes never advance a last-good record's
freshness: old valid data remains available offline, but it is not represented as
verified current. An absent or invalid record still requires a successful fetch.

Local integration validation includes real bundled-worker VM tests for cache
ownership, old-worker overlap, two shell versions and storage retention. Those
checks do not replace browser verification of registration, waiting activation,
offline deep-link boot, saving, auth transitions or physical-device installation.
The dedicated `pwa-browsers` CI job runs real Chromium offline/install/update
checks with service workers enabled, followed by bundled-worker VM tests; Firebase preview sign-in also needs an authorized hostname.

The separate `offline-webkit-data` CI job checks course bootstrap, IndexedDB
persistence, and warm-route offline navigation in desktop/mobile WebKit. It also
runs page-level first-opening, unvisited offline deep-link and reload cases in
English and Hebrew at desktop/mobile viewport sizes. These use browser page APIs,
not Playwright's Chromium-only service-worker inspection/routing APIs. WebKit
disconnects the test origin because older Playwright versions incorrectly reject
SW responses with `setOffline` ([upstream issue](https://github.com/microsoft/playwright/issues/42775));
Chromium uses full context offline emulation. These checks do not verify physical
iOS airplane mode, an installed app's standalone cold-start, or Google login.

## Component Storybook

The real SvelteKit Storybook is available at `/storybook` on Vercel preview
builds. Vercel production and unknown deployment environments omit its static
assets and return 404 for the entry route. It is a design-review tool, not an
access-controlled area; only fictional, local demo data belongs in stories.

- `npm run storybook`: live component development at `http://localhost:6006`.
- `npm run build-storybook`: standalone static build in `storybook-static/`.
- `npm run build && npm run preview`: local deployed-route check at `/storybook`.
- `npm run test:storybook`: build and browser-test the deployed route. Set
  `STORYBOOK_TEST_BASE_URL` to test an already-running local or Vercel preview.

Stories use the actual application controls and course cards. The toolbar
switches dark/light themes, English/Hebrew reading direction, and mobile/desktop
viewports; named stories cover loading, empty, disabled, and requirements states.
Storybook-only mocks prevent access to saved plans and avoid changing the app's
language/theme preferences. No Firebase, authentication, or catalog data is used.

The deployment build runs Storybook **after** the application build and copies it
under `storybook/` in the final static output. Its manager, iframe, and assets are
therefore absent from the application bundle and service-worker precache. The
`/storybook` entry redirects to the static `index.html`, preserving story query
parameters and working on direct reloads. Generated Storybook files are ignored
by Git and are removed on production builds, including reused workspaces.

## Refreshing SAP data

Run `npm run update-catalogs` (or `node scripts/refreshSAPData.mjs`). The
scheduled Data workflow uses this same entry point. Courses and catalogs are
fetched once, then the complete replacement manifest and requirements are generated
and validated in a private sibling copy of `static`. Only then is that entire
directory atomically exchanged with `static`. Fetch, generation, copy, write, or
promotion errors leave the old public snapshot intact. No raw response cache is
written by this path; existing raw files are read-only historical baselines.
Standalone `generateCatalogData.mjs` also stages and atomically publishes its
catalog changes. `generateCatalogsRaw.mjs` remains a fetch/debugging utility.

Publication requires Linux with `renameat2(RENAME_EXCHANGE)` and Python 3 (both
available on the workflow's Ubuntu runner). Unsupported platforms/filesystems
fail closed. Staging needs roughly one extra copy of `static`. A sibling lock
prevents overlapping publication; a killed process may leave a lock/staging
directory for manual cleanup once no refresh is running. Cleanup failure after
successful publication only warns: the new snapshot is already committed.
Atomic exchange prevents mixed on-disk generations even if the process is killed
at promotion; it is not a power-loss durability guarantee or a live-server
multi-request snapshot protocol. Run refreshes in a checkout, not a serving tree.
The PR and deployment remain the publication boundary for site visitors.

Saved plans keep their selected degree identity, planned courses, exemptions, and
wishlist when a curriculum becomes unavailable. Requirement/name loading checks
manifest membership before requesting old requirement files; catalog, semester,
and course pages show an unavailable notice with a Settings link. Selecting a
replacement is explicit and preserves the plan's courses.

The client already retried transport/SAP failures. It now also validates the
response envelope, inner HTTP status, query identity, required course expansions,
and matching English/Hebrew records inside that retry path. A translation is
matched within its exact faculty/track/parent, year, and semester query. There is
no English fallback or silent skip when a required counterpart is missing.

- Up to three attempts per failed query, in sequential chunks of at most 100.
  Successful subqueries are retained rather than fetched again.
- Each HTTP request, including its response body, has a 10-second abort timeout.
  Each chunk has a 30-second total deadline including retry backoff. A full
  multi-chunk/tree refresh may take longer; this is not a global refresh deadline.
- Inline counts and continuation links are checked when supplied. A partial page
  fails closed; automatic continuation fetching is not implemented. Explicit
  `getCourses(semesters, top)` calls below 10,000 may intentionally request a subset.
- Empty faculty/degree lists, tree leaves, and course expansion lists can be
  valid. Previously populated semester/faculty collections still fail closed on
  total disappearance. Degree roots are different: two independent, complete
  English/Hebrew normal `TreeOnDemandSet` lookups must agree they are empty.
  Such a degree is unavailable **only in that semester**. Its manifest choices
  and requirement files are removed; other semesters and unfetched historical
  scopes remain, including custom metadata on retained requirements. No alternate
  curriculum lookup or stale curriculum fallback is used.
- Newly unavailable roots may remove at most 5% of the requested previously
  populated roots, both overall and within each semester. There is no minimum
  one-removal allowance for small populations. Larger losses fail with counts
  for manual investigation; there is no automatic override. This conservative
  threshold is a review policy, not proof that small correlated SAP failures
  are impossible. Both languages and repeat lookups can still share an upstream
  fault. A snapshot with no usable programs always fails.
- Baselines combine cached raw catalogs (including legacy `catalogs.json`) and
  the committed manifest, or legacy static directories. They never substitute
  old data for failed requests. Transport errors, malformed/incomplete responses,
  language disagreements, and known-course lookup failures remain fatal.
- Diagnostics identify the endpoint, language, query, and SAP error code without
  dumping response bodies or internal SAP traces. Persistent RFC/shared-memory
  failures still require the SAP operator to resolve the backend problem; client
  retries cannot rebuild SAP buffers, and an empty result alone does not identify
  its server-side cause.

Run the deterministic regressions without SAP access:

```sh
npx vitest run scripts/SAPClient.regression.test.mjs scripts/refreshSAPData.test.mjs scripts/generateCatalogsRaw.test.mjs
```

The existing `scripts/SAPClient.test.mjs` remains a live integration check. Do not
update its snapshots to bless empty or incomplete upstream responses.
