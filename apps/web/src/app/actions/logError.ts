"use server";

import { prisma } from "@/lib/prisma";

export async function logSystemError(message: string, errorDetails?: unknown) {
  try {
    let details = "";
    if (errorDetails) {
      if (typeof errorDetails === "string") {
        details = errorDetails;
      } else if (errorDetails instanceof Error) {
        details = JSON.stringify({ name: errorDetails.name, message: errorDetails.message, stack: errorDetails.stack, digest: (errorDetails as any).digest }, null, 2);
      } else {
        details = JSON.stringify(errorDetails, null, 2);
      }
    }

    await prisma.systemLog.create({
      data: {
        level: "ERROR",
        message,
        details,
      }
    });
  } catch (e) {
    console.error("Failed to log system error:", e);
  }
}
