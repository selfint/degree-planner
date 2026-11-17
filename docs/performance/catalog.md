# Catalog navigation measurements

Measured locally against production builds, using the largest checked-in degree
catalog, regenerated with the normal production build pipeline: 827 course entries in 59 groups (15,915 DOM descendants). The guest plan
contains two courses. Chromium uses a 390 × 844 mobile viewport, with normal CPU
speed and CDP 4× CPU slowdown. Each setting has two independent browser contexts,
with one initial catalog navigation and three plan/catalog return navigations.

The clock starts at the trusted navigation click. First useful render is the first
animation frame with a course name and resolved degree summary. Settlement also
requires all 827 cards and no loading placeholders. This is a DOM-ready-to-paint
measurement, not a hardware screen-presentation timestamp. “First” means cold route
code after plan startup; it does not include a cold app's data download/authentication.
Service workers are blocked to isolate rendering; offline/PWA behavior is covered
by the browser suite. External browser requests are aborted before networking.

| CPU         | Navigation  | Before median (range), ms | After median (range), ms |
| ----------- | ----------- | ------------------------- | ------------------------ |
| Normal      | First, n=2  | 537.5 (434.7–640.3)       | 130.5 (123.3–137.7)      |
| Normal      | Repeat, n=6 | 482.6 (419.3–743.0)       | 111.9 (82.7–276.0)       |
| 4× slowdown | First, n=2  | 1130.9 (1068.7–1193.2)    | 448.1 (434.3–461.9)      |
| 4× slowdown | Repeat, n=5 | 2130.4 (1908.0–2675.8)    | 472.6 (371.1–737.1)      |

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
sorted order, offscreen focus access, and no document-width overflow in English
and Hebrew; existing rail tests cover horizontal scrolling and course navigation.
