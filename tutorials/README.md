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
both accessible native players and their visible transcripts. The browser suite
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
The current complete set is 6,018,987 bytes. The landing fetches neither video
format before deliberate playback; its two nearby WebP posters total 31–41 KB,
depending on language and theme. MP4 playback uses 230–412 KB per tutorial;
WebM is a fallback. Media is excluded from the app service-worker precache.
