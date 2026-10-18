# Landing tutorial recordings

Two real-browser tutorials run against the application and checked-in public catalog:

- Course-card anatomy: verifies name, code, median, credits, exam marker and an
  actual unmet prerequisite. The recording opens on the plan, zooms into the real
  card and moves the cursor over each part with a localized explanation. It then
  opens the real warning control and checks the dependency details.
- Search to semester: types a course code into search, verifies the result and
  course details, adds the course, checks persisted guest storage and semester
  totals, then reloads to verify persistence.

No course responses, application state APIs, or rendered cards are mocked. Each
recording uses an isolated fictional guest plan. External analytics/auth traffic
is blocked. The recording-only cursor, camera transform and captions are injected
by Playwright; explanatory UI is never added to the console.

## Run

    npx playwright install --with-deps chromium
    PW_DEMO=on npx playwright test --config=playwright.tutorials.config.ts tutorials/recordings.spec.ts
    node scripts/packageTutorialVideos.mjs

FFmpeg with libx264/libvpx is required for packaging. Omit PW_DEMO to run assertions
without reading pauses or videos. PLAYWRIGHT_BASE_URL targets an already-running
app; otherwise the config builds and starts the local preview.

Raw WebM recordings, annotated keyframes and timing JSON are under
`test-results/tutorials-raw`. Packaging trims setup time, removes audio, creates
MP4 + WebM, WebP posters, VTT descriptions, and a source-commit manifest under
`test-results/tutorials-media`. It fails if any variant is missing. Inspect all
recordings before copying that complete directory to `static/tutorials`.

The initial TDD checkpoint includes `scripts/assertTutorialRed.mjs`, which accepts
only the exact missing tutorial-section assertion as expected red. Runner, build,
recording and unrelated assertion failures remain failures. Replace this temporary
check with the complete passing landing suite when the implementation is added.

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
