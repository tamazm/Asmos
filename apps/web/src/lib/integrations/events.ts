export type AutomationEventName =
  | "lead.captured"
  | "variant.winner_declared"
  | "campaign.activated"
  | "campaign.paused";

export const AUTOMATION_EVENT_OPTIONS: ReadonlyArray<{
  id: AutomationEventName;
  label: string;
  description: string;
}> = [
  {
    id: "lead.captured",
    label: "Lead captured",
    description: "A shopper submits your popup form.",
  },
  {
    id: "variant.winner_declared",
    label: "Winner declared",
    description: "Asmos selects the best-performing variant.",
  },
  {
    id: "campaign.activated",
    label: "Campaign went live",
    description: "A campaign is published or reactivated.",
  },
  {
    id: "campaign.paused",
    label: "Campaign paused",
    description: "A live campaign is paused.",
  },
];

export const AUTOMATION_EVENT_IDS = AUTOMATION_EVENT_OPTIONS.map((event) => event.id);

export const LEAD_EVENT_OPTIONS = [AUTOMATION_EVENT_OPTIONS[0]] as const;

export function eventLabel(event: string): string {
  return AUTOMATION_EVENT_OPTIONS.find((option) => option.id === event)?.label ?? event;
}
