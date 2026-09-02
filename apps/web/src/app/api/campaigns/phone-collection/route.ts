import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { accountHasPhoneCollectingPopup, addPhoneToAllActivePopups } from "@/lib/phoneCollection";

// GET → whether any live popup collects a phone number (drives the Twilio card
// warning). POST → add phone collection to every live popup ("add phone to my
// live popups" one-click from the Twilio card).

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getOrCreateAccount();
  return Response.json({ anyCollectsPhone: await accountHasPhoneCollectingPopup(account.id) });
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getOrCreateAccount();
  const campaignsChanged = await addPhoneToAllActivePopups(account.id);
  return Response.json({ campaignsChanged, anyCollectsPhone: await accountHasPhoneCollectingPopup(account.id) });
}
