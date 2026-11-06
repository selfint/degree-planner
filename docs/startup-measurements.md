# Landing and console startup measurements

## Method and limits

Production build at baseline commit `d5e29d17a1e6c7dd72ff117d03394a4c031e499b`, measured with Node `v24.19.0` and the committed lockfile. The initial graph includes SvelteKit's `entry/start` and `entry/app`, the selected route's root/layout/page nodes, and their transitive **static** imports. Shared files are counted once per route. Gzip is the sum of individually compressed files using Node's default `gzipSync`.

These are emitted-code sizes, not observed request counts, transfer sizes, or timings. They exclude CSS, images, inline scripts, course/catalog JSON, external analytics scripts, service-worker precaching, and runtime-invoked imports. A dynamic import can still execute immediately; moving it out of this graph does not establish a startup improvement by itself.

## Verified baseline

| Route     | Initial JS files | Raw bytes | Gzip bytes |
| --------- | ---------------: | --------: | ---------: |
| `/`       |               25 |   566,096 |    196,528 |
| `/en`     |               24 |   511,988 |    174,710 |
| `/plan`   |               33 |   575,099 |    198,603 |
| `/search` |               27 |   536,444 |    183,711 |

Largest initial shared chunk: `_app/immutable/chunks/aoTotOHR.js`, **350,478 bytes raw / 109,495 bytes gzip**. The landing-page node is 54,317 / 21,908 bytes and the root-layout node is 33,208 / 13,387 bytes. The baseline root layout imports Firebase Auth, Firestore, Firebase Analytics, Vercel Analytics, and Speed Insights. This establishes their inclusion, not their individual byte contributions. In particular, these data do **not** establish analytics as the largest startup dependency.

Rebuilds vary by a few bytes because generated version strings and hashes change. The instrumented baseline rebuild used for the final comparison produced 566,100 / 196,531 bytes for `/`, 575,093 / 198,609 for `/plan`, and 536,448 / 183,718 for `/search`. Do not interpret single-digit differences as a code regression.

### Baseline source attribution

The instrumented rebuild identifies these contributions before final chunk minification:

| Contributor                   | Rendered source characters |
| ----------------------------- | -------------------------: |
| Firebase Firestore            |                    602,286 |
| Firebase Auth                 |                    245,629 |
| Other/shared Firebase modules |                    179,545 |
| Firebase Analytics            |                     43,245 |
| Vercel Speed Insights         |                      3,044 |
| Vercel Analytics              |                      2,416 |

Firestore, Auth, shared Firebase, and Firebase Analytics are combined in the 350,478-byte shared chunk. The Vercel modules are in the root-layout node. These numbers establish Firestore/Auth as substantially larger **source** contributors than analytics, while compression and cross-module minification prevent allocating that chunk's exact wire bytes to each package. External scripts fetched by analytics providers are outside this build measurement.

## Reproduction

```sh
npm ci
npm run generate-catalogs
node scripts/measureStartup.mjs --build --out /tmp/console-startup.json
```

To measure a separate baseline checkout with the same script:

```sh
node scripts/measureStartup.mjs --root /path/to/baseline --build --out /tmp/baseline-startup.json
```

`--build` wraps that checkout's Vite config temporarily to gather Rollup attribution for each emitted client chunk; it does not edit the application or tracked build config. Without `--build`, the script measures an existing production output, without module attribution. Generated output and raw JSON reports do not belong in Git.

The JSON report separates actual emitted chunk bytes from `renderedModuleCharacters`, Rollup's per-module rendered length **before final chunk minification**. The latter is useful for finding contributors, but is neither minified wire bytes nor independently compressed package sizes. Non-route dynamic imports are reported separately and are not counted in the initial graph.

## Browser verification

`tests/console-startup.test.ts` covers English and Hebrew at 390px and 1280px in fresh browser contexts:

- Landing makes no Firebase, auth, Firestore, analytics, course/catalog, manifest, service-worker, or console-navigation requests, including after hovering Get Started and waiting beyond the optional-analytics delay.
- Get Started retains a native `/app/` link and `data-sveltekit-reload`.
- Native entry shows the localized pre-hydration loading screen while full course JSON is deliberately delayed. The real PlanIt logo/wordmark, narrow mobile and short landscape layouts, both themes/languages, and reduced-motion behavior are checked separately with application assets blocked.
- Analytics stays inactive during blocked mandatory-data bootstrap.
- After data is released, the console becomes visible and IndexedDB contains courses and catalogs.
- A separate warm-cache regression blocks course and catalog refreshes after durable readiness has been established. On reload, both requests must remain stalled while the main UI is visible and the boot screen is gone within a 5-second assertion window. This isolates IndexedDB readiness with service workers blocked.

Every test saves and attaches `startup-network.json` on both success and failure. It separates landing, console-entry, and warm-reload requests, with counts by resource type/category and sanitized endpoint URLs. Query strings, fragments, credentials, provider-specific paths, headers, bodies, and browser storage are omitted. The JSON labels the artificial data hold explicitly; it is functional request-order evidence, not a natural startup benchmark.

Provider requests are recorded and blocked by the tests so startup checks do not send real analytics or attempt third-party authentication. Real offline installation, navigation, and storage-failure scenarios remain in the existing PWA and IndexedDB suites.

The measurement environment could not launch a browser: bundled Playwright binaries were absent, and installed Chromium failed with `socket() failed: Operation not permitted`. No browser timings or local network-test passes are claimed. Browser assertions must pass in the configured CI browser environment.

## Final comparison

Measured the visual-refresh application build on 2026-10-17 at source checkpoint `268c42ae`, after the static landing/console migration, responsive design, compact search filters and drag fixes. The separate Storybook build emitted 185 states and remains outside the app graph. Node and direct app dependencies are unchanged from the instrumented baseline. These current graph sizes have no new module attribution; the earlier attribution remains evidence about source contributors.

| Before → after route          | Before raw / gzip bytes | After raw / gzip bytes | Raw reduction | Gzip reduction |
| ----------------------------- | ----------------------: | ---------------------: | ------------: | -------------: |
| `/` → `/`                     |       566,100 / 196,531 |       144,006 / 59,577 |         74.6% |          69.7% |
| `/plan` → `/app/plan`         |       575,093 / 198,609 |      565,561 / 197,583 |          1.7% |           0.5% |
| `/search` → `/app/search`     |       536,448 / 183,718 |      525,109 / 182,217 |          2.1% |           0.8% |
| `/settings` → `/app/settings` |       589,768 / 203,229 |      582,380 / 202,601 |          1.3% |           0.3% |

The landing's initial graph contains 27 files versus 25 previously. This is a graph file count, not an observed request count. The final `/en` graph is 127,938 raw / 53,998 gzip bytes before its redirect; the `/app` entry is 498,560 / 172,045 before routing to settings or a saved plan. Use the working-route rows above for the console UI.

### What changed

- Landing services remain isolated: its static graph has no Firebase, Vercel Analytics or Speed Insights. Browser tests verify no provider/data/worker startup requests on the landing.
- The visual refresh replaces the old large course-explanation SVG with semantic, localized HTML. The landing-page node is now 16,325 raw / 5,694 gzip bytes. This further reduces the landing graph beyond the service split.
- Firebase Auth and Firestore remain console dependencies. Their shared chunk is 332,574 raw / 103,711 gzip bytes. The earlier instrumented comparison identified Firestore and Auth as much larger source contributors than analytics.
- Optional analytics remains deferred until after console mounting, with the same providers. No credentials or provider migration were introduced.
- The largest emitted JavaScript chunk is still the dynamically loaded PDF parser: 407,564 raw / 119,312 gzip bytes. It is outside the initial route graphs.

The worker can prefetch dynamic application chunks for offline use, including analytics modules and the PDF parser. Deferred execution does not mean those bytes are excluded from a cold PWA installation. Full course/catalog JSON, service-worker traffic, external provider scripts and runtime timings are outside this table.

**Conclusion:** the landing is substantially lighter, while the console's initial JavaScript is only modestly smaller. These measurements do not establish natural time-to-interactive, total installation size, or analytics as the largest dependency.

Preview Storybook adds development dependencies and isolated build output only. All 185 fictional-data states use guarded preference/theme/data mocks. Production Vercel builds omit and clean Storybook; the application worker and Vite manifest exclude it. Local Storybook requires a temporary loopback-only metadata stub for sandbox OS-interface enumeration; this is not committed or used in Vercel/CI.
