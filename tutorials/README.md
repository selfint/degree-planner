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
The current complete set (including the Search feature) is 8,493,147 bytes. The landing fetches neither video
format before deliberate playback; its two nearby WebP posters total 31–41 KB,
depending on language and theme. MP4 playback remains under 600 KB per clip;
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
The Tutorial videos CI workflow records and packages all 36 variants and retains
raw videos, timing JSON, keyframes, packaged media and the source-commit manifest
in its existing `tutorials-<commit>` artifact. Missing variants fail packaging.

All seven feature images are replaced by their own recordings, using the existing
sections, headings, paragraphs, order and grids. Both original tutorials remain. Each
native player follows the landing preferences, loads no video before playback,
and recreates the player when language or theme changes. Run the focused checks:

    npx playwright test --config=playwright.search-feature.config.ts

The standard tutorial config also includes these checks. The 105 checks cover all seven players in all four
variants at 320, 390 and 1280px, actual playback, fullscreen, live preference
switching with playback of each selected source, WebM fallback, and the failure
message without losing the feature description.

The checked-in 36-clip set was recorded from GitHub's PR merge commit
`afa2e701cbb83c69a121e115451257ae9c7d8612` (PR head
`2e466e62`) in successful Actions run
[39406470836](https://github.com/selfint/degree-planner/actions/runs/39406470836),
artifact `12259028586`. All 70 checks passed before packaging. All 72 MP4/WebM
files were fully decoded with FFmpeg, and start/middle/end frames across all 36
clips were visually inspected before copying the complete packaged set.
`provenance.json` records the exact source, artifact ZIP hash, per-file hashes and
media durations. The nine-topic root manifest remains separate from the nested
`journeys/` gallery and its independent provenance/inventory validation.

Two minor recording cosmetics remain visible: the lower duplicate prerequisite
line in the English Plan warning partly overlaps its caption, and the unrelated
external Google sign-in logo is unavailable in Settings' network-isolated guest
context. Settings demonstrates degree selection only, not sign-in. The demonstrated
controls, unique prerequisite alternatives and captions remain readable; no failure UI was
hidden. Native playback of the newly integrated six players must still pass CI
and deployed-preview checks; recording success alone does not establish it.

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
(36 clips). The checked-in assets/provenance are not refreshed by this source
change. After the complete recording CI succeeds, refresh the full artifact,
verify its digest and all codecs/durations, and inspect successive frames DURING
scrolls and the Plan drag in all four variants, not only their before/after
screenshots. Confirm intermediate positions, readable orientation and the actual
asserted destination/drop before publishing replacement assets and provenance.
`motion.test.ts` checks intermediate nested/horizontal scrolling (including negative RTL
offsets), pressed-pointer timing and native HTML drop/cursor alignment in
isolated browser fixtures; the application recordings still assert real
catalog, guest storage and course movements without mocked course APIs.
