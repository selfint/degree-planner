# Asserted student journey recordings

The capture configuration runs the existing `tests/student-journeys.test.ts`
assertions against the real application and checked-in public catalog. It does
not record Storybook mocks, change storage seeds, enable service workers, or
replace dialogs. Normal functional tests leave the capture hooks disabled.

## Capture and package (Node 24, Chromium, ffmpeg)

```
RECORD_STUDENT_JOURNEYS=1 npx playwright test --config playwright.journeys.config.ts
node scripts/packageJourneyVideos.mjs --install
```

Publishing requires GitHub's `GITHUB_SHA` and `GITHUB_RUN_ID` provenance. The
`Student journey videos` workflow provides them. Packaging rejects metadata from
a different commit or workflow run, preventing reuse of stale capture files.
Application source, canonical catalog/course data, test helpers, dependencies and
build configuration changes trigger fresh capture on PRs and staging pushes. Failed tests produce diagnostic
artifacts, not publishable metadata. Packaging requires all four journeys in
English/Hebrew and initial light/dark themes before installing any public assets.
The setup journey intentionally changes language, theme and viewport as part of
its original persistence assertion; the selected variant describes its initial
preferences, not a promise that the whole clip stays in that state.

Each video is assembled from explicitly ordered, named segments. The share flow
contains owner share, generated popup preview, independent recipient import/edit,
and unchanged owner verification. The setup flow includes the second-tab reopen.
Secondary contexts explicitly opt into video and reload-safe cursor/theme hooks.
We do not start an extra trace (the browser fixture already traces those contexts).

Magenta boundary frames are capture-only and stripped from the published media.
Boundary extraction works from decoded video frames, not wall-clock estimates;
missing boundaries or incomplete segment lists fail closed. Quiet time on the
owner page while the recipient acts is excluded from the assembled clip.

The successful artifact contains MP4, WebM, WebP poster, localized WebVTT segment
descriptions, and a provenance registry with commit, run, original test and named
segments. It is input to the subsequent Storybook integration: do not publish an
empty gallery or claim the recordings passed until the CI artifact exists and
actual playback has been checked.

Source checks (no browser launch):

```
npx vitest run scripts/journeyTimeline.test.mjs scripts/journeyManifest.test.mjs src/lib/journeyRecording.test.ts
RECORD_STUDENT_JOURNEYS=1 npx playwright test --config playwright.journeys.config.ts --list
```
