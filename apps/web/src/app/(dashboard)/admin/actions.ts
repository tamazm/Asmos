"use server";

import { currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PlanTier } from ".prisma/client";
import { isSuperadminEmail } from "@/lib/superadmin";

async function verifySuperadmin() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    throw new Error("Unauthorized: Superadmin access required.");
  }
}

// Bug fix: these used to let a thrown error cross the Server Action boundary
// raw. Client callers (AccountsTable) were invoking them as
// `startTransition(() => updateX(...))` — a plain (non-async) callback whose
// return value (the action's promise) was discarded, so any rejection became
// an unhandled promise rejection in the browser. That's what showed up as
// "it got changed but errored out": the write itself often succeeded, but
// the client never awaited the result, so a later hiccup (e.g. a stale
// Server Action reference after a dev-mode rebuild, or a genuine DB error)
// surfaced as an uncaught error instead of a clean message. Returning a
// typed result — and having callers actually await + check it — fixes both
// the noisy false-error case and real failures.
type ActionResult = { success: true } | { success: false; error: string };

export async function updatePlanTier(accountId: string, newTier: PlanTier): Promise<ActionResult> {
  try {
    await verifySuperadmin();

    await prisma.account.update({
      where: { id: accountId },
      data: { planTier: newTier },
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/accounts/${accountId}`);
    return { success: true };
  } catch (err) {
    console.error("[admin] updatePlanTier failed", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update plan tier." };
  }
}

export async function updateAIGenerationsCount(accountId: string, count: number): Promise<ActionResult> {
  try {
    await verifySuperadmin();

    await prisma.account.update({
      where: { id: accountId },
      data: { aiGenerationsCount: Math.max(0, count) },
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/accounts/${accountId}`);
    return { success: true };
  } catch (err) {
    console.error("[admin] updateAIGenerationsCount failed", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update generation count." };
  }
}
