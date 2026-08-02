import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { NewCampaignForm } from "./NewCampaignForm";

export default async function NewCampaignPage() {
  const account = await getOrCreateAccount();
  const website = await prisma.website.findFirst({
    where: { accountId: account.id },
    orderBy: { createdAt: "asc" },
  });

  return <NewCampaignForm defaultUrl={website?.url ?? ""} />;
}
