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

Course maps, individual course details, the bilingual catalog index, and program
requirements use the `degree-planner-public-data` IndexedDB database. Every key
is an allowlisted static URL; a requirement key includes its catalog, faculty,
and program IDs. English and Hebrew stay together in the same record. Selecting
a path never mutates the complete cached requirement tree.

- A valid cached response is returned immediately, including while offline.
- After one hour, an online read refreshes in the background using ETag and
  Last-Modified validators when available. Updated data appears on the next read.
- HTTP errors, invalid JSON, incomplete translations, and incompatible payloads
  never replace the last good snapshot. Cache records have their own schema
  version, separate from saved-plan and Firestore versions.
- Atomic revision checks stop a delayed request in one tab from overwriting a
  newer cached response from another tab.
- Blocked, denied, unavailable, or full IndexedDB falls back to the network.
  Opening/transactions have bounded waits, and failed updates roll back atomically.
- Up to 128 resources are retained, evicting the oldest validation timestamps.
  Browser storage remains best-effort and may be cleared or evicted. A resource
  never loaded successfully still needs a network connection.

This cache contains public data only. Existing localStorage plans (including
old/unknown course IDs), plan migrations, Firebase authentication, and Firestore
sync are unchanged. Server rendering uses the supplied fetch without IndexedDB.
A PWA app shell is a separate layer: IndexedDB alone cannot start the app offline
if its HTML/JavaScript has never been available locally. The service worker must
leave these public-data requests to this repository rather than maintain a
second, potentially stale data cache.

Run `npm run test:public-data` for cache refresh, validation, versioning, isolation,
quota/blocked-open handling, and persistence tests. Browser tests additionally
cover reloads with public-data requests blocked, language switching, course
details, and unchanged saved plans.

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
