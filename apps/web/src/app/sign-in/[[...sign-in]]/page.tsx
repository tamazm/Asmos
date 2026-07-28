import { SignIn } from "@clerk/nextjs";
import { StackedLogo } from "@/components/ui/Logo";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[color:var(--color-surface-sunken)]">
      <StackedLogo />
      <SignIn />
    </div>
  );
}
