# Button audit

All action surfaces were reviewed together rather than treating each Save label as a new design.

## Shared contract

`Button` is the native action primitive. `AsyncButton` composes it and owns its async lock/spinner; `PlanActionButton` adds plan-write/offline policy. All three use the same global `.ui-button` variants. Semantic links and the native file-upload label use those same classes without pretending to be buttons.

Primary action paint is the approved dark teal/white Save/Share style in **both themes**. It has separate tokens from decorative accents, so the dark theme's light teal accent cannot silently change action contrast. Secondary actions retain the surface/border treatment. Route-local Save and Copy patches have been removed. Disabled file uploads use the same disabled contract and do not show an enabled hover affordance.

## Reviewed inventory

| Surface             | Controls                                           | Contract                                          |
| ------------------- | -------------------------------------------------- | ------------------------------------------------- |
| Settings account    | Google sign-in, sign-out                           | Secondary async                                   |
| Settings degree     | Save/loading Save, Cancel, Revert                  | Primary plan/async, secondary async/button        |
| Settings semesters  | Current and total semester Save/Cancel             | Primary plan, secondary async                     |
| Settings transcript | Upload, parsed Save, Cancel                        | Primary native file label/plan, secondary async   |
| Plan                | Save, Cancel, Share                                | Primary plan/link, secondary async                |
| Shared plan preview | Copy plan                                          | Primary plan                                      |
| Course              | Plan; wishlist, exemptions and semester add/remove | Primary plan, secondary plan                      |
| Catalog and offline | Settings, return-to-plan links                     | Secondary links                                   |
| Landing             | Get started / install-information navigation       | Primary link; normal navigation retained          |
| Search              | Submit, clear filters, results                     | Icon, secondary, card                             |
| Semester            | Course visibility toggles and navigation           | Card; native keyboard click, explicit button type |
| Course cards        | Open, requirement disclosure                       | Card and disclosure, not primary actions          |
| PWA banner          | Accept update, dismiss                             | Secondary and icon                                |
| PWA account         | Retry, sign out                                    | Secondary                                         |
| PWA status/footer   | Error details, retry, update                       | Intentionally compact text actions                |
| Header/footer       | Brand/navigation, language and theme choices       | Links/native selectors, not primary actions       |

Card/icon/text controls deliberately retain their geometry and semantics. They must not inherit primary paint simply because their HTML tag is `button`. Destructive/removal actions remain secondary and are not promoted to primary.

## Regression coverage

- Unit tests render synchronous/asynchronous variants, native attributes and disabled state; enforce shared primary tokens, no page-level action-paint overrides and keyboard-operable semester controls.
- Real Storybook consumers cover degree/semester/transcript Save, upload and shared primitives in English/Hebrew, dark/light and 320/390-pixel layouts. Async lock/focus and disabled upload hover are exercised.
- Existing route layout/navigation tests cover Plan Share, Copy, Course actions, Settings, filters and text/icon controls. Existing Storybook variants cover pending/loading/offline/disclosure states.
- New native controls must be deliberately classified by the inventory regression test. Do not patch consumer CSS to change an action variant: update the shared contract and all consumer assertions together.
