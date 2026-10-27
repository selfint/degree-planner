# Landing tutorial recordings

Two real-browser tutorials run against the application and checked-in public catalog:

- Course-card anatomy: verifies name, code, median, credits, exam marker and an
  actual unmet prerequisite. The recording opens on the plan, zooms into the real
  card and moves the cursor over each part with a localized explanation. It then
  opens the real warning control and checks the dependency details.
- Search to semester: types a course code into search, verifies the result and
  course details, adds the course, checks persisted guest storage and semester
  totals, then reopens the saved plan to verify persistence.

No course responses, application state APIs, or rendered cards are mocked. Each
recording uses an isolated fictional guest plan. External network traffic is blocked. The recording-only cursor, camera transform and captions are injected
by Playwright; explanatory UI is never added to the console.

## Run

    npx playwright install --with-deps chromium
    PW_DEMO=on npx playwright test --config=playwright.tutorials.config.ts tutorials/recordings.spec.ts
    node scripts/packageTutorialVideos.mjs

FFmpeg with libx264/libvpx is required for packaging. Omit PW_DEMO to run assertions
without reading pauses or videos. Recordings require genuine service-worker readiness and fail on visible PWA errors. A recording-only slate provides an exact frame boundary for trimming setup; it is removed from every published clip. The recorded page closes before persistence verification, so reload screens cannot enter the tutorial. PLAYWRIGHT_BASE_URL targets an already-running
app; otherwise the config builds and starts the local preview.

Raw WebM recordings, annotated keyframes and timing JSON are under
`test-results/tutorials-raw`. Packaging trims setup time, removes audio, creates
MP4 + WebM, WebP posters, VTT descriptions, and a source-commit manifest under
`test-results/tutorials-media`. It fails if any variant is missing. Inspect all
recordings before copying that complete directory to `static/tutorials`.

## Landing acceptance and TDD

    npm run build
    node --test tutorials/ssr.test.mjs
    npx playwright test --config=playwright.tutorials.config.ts tutorials/landing.test.ts

The real production-rendered HTML test was committed and observed failing on the
missing tutorial section before adding the landing components. It now verifies
all nine accessible native players and both original visible transcripts. The browser suite
also checks both languages/themes at 320, 390 and 1280px, no media transfer before
play, no console/data boot on landing, keyboard focus, playback, pause and failure
fallback, native fullscreen and live preference changes. CI runs these assertions normally; unexpected failures fail the job.

The earlier test-first checkpoint retains `scripts/assertTutorialRed.mjs` for
provenance. It only accepted the exact missing-section browser assertion, never a
build, runner or unrelated failure. It is not used by the final green workflow.

## Planit source and attribution

The source pattern is selfint/planit at commit
`c851fd12eb59508f912a77418620a54185637e64`:

- https://github.com/selfint/planit/blob/c851fd12eb59508f912a77418620a54185637e64/tests/user-flows/first-time-user-experience.spec.ts
- https://github.com/selfint/planit/blob/c851fd12eb59508f912a77418620a54185637e64/src/assets/demos/modern-cursor.svg
- https://github.com/selfint/planit/blob/c851fd12eb59508f912a77418620a54185637e64/playwright.config.ts
- https://github.com/selfint/planit/blob/c851fd12eb59508f912a77418620a54185637e64/scripts/optimize-playwright-videos.mjs

The cursor SVG is unchanged. Its 56px size, shadow, pressed scaling and click-pulse
style are adapted from the first-time-user-experience test (not the older circular
cursor in `tests/helpers/demoCursor.ts`). The recording helper is adapted for this
Svelte app, localized captions, zooming, isolated guest data, and separate packaging.
Planit is Apache-2.0 licensed; its license is retained in `assets/LICENSE.planit`.

## Checked-in media

`provenance.json` records each published media file's byte size and SHA-256,
with the exact recording commit, successful CI run and artifact identifier.
The current complete nine-topic set is 29,255,062 bytes. The landing fetches neither video
format before deliberate playback; its two nearby WebP posters total 31–42 KB,
depending on language and theme. MP4 playback remains under 725 KB per clip;
WebM is a fallback. Media is excluded from the app service-worker precache.

## Search feature recording and publication

`search-recordings.spec.ts` adds the first feature-slot vertical slice. It searches
for the real public course `02340114`, verifies its name/code/credits, selects its
actual faculty filter, verifies the URL and matching result, and opens the real
course details. The guest plan must remain unchanged. All four English/Hebrew and
light/dark variants use the existing pinned PlanIt cursor and timing helper.

    PW_DEMO=on npx playwright test --config=playwright.tutorials.config.ts tutorials/search-recordings.spec.ts
    node scripts/packageTutorialVideos.mjs --group=features

Use `PLAYWRIGHT_BASE_URL` for an existing production preview. A local system
Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; Playwright's
video encoder must also be installed. A development server without a ready real
service worker does not satisfy the recording precondition.

The shared inventory in `src/lib/tutorialMedia.ts` distinguishes existing
tutorials from feature recordings; inventory membership is not publication.
Packaging without arguments still selects only the original two tutorials.
`--group=features` selects all seven features, and `--group=all` selects all nine topics.
The Tutorial videos CI workflow records and packages only the 28 landing-feature
variants on staging pushes. Seven independent topic runners each record four
variants serially with one browser worker, then encode that topic on the same
runner. There is no concurrent capture within a browser. Pull requests run all
acceptance assertions without duplicate recording work. The separate acceptance
job retains the in-app recording scenarios as assertions without video capture.

Only after acceptance and every recording runner succeed, the aggregate job
validates the exact seven shards, 28 unique variants, current source commit and
complete nonempty MP4/WebM/poster/caption inventory. It uploads the landing-only
`tutorials-<commit>` artifact (files at the artifact root). Each topic also retains
`landing-evidence-<commit>-<topic>` with raw video, timing JSON and keyframes.
Missing, duplicate, stale-source or unexpected assets fail closed; checked-in
media is never a fallback. `--group=features --topic=feature-plan` packages just
one explicit topic; the default and full-group packaging modes remain available.

Publication is manual and separate: replace only these 28 landing variants, merge
their manifest entries with the unchanged eight in-app entries, and retain each
clip's true source commit in scoped provenance. Leave the nested journeys assets
and provenance unchanged. Read-only CI never commits or publishes media itself.
Runtime improvement depends on the slowest topic and runner availability; measure
it from a successful run rather than assuming a wall-time guarantee.

All seven feature images are replaced by their own recordings, using the existing
sections, headings, paragraphs, order and grids. Both original tutorials remain. Each
native player follows the landing preferences, loads no video before playback,
and recreates the player when language or theme changes. Run the focused checks:

    npx playwright test --config=playwright.search-feature.config.ts

The standard tutorial config also includes these checks. The 105 checks cover all seven players in all four
variants at 320, 390 and 1280px, actual playback, fullscreen, live preference
switching with playback of each selected source, WebM fallback, and the failure
message without losing the feature description.

The checked-in 36-clip set was recorded from the exact staging push commit
`8e6af135bb4f9ee546c39bb5b604d8aff691b337` in successful Actions run
[39472885967](https://github.com/selfint/degree-planner/actions/runs/39472885967),
artifact `12291437449`. All 164 recording, motion and landing checks passed before
packaging, including all four Settings variants. The artifact ZIP SHA-256 was
verified against GitHub, all 72 MP4/WebM files were fully decoded with FFmpeg,
and every clip was visually reviewed in all four language/theme variants.
Consecutive native frames during the Plan drag and Catalog vertical/horizontal
scrolls show intermediate motion, with orientation holds and the actual saved
destination visible. `provenance.json` records the exact source, artifact ZIP
hash, per-file hashes and media durations. The nine-topic root manifest remains
separate from the unchanged nested `journeys/` gallery and its independent
provenance/inventory validation.

Two minor recording cosmetics remain visible: the lower duplicate prerequisite
line in the English Plan warning partly overlaps its caption, and the unrelated
external Google sign-in logo is unavailable in Settings' network-isolated guest
context. Settings demonstrates degree selection only, not sign-in. The demonstrated
controls, unique prerequisite alternatives and captions remain readable; no failure UI was
hidden. The later Semester pointer approaches are slow and somewhat stepped,
but their intermediate positions and completed exclusion/re-enable remain visible.
Search changes its faculty selection without showing the opened option list.
These are presentation limitations, not instantaneous scroll/drop failures.
Native playback of these refreshed media files must still pass CI and deployed-preview
checks after publication; the successful capture and local decode review do not
establish playback of the refreshed files on the deployed site.

### Reviewed smooth-motion refresh (not published)

A replacement 36-clip landing set was recorded from the exact staging push
commit `8e6af135bb4f9ee546c39bb5b604d8aff691b337` in successful Actions run
[39472885967](https://github.com/selfint/degree-planner/actions/runs/39472885967),
artifact `12291437449`. All 164 recording, motion and landing checks passed before
packaging, including all four Settings variants. This is a reviewed candidate,
not the checked-in or deployed media set. This documentation-only update leaves
videos, posters, captions, manifests and provenance unchanged.

The candidate artifact ZIP SHA-256 was verified against GitHub. All 72 MP4/WebM
files were fully decoded with FFmpeg, and every clip was visually reviewed in
all four language/theme variants. Consecutive native frames during the Plan
drag and Catalog vertical/horizontal scrolls show intermediate motion, with
orientation holds and the actual saved destination visible.

The candidate still has presentation limitations: later Semester pointer
approaches are slow and somewhat stepped, although intermediate positions and
completed exclusion/re-enable remain visible. Search changes its faculty
selection without showing the opened option list. These observations do not
establish that the replacement media is published.

Native playback of replacement media must pass CI and deployed-preview checks
after publication. Successful capture and local decode review alone do not
establish playback of those files on the deployed site. Publish captions,
manifests and provenance only with their matching complete media set.

For future regeneration, inspect all four variants per topic and update the
complete asset set and provenance. Do not substitute fixtures, screenshot
animations or unrelated clips for missing footage.

### Capture motion and refresh gate

Capture mode (`PW_DEMO=on`) uses `helpers/motion.ts` for real scroll offsets
animated over 900 ms, with 300 ms orienting pauses and five stable animation
frames before continuing. Nested scroll panels are revealed before the document.
Cursor approaches emit real mouse moves every 25 ms over 900 ms. The Plan
wish-list drag keeps the real mouse button pressed while moving for 1600 ms,
with short holds before and after dropping. The decorative cursor also follows
each real mouse move during native HTML drag, which suppresses ordinary
mousemove events. Playwright `steps` or extra static
caption holds alone are not used as a substitute for elapsed motion time.
Normal assertion runs retain their fast scrolling and drag path.

All nine topics use the shared recording action helpers in every EN/HE and
light/dark variant: course-card, plan-course, feature-search, feature-plan,
feature-catalog, feature-settings, feature-course, feature-semester, feature-share
(36 clips). The checked-in assets and provenance were refreshed from the successful run above.
For each future regeneration, after the complete recording CI succeeds, refresh the full artifact,
verify its digest and all codecs/durations, and inspect successive frames DURING
scrolls and the Plan drag in all four variants, not only their before/after
screenshots. Confirm intermediate positions, readable orientation and the actual
asserted destination/drop before publishing replacement assets and provenance.
`motion.test.ts` checks intermediate nested/horizontal scrolling (including negative RTL
offsets), pressed-pointer timing and native HTML drop/cursor alignment in
isolated browser fixtures; the application recordings still assert real
catalog, guest storage and course movements without mocked course APIs.
