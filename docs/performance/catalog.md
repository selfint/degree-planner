# Catalog navigation measurements

**Current result:** automatic rail skipping was removed after the blank-rail audit.
See [the reveal-safety follow-up](./catalog-reveal.md) for the current behavior,
new matched measurements and no-geometry CPU traces. The CSS-only rail results
below describe the superseded experiment, not the current implementation.

The tables record successive iterations. The section **CSS containment with
defined rail geometry** contains the latest CSS-only follow-up. The earlier
**Stable course targets in WebKit** section documents the section-sizing regression
and its correction.

Measured locally against production builds, using the largest checked-in degree
catalog, regenerated with the normal production build pipeline: 827 course entries in 59 groups (15,915 DOM descendants). The guest plan
contains two courses. Chromium uses a 390 × 844 mobile viewport, with normal CPU
speed and CDP 4× CPU slowdown. Each setting has two independent browser contexts,
with one initial catalog navigation and three plan/catalog return navigations.

The original probe clock starts at the trusted navigation click. First useful render is the first
animation frame with a course name and resolved degree summary. Settlement also
requires all 827 cards and no loading placeholders. This is a DOM-ready-to-paint
measurement, not a hardware screen-presentation timestamp. “First” means cold route
code after plan startup; it does not include a cold app's data download/authentication.
Service workers are blocked to isolate rendering; offline/PWA behavior is covered
by the browser suite. External browser requests are aborted before networking.

| CPU         | Navigation  | Before median (range), ms | After median (range), ms |
| ----------- | ----------- | ------------------------- | ------------------------ |
| Normal      | First, n=2  | 726.1 (410.5–1041.8)      | 134.6 (128.8–140.5)      |
| Normal      | Repeat, n=6 | 463.9 (368.7–865.8)       | 84.6 (79.0–108.7)        |
| 4× slowdown | First, n=2  | 1576.5 (1512.7–1640.2)    | 675.6 (455.7–895.6)      |
| 4× slowdown | Repeat, n=6 | 2410.5 (2093.2–3218.1)    | 398.4 (344.3–609.4)      |

Raw samples: [before](./catalog-before.json), [after](./catalog-after.json).
Both builds use the same regenerated public data and production environment.
The baseline source is main commit `29e757403c301de88c217b683a8d7999e94871ca`.
No samples are profiled or excluded from these final aggregates.
These are small samples on one shared four-core host, not a universal latency SLA.
**The 50 ms maximum is not achieved.** The remaining work includes constructing
827 cards and their Svelte effects, even when offscreen layout is skipped.

The original row used separate pending/resolved keyed blocks: a DOM observer
counted 1,654 card constructions for 827 entries. One keyed block retains the cards
while sorting pending data. The catalog passes already-resolved data so rows sort
and cards render synchronously. This iteration used CSS `content-visibility: auto` to skip offscreen layout/paint.
That section optimization was subsequently removed because its estimated heights
could move a WebKit click target; see the final measurements below. No course
counts, groups or content are omitted.

## Retaining the live catalog between visits

The shared course-data layout now retains one catalog after its first visit.
Returning from the plan, a course, semester, preview or settings page reuses its
DOM and reactive state instead of constructing 827 cards again. It is released
when leaving this route group (including search), when account access closes,
or on document navigation. Account changes and signed-in offline restrictions
remove it before another account can see it. Guest plan edits update the retained
component normally.

The inactive cache has zero height, `content-visibility: hidden`, `inert` and
`aria-hidden`. Explicit `inert` is necessary: an English/Hebrew mobile WebKit
regression caught intermittent native focus entering skipped contents without it.
It costs style recalculation on return, but preventing hidden keyboard targets
is required. All 827 cards remain real elements; the active catalog still supports
native focus, course navigation, browser find and horizontal course rails.

The revised probe requires the active catalog navigation item, native visibility,
a resolved summary and an actual course name intersecting the viewport and passing
hit testing. It then crosses another animation frame before stopping the clock.
Whole-catalog correctness scans run afterward, outside the measured interval.
This is a rendering-opportunity proxy, not a physical screen-presentation timestamp.
**Do not compare these timings directly with the earlier DOM-ready table.**
Both sides below use this same revised probe, production data and browser settings.
The baseline is the previous PR revision `081f5769eb32712a2623bc6f0af287b65a4c47a2`.

| CPU         | Navigation  | Before retention median (range), ms | Retained median (range), ms |
| ----------- | ----------- | ----------------------------------- | --------------------------- |
| Normal      | First, n=2  | 172.6 (169.1–176.0)                 | 264.2 (179.6–348.8)         |
| Normal      | Repeat, n=6 | 115.0 (113.7–139.7)                 | 46.1 (45.3–46.7)            |
| 4× slowdown | First, n=2  | 828.8 (765.5–892.1)                 | 607.4 (531.1–683.7)         |
| 4× slowdown | Repeat, n=6 | 525.5 (473.5–601.6)                 | 99.0 (91.2–120.5)           |

Raw samples: [before retention](./catalog-visible-before-retention.json),
[retained](./catalog-visible-retained.json). No samples are excluded.
At that revision, the cache improved repeated visits by about 81% at 4× CPU
slowdown. The later correctness fix below supersedes those final timings. First-entry samples remain variable and do not demonstrate a consistent
cold-entry improvement. **The 50 ms maximum remains unmet.** First construction
still builds the complete catalog; safe retention still incurs browser style work.
A prototype without `inert` approached 50 ms but failed focus isolation and was
rejected. Background construction was not shipped: doing the same large synchronous
render during idle time can stall unrelated plan interaction. Incremental preparation
or virtualization would require separate work to preserve search, focus and immediate
access to all course groups rather than merely improving this metric.

## Stable course targets in WebKit

Returning to the retained catalog and clicking an offscreen course reproduced a
real missed navigation: pointer-down hit the course anchor, but pointer-up hit a
section after the course moved approximately 90 px. Event capture recorded only
one document request, ruling out a page reload. Offscreen `content-visibility: auto`
sections initially reserved 240 px, then resolved to actual heights around 195 px.
Several preceding sections could change the target's position during the press.

Revision `61bca24` missed 3 of 12 instrumented English WebKit clicks; the
pre-retention revision missed none of 12. Hiding the retained root with `display:none`
was not sufficient. Removing skipped section layout eliminated the observed miss.
The fix keeps real section heights, the retained component, native course links,
account-bound disposal, and inactive focus/accessibility protection. It does not
add a retry, delay navigation, or activate links on pointer-down.

The English WebKit regression failed on the expected course URL before the fix.
The final implementation passed all four English/Hebrew Chromium/WebKit catalog
cases and 24 additional WebKit click trials (12 per language), with one document
request per trial. The test also compares preceding section heights around scrolling
and verifies the resulting course route before exercising the real wishlist action.

Final local validation passed all 616 browser tests (23.7 minutes), 10 affected
Storybook tests, and both retained-catalog account-isolation cases. The production
app/Storybook build, type checks, formatting and ESLint passed. Mobile English/light
and Hebrew/dark views were reviewed in Chromium and WebKit. In the two heavy
catalog/navigation test files, DOM trace snapshots are disabled because capturing
the hidden catalog caused WebKit trace overhead to exceed test deadlines; action
traces, screenshots, source capture, and all behavioral assertions remain enabled.

This correctness fix has a substantial performance cost. These matched samples use
the same visible-render probe, production data and CPU settings on both sides:

| CPU         | Navigation  | Before correction median (range), ms | Corrected median (range), ms |
| ----------- | ----------- | ------------------------------------ | ---------------------------- |
| Normal      | First, n=2  | 196.9 (179.5–214.2)                  | 415.9 (404.4–427.4)          |
| Normal      | Repeat, n=6 | 46.0 (45.4–46.5)                     | 81.4 (78.0–92.7)             |
| 4× slowdown | First, n=2  | 667.3 (662.2–672.3)                  | 1251.3 (1117.9–1384.8)       |
| 4× slowdown | Repeat, n=6 | 95.8 (92.1–107.6)                    | 353.5 (295.9–565.6)          |

Raw samples: [before correction](./catalog-stable-heights-before.json),
[corrected](./catalog-stable-heights-after.json). The before source is
`61bca24d5f1ceb29b4bd23d8cf9606c933bdab4d`. No samples are excluded.
**The 50 ms maximum remains unmet.** The previous faster results did not provide
reliable course activation. Further optimization must preserve real target geometry
through scrolling and pointer interaction, as well as full content and account safety.

## Reproduce

Build once with `npm run build`, then start a fresh `npm run preview` process.
Do not reuse a preview process across builds (its SSR module graph can be stale).
Run:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:4173 node scripts/profileCatalog.mjs /tmp/catalog
```

The script writes JSON samples. Set `CATALOG_CPU_PROFILE=1` for a separate diagnostic
run with a CPU profile; exclude that instrumented sample from comparisons.
`QA_DENY_PROXY` optionally adds a deny-all external proxy; same-origin routing
always aborts nonlocal requests. Never point this probe at a hosted deployment.
Run the benchmark without other builds or suites competing for CPU. Compare the
same checked-in data, host, browser build and CPU setting. The regression test
`tests/catalog-rendering.test.ts` checks one construction per course, all groups,
sorted order, retained element identity, updates after a real plan edit, hidden
focus/accessibility isolation, offscreen focus access, and no document-width overflow in English
and Hebrew; existing rail tests cover horizontal scrolling and course navigation.

## CSS containment with defined rail geometry

The follow-up prioritizes CSS-only rendering. Only catalog rails use
`content-visibility: auto`. Their `block-size: 7.5rem` is an enforced layout size,
not an estimate that changes when a skipped subtree becomes visible. Catalog card
bodies use 6.5rem (0.75rem padding, 1rem metadata, 0.25rem gap and 4.5rem copy), with
1rem reserved for rail padding and the native thin scrollbar. Cards retain their
natural height rather than stretching into that gutter. Wrapping section headings
and progress summaries stay outside containment, using their real intrinsic heights.
The matching intrinsic size hint does not replace the explicit rail size.

All 827 cards and 59 groups remain in the DOM. Native course links, horizontal
scrolling, find-in-page, offscreen focus, and the inactive root's `inert` and
`aria-hidden` protections remain. No estimated section heights, pointer-down
navigation, click retries, delayed clicks, skeleton, or application JavaScript
scheduler were introduced. Account-bound retention/disposal is unchanged.

A card-body-only experiment improved repeat visits less than rail containment:
it still laid out each card wrapper. Rail containment skips descendants of entire offscreen rails.
It cannot eliminate Svelte's construction of 827 components / 15,915 descendants,
or the retained tree's style/accessibility work when toggling `inert`. A skeleton
could provide feedback while that work runs, but would not itself make a course
usable. Windowing visible rows plus a buffer would reduce construction work;
unmounting offscreen links/text would also break native browser find and direct
focus access. Stable explicit rail geometry solves only the sizing part of that
approach. No JavaScript virtualization was shipped under the CSS-first preference.

This run uses a fresh Linux host and Playwright Chromium 143.0.7499.4, a 390 × 844
mobile viewport, and normal / 4× CDP CPU slowdown. There are two independent
contexts per CPU setting, one first navigation and three repeats per context.
Application startup/data loading finishes before measurement. Each comparison
uses the same regenerated checked-in data and browser, without concurrent builds
or test suites. Do not compare absolute timings with earlier hosts.

The extended probe starts at a trusted native click and independently records:

- `navigationMs`: active navigation observed, then a rendering opportunity.
- `skeletonMs`: a visible skeleton followed by a rendering opportunity; null here
  because no skeleton is present. It never counts as usable content.
- `usefulMs`: resolved summary and a real named card in the viewport passing hit
  testing, followed by another animation frame (the existing visible-content metric).
- `fullMs`: all 827 cards present and no catalog/course loading placeholders,
  followed by a rendering opportunity. The completeness scan runs after the useful
  measurement to avoid adding whole-tree traversal to that interval. Consequently
  this is an audited upper bound on full DOM readiness, not its earliest instant,
  and does not mean offscreen pixels have been painted.

These remain rendering-opportunity proxies, not physical iPhone presentation times.
Raw preliminary samples are preserved: [baseline](./catalog-css-before.json),
[card-body experiment](./catalog-css-body-experiment.json), and
[rail experiment before the natural-height adjustment](./catalog-css-rail-experiment.json).

Final baseline: `ce52dc58fff8a2e1a042caf7c81e47fb2f9aed87`. Application changes are
limited to catalog CSS; no startup or account code is changed. All samples are
retained, including the slower second 4× first-entry sample.

Each cell below is **median / maximum in milliseconds**.

| CPU    | Visit        | Metric       | Before          | CSS rails       |
| ------ | ------------ | ------------ | --------------- | --------------- |
| Normal | First (n=2)  | navigationMs | 230.9 / 422.3   | 214.5 / 215.8   |
| Normal | First (n=2)  | usefulMs     | 524.8 / 596.3   | 279.8 / 293.4   |
| Normal | First (n=2)  | fullMs       | 549.0 / 622.7   | 311.0 / 326.6   |
| Normal | Repeat (n=6) | navigationMs | 122.4 / 155.0   | 48.1 / 50.5     |
| Normal | Repeat (n=6) | usefulMs     | 122.4 / 155.1   | 48.1 / 50.6     |
| Normal | Repeat (n=6) | fullMs       | 142.7 / 173.5   | 75.8 / 76.8     |
| 4×     | First (n=2)  | navigationMs | 67.9 / 71.8     | 67.6 / 81.3     |
| 4×     | First (n=2)  | usefulMs     | 2192.9 / 2340.6 | 1531.2 / 1910.9 |
| 4×     | First (n=2)  | fullMs       | 2217.8 / 2365.9 | 1570.4 / 1941.6 |
| 4×     | Repeat (n=6) | navigationMs | 591.7 / 833.2   | 256.5 / 288.6   |
| 4×     | Repeat (n=6) | usefulMs     | 591.7 / 833.2   | 256.5 / 288.6   |
| 4×     | Repeat (n=6) | fullMs       | 609.8 / 847.7   | 317.1 / 339.0   |

Final raw samples: [before](./catalog-css-before.json), [after](./catalog-css-after.json).
**The 50 ms maximum is not achieved**, including normal repeats (50.6 ms maximum).
At 4× CPU, repeat usable-card median improves from 591.7 ms to 256.5 ms (about 57%),
while first-entry median improves from 2192.9 ms to 1531.2 ms. First entry remains
variable and far above the requested limit. No skeleton timing is reported as
content readiness.

Validation for the final CSS:

- 32 focused catalog/rendering/rail browser cases passed in Chromium and WebKit,
  including English/Hebrew, stable offscreen geometry, native activation, hidden
  focus isolation, retained identity and reactive guest-plan edits.
- New regressions cover 320/390/1280px geometry, Back/Forward, repeated native
  navigation and native find-in-page revealing an offscreen course.
- All 28 account-loading/catalog-scroll cases and 10 affected Storybook cases
  passed. Local mobile English/light and Hebrew/dark visual checks passed in both
  engines; observed rail/card heights were 120px/104px, with no document overflow.
- Full browser suite: 616 passed, four failed (620 total). The four WebKit cold landing-video
  cases cannot play the local MP4s on this host. A standalone page without
  application code also rejects native `video.play()` with `NotSupportedError`
  (media error 4), both with and without the deny proxy. Catalog assertions in
  those tests are not involved.
- Production app and Storybook build passed. Svelte/type checks reported zero
  errors or warnings; formatting and ESLint passed.
- The unit run passed 1,103 tests with four skipped. One existing external-network
  test, `scripts/HistogramsClient.test.mjs` / `Get course median`, failed when its
  GitHub Pages fetch returned ECONNREFUSED / ENETUNREACH. It was not retried.
  The separate live SAP suite was not run. Physical-iPhone presentation was not tested.

PR #245 (`28748923dafacc28daf836d3de120222e1fd188d`) changes startup redirects,
loading state and progress. This CSS follow-up changes none of those files and
GitHub reports PR #246 mergeable against main. No merge, default-branch push or
new deployment was performed; the existing staging slot is untouched.

### Wheel-driven reveal audit (separate from navigation timing)

[WebKit report 321501](https://bugs.webkit.org/show_bug.cgi?id=321501) describes
persistent blank content after wheel/trackpad scrolling and warns that geometry
reads can conceal the problem. This is a separate risk; it is not evidence that
it caused the earlier estimated-section-height click misses.

`node scripts/auditCatalogWheel.mjs /tmp/catalog-wheel-audit` runs the local manual
check. It copies the pinned Playwright 1.57.0 driver into a temporary directory,
disables its WebKit screenshot stylesheet/layout flush, and dispatches wheel
input without Playwright's preparatory scrolling-state update. It changes neither
the installed driver nor the browser engine. Screenshots use viewport capture,
normal animations and the existing caret. There are no element geometry reads,
programmatic scroll-position writes, locator clicks, or trace DOM snapshots.
External requests are blocked before navigation.

Each fresh English/Hebrew context at 390/1180px receives eight trusted 640px wheel
inputs. Images are captured during the gesture and after scroll events become
quiet. Coordinates and an expected course code are selected from the settled
image; exactly one native pointer-down/up/click is sent. Playwright does not support
wheel input in its mobile-WebKit mode, so these are wheel-capable narrow/wide
contexts, not physical iPhone or trackpad measurements. This qualitative audit ran
alongside broader correctness checks; it makes no scroll-latency claim and does
not alter the isolated navigation benchmarks above.

All four final audited clicks reached their expected course, with matching trusted
pointer-down/up/click anchor targets. All settled captures showed course cards
without a forced geometry read. **Rapid wheel input can nevertheless expose
transient empty rails**: see the exploratory [in-motion image](./catalog-wheel/en-in-motion.png)
and its [settled image](./catalog-wheel/en-settled.png). Recovery happened without
an explicit layout flush; its earliest paint time was not measured. Persistent
blanking like the reported failure was not observed in these samples. This does
not establish that every Safari version/device is unaffected.

One earlier exploratory coordinate click did not navigate: its coordinates were
chosen from an in-motion screenshot, and subsequent fresh captures demonstrated
continued scrolling after that stage. No event-target log was captured for that
initial miss, so its cause is not asserted. It is not counted as a passing trial.
No application click delay, pointer-down navigation or retry was introduced.

[Final raw wheel/pointer events](./catalog-wheel/results.json) and all 16 final
captures are preserved in `catalog-wheel/` (use the capture basenames from the
original local paths in the JSON). Separately, the standard offscreen native-click
regression passed 24/24 additional WebKit trials, 12 per language.

A separate retained-catalog return check used native coordinate clicks to open a
course and return through the Catalog header, with the same no-flush driver.
One exploratory capture after two animation frames showed [blank visible
rails](./catalog-wheel/return-exploratory-blank.png). That context closed before a
later capture, so its blank duration is unknown. This is not counted as a
successful reveal. All six subsequent fresh contexts (three EN, three HE) showed cards in the
capture after two frames; each image was byte-identical to its capture a second
later, without descendant geometry reads. Their raw captures and
[manifest](./catalog-wheel/return-results.json) are retained alongside the wheel
results. These qualitative
checks do not establish an earliest pixel-presentation time. In particular,
`usefulMs` above includes geometry reads and hit testing: it measures an audited
rendering opportunity, not uninstrumented painted-card readiness. No claim of
50ms actual content presentation is supported.

Publication uses `[skip ci]` because the existing PR workflow starts live SAP
tests, which are outside this task's local-QA-only scope. No new CI pass is
claimed. Required checks may remain pending under GitHub's
[skip semantics](https://docs.github.com/actions/managing-workflow-runs/skipping-workflow-runs).
No new staging or deployed Storybook review artifact was created.
