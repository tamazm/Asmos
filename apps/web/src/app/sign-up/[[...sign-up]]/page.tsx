import { SignUp } from "@clerk/nextjs";
import { StackedLogo } from "@/components/ui/Logo";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[color:var(--color-surface-sunken)]">
      <StackedLogo />
      <SignUp />
    </div>
  );
}
