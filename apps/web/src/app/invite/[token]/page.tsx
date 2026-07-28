import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { AcceptInviteButton } from "./AcceptInviteButton";

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { userId } = await auth();

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { account: { select: { name: true } } },
  });

  const invalid = !invite || invite.status !== "PENDING";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[color:var(--color-surface-sunken)] px-6 text-center">
      <Logo />

      {invalid ? (
        <div className="max-w-sm">
          <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
            Invite not found
          </h1>
          <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
            This invite link is invalid, expired, or has already been used.
          </p>
          <Button href="/" className="mt-4">
            Back to home
          </Button>
        </div>
      ) : (
        <div className="max-w-sm">
          <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
            Join {invite.account.name} on Asmos
          </h1>
          <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
            You&apos;ve been invited as {invite.email} ({invite.role.toLowerCase()}).
          </p>
          <div className="mt-4">
            {userId ? (
              <AcceptInviteButton token={token} />
            ) : (
              <Button href={`/sign-up?redirect_url=${encodeURIComponent(`/invite/${token}`)}`}>
                Sign up to accept
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
