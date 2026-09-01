import { prisma } from "../prisma";

export async function listTemplates(connectionId: string) {
  return prisma.messageTemplate.findMany({
    where: { connectionId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTemplate(
  connectionId: string, 
  input: { name: string; channel: string; subject?: string; body: string }
) {
  return prisma.messageTemplate.create({
    data: {
      connectionId,
      name: input.name,
      channel: input.channel,
      subject: input.subject || null,
      body: input.body,
    }
  });
}

export async function updateTemplate(
  id: string, 
  input: Partial<{ name: string; subject: string | null; body: string }>
) {
  return prisma.messageTemplate.update({
    where: { id },
    data: {
      name: input.name,
      subject: input.subject,
      body: input.body,
    }
  });
}

export async function deleteTemplate(id: string) {
  await prisma.messageTemplate.delete({
    where: { id }
  });
}
