# PostHog analytics

PostHog is optional, independent of the existing Google/Firebase Analytics and
Vercel integrations. Nothing in this change deploys the app.

## Configuration

The approved project token and US ingestion host are set in the intentionally
tracked `.env.production`, containing only public browser configuration. Hosting
and CI environment variables override those defaults. Local development remains
off, and Storybook/unrecognized routes do not initialize analytics.

To configure another project, set these **build-time** public variables:

- `PUBLIC_POSTHOG_KEY`: the PostHog **project token**, never a personal API key.
- `PUBLIC_POSTHOG_HOST`: the matching HTTPS ingestion host from that project's
  setup page. Do not use the dashboard URL or guess the project's region.

Both are required. An absent/invalid configuration is a no-op. `.env.example`
contains blank placeholders for local overrides. Local development is off unless
`PUBLIC_POSTHOG_ENABLE_DEV=true`; production builds do not need that switch.
Static Pages builds embed these public values and need a new build after changes.
The public project token is expected to be visible in the browser bundle.
No personal API key is committed. Pages deployment settings remain unchanged.

## Events and definitions

| Event                        | Trigger                                                                  | Extra properties |
| ---------------------------- | ------------------------------------------------------------------------ | ---------------- |
| `$pageview`                  | Completed navigation to a recognized page, once per consecutive page     | `page`           |
| `start_clicked`              | Either landing Get Started button                                        | `page`           |
| `degree_selected_first_time` | First successful manual degree save with no prior degree in this browser | `page`           |
| `grade_file_uploaded`        | A valid transcript finishes parsing and shows its preview                | `page`           |
| `grade_import_saved`         | The user saves the transcript and persistence succeeds                   | `page`           |
| `course_added_to_wishlist`   | New wishlist membership successfully saved                               | `page`, `source` |
| `course_added_to_semester`   | New course placement in a destination semester successfully saved        | `page`, `source` |
| `courses_shuffled`           | A course is successfully saved in a different semester                   | `page`, `source` |
| `plan_updated`               | Enabled plan-board Save button activated, before persistence             | `page`           |
| `share_plan_clicked`         | Share my plan link activated                                             | `page`           |
| `copy_plan_clicked`          | Copy plan button activated, before confirmation                          | `page`           |
| `plan_copied`                | Shared plan successfully saved to the recipient's plan                   | `page`           |

`page` is one of `landing`, `catalog`, `plan`, `settings`, `semester`, `share`,
`search`, `course`, or `offline`. Search/course/offline ensure app-wide active
usage is not restricted to the six requested page categories. Both browser
`/share/...` and legacy `/app/preview/...` count as `share`. Language redirects,
query-only changes, and repeated callbacks do not create duplicate views;
leaving a page and returning (including Back/Forward) does. Refresh counts a new
view. A root `/app/` redirect does not count an extra page. Consecutive course
or share detail changes stay in the same page category and are not separate views.

`source` is `course_detail` or `plan_board`. One event is emitted per new saved
course placement. Dragging then canceling, reordering inside the same list,
removal, duplicate adds, hydration, sign-in reads, and import bulk copies do not
inflate these events. Moving a course between semesters counts one new placement.

`courses_shuffled` counts each course with a saved departure from one semester
and a new arrival in another. It is emitted after a successful plan-board save,
once per moved course, even when several courses are saved together. It measures
the net saved move, not every intermediate drag. Initial placements, wishlist
transfers, duplicate copies, same-semester reorders, canceled edits and failed
saves do not count. A cross-semester move also retains the existing
`course_added_to_semester` event; do not sum those two series as distinct actions.

`plan_updated` is the requested **Save-click metric**, not evidence that a plan
was successfully saved. It fires once when the enabled plan-board Save action
starts, including attempts whose persistence later fails. An explicit retry
counts another click; disabled/busy clicks and Cancel do not. Other Save buttons
(for example transcript import) retain their separate events. Both new events
use the same anonymous identity and `auth_status` segmentation as existing events.
The UI remains usable if analytics fails; telemetry is best-effort and can be
blocked or lost. Link clicks use immediate beacon transport across full navigations.

The first-degree marker is local to this browser/origin and not a global account
history. Existing degrees and later changes are not counted; clearing storage or
using another browser can start a new identity. Imports are measured separately,
not as a first manual degree selection. Uploading here means parsing locally,
not sending the PDF to PostHog. A canceled preview counts a parsed upload but not
a saved import. Copy plan means importing into one's own plan, not clipboard copy.

## Authentication status and sessions

Every event has the allowlisted `auth_status` value `signed_in`, `signed_out`,
or `unknown`. It reflects the resolved Firebase authentication state when the
event is captured. The observer attaches only when the application initializes
Firebase; analytics never starts authentication or delays application boot.
Initial app pageviews wait at most one second for authentication to resolve,
preserving their navigation timestamp. Navigation, actions, and page exit flush
any pending view without adding another pageview. Login/logout changes subsequent
events without changing the anonymous browser ID.

A fresh landing visit, slow/failed authentication, and data collected before this
property existed cannot be classified as signed out. Keep them unknown or only
in the unfiltered total. Auth splits start with the new build; old events cannot
be backfilled reliably. A browser can appear in both signed-in and signed-out
unique counts, so those counts must not be added to calculate the total.

The bundled SDK already emits a random `$session_id`; no custom session-start
event or extra persistent identifier is necessary. Count **unique sessions**
(`unique_session`) on `$pageview` to measure sessions with a recognized pageview.
Within one document, navigation and actions share the session until 30 minutes
without captured activity or the SDK's 24-hour maximum. These are sessions with
pageviews, not every mouse movement or all unobserved activity.

SDK persistence intentionally remains memory-only to avoid saving private
session-entry URLs. A reload, full-document navigation, or new tab starts a new
session even when the anonymous browser ID stays the same. Label the metric
**Sessions (memory-only)**; it is not a cross-tab, refresh-deduplicated visit count.
See [PostHog sessions](https://posthog.com/docs/data/sessions) and
[JavaScript persistence](https://posthog.com/docs/libraries/js/persistence).

## Suggested dashboard

- Acquisition funnel: unique browsers doing `$pageview` with `page=landing`,
  then `start_clicked`, in that order (for example within one day).
- App MAU: unique `distinct_id` on `$pageview`, with `page` in
  `catalog, plan, settings, semester, share, search, course, offline`, grouped by
  calendar month. Label it **monthly active browsers**. Use all pages for site MAU.
- Operations: total events per day/week for the explicit action events.
- Page traffic: both total `$pageview` counts and unique anonymous browsers
  (`dau` over the selected period), broken down by `page`.
- Sessions: unique `$session_id` on `$pageview`, with the memory-only caveat above.
- Show unfiltered total, signed-in, and signed-out series for each metric.
  Keep unknown/pre-update traffic visible rather than silently calling it signed out.
- Adoption: unique browsers for first-degree, saved import and saved copy.

Unique anonymous browsers are not verified people or unique user accounts, even
when filtered to signed-in events. Account-level deduplication across devices is
not collected. Browser storage resets, private browsing, multiple devices/origins, DNT/GPC, blockers,
and offline requests affect the counts. No login identity is sent or merged.

## Privacy boundary

- The lightweight bundled SDK has no optional extensions or external scripts.
- Autocapture, automatic pageviews/pageleave, recording, exceptions, heatmaps,
  performance, rage/dead clicks, surveys, remote configuration/flags, person
  profiles, referrers and campaign capture are disabled.
- Only explicit allowed event names and enum properties (including authentication
  status) survive `before_send`.
  All raw URLs, queries, fragments, referrers, names, emails, Firebase IDs,
  degree/course IDs, semesters, grades, filenames, file content, `$set` and
  `$set_once` fields are removed. `$pathname` is a fixed sanitized page path.
- SDK state, including session/window IDs, is memory-only. The application persists only a random UUID and a
  first-degree boolean for analytics. This avoids the SDK's default persistence
  of raw session-entry/share URLs. It does not change existing plan storage.
- The UUID is passed as an explicitly anonymous bootstrap ID. Never call
  `identify`, `alias`, `group`, or set person properties in this integration.
- DNT and Global Privacy Control disable initialization. Disabled analytics
  writes neither the anonymous browser ID nor the first-degree marker. Requests carry
  `$process_person_profile:false` and `$geoip_disable:true`.
- Configure **Discard IP data** in the PostHog project before enabling collection.
  Do not rely on the deprecated `ip:false` SDK option. The provider still receives
  network IP addresses in transit. Review any applicable consent/privacy notice
  requirements before activation; this is not a claim of legal compliance.
- These safeguards apply to this new PostHog integration, not the unchanged GA
  and Vercel integrations.

## Verification

```sh
npm run test:unit -- --run
PUBLIC_POSTHOG_KEY=phc_test_only \
PUBLIC_POSTHOG_HOST=https://posthog.example.test \
BASE_PATH=/degree-planner npm run build:pages
BASE_PATH=/degree-planner npx playwright test --config playwright.analytics.config.ts
```

Repeat build and browser checks with `BASE_PATH=''` for root hosting.
The browser suite intercepts every request to the test host, decodes actual SDK
payloads, and blocks unrelated external requests. It does not send events to a
real project. It exercises the landing funnel, persistent random ID, navigation,
course operations, saved cross-semester moves, Save clicks including failed writes
and retries, session stability within SPA navigation and rotation on reload,
authentication status, share/copy confirmation, file failure/cancel/save, and private
URL/referrer stripping including storage. The analytics workflow tests both base
paths and never deploys. Unit tests cover disabled configuration, failed writes,
first-degree repetition, storage failures, event allowlisting, route dedupe,
unknown authentication, login/logout changes, and session inactivity rotation.
