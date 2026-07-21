import { Button } from "@/components/ui/Button";

export default function OnboardingWelcomePage() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
        Welcome to asmos
      </h1>
      <p className="text-sm text-[color:var(--color-text-secondary)]">
        Next, we&apos;ll connect your website, verify the install, and set up
        your business profile and consent settings — takes about 5 minutes.
      </p>
      <Button href="/onboarding/connect-website" className="mt-2">
        Get Started
      </Button>
    </div>
  );
}
