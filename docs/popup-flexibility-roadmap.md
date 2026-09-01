# Popup Platform Flexibility Roadmap

## Context

Written 2026-08-31 after a capability audit prompted by a simple question:
"if a client asks for X, can we actually build it?" This is a different angle
from `docs/popup-upgrade-plan.md` (which is about design/conversion-rate
research within the existing system) - this doc is about raw platform
*capability* gaps that block arbitrary client requests regardless of design
quality. Four gaps were identified and confirmed against the actual code
(`src/lib/templates/runtime.ts`, `src/lib/popupDna.ts`,
`src/app/api/widget/leads/route.ts`). None of these are scoped or approved
implementation plans - each one still needs its own planning pass (this repo
uses Claude Code's plan mode for that) when picked up, since all four are
architecturally significant, not small tweaks.

---

## Gap 1: No real multi-step / multi-page popups

**Confirmed today:** `step_flow` (`popupDna.ts`) is a strict 2-value enum
(`one_step | two_step`). `resolveFlow()` (`runtime.ts:55-74`) derives up to 4
*fixed, named* screens - teaser, capture, reveal, success - from the
combination of `goal` × `step_flow`, not from any count-driven structure.
`goToStep()` (`runtime.ts:541`) just toggles `hidden` on
`.popup-step[data-step="N"]` for N∈{1,2,3,4}; `data-next="2"` is the only
hardcoded jump anywhere. There is no loop, array, or generator - a 3-question
quiz flow or an N-step wizard cannot be built today at any step count other
than what those 4 named slots produce.

**What's needed:**
- Generalize the step machine in `runtime.ts` from 4 named cases to an
  ordered array of steps, each with its own type (question / capture /
  reveal / message) and content, rendered/advanced generically instead of by
  name.
- Extend `PopupDna` (or add a new top-level `steps: PopupStep[]` field to
  `PopupSpec`) so a spec can carry a variable-length step program.
- Extend the AI generation tool schema (`popupSpecSchema` in
  `popupGeneration.ts`) so the model can emit a bounded-length step array
  (e.g. 1-6) instead of just picking `one_step`/`two_step`.
- Backward compatibility: today's 4 goal×step_flow combinations should become
  one built-in "step program" preset each, so existing `Variant` rows with
  the current shape keep rendering unchanged without a data migration.

---

## Gap 2: Lead capture doesn't forward to the merchant's actual ESP

**Confirmed today - better than assumed, but with the gap suspected:** Email
capture *is* fully wired end-to-end for what it currently promises: the
widget's submit handler (`runtime.ts:661-741`) POSTs to
`/api/widget/leads`, which creates a real `Lead` row, sends a real reward
email to the shopper via Resend (`sendRewardEmail`, `lib/email.ts:20-37`),
fires an outbound webhook if the merchant configured one, and best-effort
upserts a Shopify Customer. What does **not** exist: forwarding a captured
lead into Klaviyo/Mailchimp/HubSpot. `Account.integrationCredentials` is
pure storage - `api/account/integrations/route.ts` says so directly in its
own comment: "nothing reads it yet to actually forward leads to these
providers. That sync job doesn't exist yet."

**What's needed:**
- A new Inngest function (e.g. `forward-lead-to-esp`), triggered from the
  same place the reward email/webhook already fire in
  `api/widget/leads/route.ts`'s `after()` block.
- A small per-provider adapter interface - Klaviyo's profile/subscribe REST
  call first (most commonly requested), Mailchimp/HubSpot as fast-follows
  behind the same interface.
- Real credential *validation* at connect time (today the integrations route
  just stores whatever string is pasted, no verification call), plus a
  `lastSyncStatus`/error surface so a merchant can tell if forwarding is
  silently failing rather than finding out from a support ticket.

---

## Gap 3: No dynamic placeholder/variable system in copy

**Confirmed today:** No `{{variable}}` or merge-tag system exists anywhere -
grepped `templates/*.ts`, `popupGeneration.ts`, `popupDna.ts` for `{{`,
"merge", "interpolat" and found nothing of that kind. Copy fields
(`reveal_headline`, `reveal_subhead`, etc.) are plain static strings written
once at generation time and dropped into HTML via `esc()` with no
substitution pass. The *only* dynamic value in the whole system is the
coupon code, and it isn't a generic variable - it's one specific hardcoded
DOM slot, `#asmosPopupCodeValue` (`runtime.ts:258`), overwritten by JS after
the leads API responds. A merchant or the AI cannot reference any other
dynamic value (shipping estimate, customer name, live stock count, etc.) in
copy today.

**What's needed:**
- Define a small, closed set of "known variables" (not arbitrary/unbounded -
  each one needs an actual data source) that DNA copy fields can reference
  via a `{{variable_name}}` token.
- An interpolation pass that replaces those tokens with real values -
  **timing matters per variable**: some (store name, discount percent) are
  known at generation time and can be substituted server-side when the
  `Variant` is created; others (a live stock count, a per-visitor referral
  code) need substitution at *serve* time in `widget.js`/`runtime.ts`,
  client-side, per visitor.
- Extend the generation prompt so the model knows which variables exist and
  is told to use them instead of inventing static text where a real dynamic
  value would be more honest.

---

## Gap 4: No customer redirection

**Confirmed today:** Zero navigation capability exists. Every popup button
is `type="button"` (`runtime.ts:184,189,222,259,261,269`) - there is no
`<a href>` anywhere in `runtime.ts` or the three template files, and the only
`window.location` reference in the entire runtime is a read-only path check
for `/store-preview`, not a navigation call. The three click behaviors that
exist are: advance to the next step (`data-next`), close the popup
(`data-dismiss`), and copy the coupon code to clipboard
(`#asmosPopupCopy`). Sending a shopper to a URL - as the CTA action itself,
or after a successful submission - isn't wired anywhere.

**What's needed:**
- A CTA action type field (e.g. `cta_action: "advance_step" | "reveal_coupon"
  | "redirect" | "close"`) on `PopupSpec`/`PopupDna`, with a `redirect_url`
  when the action is `"redirect"`.
- A new click handler branch in `runtime.ts` that navigates
  (`window.location.href` for same-tab, `window.open` for new-tab - decide
  which, or support both) when the resolved action is `redirect`.
- Care needed at the tracking boundary: the `SUBMISSION`/click event has to
  actually reach the server *before* the navigation fires, since a hard
  page navigation can cancel an in-flight `fetch()`. Likely needs
  `navigator.sendBeacon()` for this specific path rather than the existing
  fire-and-forget `fetch()` pattern.
- Validation/safety: same-origin vs external URL handling, and whether an
  external redirect should be allowed at all without some merchant-level
  opt-in (a popup silently sending shoppers off-site is a real trust/abuse
  surface).

---

## Suggested order

1. **Gap 4 (redirection)** - smallest surface area, no schema-shape change
   beyond one new field, clearest value (e.g. "go to this collection page"
   is a very common ask).
2. **Gap 2 (ESP forwarding)** - high merchant value, fully additive (new
   Inngest function + adapter), doesn't touch the rendering/runtime path at
   all.
3. **Gap 3 (variables)** - moderate complexity, unlocks real per-visitor
   personalization once the timing question (server vs client substitution)
   is settled.
4. **Gap 1 (multi-step)** - biggest lift, touches the shared runtime state
   machine every existing template depends on; get it right rather than
   fast, since a regression here breaks every live popup at once.

This ordering is a suggestion, not a commitment - re-evaluate against
whatever's actually being asked for by the time this gets picked up.
