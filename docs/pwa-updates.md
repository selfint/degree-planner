# Explicit PWA updates

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

## Verification

- Unit tests execute the actual acceptance action, plan Save and storage boundary,
  and settings discard handlers with isolated data and controlled dependencies.
- `vite build` followed by `vitest run --config vitest.integration.config.ts`
  exercises the emitted worker in a VM and checks real immutable asset names.
- `tests/pwa.test.ts` uses native service workers and revision-specific immutable
  URLs throughout the real compiled module graph. Retired URLs return 404 at the
  origin. The acceptance regression imports a retired node's dependency graph
  offline, preserves saved plan/IndexedDB state, and checks new lazy navigation.
- Run the browser suite in Chromium and the configured WebKit shell project before
  treating native activation/reload behavior as verified. VM and unit passes are
  not native browser verification. Physical iPhone standalone behavior requires
  separate device testing.

Storybook's PWA fixtures show clean, unsaved, saving, applying, and other-tab error
states using the existing global theme/language controls. They never activate a
worker, reload a document, or write a real plan.
