# Smaller catalog tree

The resolved degree rows now render native course anchors directly, avoiding per-card async components, effects and redundant wrappers. The largest checked-in degree still contains all 827 cards in 59 groups, with 8,544 descendants instead of 15,915. Course names, codes and metadata stay mounted for native find, links and focus. Plan notes remain reactive. Wishlist cards keep the general component. The retained catalog's account gate, inert state and disposal behavior are unchanged.

No active rail uses content-visibility, estimated section geometry or fixed rail heights. There is no skeleton or virtualizer. Natural equal card heights, horizontal scrolling, RTL, full accessible labels and focus-visible outlines are retained.

## Matched measurements

Baseline: `7847d69a2623d6e21d6249e8fab1536fad435c54`, rebuilt with the same regenerated data as the candidate. Both use the corrected probe in this commit on the same host, Chromium 143.0.7499.4, 390 × 844 mobile viewport, two independent contexts per CPU setting, one first entry and three returns per context. No builds or other suites ran during measurements. All external browser requests were blocked before networking. First entry excludes initial application data/auth startup. These are paint-opportunity proxies, not physical iPhone presentation timestamps.

The trusted native click starts the clock. Navigation, a visible/hit-tested usable course and full 827-card completion are recorded separately with frame checks. No skeleton was rendered (`skeletonMs: null`). Full completion means all cards are available, not that every offscreen pixel was painted.

The probe now gates visibility/geometry reads on active navigation and absence of inert, and waits for plan navigation using DOM state alone. Previously it queried the still-hidden retained subtree, forcing work and disturbing the cache being measured. Earlier documents remain historical; do not compare their numbers directly with this matched pair.

Each cell is **median / maximum milliseconds**. Raw samples: [before](./catalog-tree/before.json), [after](./catalog-tree/after.json).

| CPU / entry       | Before navigation | After navigation | Before usable cards | After usable cards | Before full     | After full      |
| ----------------- | ----------------- | ---------------- | ------------------- | ------------------ | --------------- | --------------- |
| Normal first (2)  | 301.4 / 560.8     | 279.1 / 298.8    | 584.5 / 592.2       | 296.3 / 316.2      | 609.5 / 611.1   | 332.5 / 356.2   |
| Normal return (6) | 60.7 / 114.7      | 44.5 / 45.4      | 60.7 / 114.7        | 44.5 / 45.4        | 82.2 / 140.6    | 77.7 / 77.9     |
| 4× first (2)      | 80.3 / 91.8       | 88.3 / 106.4     | 3235.8 / 3613.4     | 1351.5 / 1472.0    | 3275.7 / 3666.4 | 1390.2 / 1499.8 |
| 4× return (6)     | 352.9 / 660.2     | 129.3 / 271.2    | 352.9 / 660.3       | 129.3 / 271.2      | 372.3 / 684.3   | 156.6 / 292.2   |

**The 50 ms maximum is not met.** Normal returns were below 50 ms in these six samples; this is not a general guarantee. At 4×, first usable cards improve about 58% and return median about 63%. Navigation highlighting is not usable catalog content.

## Remaining work and virtualization tradeoff

Independent no-geometry traces from `scripts/profileCatalogWork.mjs` show first-entry layout 449.9 ms, style 308.3 ms, prepaint 114.0 ms and paint 40.5 ms, with a 943.9 ms longest task. Immediate-return prepaint/paint take 50.8/22.8 ms and the longest task is 89.7 ms; settled-return values are 34.8/24.8 ms and 74.5 ms. These are diagnostic 4× CPU traces including eight observation frames after full DOM readiness, not navigation latencies. Nested event totals must not be added. [Compressed raw traces and CPU profiles](./catalog-tree/) preserve the evidence.

Reducing component construction and browser tree size helps, but the remaining full tree still incurs substantial browser rendering work. CSS cannot remove Svelte construction. The previous automatic-skipping experiment also failed visual reveal safety; see [the reveal audit](./catalog-reveal.md).

Unmounting offscreen rows would remove native find and direct-focus targets. A local alternative using `hidden="until-found"` was tested in both installed engines: Tab skipped the hidden course and programmatic focus stayed on the previous visible control. Both exposed `beforematch`; support alone does not preserve keyboard access. Chromium's role query exposed two visible links, WebKit's three, so accessibility hiding is not uniform either. [Raw probe](./catalog-tree/windowing-probe.json). This is a minimal platform experiment, not a measured Svelte virtualizer. A native-equivalent virtualizer has not been demonstrated; it was not shipped to achieve a misleading speed result.

## Verification

- Production application and Storybook builds passed. Svelte/type checks passed with zero errors/warnings; ESLint passed.
- Catalog/native-interaction suite: 20 passed in Chromium/WebKit; four added EN/HE touch/Enter cases passed (three native course taps and returns per case).
- All eight real-catalog rail cases also passed a final rerun after strengthening intrinsic-content height measurement for the compact anchors.
- All nine affected Storybook checks passed, including the new resolved-row stories and intrinsic-height checks.
- Account/bootstrap/scroll suite: all 28 passed, including account closure/isolation and 320/390 px EN/HE scrolling.
- Local unit suite: 1,103 passed, four skipped. The first broad run found two missing Storybook inventory assertions, corrected by adding standalone row stories and inventory documentation. Its unrelated live histogram fetch failed with ECONNREFUSED/ENETUNREACH; that network-dependent test was excluded from the local rerun. Live SAP was excluded by the unit configuration and was not run.
- The initial catalog check hit a local preview 500 followed by connection-refused errors. Restarting the local preview resolved it; the complete 20-case rerun passed. The first standalone row-story check served stale preview assets; copying the rebuilt Storybook assets resolved that setup issue.
- Full all-feature browser/media and complete Storybook suites were not rerun for this change. Earlier 616-pass browser results belong to an older revision, not this one. Physical iPhone presentation remains unmeasured.

The WebKit 26.0 no-flush wheel audit ran EN/light and HE/dark at 390 and 1180 px. Each case used eight trusted 640 px wheel inputs; screenshots were taken after inputs 1/4/8 and at rest, without geometry/visibility reads or Playwright's scrolling-state/screenshot flushes. All 12 moving captures and four settled captures contained cards. One native coordinate click per case succeeded (4/4, no retries or input delays), with the same course href on pointerdown/up/click. Three Back/Forward returns per case produced 12 populated two-frame captures and 12 populated idle captures; no blank rail/return was observed. These limited samples do not prove all WebKit versions or scrolling gestures safe. [Results and 40 screenshots](./catalog-tree/wheel/results.json).

No deployment was made. No real Firebase writes, SAP calls or Vercel requests were made. Browser traffic was restricted to loopback throughout. The PR remains unmerged; CI is skipped because the existing workflow includes live SAP calls, outside this local-QA scope.

Integration assessment: a simulated merge with main `28748923dafacc28daf836d3de120222e1fd188d` had no conflicts and preserved all eight startup implementation/test files from #245 byte-for-byte relative to main. No actual merge or default-branch update was performed.
