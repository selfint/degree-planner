# Explicit PWA updates

## One build identity and one installed document

The footer, SvelteKit client, worker protocol, and shell-cache namespace share a
single deterministic build identity. `scripts/buildIdentity.mjs` combines Git
provenance with a fingerprint of application source, build configuration and
lockfile, required shell static assets, and toolchain/mode. The footer abbreviates
the commit portion but retains the fingerprint; its full identity is available
on hover. A Git SHA alone is not an artifact identity. Identical inputs produce
identical identities, while changed application inputs at the same commit cannot
alias the previous cache. Build time and deployment IDs are not inputs.
Independent fetched course data and tutorial media are not shell identity inputs.
When introducing build-affecting environment configuration, update the input
contract and tests explicitly; never hash private secrets or all of `process.env`.

Every controlled `/app/` document navigation, online or offline, receives the
serving worker's cached, data-free SPA shell. That build resolves the original
URL, including trailing slashes and unknown/new routes. A newer network deployment
cannot advance the page while its worker is still waiting for acceptance. App
assets remain pinned to their immutable URLs. Marketing, authentication, API,
and browser-share documents are outside this navigation policy.

If the installed shell is missing, repair fetches and validates that worker's own
entry-point graph before storing it. A mismatched newer shell is never executed.
If repair fails, a self-contained localized recovery document offers Retry or an
explicit Update action. Recovery uses the same version-bound sole-client protocol,
never clears storage, and never loads a newer application bundle before acceptance.
An already-ready waiting worker can be used offline; a new update check is bounded.

### Lifecycle boundaries

This policy guarantees the document returned by a **controlled navigation** matches
the worker that serves it. It does not assert that every already-open document
always matches its controller. A first uncontrolled load can race deployment, and
an old network-first worker already installed on a device retains its old policy
until one explicit update replaces it. These are migration/initial-load boundaries,
not evidence that a reported device followed either particular path.

Likewise, accepted activation can change the controller before the final guarded
reload. If the user starts a draft during activation, the old document remains
open, retained immutable caches remain available, and an explicit retry is kept.
Draft safety takes priority over forcibly making the document match the controller.

When a waiting version has been verified, a native button styled like the report
link adds a minimal Update action beside the version. It uses the exact same
acceptance handler and live safety state as the banner, including after the
banner is dismissed. Browser-only `/share/` previews display the running version
without mounting the service-worker lifecycle, readiness diagnostics, or update
actions because those documents are outside the `/app/` worker scope. Keyboard users can activate it with Enter or Space. Dirty,
saving, and applying states disable it; blocked reasons and failures stay visible.

The Update action is disabled while the current document has an unsaved plan or
settings/transcript draft, a pending storage write, or a failed save. A successful
retry or explicit discard clears a save failure; remaining drafts and writes still
block updating. Both activation and the final reload check the live guards.

The waiting worker verifies the requested version, prepares its own complete shell,
and refuses activation if any other `/app` window exists, including uncontrolled or
unknown clients. Users must save and close those windows themselves. No other tab
is automatically reloaded. This check is conservative, not an atomic browser-wide
lock: a new window can open immediately afterward.

For that race, activation retains historical console caches. The new worker serves
an old immutable build asset only from its exact URL in a console shell cache.
Old HTML is never used as the new navigation shell. This intentionally increases
storage use across deployments. Cache garbage collection requires a separate,
conservative live-client/version design; deleting all old caches or merely keeping
the latest two builds is unsafe for long-lived tabs. Browser storage eviction is
still possible and is reported through the existing shell-readiness checks.

## Automatic update discovery

Once the `/app/` registration is available, the app checks whether an update
check is due. The explicit check runs at startup when there is no recent attempt,
then at most once an hour while the page is visible and online. Focus, visibility,
page restore, and reconnect events check the same timestamp, so returning after
an hour triggers a check without waiting another hour. Hidden/offline pages do
not poll or consume an attempt. This does not promise background execution when
an installed app is suspended or closed, including on iOS.

The origin-local `planit:pwa:update-check:/app/` record stores `lastAttemptAt`
before requesting `registration.update()` and `lastCheckedAt` only after that
request resolves. Failed or timed-out requests retain the previous success and
are throttled for an hour too. An update request resolving is not proof that a
new worker installed or its offline shell is ready; the existing worker-version
and readiness checks remain authoritative. A 30-second wait bounds stalled
checks, and invalid/future timestamps are treated as due rather than blocking
checks indefinitely.

A short Web Lock coordinates the persisted attempt between tabs when supported.
Without usable Web Locks, shared storage is best-effort deduplication; when storage is
blocked, the per-page memory throttle still works. None of this replaces the
existing activation safety gates. Browser-owned registration/navigation update
checks may also run independently. Discovery never activates a waiting worker,
reloads the page, or changes saved plans. `/share/` previews and unrelated worker
registrations are excluded.

## Verification

- Two clean identical-input Vite builds must produce the same canonical identity
  **and byte-identical service-worker scripts**; stable labels alone are not enough
  because browsers compare worker script bytes.
- Controlled online reload/new-tab/offline navigations must remain on A while B
  waits; explicit safe acceptance must advance to B and repeated checks/reloads
  must not re-offer B. Evicted A shells must never execute network B implicitly.
- Recovery tests execute the actual emitted inline protocol clients, including
  successful acceptance and refusal while other app windows exist.

- Unit tests execute the actual acceptance action, plan Save and storage boundary,
  and settings discard handlers with isolated data and controlled dependencies.
- `vite build` followed by `vitest run --config vitest.integration.config.ts`
  exercises the emitted worker in a VM and checks real immutable asset names.
- `tests/pwa.test.ts` uses native service workers and independently compiled deployment
  snapshots throughout the real module graph. Retired URLs return 404 at the
  origin. The acceptance regression imports a retired node's dependency graph
  offline, preserves saved plan/IndexedDB state, and checks new lazy navigation.
- Run the browser suite in Chromium and the configured WebKit shell project before
  treating native activation/reload behavior as verified. VM and unit passes are
  not native browser verification. Physical iPhone standalone behavior requires
  separate device testing.

Storybook's PWA fixtures show clean, unsaved, saving, applying, and other-tab error
states using the existing global theme/language controls. They never activate a
worker, reload a document, or write a real plan.
