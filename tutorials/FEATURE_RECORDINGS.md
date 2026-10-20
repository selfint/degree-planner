# Landing-feature recording scenarios

`feature-recordings.spec.ts` supplies 24 real-app clips: Plan, Catalog, Settings,
Course, Semester and Share Plan, each in English/Hebrew and light/dark. It uses
the same pinned PlanIt cursor, real public catalog/course requests, isolated
fictional guest storage, real service-worker readiness and magenta-slate packaging
as the existing Search recordings. No API responses are mocked. External traffic
is blocked. Inventory membership does not publish assets or replace landing text.

## Asserted journeys

- Plan: real exam rows and credit totals, an unmet-prerequisite warning, drag a
  wish-list course into a semester, explicit Save, storage and fresh-page checks.
- Catalog: a completed semester and a current semester produce exact completed
  and planned count/credit totals; inspect a requirement's three values and open
  its actual course. Browsing must leave the guest plan unchanged.
- Settings: a guest with no degree selects year, faculty and degree, saves it,
  opens the populated catalog, and retains the choice on a fresh page. No login
  or transcript with personal information is used.
- Course: actual description/prerequisites, real external SAP-link attributes,
  add to wish list and verify its saved card on the plan and on a fresh page.
- Semester: open its name from the plan, inspect actual exam rows, temporarily
  exclude and restore a course, verify changed credits/exam counts, and prove
  the saved plan is unchanged.
- Share: obtain the real sender's public preview link, open it in a separate
  guest browser context, verify viewing is read-only, explicitly confirm copying
  into that recipient, and check copied degree/semesters, preserved current
  semester/exemptions, deduplicated wish list, fresh-page persistence and the
  sender's unchanged plan. The recording shows the recipient journey. Its
  caption explains replacement before confirmation; there are no real accounts.

## Production and review

    PW_DEMO=on npx playwright test --config=playwright.tutorials.config.ts
    node scripts/packageTutorialVideos.mjs --group=all

The complete inventory is 36 clips (two existing tutorials plus seven features).
`--group=features` requires all 28 feature clips, not only Search. Running one
scenario alone is useful for debugging, but cannot package a complete group.
The workflow has 60 minutes for the single-worker production recordings and
36 MP4/WebM/poster/caption encodes. Failed/missing recordings fail packaging.

Source/unit checks and test discovery do not establish browser correctness.
Review every CI-generated language/theme variant, captions and poster for
readability, true interactions, layout, cursor and timing before publishing.
Only a successful complete artifact, with matching source commit and updated
provenance, may replace any remaining landing image. Do not substitute existing
footage for a different feature. Browser execution was not attempted locally
because this environment's browser launch is already known to be blocked.

The complete set is now published with the source/run/hash details in `provenance.json`.
Native-player integration coverage is in `search-feature.test.ts` (historical name),
with 105 checks across all seven feature players.
