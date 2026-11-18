# Catalog reveal safety and remaining rendering cost

The fixed-size `content-visibility:auto` rail experiment at
`6c6cb4d062966fd76ce34852668cdf38a7010826` is removed. Active catalog rails now
render normally at their natural height. The existing account-bound retained
catalog, inactive root's `content-visibility:hidden`, `inert` and `aria-hidden`,
and disposal rules remain unchanged. No application JavaScript, skeleton,
geometry flush, pointer-down navigation, click delay or click retry was added.

This is a safety fallback with a measured performance cost, not a 50ms solution.
Stable size hints prevented the earlier moving-target problem, but did not ensure
that skipped content was actually painted during wheel scrolling or immediately
on return. The prior [blank-frame evidence](./catalog-wheel/) is preserved.
Removing rail skipping removes that deferred-reveal mechanism; it does not claim
to fix WebKit itself or establish the cause of every historical blank frame.

## Native reveal checks

The expanded `scripts/auditCatalogWheel.mjs` uses the isolated, pinned Playwright
no-flush adapter described in [the earlier report](./catalog.md#wheel-driven-reveal-audit-separate-from-navigation-timing).
It does not use descendant geometry reads, visibility tests, programmatic scroll
positions, trace DOM snapshots or locator actionability to reveal cards.
All browser external requests are blocked before navigation.

- Four fresh WebKit contexts: EN/light and HE/dark, each at 390px and 1180px.
- Eight trusted 640px native wheel events per context. All 12 in-motion captures
  and four settled captures showed visible cards; no blank rails were observed.
- One native coordinate click per context reached the selected course. All four
  pointer-down/up/click target triples matched. No retry or delayed activation.
- Three Back/Forward return cycles per context. All twelve first captures showed
  cards; each was byte-identical to its later capture 250ms afterwards.
- Six additional fresh 390px contexts (three per language) returned via the Catalog
  header after a native course click. All six captures after two animation frames
  showed cards and were byte-identical to their capture a second later.

The observation intervals above are for detecting persistent blanking, not delays
inserted into application input handling. These are finite qualitative checks on
Linux WebKit, not proof for every Safari/device or measurements of earliest
physical screen presentation. Wheel-capable narrow contexts are not touch-device
wheel emulation. [Wheel events and 40 captures](./catalog-reveal/wheel/results.json)
and [header-return captures](./catalog-reveal/headers/return-results.json) are
preserved; use the basenames for original local capture paths in the wheel JSON.

## Matched measurements

Same host, production Chromium 143.0.7499.4, mobile 390×844, normal and 4× CDP CPU
slowdown; no concurrent builds or test suites during measurement. Two independent
contexts per CPU, each with one first entry and three immediate returns. Startup
and initial application data loading are excluded. The existing trusted-click,
hit-tested rendering-opportunity probe is unchanged. All samples are retained.

Each value is **median / maximum milliseconds**. Before means the auto-skipped
rails at `6c6cb4d0`; after means the final fully rendered, natural-height rails.

| CPU    | Visit        | Metric               | Before          | Safe fallback   |
| ------ | ------------ | -------------------- | --------------- | --------------- |
| Normal | First (n=2)  | Navigation           | 40.4 / 42.1     | 620.3 / 675.9   |
| Normal | First        | Usable-card proxy    | 305.8 / 311.1   | 669.1 / 708.4   |
| Normal | First        | Full DOM upper bound | 334.5 / 340.6   | 685.1 / 725.6   |
| Normal | Return (n=6) | Navigation           | 49.5 / 61.4     | 121.8 / 170.3   |
| Normal | Return       | Usable-card proxy    | 49.6 / 61.5     | 121.8 / 170.3   |
| Normal | Return       | Full DOM upper bound | 77.5 / 135.7    | 142.1 / 189.5   |
| 4×     | First (n=2)  | Navigation           | 75.2 / 78.2     | 71.9 / 80.6     |
| 4×     | First        | Usable-card proxy    | 1393.3 / 1469.0 | 2517.6 / 2862.4 |
| 4×     | First        | Full DOM upper bound | 1418.9 / 1495.7 | 2543.1 / 2888.6 |
| 4×     | Return (n=6) | Navigation           | 220.8 / 240.9   | 614.3 / 766.2   |
| 4×     | Return       | Usable-card proxy    | 220.8 / 240.9   | 614.3 / 766.2   |
| 4×     | Return       | Full DOM upper bound | 267.4 / 292.2   | 632.0 / 781.1   |

[Raw before](./catalog-reveal/before.json), [raw after](./catalog-reveal/after.json).
Navigation becoming active can precede usable cards. The usable-card probe reads
geometry and can force style/layout work; it is not an uninstrumented pixel-paint
measurement. Full completion means all 827 card nodes are present without loading
placeholders, audited after the useful measurement; it is an upper bound, not the
earliest completion instant. No skeleton exists; its metric remains null.

Alternatives were compared as stylesheet overrides against a production build
before choosing the final implementation. `display:none` for the inactive cache
plus strict rail containment produced 4× return median/max 1355.1/1926.3ms;
ordinary layout/style/paint rail containment with the existing hidden cache
produced 573.5/919.8ms. Neither established a consistent speed advantage over
natural rails, so the simpler natural layout was restored. Their exploratory
samples are [preserved here](./catalog-reveal/); they are not pooled with the
final matched samples.

## Profiling without geometry reads

`node scripts/profileCatalogWork.mjs /tmp/catalog-work` records separate CPU and
Chromium timeline traces at 4× CPU. It uses native coordinate clicks in the
checked 390px English header, DOM-only readiness queries, and eight observation
frames. It never calls `checkVisibility`, `getBoundingClientRect`, `elementFromPoint`
or a locator actionability check. Screenshots occur after tracing stops.
The eight-frame observation window is explicitly not a first-paint benchmark.
An immediate return has no intentional settling wait after leaving; the second
return follows eight settling frames on the plan page. Protocol overhead remains.

Raw traces/CPU profiles are [gzip-compressed here](./catalog-reveal/profiles/)
(decompress before importing into DevTools), with a [summary](./catalog-reveal/profiles/summary.json).
The summary clips renderer-main-thread events between the native-click and
profile-end marks. Event totals can nest and must not be added together.

| Trace            | Layout total | Style total | Pre-paint total | Paint total | Longest main task |
| ---------------- | ------------ | ----------- | --------------- | ----------- | ----------------- |
| First entry      | 1304.5ms     | 294.1ms     | 210.3ms         | 51.6ms      | 1944.5ms          |
| Immediate return | 7.8ms        | 3.1ms       | 75.8ms          | 36.3ms      | 170.7ms           |
| Settled return   | 3.8ms        | 0.9ms       | 68.4ms          | 36.7ms      | 158.9ms           |

First entry includes construction of 827 components / 15,915 descendants and
substantial browser layout. Retention eliminates most repeat layout, but the
large retained tree still requires pre-paint/paint and other browser work.
An earlier geometry-reading diagnostic on the containment experiment attributed
much more work to style recalculation; that is not a universal diagnosis of native
returns. The no-geometry traces above are the better evidence for this final
fallback. CPU profiles and timeline event totals are diagnostic samples with
instrumentation overhead, not additional latency samples.

**None of the tested CSS-only approaches meets the 50ms maximum.** A skeleton
would only change feedback timing. Moving substantially toward that target needs
a smaller rendered tree or bounded/virtualized rendering, with explicit handling
for native find, focus, anchors and full-course access. That is a larger change
than CSS containment; no such JavaScript scheduler or virtualizer is introduced
under the CSS-first direction.

## Validation and publication

- 14 catalog/rendering/native-navigation cases passed across Chromium and WebKit,
  including hidden focus isolation, stable offscreen geometry, native find,
  retained identity, plan edits and repeated navigation/history.
- Eight additional real catalog/wishlist rail cases passed at 320/390px in both
  engines; eight affected Storybook cases passed, including natural equal card
  heights and full canvas width while scrolling.
- The account suite initially had 27 passes and one bootstrap-helper failure:
  `page.evaluate: Execution context was destroyed` during startup navigation,
  before catalog assertions. The helper now uses navigation-surviving
  `waitForFunction` for the same held-read count and 20s budget. All 28 account
  and catalog-scroll cases passed on the complete rerun, including account
  closure/switch and offline disposal. Privacy assertions are unchanged.
- Production app/Storybook build passed; Svelte/types reported zero errors and
  warnings; formatting/ESLint passed.
- Wheel and return visual checks are detailed above. No blank rails were observed
  in the final 16 wheel and 36 return captures.

No live SAP calls, real Firebase writes, deployment or staging overwrite were
performed. The prior full 620-browser-test run belongs to the preceding revision
(616 passed; four host WebKit MP4 failures), not this follow-up. The broad unit
suite is likewise not re-run for this CSS removal; its earlier external-fetch
failure remains documented. Physical iPhone/Safari presentation is not tested.
Publication skips CI because the existing workflow invokes live SAP tests; no new
CI pass is claimed. The same PR remains non-draft and is not merged.
