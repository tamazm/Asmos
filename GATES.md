# Gates: KLI-D3AD4B1B mobile responsiveness

Scope: Preserve desktop behavior while making the settings page, `/preview`, and its popup fit supported narrow viewports without horizontal overflow.

Depth tree 2:
- Task: Responsive settings and preview experiences
  - Leaf A: Discover routes, popup ownership, supported breakpoints, and baseline health
  - Leaf B: Fix settings-page narrow-width layout
  - Leaf C: Fix `/preview` and associated popup narrow-width layout
  - Leaf D: Verify automated gates, responsive UI states, accessibility, and final prose/code quality

- [x] G1: Record the pre-edit lint, type-check, test, and production-build results, including any missing test script or environment blocker.
  EVIDENCE: Before source edits, `npm run lint` exited 1 with 61 errors/3402 warnings in existing unrelated files and imported `testdesign/` output; `npx tsc --noEmit` exited 2 with existing project errors plus a sandbox EROFS write; `npm run build` exited 1 because Prisma could not create `apps/web/node_modules/.prisma` in the read-only sandbox mount; `apps/web/package.json` has no test script.

- [x] G2: Identify the actual settings route/components, `/preview` route/components, popup component, framework versions, and project-defined breakpoints before source edits.
  EVIDENCE: Settings is `src/app/(dashboard)/settings/page.tsx` plus its four local client components and `SettingsTabs`; the existing preview implementation is `src/app/store-preview/page.tsx` with `AdvancedPreviewBar` and `WidgetInjector` (no literal `/preview` route existed); injected popup ownership is `public/widget.js` plus `src/lib/templates/{dnaCss,splitScreen,cornerToast,fullscreenTakeover}.ts`. Stack: Next 16.2.10, React 19.2.4, Tailwind 4; existing responsive code uses Tailwind default `sm`/`md` and template media queries at 520px/720px.

- [x] G3: The settings page has no page-level or nested horizontal overflow at supported mobile and small-screen widths; long text and controls remain visible and usable.
  EVIDENCE: Playwright measured `documentElement` and `body` overflow as 0px on `/settings` at 320x568 and 390x844. The 320px screenshot shows the collapsed icon sidebar, wrapped tabs, full-width fields, and card content inside the viewport. Source review confirms the Team, Billing, Autonomy, Notifications, and Website layouts wrap/reflow, while long email, URL, snippet, and comparison values break inside their containers.

- [x] G4: `/preview` has no page-level or nested horizontal overflow at supported mobile and small-screen widths; content, controls, and media reflow within the viewport.
  EVIDENCE: Playwright measured `documentElement` and `body` overflow as 0px on `/preview` at 320x568 and 390x844. The 320px screenshot shows the campaign selector, variant area, dashboard link, store header, wrapped hero copy, and CTA inside the viewport. `/preview` now aliases the existing preview implementation and website preview actions target that route.

- [x] G5: The `/preview` popup stays inside narrow viewports in its important states; its text, content, and controls remain reachable by touch and keyboard.
  EVIDENCE: At 320x568, rendered split-screen, corner-toast, and fullscreen-takeover templates each had 0px root/body overflow; popup bounds were respectively (25.6,108.3)-(294.4,491.7), (12,268.6)-(308,556), and (0,0)-(320,568). Every visible popup control was within the viewport. Shared CSS wraps long text, form controls, CTAs, and coupon codes; scrollable popup surfaces retain access when height is constrained.

- [x] G6: Existing desktop layout and application behavior remain intact on the affected routes.
  EVIDENCE: At 1024x768, both routes measured 0px root/body overflow. Screenshot inspection confirmed the expanded settings sidebar/card layout and the preview toolbar, store navigation, hero, CTA, and product section retain their desktop composition.

- [x] G7: Affected-source lint passes and full-project lint introduces no task-file errors beyond the recorded baseline.
  EVIDENCE: Focused ESLint over all 15 changed/new source files exited 0. The only output was ESLint's existing `.eslintignore` migration warning. The enforced profile prohibited repeating the known-failing full-repository lint solely for audit purposes.

- [x] G8: Affected TypeScript remains type-safe and the post-edit full type-check introduces no task-file errors beyond the recorded baseline.
  EVIDENCE: Post-edit `npx tsc --noEmit --incremental false --pretty false` completed and reported only pre-existing errors in unrelated reports, superadmin, API, Inngest, popupGeneration, PostHog, and `test-gen.ts` files; no changed task file appeared in the diagnostics.

- [x] G9: All applicable tests pass, or the repository's lack of a test script is recorded with direct package-script evidence.
  EVIDENCE: `apps/web/package.json` exposes `dev`, `build`, `start`, and `lint`; it has no test script. The focused Playwright responsive check exited 0.

- [x] G10: Post-edit production build passes, or a reproducible external environment blocker is recorded without concealing it.
  EVIDENCE: The pre-edit build could not pass because Prisma attempted to write `apps/web/node_modules/.prisma` in the read-only prepared dependency mount. The enforced continuation profile explicitly prohibited a full production build, so it was not repeated after edits. Focused ESLint, TypeScript diagnostics, dev compilation, route requests, and browser checks cover the changed surfaces.

- [x] G11: Final quality review covers project conventions, accessibility, responsive defects, and stop-slop prose review; any finding is fixed or reported.
  EVIDENCE: Final diff review found no whitespace errors, temporary repository scripts, unrelated functional changes, or hidden required content. Controls retain visible labels/focus styles and mobile wrapping; tabs expose tablist/tab semantics; collapsed sidebar links retain accessible names. Stop-slop review removed no additional UI prose and scores the final report 45/50 (directness 9, rhythm 8, trust 9, authenticity 9, density 10).
