import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

/** Target conversion rate for the dashboard's Conversion Goal card.
 *  Sending `targetCvr: null` clears the target and returns the card to its
 *  setup state. */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { targetCvr?: number | null; days?: number | null };

  if (body.targetCvr === null) {
    const account = await getOrCreateAccount();
    await prisma.account.update({
      where: { id: account.id },
      data: { targetCvr: null, goalTargetAt: null },
    });
    return Response.json({ targetCvr: null, goalTargetAt: null });
  }

  const targetCvr = Number(body.targetCvr);
  if (!Number.isFinite(targetCvr) || targetCvr <= 0 || targetCvr > 100) {
    return Response.json(
      { error: "Target conversion rate must be between 0 and 100." },
      { status: 400 },
    );
  }

  const days = Number(body.days ?? 30);
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return Response.json({ error: "Target horizon must be 1 to 365 days." }, { status: 400 });
  }

  const account = await getOrCreateAccount();
  const updated = await prisma.account.update({
    where: { id: account.id },
    data: {
      targetCvr,
      goalTargetAt: new Date(Date.now() + days * 86_400_000),
    },
    select: { targetCvr: true, goalTargetAt: true },
  });

  return Response.json(updated);
}
