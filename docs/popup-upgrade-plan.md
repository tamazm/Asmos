# Making Asmos popups stunning *and* high-converting

Research + a concrete upgrade plan, written against the current code
(`apps/web/src/lib/templates/*`, `apps/web/src/lib/popupDna.ts`,
`apps/web/public/widget.js`).

---

## 0. Where the bar actually is

Numbers to design against, not vanity targets:

| Metric | Benchmark |
|---|---|
| Average popup conversion, all industries | ~4.8% |
| Ecommerce specifically | ~6.9% |
| Standard discount modal, "good" Shopify store | 5–8% |
| **Gamified (spin wheel / scratch)** | **8–15%, roughly 2–3× a plain modal** |
| Multi-step flow vs. static form | up to **+86%** |
| Exit-intent vs. time-delay on product/pricing pages | **+47%** |
| 6–10s delay vs. fire-immediately | 2.4% vs 1.9% |
| Mobile vs. desktop popups | 4.98% vs 3.67% - **mobile converts better** |

Two of these are worth sitting with. Gamified popups are the single largest
multiplier available, and Asmos already has `WHEEL` and `SCRATCH_CARD` campaign
types in the schema - but the template engine has no gamified template, so those
campaigns fall through to the plain legacy card in `widget.js`. The biggest
conversion lever in the product is currently a `TODO` shaped like a feature flag.

And mobile out-converts desktop, while `fullscreen-takeover` is the template most
likely to get a merchant's mobile rankings hit by Google's intrusive-interstitial
rule. Right now the DNA can't express "behave differently on a phone" at all.

---

## 1. The three failures that cap conversion today

### 1.1 There is no gamified template

`campaign.type` supports `WHEEL` / `SCRATCH_CARD`, `buildRewardBlock()` in
`asmos-widget.js` renders them as *a bulleted list of prizes*, and
`lib/templates/index.ts` has exactly three entries, none of which spin. The
design guide in `lib/popup-design-guide.md` §8.3–8.4 already contains working
canvas scratch-card and CSS-transform wheel implementations. They were never
wired into the template engine.

This is the highest-ROI item on the list by a wide margin.

### 1.2 No zero-party / yes-no fork

`step_flow` is `one_step | two_step`, and the two-step teaser is just
"offer → email". The pattern that produces the +86% number is a *question*
first - "What are you shopping for? Men's / Women's" - because answering it is a
micro-commitment and the answer is a segmentation field worth more than the email
alone. Asmos captures `email`, `name`, `phone` and nothing about intent.

### 1.3 Urgency is decorative

`timer_mode: "countdown"` renders a countdown that resets on every page load and
means nothing. Loss aversion is real (losing is felt ~2× as strongly as gaining),
but a timer the visitor can reset by refreshing trains them to ignore all of your
urgency. Either bind the deadline to something true - a reserved code, a real
campaign end date, stock level - or use `static_badge` and stop pretending.

---

## 1.5 Product imagery - checked, and cut

`art_direction: product` was investigated and then **removed** - the cost of
sourcing real product imagery wasn't worth it for one school. Recorded here
because the finding still matters for §6 item 7, and because it explains why
every popup currently shows stock photography.

Current state:

| Source | What it actually returns |
|---|---|
| `api/campaigns/scrape-pages` | **Page paths only.** It explicitly *excludes* image URLs (`isAssetOrNoisePath` filters `.jpg/.png/.webp`). No imagery at all. |
| `extractBrandMeta` in `api/analyze` | One `og:image` - a social share banner, opaque, usually a logo lockup. |
| `lib/imageLibrary.ts` | **11 hardcoded Unsplash stock photos**, hotlinked, grouped into 7 categories. Two of the categories share the same photo. |

So today every "product" popup shows a stock photo of somebody else's product. No
cutout, no alpha channel, nothing from the merchant's own catalogue.

**The path that works**, in order of effort:

1. **`{store}/products.json`** - public on essentially every Shopify store, no
   API key, no auth, returns `products[].images[].src` at full resolution.
   That's the entire catalogue for one GET. WooCommerce has
   `/wp-json/wc/store/products` as the equivalent.
2. **Pick the right shot.** Prefer the image whose aspect ratio is square-ish
   and whose corners sample near-white - that's the packshot rather than the
   lifestyle photo.
3. **Knock out the background.** A large share of ecommerce packshots are
   already on white. A luminance key in a canvas pass (flood-fill from the
   corners, feather the edge) handles those without a model. Anything that
   fails the corner test keeps its background and renders framed instead of
   cut out - degrade, don't guess.

Worth doing eventually as an improvement to `image_treatment` across all
schools - a real product shot in the side panel beats an Unsplash photo
regardless of art direction. It is not worth doing as a dedicated school.

## 1.6 Why the output still reads as generated

Three habits, all in the shared CSS rather than in the model:

1. **Everything was centred.** Centre alignment is what a layout defaults to
   when nothing decided where the text goes - there is no left edge for the eye
   to return to, so a stack of centred elements reads as a list of unrelated
   things. Fixed by `text_align`, which defaults to a left axis for every
   school except glass.

2. **Spacing was even.** Every gap was `--asmos-gap` or `calc(gap * 1.6)` - 12px
   and 19px, all the way down. Even spacing tells the eye that every element is
   equally related to its neighbours, which is never true: an eyebrow belongs to
   its headline, the form is a separate movement. Replaced with
   `tight / text / break`, where break is 3-5× tight.

3. **Nothing was ever left out.** The model has an eyebrow field, a proof field,
   a privacy field, a dismiss field and a timer, so it filled all of them -
   averaging 1.7 supporting elements per popup with all four appearing about
   one time in twenty. A designer's first move on this brief is to delete three.
   Fixed by `maxSupporting` in each art preset, spent in priority order.

Plus the copy tell, which no amount of typography rescues: the model's default
is a headline stating the offer and a subhead restating it in different words.
`COPY_DISCIPLINE` in `designBrief.ts` now bans the paraphrase outright, along
with the "Get / Unlock / Don't miss" openings and the usual filler vocabulary.

Type contrast went from ~2.4:1 to ~3.7:1 in the same pass - the old scale had
headline and subhead close enough that they read as one texture.

## 2. The "whoa" problem, specifically

Read `dnaCss.ts` and the visual ceiling becomes obvious. Every popup Asmos can
currently produce is: `system-ui`, one flat accent color, a solid or outlined
button, one optional photograph, a 1.5px border, no shadow language, no texture,
no illustration. It is *clean*. It is not memorable. Nobody screenshots it.

Six levers, cheapest first - all expressible as new DNA knobs, so the model can
choose them per popup and they become testable axes rather than a redesign:

1. **Typography.** A single self-hosted display face for the headline against
   system-ui body copy does more for perceived quality than any other change.
   Add `type_pairing: editorial | geometric | grotesque | system`. Inline the
   font as base64 in the generated code or serve from your own origin - a
   third-party font request from a merchant's site is a CSP and privacy problem.

2. **Depth.** There is no `box-shadow` anywhere in `dnaCss.ts`. A layered shadow
   (`0 1px 2px`, `0 8px 24px`, `0 32px 64px` stacked) is what separates "a div"
   from "an object floating above the page". Add `elevation: flat | raised | floating`.

3. **A real background layer.** Mesh gradients, a subtle grain/noise overlay, a
   soft radial glow behind the CTA. `background_block` currently paints a 12%
   linear gradient and stops. Add `surface_treatment: plain | mesh | grain | glow | duotone`.

4. **Product imagery instead of stock.** `DEFAULT_FALLBACK_IMAGE` is a generic
   asset. The scraper (`api/campaigns/scrape-pages`) already visits the store -
   pull real product shots and let `image_treatment` place one as a cutout that
   *breaks the popup's bounding box*. Overlap is the cheapest "designed" signal
   there is.

5. **The reveal moment.** `.asmos-code` is a dashed border. The single most
   screenshot-able moment in the whole flow is the code appearing. Give it a
   flip, a confetti burst, a shimmer sweep - 400ms of delight at exactly the
   point the visitor has already converted, so it costs nothing in friction.

6. **Motion with intent.** Four entrances exist, all whole-popup transforms.
   Staggering children (headline → sub → form → CTA at 40ms intervals) reads as
   considered in a way a single scale-in does not. One `transition-delay`
   calculation per child; no new dependencies.

**Guardrail:** every one of these must degrade. `prefers-reduced-motion` is
already handled in `dnaCss.ts` - keep that discipline for weight (fonts), for
`color-mix` support, and for `backdrop-filter`.

---

## 3. Targeting and triggers - the unglamorous half

Conversion rate is mostly *who sees it and when*, and this is where Asmos is
thinnest. Current triggers: `time_delay`, `exit_intent`, `scroll_depth`.

Worth adding, roughly in value order:

- **Cart-aware triggers.** "Cart over $X" and "cart has items but no checkout
  after 60s" are the highest-intent moments on any store. Needs a small
  `window.__asmos_cart` contract in the install snippet.
- **New vs. returning.** `asmos_visitor_id` already exists in localStorage and is
  never used for targeting. A returning visitor who didn't convert should not see
  the same offer again - they should see a different one.
- **Traffic source.** UTMs are already collected in `behavioralContext()` and go
  nowhere near targeting. Paid traffic deserves a harder offer than organic.
- **Mobile exit intent.** `widget.js` binds `mouseleave`, which never fires on a
  phone - so on the device that converts *better*, exit-intent campaigns simply
  never fire. `asmos-widget.js` has a timeout fallback; `widget.js` does not.
  The proper mobile equivalents are scroll-up velocity and back-button intent.
- **Frequency capping.** `SUPPRESS_DAYS = 14` is a hardcoded constant in
  `runtime.ts` and `asmos_shown_<campaign>` is session-scoped. Merchants need
  this per-campaign, and "dismissed" should suppress for longer than "converted".

---

## 4. Mobile is a different product

Mobile converts better and is the more fragile surface. Three rules:

1. **Bottom sheet, not centered modal.** Thumb reach. `asmos-widget.js`'s legacy
   card already does this (`align-items:flex-end` under 640px) - the template
   engine does not.
2. **Under 30% of viewport, after engagement.** Google penalizes interstitials
   that cover main content before the user engages. `fullscreen-takeover` on
   mobile is a ranking risk for the merchant, which makes it a churn risk for you.
   Either force a sheet layout under 640px or refuse to serve that template to
   mobile at all.
3. **42–72px close target**, and never open the keyboard on entry - the current
   `focusTarget.focus()` in `openPopup()` does exactly that on mobile, which
   shoves the popup up behind the keyboard the instant it appears.

---

## 5. Trust, because 60%+ of the drop-off is here

Cheap, high-return, mostly already modeled in the DNA and just under-used:

- `privacy_note` - "No spam. Unsubscribe in one click." Default it on, not null.
- `social_proof` - real numbers only. The DNA comment already says this; enforce
  it in generation rather than trusting the model.
- Show the reward *before* asking for the email. "15% off" as the headline beats
  "Join our newsletter" every time.
- Make the opt-out an honest button. `dismiss_text` currently defaults to null,
  so the only exit is a small ×. Confidence-inducing dismissals raise trust and
  cost less than they appear to.
- **Auto-apply the code.** A "Shop now" that lands on the store with the discount
  already in the cart converts far better than a code the visitor must remember.
  `reveal_cta` currently just closes the popup.

---

## 6. Suggested sequence

**Now - unblocks everything else**
1. ~~Fix `resolveFlow` blank-popup bug~~ (done - see `runtime.ts` and
   `scripts/repair-blank-popups.ts`).
2. Mobile bottom-sheet layout for all three templates; stop `fullscreen-takeover`
   from serving full-bleed on phones.
3. Don't autofocus the email field on mobile.

**Next - the conversion multiplier**
4. `spin-wheel` and `scratch-card` templates in the template engine, wired to
   `RewardRule` weights so the wheel's odds are the real odds.
5. Zero-party question step: add `question_step` to the DNA and a `segment` field
   to `Lead`.

**Then - the "whoa"**
6. ~~`art_direction`, `type_pairing`, `elevation`, `surface_treatment` DNA knobs~~
   (done - `popupDna.ts`, `templates/fonts.ts`, `templates/dnaCss.ts`,
   `designBrief.ts`). Five schools, dealt across variants in explore mode and
   perturbable as a single axis in exploit mode.
7. Product imagery via `products.json` + luminance-key cutout - see §1.5. This
   is the one part of `art_direction: product` that is still stock photography.
8. Reveal-moment animation.

**Ongoing**
9. Cart-value and new-vs-returning targeting.
10. Per-campaign frequency capping; separate dismissed vs. converted suppression.
11. Real deadlines behind `timer_mode: countdown`, or drop it.

Everything in 6–8 should land as DNA knobs rather than hardcoded template
changes - that is what makes them A/B-testable by the existing bandit instead of
a one-way design decision.

---

## Sources

- [50+ Popup Statistics: What Converts, What It's Worth - Crazy Egg](https://www.crazyegg.com/blog/popup-statistics/)
- [Shopify Popup Conversion Benchmarks 2026](https://easyappsecom.com/guides/shopify-popup-conversion-benchmarks)
- [Email Capture Rate Benchmarks by Industry (2026)](https://easyappsecom.com/guides/email-capture-rate-benchmarks)
- [Average Popup Conversion Rate: 3% (2026 Benchmarks)](https://www.acceleroi.com/blog/average-popup-conversion-rate)
- [How to Increase Email Popup Conversion Rates: 2026 Benchmarks & Tactics](https://www.aliapopups.com/blog/how-to-increase-email-popup-conversion-rates-benchmarks-tactics)
- [The Exit-Intent Popup Playbook: When They Convert & When They Hurt UX - Crazy Egg](https://www.crazyegg.com/blog/exit-popup/)
- [Exit Intent Popup: The Complete 2026 Conversion Guide - Hello Bar](https://www.hellobar.com/blog/exit-intent-popup-guide/)
- [9 Proven Popup Best Practices for 2026 Conversions - Hello Bar](https://www.hellobar.com/blog/popup-best-practices-strategies-2026/)
- [Popup Design Best Practices: UI, UX & Psychology - Super Popups](https://www.superpopups.com/blog/popup-design-best-practices-ui-ux-psychology-for-higher-conversions)
- [SEO Popup Impact: Google's 2026 Rules - Popupsmart](https://popupsmart.com/blog/seo-popup)
- [How to Create SEO-Friendly Pop-Ups in 2026 - Wisepops](https://wisepops.com/blog/SEO-friendly-popups)
- [Interstitials and dialogs: How to fix intrusive pop-ups - Search Engine Land](https://searchengineland.com/guide/interstitials-and-dialogs)
