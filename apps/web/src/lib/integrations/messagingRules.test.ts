import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseRules, matchRules, renderRule, executeRule } from "./messagingRules";
import type { IntegrationEvent, IntegrationAdapter, ResolvedConnection } from "./types";
import { prisma } from "../prisma";

vi.mock("../prisma", () => ({
  prisma: {
    messageTemplate: {
      findUnique: vi.fn(),
    },
  },
}));

describe("messagingRules", () => {
  describe("parseRules", () => {
    it("parses valid JSON", () => {
      const input = [
        { event: "lead.captured", delayMinutes: 0, templateId: "t1" },
        { event: "variant.winner_declared", delayMinutes: 5, templateId: "t2" }
      ];
      expect(parseRules(input)).toEqual(input);
    });

    it("returns empty array for invalid input", () => {
      expect(parseRules(null)).toEqual([]);
      expect(parseRules("string")).toEqual([]);
      expect(parseRules({})).toEqual([]);
      expect(parseRules([{ event: "test" }])).toEqual([]); // missing fields
    });
  });

  describe("matchRules", () => {
    it("filters by event name", () => {
      const rules = [
        { event: "lead.captured", delayMinutes: 0, templateId: "t1" },
        { event: "other.event", delayMinutes: 0, templateId: "t2" },
      ];
      const ev = { event: "lead.captured" } as IntegrationEvent;
      expect(matchRules(rules, ev)).toEqual([rules[0]]);
    });
  });

  describe("renderRule", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("loads template, substitutes vars", async () => {
      vi.mocked(prisma.messageTemplate.findUnique).mockResolvedValueOnce({
        id: "t1",
        connectionId: "c1",
        name: "Welcome",
        channel: "email",
        subject: "Hi {{lead.name}}",
        body: "Your code is {{reward.coupon_code}}",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const ev = {
        event: "lead.captured",
        payload: {
          lead: { name: "Jane" },
          reward: { coupon_code: "123" }
        }
      } as any;

      const res = await renderRule({ event: "lead.captured", delayMinutes: 0, templateId: "t1" }, ev);
      expect(res.channel).toBe("email");
      expect(res.subject).toBe("Hi Jane");
      expect(res.body).toBe("Your code is 123");
    });
  });

  describe("executeRule", () => {
    it("calls adapter with rendered content", async () => {
      vi.mocked(prisma.messageTemplate.findUnique).mockResolvedValueOnce({
        id: "t1",
        channel: "email",
        subject: "Subject",
        body: "Body",
      } as any);

      const adapter: IntegrationAdapter = {
        provider: "mailgun",
        kind: "messaging",
        validate: vi.fn(),
        deliver: vi.fn().mockResolvedValue({ status: "success" })
      };

      const ev = {
        event: "lead.captured",
        payload: { lead: { email: "j@example.com" } }
      } as any;

      const res = await executeRule(
        { event: "lead.captured", delayMinutes: 0, templateId: "t1" },
        ev,
        {} as ResolvedConnection,
        adapter
      );

      expect(res.status).toBe("success");
      expect(adapter.deliver).toHaveBeenCalledWith(expect.objectContaining({
        renderedContent: {
          to: "j@example.com",
          subject: "Subject",
          body: "Body"
        }
      }));
    });
  });
});
