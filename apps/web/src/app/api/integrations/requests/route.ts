import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

const MAX_LEN = 1000;

// POST /api/integrations/requests — a merchant asks for an integration Asmos
// doesn't offer yet. Stored for superadmins to review on their tab.
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) {
    return Response.json({ error: "Please describe the integration you'd like." }, { status: 400 });
  }
  if (text.length > MAX_LEN) {
    return Response.json({ error: `Please keep it under ${MAX_LEN} characters.` }, { status: 400 });
  }

  const account = await getOrCreateAccount();

  await prisma.integrationRequest.create({
    data: { accountId: account.id, text },
  });

  return Response.json({ ok: true });
}
