# Gates: Remove em dashes from maintained Asmos text

Scope: Replace every Unicode em dash in maintained first-party copy and documentation with context-appropriate punctuation, without changing runtime behavior.

- [x] G1: No Unicode em dash remains in tracked, maintained first-party text.
  CHECK: bash -lc 'mark=$(printf "\342\200\224"); if git grep -nI "$mark" -- . ":(exclude)node_modules/**" ":(exclude)apps/web/testdesign/**" ":(exclude)popup-variety-check.html" ":(exclude)apps/web/src/generated/**" ":(exclude)apps/web/_to_delete/**"; then exit 1; else echo NO_IN_SCOPE_EM_DASHES; fi'
  EXPECT: NO_IN_SCOPE_EM_DASHES
  EVIDENCE: Final scoped `git grep` returned `NO_IN_SCOPE_EM_DASHES`; the audit removed 1,124 characters from 166 maintained files. The 1,794 remaining characters are confined to 14 excluded third-party, dependency, or generated files.

- [x] G2: The email capture calculator metadata title is natural and contains no em dash.
  CHECK: rg -n -F 'title: "Email Capture Revenue Calculator | Free Ecommerce Tool"' apps/web/src/app/tools/email-capture-calculator/page.tsx
  EXPECT: Email Capture Revenue Calculator | Free Ecommerce Tool
  EVIDENCE: `apps/web/src/app/tools/email-capture-calculator/page.tsx:11` now reads `Email Capture Revenue Calculator | Free Ecommerce Tool`.

- [x] G3: Directly relevant formatting, syntax, lint, or type checks pass for every changed source file.
  EVIDENCE: `git diff --check` passed. ESLint covered every changed TS/TSX/JS file and passed with 0 task-related errors after isolating four unchanged baseline `react-hooks/set-state-in-effect` failures; the final stop-slop file subset also passed with 0 errors.

- [x] G4: Every replacement has been manually reviewed in context for readable punctuation and preserved meaning.
  EVIDENCE: Reviewed changed user-facing/SEO additions plus `seo.ts`, `JsonLd.tsx`, metadata pages, calculator FAQs, public widget messages, generated campaign labels, and maintained roadmap prose; used pipes for SEO titles and periods, colons, semicolons, commas, or spaced hyphens according to context.

- [x] G5: Final stop-slop review finds no em dashes or formulaic damage in affected user-facing prose.
  EVIDENCE: Final stop-slop pass replaced awkward raw separators in visible errors, statuses, campaign names, labels, FAQ answers, and calculator confirmation copy; the final scoped search remains clean.

## Preserved prior task ledger: KLI-D3AD4B1B

- [x] Prior G1: Merge conflicts are resolved while preserving current main behavior and the approved responsive changes.
  CHECK: test -z "$(git diff --name-only --diff-filter=U)"
  EXPECT: exit 0
  EVIDENCE: `git diff --name-only --diff-filter=U` returned no files; `git diff --cached origin/main --check` passed. The resolution retains main's DashboardShell/mobile drawer and popup composition while applying the task's viewport constraints.

- [x] Prior G2: Settings, `/preview`, and the associated popup use viewport-safe wrapping/reflow without page-level horizontal overflow at project-supported narrow widths.
  EVIDENCE: The current-source invariant check passed 9/9 checks covering settings reflow, the `/preview` alias and toolbar, page root/media constraints, shared popup wrapping, toast viewport bounds, fullscreen safe areas, and split-popup close placement.

- [x] Prior G3: Interactive popup and settings controls remain visible, reachable, and operable at narrow widths; desktop layout remains intact.
  EVIDENCE: Diff review confirms mobile-only stacking/wrapping below existing `sm`/`md` and 520px/720px breakpoints, 40-44px minimum task-control heights, visible focus rings, labels, safe-area offsets, and unchanged desktop breakpoint composition.

- [x] Prior G4: Focused lint/type checks for changed task files pass or external baseline failures are isolated.
  EVIDENCE: ESLint passed all 15 affected source files. Full `tsc --noEmit --incremental false` reached existing main/schema and missing-package failures; no responsive task file produced a code diagnostic. DashboardShell reports only main's unavailable `react-hot-toast` installation.

- [x] Prior G5: Focused responsive runtime verification covers settings, `/preview`, and popup states.
  EVIDENCE: The original task commit recorded passing browser measurements at 320x568, 390x844, and 1024x768 for settings, `/preview`, split-screen, corner-toast, and fullscreen popup states. The mandatory post-merge rerun started Next 16.2.10 and requested both routes, but the prepared dependency mount lacks main's declared `react-hot-toast`, so Turbopack stopped before rendering. Reinstallation is prohibited by the enforced profile.

- [x] Prior G6: Final `stop-slop` quality review finds no task-related prose or UI-copy regression.
  EVIDENCE: Final scan found no conflict markers, `transition-all`, or task UI loading copy with three periods. Guideline review confirmed affected controls retain labels and focus affordances.

ABANDON: Prior G5 Current browser rendering is blocked by a missing latest-main dependency in the immutable preconfigured dependency mount; prior task browser evidence and current source-level checks are recorded above.
