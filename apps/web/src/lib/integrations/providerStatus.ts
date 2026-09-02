import type { IntegrationStatus } from "@/components/integrations/IntegrationCard";

export interface ProviderStatusResult {
  status: IntegrationStatus;
  activeEventsCount: number;
  lastDelivery: { status: string; at: string } | null;
  conn: any;
}

export function computeProviderStatus({
  meta,
  syncConns,
  webhookConns,
  messagingViews,
  customWebhookView,
}: {
  meta: any;
  syncConns: any[] | null;
  webhookConns: any[] | null;
  messagingViews: any[];
  customWebhookView: {
    webhookUrl: string | null;
    webhookSecret: string | null;
    webhookEnabled: boolean;
    subscribedEvents?: string[];
  } | null;
}): ProviderStatusResult {
  if (meta.type === "sync") {
    const conn = syncConns?.find((c) => c.provider === meta.id);
    const hasSecret = Boolean(conn?.maskedKey);
    const isReconnect = meta.authMode === "oauth" && conn?.authType === "apiKey";
    const missingRequiredConfig = Boolean(
      hasSecret &&
        meta.configFields &&
        meta.configFields.some((f: { key: string }) => !conn?.config?.[f.key]?.trim())
    );
    const hasSomeConfig = Boolean(
      !hasSecret &&
        conn?.config &&
        Object.values(conn.config).some(
          (v) => typeof v === "string" && v.trim().length > 0
        )
    );

    let status: IntegrationStatus = "disconnected";
    if (isReconnect) {
      status = "reconnect";
    } else if (missingRequiredConfig || hasSomeConfig) {
      status = "key_required";
    } else if (hasSecret) {
      status = "connected";
    }

    return {
      status,
      activeEventsCount: conn?.subscribedEvents?.length || (status === "connected" ? 1 : 0),
      lastDelivery: conn?.lastDelivery || null,
      conn: conn || null,
    };
  }

  if (meta.type === "webhook") {
    const conn = webhookConns?.find((c) => c.provider === meta.id);
    const hasUrl = Boolean(conn?.url);
    const hasSecretOnly = Boolean(!hasUrl && conn?.maskedSecret);
    const status: IntegrationStatus = hasUrl
      ? "connected"
      : hasSecretOnly
      ? "key_required"
      : "disconnected";
    return {
      status,
      activeEventsCount: conn?.subscribedEvents?.length || 0,
      lastDelivery: conn?.lastDelivery || null,
      conn: conn || null,
    };
  }

  if (meta.type === "custom-webhook") {
    const hasUrl = Boolean(customWebhookView?.webhookUrl);
    const isEnabled = Boolean(customWebhookView?.webhookEnabled);
    const hasSecret = Boolean(customWebhookView?.webhookSecret);
    const isConnected = Boolean(hasUrl && isEnabled);
    const isKeyRequired = Boolean((hasUrl && !isEnabled) || (!hasUrl && hasSecret));
    const status: IntegrationStatus = isConnected
      ? "connected"
      : isKeyRequired
      ? "key_required"
      : "disconnected";
    return {
      status,
      activeEventsCount: customWebhookView?.subscribedEvents?.length || 0,
      lastDelivery: null,
      conn: customWebhookView,
    };
  }

  if (meta.type === "messaging") {
    const view = messagingViews?.find((v) => v.provider === meta.id);
    const isConnected = Boolean(view?.connected);
    const isReconnect = Boolean(isConnected && meta.requiresRestrictedKey && view?.authType === "authToken");
    const missingRequiredConfig = Boolean(
      isConnected &&
        meta.configFields
          ?.filter((f: { isSecret?: boolean }) => !f.isSecret)
          .some((f: { key: string }) => !((view?.config as any)?.[f.key]?.trim?.()))
    );
    const hasSomeConfig = Boolean(
      !isConnected &&
        view?.config &&
        Object.values(view.config).some(
          (v) => typeof v === "string" && v.trim().length > 0
        )
    );

    let status: IntegrationStatus = "disconnected";
    if (isReconnect) {
      status = "reconnect";
    } else if (missingRequiredConfig || hasSomeConfig) {
      status = "key_required";
    } else if (isConnected) {
      status = "connected";
    }

    return {
      status,
      activeEventsCount: view?.rules?.length || (status === "connected" ? 1 : 0),
      lastDelivery: null,
      conn: view || null,
    };
  }

  return { status: "disconnected", activeEventsCount: 0, lastDelivery: null, conn: null };
}
