# PlanIt visual refresh

This pass keeps the existing PlanIt logo, teal accent and light/dark preferences.
It focuses on readable mobile layouts and consistent controls rather than new
application behavior.

## Shared foundation

- Color, surface, border, radius and shadow tokens live in `src/app.css`.
- `ui-button`, `ui-field`, `ui-panel`, `ui-page`, `ui-page-title` and `ui-notice`
  provide shared sizing and hierarchy. Interactive controls use a 2.75rem minimum
  target. Text and layout dimensions use rem; responsive containers stay fluid.
- Secondary text and primary action labels meet 4.5:1 contrast in both themes,
  covered by `src/lib/designTokens.test.ts`.
- Logical spacing and automatic direction on bilingual course titles preserve
  Hebrew/English readability. Storybook's toolbar owns theme/language/direction.

## Pages and states

The landing uses a clearer introduction and aligned demonstration sections.
Installation guidance is always visible at the bottom, without starting console
services. Console navigation remains available before selecting a degree, and
mobile search has its own full-width row. Course cards keep a readable minimum
width inside intentional horizontal rails; semester metrics are labeled.

The startup view contains the existing brand and an indeterminate bar, plus a
localized screen-reader status. The root layout shows it only when entering the
console from outside `/app`; internal tabs, history and offline client navigation
retain the current document without the full-screen startup overlay.

Existing offline write guards, Firebase isolation, IndexedDB ownership, and
service-worker update rules remain in place. Course data remains JSON.

## Verification

The browser suites cover repeated console tabs, history, offline routes, native
search, drag gestures and installation guidance. The deployed mobile suite checks
real settings/catalog/plan/search/course pages and saves screenshots. Storybook
covers all visible components and screens with meaningful state variants, using
its normal canvas size and global appearance controls.

Physical iOS standalone behavior and live Google authentication are separate
checks; mobile browser emulation does not establish either.
