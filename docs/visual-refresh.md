# PlanIt visual refresh

This pass keeps the existing PlanIt logo, teal accent and light/dark preferences.
The console prioritizes compact task layouts, SAP course content and direct
controls. Explanatory and marketing copy stays on the landing.

## Shared foundation

- Color, surface, border, radius and shadow tokens live in `src/app.css`.
- `ui-button`, `ui-field`, `ui-panel`, `ui-page`, `ui-page-title` and `ui-notice`
  provide shared sizing and hierarchy. Console controls use compact 2.25rem
  targets; landing primary actions retain 2.75rem targets. Editable text stays
  at 1rem to avoid mobile input zoom. Labels stay on one line and whole buttons
  wrap within action groups. Dimensions use rem; containers stay fluid.
- Secondary text and primary action labels meet 4.5:1 contrast in both themes,
  covered by `src/lib/designTokens.test.ts`.
- Logical spacing and automatic direction on bilingual course titles preserve
  Hebrew/English readability. Storybook's toolbar owns theme/language/direction.

## Pages and states

The landing uses a clearer introduction and aligned demonstration sections.
Installation guidance is always visible at the bottom, without starting console
services. Console navigation remains available before selecting a degree, and
mobile search has its own full-width row. Mobile planner rails show three full
course cards and a visible fourth-card peek at 320px and 390px in both directions.
The shared course card retains the original content hierarchy: marker/note and
median/credits above the name with inline code, then timing and warning details.
Full course names remain in accessible text and titles. Search uses compact
full-width result rows on narrow screens. Semester metrics remain concise.

Healthy/preparing status takes no space. Exceptional setup or waiting-update
status uses one header indicator with optional details, without moving task
content. Offline write reasons stay near disabled actions. Failed public-data
refreshes use the same compact indicator with their actual cause. Valid stored
data remains readable, and only a successful refresh of the failed resource
clears its error. Selected-degree data uses this same reporting path.

The startup view contains the existing brand and visible localized stage text
below the bar. Data preparation shows the actual count of validated, persisted
data files completed; application loading, cache checks and final initialization
remain indeterminate rather than estimating elapsed-time progress. The root
layout shows it only when entering the
console from outside `/app`; internal tabs, history and offline client navigation
retain the current document without the full-screen startup overlay.

Existing offline write guards, Firebase isolation, IndexedDB ownership, and
service-worker update rules remain in place. Course data remains JSON.

## Verification

The browser suites cover repeated console tabs, history, offline routes, native
search, drag gestures and installation guidance. Repeated native touch navigation
between related courses checks for stale hover decoration; keyboard navigation
retains focus-visible outlines. Hover decoration is restricted to fine pointers
that support hover. The deployed mobile suite checks
real settings/catalog/plan/search/course pages and saves screenshots. Storybook
covers all visible components and screens with meaningful state variants, using
its normal canvas size and global appearance controls.

Physical iOS standalone behavior and live Google authentication are separate
checks; mobile browser emulation does not establish either.
