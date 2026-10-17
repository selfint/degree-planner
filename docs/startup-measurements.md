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

Measured the completed migration client source on 2026-10-17, after the branded startup redesign, mainline SAP/CI integration and complete Storybook expansion and bounded reconnect repair. The final application graph was rechecked after the separate 180-story build. The Node version and direct application dependency versions remain the same as the instrumented baseline. Storybook is built separately after Vite and does not enter these graphs. The combined production build passed. These current graph sizes are measured without new module attribution; source-attribution observations below come from the instrumented migration comparison.

| Before → after route          | Before raw / gzip bytes | After raw / gzip bytes | Raw reduction | Gzip reduction |
| ----------------------------- | ----------------------: | ---------------------: | ------------: | -------------: |
| `/` → `/`                     |       566,100 / 196,531 |   **184,910 / 77,476** |     **67.3%** |      **60.6%** |
| `/plan` → `/app/plan`         |       575,093 / 198,609 |      563,530 / 196,922 |          2.0% |          0.85% |
| `/search` → `/app/search`     |       536,448 / 183,718 |      523,532 / 181,458 |          2.4% |          1.23% |
| `/settings` → `/app/settings` |       589,768 / 203,229 |      578,989 / 201,724 |          1.9% |          0.74% |

The landing's initial graph has 27 files versus 25 previously. Splitting the application lowers bytes substantially; it does not reduce the number of emitted files. These are graph file counts, not observed browser requests.

The final `/en` graph is 127,859 raw / 54,083 gzip bytes before its navigation to `/`; it is not the total English landing session. The `/app` entry graph is 498,446 / 172,167 before redirecting to settings or a saved plan, so use the destination-route rows above when assessing the console's working UI.

### What changed

- The landing remains prerendered and hydrated for its existing interactive UI. Its static graph contains **no Firebase, Vercel Analytics, or Vercel Speed Insights modules**, and no non-route dynamic imports are reachable from that graph.
- Firebase Auth and Firestore remain in the console's initial graph. Their shared chunk is 332,574 raw / 103,711 gzip bytes, with unchanged Firestore source attribution of 602,286 characters and Auth attribution of 245,617 characters.
- Firebase Analytics, Vercel Analytics, and Speed Insights are absent from the console's initial static graph. Three separate chunks contain 21,202 raw / 7,896 gzip bytes total. Their execution is scheduled 1,500ms after the console mounts; the provider choice is unchanged.
- The largest emitted `.js` chunk is the PDF parser at 407,564 raw / 119,312 gzip bytes. It is a dynamic transcript-import dependency, not in these initial route graphs.
- The landing-page node itself is 57,302 raw / 23,506 gzip bytes; the large saving comes from removing application services from the landing's dependency graph.

The console's automatic service-worker preparation can still fetch dynamic chunks for offline use after mounting, including analytics modules and the PDF parser. The delayed imports establish execution ordering, not a guarantee that those bytes are absent from a cold PWA installation. Service-worker precaching, full course/catalog downloads, external provider traffic, and runtime startup timings require browser-network measurements and are not included in the table.

**Conclusion:** the measured improvement is a substantially lighter landing and a clean service boundary. Console JavaScript is only modestly smaller, with Auth/Firestore still dominating its initial bundle. No evidence here supports claiming analytics was the largest dependency, promising a particular time-to-interactive improvement, or replacing providers without a separate comparison.

Preview Storybook adds development dependencies and build output only. Its 180 fictional-data stories across 44 groups use isolated preference/theme mocks; the build rejects live planner storage and Firebase modules. Production Vercel builds omit and clean the Storybook files, while the application service worker and Vite asset manifest never include them. The default local Storybook CLI could not enumerate OS interfaces in this sandbox; its local build was checked using a temporary loopback-only metadata stub. No such stub is committed or used by Vercel/CI.
