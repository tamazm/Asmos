/**
 * /onboarding/testing-strategy is no longer a required onboarding step.
 * Testing strategy is configured per-campaign in the campaign editor.
 */
import { redirect } from "next/navigation";

export default function TestingStrategyRedirect() {
  redirect("/onboarding/connect-store");
}
