import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-adapter", () => ({ currentUser: mocks.currentUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
  },
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/lib/superadmin", () => ({ isSuperadminEmail: vi.fn() }));
vi.mock("@/lib/shopify/session-cookie", () => ({ readShopSessionFromCookies: vi.fn() }));

import { getOrCreateAccount } from "./account";

describe("getOrCreateAccount authenticated fast path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves an existing account locally without a second Clerk request", async () => {
    const account = { id: "acc_1", websites: [{ id: "web_1", url: "shop.example" }] };
    mocks.userFindUnique.mockResolvedValue({ account });

    await expect(getOrCreateAccount("user_1")).resolves.toBe(account);

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "user_1" },
      include: { account: { include: { websites: true } } },
    });
    expect(mocks.currentUser).not.toHaveBeenCalled();
  });
});
