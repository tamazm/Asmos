/**
 * /onboarding/conversion-goal is no longer a required onboarding step.
 * Conversion goal is now collected in business-profile.
 * This redirect handles any bookmarked or back-navigated links.
 */
import { redirect } from "next/navigation";

export default function ConversionGoalRedirect() {
  redirect("/onboarding/business-profile");
}
