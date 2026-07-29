# Platform Page-by-Page Map

Organized by user journey, in the order a customer would actually move through the product.

---

## 1. Public / Marketing (pre-signup)

**Landing Page** — Explains what the platform does, value prop, social proof, CTA to sign up. First impression, sales tool.

**Pricing Page** — Lists plan tiers (based on traffic volume, features like AI optimization vs basic). Lets prospects self-qualify before talking to sales.

**Features / How It Works Page** — Deeper explanation of popups, tracking, and the AI agent for prospects who need more convincing than the landing page gives.

**Login Page** — Existing customers sign in.

**Signup Page** — New customer creates account. Should capture minimal info upfront (email, password, business name) — don't overload this step.

---

## 2. Onboarding (first-time setup, right after signup)

**Welcome / Onboarding Start Page** — Sets expectations, short intro to what they'll configure next.

**Connect Your Website Page** — Customer enters their site URL, gets the widget install snippet (`<script>` tag) and instructions for adding it to their site (or CMS-specific guides: Shopify, WordPress, custom).

**Install Verification Page** — Checks if the snippet is live on their site (ping/handshake check), shows success or troubleshooting steps if not detected.

**Business Profile Setup Page** — Industry/vertical selection (feeds the cross-customer clustering later), brand colors/logo upload for popup theming defaults.

**Consent/Compliance Setup Page** — Customer configures their region-specific consent requirements (GDPR banner text, etc.) before tracking goes live.

---

## 3. Core Dashboard (main app, post-onboarding)

**Dashboard Home / Overview Page** — At-a-glance summary: active campaigns, recent conversions, key metrics (impressions, emails captured, conversion rate). This is the page they land on every login.

**Campaigns List Page** — Table/grid of all popup campaigns (active, paused, draft), quick stats per campaign, create-new button.

---

## 4. Popup Builder Flow

**Campaign Type Selection Page** — Choose popup type: spin-the-wheel game, scratch card, or plain popup form. Determines which builder flow they enter next.

**Popup Builder Page** — Drag-and-drop editor: design the popup visually, set colors/fonts/logo, arrange elements. Different sub-modes for game-based vs plain popups.

**Game/Wheel Configuration Page** — For game-based popups specifically: set number of wheel segments, prize labels, win probabilities per prize.

**Form Fields Configuration Page** — Choose what data to collect (name, email, phone), set which fields are required, add custom fields if needed.

**Rewards/Gifts Configuration Page** — Define the actual prizes/discounts tied to game outcomes or form submission, link to coupon codes or reward delivery method.

**Targeting & Triggers Page** — Set when/where the popup shows: exit intent, time-on-page delay, specific URL paths, device type, new vs returning visitor.

**Popup Preview Page** — Live preview of the popup as it will appear on the actual site (desktop + mobile views).

**Campaign Review & Publish Page** — Final summary before going live; confirm settings, hit publish.

---

## 5. A/B Testing & Optimization

**Variant Manager Page** — Create/manage multiple variants of a single campaign for testing (design, copy, offer differences).

**A/B Test Setup Page** — Configure test parameters: traffic split (fixed testing) or enable auto-optimization (bandit mode) once that phase is built.

**Test Results / Performance Page** — Shows variant-by-variant performance, statistical confidence, current leader. This is where bandit allocation would visually show which variant is getting more traffic and why, once that's built.

**AI Insights Page** *(later phase, once agent is built)* — Plain-English breakdown from the agent explaining why a variant is winning, and suggested next variants to test.

---

## 6. Analytics

**Campaign Analytics Page** — Deep dive into a single campaign: conversion funnel, impressions → interactions → submissions → gift claims.

**Site-Wide Behavioral Analytics Page** — Broader visitor behavior data beyond just the popup — page-level engagement, drop-off points, navigation flow across their site.

**Leads / Captured Data Page** — Table of all collected name/email/phone entries, exportable, filterable by campaign/date.

**Reports/Export Page** — Generate downloadable reports (CSV/PDF) for a given date range or campaign.

---

## 7. Account & Settings

**Account Settings Page** — Business profile, contact info, password management.

**Team/User Management Page** — Invite teammates, assign roles/permissions (if multi-user accounts are supported).

**Billing & Subscription Page** — Current plan, usage vs plan limits, upgrade/downgrade, invoice history.

**Integrations Page** — Connect third-party tools (email platforms like Mailchimp/Klaviyo, Shopify, Zapier) to push captured leads elsewhere.

**Consent & Privacy Settings Page** — Ongoing management of tracking consent rules, data retention settings, region-specific compliance toggles.

**Website Management Page** — For customers with multiple sites/domains under one account — manage each site's install status and settings separately.

**API/Developer Settings Page** *(later)* — API keys for customers who want programmatic access to their data.

---

## 8. Support / Misc

**Help Center / Docs Page** — Self-serve documentation, install guides, FAQ.

**Notifications Page** — In-app alerts (e.g. "Variant B is now the clear winner," "Install snippet not detected in 7 days").

**404 / Error Pages** — Standard fallback pages.

---

## Build priority note

Pages under sections 1–4 (marketing, onboarding, dashboard, popup builder) are needed for Phase 1 of the roadmap (sellable MVP, no AI). Section 5's basic A/B testing pages align with Phase 3. The "AI Insights Page" and bandit-visualized results belong to Phases 4–6. Sections 6–8 can start simple (basic tables/counts) in Phase 1 and grow in depth as the tracking and AI layers come online.
