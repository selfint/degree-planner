# Catalog navigation measurements

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
and cards render synchronously. CSS `content-visibility: auto` skips offscreen
layout/paint while keeping all links in the DOM for native focus, scrolling and
browser find. No course counts, groups or content are omitted.

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
The cache primarily improves repeated visits: about 81% lower median at 4× CPU
slowdown. First-entry samples remain variable and do not demonstrate a consistent
cold-entry improvement. **The 50 ms maximum remains unmet.** First construction
still builds the complete catalog; safe retention still incurs browser style work.
A prototype without `inert` approached 50 ms but failed focus isolation and was
rejected. Background construction was not shipped: doing the same large synchronous
render during idle time can stall unrelated plan interaction. Incremental preparation
or virtualization would require separate work to preserve search, focus and immediate
access to all course groups rather than merely improving this metric.

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
