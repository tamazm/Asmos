import { Button } from "@/components/ui/Button";

export default function OnboardingWelcomePage() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
        Welcome to asmos
      </h1>
      <p className="text-sm text-[color:var(--color-text-secondary)]">
        Next, we&apos;ll set up your business profile and consent settings —
        takes about a minute. You can connect your website afterward from
        Settings.
      </p>
      <Button href="/onboarding/business-profile" className="mt-2">
        Get Started
      </Button>
    </div>
  );
}
