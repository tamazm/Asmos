"use client";

// ── Mandatory onboarding wizard ───────────────────────────────────────────────
// Rendered in place of the dashboard (see page.tsx) until the merchant has
// completed the three logical steps that get Asmos actually running on their
// store. Connecting an Asmos account is the first, non-skippable gate — the app
// no longer works on the auto-provisioned throwaway account without it.
//
// This component is intentionally "dumb": it owns no data-fetching. page.tsx
// already loads shop/linked/campaigns and owns the connect / generate / embed
// actions, so we pass those straight through. That keeps a single source of
// truth for app state and makes each step here a thin presentational unit.

interface Campaign {
  id: string;
  name: string;
  status: "DRAFT" | "GENERATING" | "ACTIVE" | "PAUSED" | "FAILED" | "ARCHIVED";
}

export type StepState = "done" | "active" | "upcoming";

export function OnboardingWizard({
  linked,
  connecting,
  onConnect,
  campaigns,
  hasActiveCampaign,
  creating,
  onCreateStarter,
  onSelectActive,
  embedAcknowledged,
  onOpenThemeEditor,
  onAcknowledgeEmbed,
  onFinish,
}: {
  linked: boolean;
  connecting: boolean;
  onConnect: () => void;
  campaigns: Campaign[];
  hasActiveCampaign: boolean;
  creating: boolean;
  onCreateStarter: () => void;
  onSelectActive: (id: string) => void;
  embedAcknowledged: boolean;
  onOpenThemeEditor: () => void;
  onAcknowledgeEmbed: () => void;
  onFinish: () => void;
}) {
  // Derive which step is live purely from real state, so the wizard always
  // reflects where the merchant actually is — even across the top-frame connect
  // round-trip (they leave at step 1 and return with linked === true).
  const step1: StepState = linked ? "done" : "active";
  const step2: StepState = !linked ? "upcoming" : hasActiveCampaign ? "done" : "active";
  const step3: StepState =
    !linked || !hasActiveCampaign ? "upcoming" : embedAcknowledged ? "done" : "active";

  const allDone = step1 === "done" && step2 === "done" && step3 === "done";
  const completedCount = [step1, step2, step3].filter((s) => s === "done").length;

  return (
    <s-page heading="Welcome to Asmos">
      <s-stack direction="block" gap="large">
        <s-box>
          <s-text tone="subdued">
            A few quick steps and your first popup is live. This takes about two minutes.
          </s-text>
        </s-box>

        {/* Progress meter — concrete "x of 3" so the finish line is always visible. */}
        <ProgressBar completed={completedCount} total={3} />

        <s-stack direction="block" gap="base">
          <StepCard
            index={1}
            state={step1}
            title="Connect your Asmos account"
            description={
              linked
                ? "Your store is linked to your Asmos account."
                : "Asmos keeps your popups, leads, and analytics in one account — on your store and on the web. Sign in, or create an account if you're new."
            }
          >
            {step1 === "active" && (
              <s-stack direction="block" gap="small-300">
                <s-box>
                  <s-button
                    variant="primary"
                    loading={connecting}
                    disabled={connecting}
                    onClick={onConnect}
                  >
                    Connect Asmos account
                  </s-button>
                </s-box>
                <s-text tone="subdued">
                  New to Asmos? You&rsquo;ll create your account in the same step.
                </s-text>
              </s-stack>
            )}
          </StepCard>

          <StepCard
            index={2}
            state={step2}
            title="Create your first popup"
            description={
              hasActiveCampaign
                ? "A popup is live and ready to show on your store."
                : campaigns.length > 0
                  ? "You have popups — choose which one runs on your store."
                  : "Asmos generates a lead-capture popup tailored to your store in about a minute. You can customize it any time."
            }
          >
            {step2 === "active" && (
              <Step2Body
                campaigns={campaigns}
                creating={creating}
                onCreateStarter={onCreateStarter}
                onSelectActive={onSelectActive}
              />
            )}
          </StepCard>

          <StepCard
            index={3}
            state={step3}
            title="Turn Asmos on in your store"
            description={
              embedAcknowledged
                ? "Asmos is switched on in your theme."
                : "One last switch: enable the Asmos embed in your theme so shoppers can see your popup. It opens in your theme editor — toggle Asmos on and hit Save."
            }
          >
            {step3 === "active" && (
              <s-stack direction="block" gap="small-300">
                <s-box>
                  <s-button variant="primary" onClick={onOpenThemeEditor}>
                    Open theme editor
                  </s-button>
                </s-box>
                <s-box>
                  <s-button onClick={onAcknowledgeEmbed}>I&rsquo;ve turned it on</s-button>
                </s-box>
                <s-text tone="subdued">
                  In the editor: open <s-text type="strong">App embeds</s-text>, switch on{" "}
                  <s-text type="strong">Asmos Popups</s-text>, then Save.
                </s-text>
              </s-stack>
            )}
          </StepCard>
        </s-stack>

        {allDone && (
          <s-banner tone="success" heading="You&rsquo;re all set">
            <s-stack direction="block" gap="base">
              <s-text>Your popup is live. Head to your dashboard to manage popups, view leads, and more.</s-text>
              <s-box>
                <s-button variant="primary" onClick={onFinish}>
                  Go to dashboard
                </s-button>
              </s-box>
            </s-stack>
          </s-banner>
        )}
      </s-stack>
    </s-page>
  );
}

// ── Step 2 body: generate a starter, or pick among existing popups ────────────
function Step2Body({
  campaigns,
  creating,
  onCreateStarter,
  onSelectActive,
}: {
  campaigns: Campaign[];
  creating: boolean;
  onCreateStarter: () => void;
  onSelectActive: (id: string) => void;
}) {
  const generating = campaigns.some((c) => c.status === "GENERATING");
  const selectable = campaigns.filter((c) => c.status !== "GENERATING" && c.status !== "FAILED");

  // No popups yet → generate one. Popups exist but none is live → let them pick.
  if (campaigns.length === 0) {
    return (
      <s-box>
        <s-button
          variant="primary"
          loading={creating}
          disabled={creating}
          onClick={onCreateStarter}
        >
          Generate my popup
        </s-button>
      </s-box>
    );
  }

  if (generating && selectable.length === 0) {
    return <s-text tone="subdued">Generating your popup — this takes about a minute…</s-text>;
  }

  return (
    <s-stack direction="block" gap="small-300">
      <s-text tone="subdued">Pick the popup to run on your store:</s-text>
      {selectable.map((c) => (
        <s-box key={c.id} border="base" borderRadius="base" padding="base">
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
            <s-text type="strong">{c.name}</s-text>
            <s-button variant="primary" onClick={() => onSelectActive(c.id)}>
              Use this one
            </s-button>
          </s-stack>
        </s-box>
      ))}
      <s-box>
        <s-button loading={creating} disabled={creating} onClick={onCreateStarter}>
          Or generate a new one
        </s-button>
      </s-box>
    </s-stack>
  );
}

// ── A single step row: numbered/checked marker, title, description, actions ────
function StepCard({
  index,
  state,
  title,
  description,
  children,
}: {
  index: number;
  state: StepState;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <s-box
      border="base"
      borderRadius="base"
      padding="base"
      background={state === "active" ? "subdued" : undefined}
    >
      {/* Explicit flex row (not s-stack) so the marker always stays pinned left
          and the content column fills the rest — s-stack inline lets a long
          description wrap the whole content block below the marker. minWidth:0
          lets the text wrap inside the column instead of overflowing. */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <StepMarker index={index} state={state} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <s-stack direction="block" gap="small-300">
            <s-stack direction="inline" gap="small-300" alignItems="center">
              <s-text type="strong">{title}</s-text>
              {state === "done" && <s-badge tone="success">Done</s-badge>}
            </s-stack>
            <s-text tone="subdued">{description}</s-text>
            {children}
          </s-stack>
        </div>
      </div>
    </s-box>
  );
}

// Numbered circle for pending/active steps; a check for completed ones. Plain
// inline-styled span so it renders instantly with no Polaris icon dependency.
function StepMarker({ index, state }: { index: number; state: StepState }) {
  const done = state === "done";
  const active = state === "active";
  return (
    <span
      aria-hidden
      style={{
        flex: "0 0 auto",
        width: 28,
        height: 28,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
        fontWeight: 700,
        marginTop: 2,
        color: done ? "#fff" : active ? "#fff" : "#6d7175",
        background: done ? "#1a7f37" : active ? "#2a2a35" : "#eceded",
        border: done || active ? "none" : "1px solid #d9d9d9",
      }}
    >
      {done ? "✓" : index}
    </span>
  );
}

// ── Progress meter ─────────────────────────────────────────────────────────────
function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = Math.round((completed / total) * 100);
  return (
    <s-box>
      <s-stack direction="block" gap="small-300">
        <s-text tone="subdued">
          Step {Math.min(completed + 1, total)} of {total}
          {completed === total ? " — complete" : ""}
        </s-text>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ height: 6, borderRadius: 999, background: "#eceded", overflow: "hidden" }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "#1a7f37",
              transition: "width 240ms ease",
            }}
          />
        </div>
      </s-stack>
    </s-box>
  );
}
