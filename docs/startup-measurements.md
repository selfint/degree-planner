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

An unchanged rebuild produced the same raw totals and gzip totals differing by 4–6 bytes because generated version strings and hashes changed. Do not interpret tiny gzip differences as a code regression.

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
- Native entry shows the localized pre-hydration loading screen while full course JSON is deliberately delayed.
- Analytics stays inactive during blocked mandatory-data bootstrap.
- After data is released, the console becomes visible and IndexedDB contains courses and catalogs.

Provider requests are recorded and blocked by the tests so startup checks do not send real analytics or attempt third-party authentication. Real offline installation, navigation, and storage-failure scenarios remain in the existing PWA and IndexedDB suites.

The measurement environment could not launch a browser: bundled Playwright binaries were absent, and installed Chromium failed with `socket() failed: Operation not permitted`. No browser timings or local network-test passes are claimed. Browser assertions must pass in the configured CI browser environment.

## Final comparison

Pending the completed console source checkpoint and a successful production build. This section will be replaced with comparable measurements before publication.
