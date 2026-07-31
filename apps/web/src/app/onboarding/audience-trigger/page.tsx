/**
 * /onboarding/audience-trigger is no longer a required onboarding step.
 * Audience and trigger settings are configured in the campaign builder.
 */
import { redirect } from "next/navigation";

export default function AudienceTriggerRedirect() {
  redirect("/onboarding/consent");
}
