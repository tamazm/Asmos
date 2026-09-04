/**
 * /onboarding/offer-selection is no longer a required onboarding step.
 * Offer details are configured in the popup builder after onboarding.
 */
import { redirect } from "next/navigation";

export default function OfferSelectionRedirect() {
  redirect("/onboarding/consent");
}
