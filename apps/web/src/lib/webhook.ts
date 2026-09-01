// ── Event type union ────────────────────────────────────────────────────────

export type WebhookEvent =
  | { event: "lead.captured"; payload: LeadCapturedPayload }
  | { event: "variant.winner_declared"; payload: VariantWinnerPayload }
  | { event: "campaign.activated"; payload: CampaignLifecyclePayload }
  | { event: "campaign.paused"; payload: CampaignLifecyclePayload };

// ── Payload shapes ──────────────────────────────────────────────────────────

export type LeadCapturedPayload = {
  campaign_id: string;
  campaign_name: string;
  variant_id: string;
  variant_name: string;
  lead: {
    email: string | null;
    name: string | null;
    phone: string | null;
    consent_given: boolean;
    captured_at: string; // ISO 8601
  };
  reward: {
    label: string;
    type: string;
    coupon_code: string | null;
  } | null;
  /** Present only on connection-test requests. */
  test?: boolean;
};

export type VariantWinnerPayload = {
  campaign_id: string;
  campaign_name: string;
  winning_variant_id: string;
  winning_variant_name: string;
  declared_at: string; // ISO 8601
};

export type CampaignLifecyclePayload = {
  campaign_id: string;
  campaign_name: string;
  changed_at: string; // ISO 8601
};
