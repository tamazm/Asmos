import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    testerDiversityRun: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  saveDiversityRun,
  listDiversityRuns,
  deleteDiversityRun,
  clearDiversityRuns,
  type DiversityResult,
} from "./testingActions";

const mockDiversityResult: DiversityResult = {
  n: 50,
  structural: {
    n: 50,
    meanNearestNeighbor: 0.85,
    minNearestNeighbor: 0.62,
    tooClosePairRate: 0.02,
    exactCollisions: 0,
    uniqueRate: 1.0,
  },
  knobs: {
    theme: {
      counts: { light: 25, dark: 25 },
      coverage: 1.0,
      entropy: 1.0,
      topValue: "light",
      topShare: 0.5,
    },
  },
  copy: {
    n: 2,
    exactHeadlineDupes: 0,
    maxHeadlineSimilarity: 0.25,
    subheadRestateRate: 0.0,
    bannedOpenerRate: 0.0,
    generationErrors: 0,
  },
  popups: [
    {
      generatedCode: "<div>Popup 1</div>",
      headline: "Get 20% Off",
      subhead: "Sign up today",
      cta: "Claim Offer",
      primaryColor: "#000000",
      testAxis: "Capture & offer",
    },
  ],
  aiCallsRequested: 1,
  goal: "BOTH",
};

describe("TesterDiversityRun durable history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a diversity run and converts to DTO", async () => {
    const fakeRow = {
      id: "run_123",
      n: 50,
      aiCallsRequested: 1,
      goal: "BOTH",
      uniqueRate: 1.0,
      meanNearestNeighbor: 0.85,
      minNearestNeighbor: 0.62,
      tooClosePairRate: 0.02,
      exactCollisions: 0,
      knobs: mockDiversityResult.knobs,
      copy: mockDiversityResult.copy,
      popups: mockDiversityResult.popups,
      succeeded: true,
      errorMessage: null,
      createdAt: new Date("2026-09-04T22:00:00.000Z"),
    };
    vi.mocked(prisma.testerDiversityRun.create).mockResolvedValue(fakeRow as any);

    const saved = await saveDiversityRun(mockDiversityResult);
    expect(saved.id).toBe("run_123");
    expect(saved.n).toBe(50);
    expect(saved.aiCallsRequested).toBe(1);
    expect(saved.goal).toBe("BOTH");
    expect(saved.uniqueRate).toBe(1.0);
    expect(saved.popups).toHaveLength(1);
    expect(saved.popups[0].headline).toBe("Get 20% Off");
    expect(saved.createdAt).toBe("2026-09-04T22:00:00.000Z");

    expect(prisma.testerDiversityRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        n: 50,
        aiCallsRequested: 1,
        goal: "BOTH",
        uniqueRate: 1.0,
      }),
    });
  });

  it("lists runs paginated with newest first", async () => {
    const fakeRows = [
      {
        id: "run_2",
        n: 20,
        aiCallsRequested: 0,
        goal: "BOTH",
        uniqueRate: 0.95,
        meanNearestNeighbor: 0.8,
        minNearestNeighbor: 0.5,
        tooClosePairRate: 0.05,
        exactCollisions: 1,
        knobs: {},
        copy: null,
        popups: [],
        succeeded: true,
        errorMessage: null,
        createdAt: new Date("2026-09-04T22:05:00.000Z"),
      },
      {
        id: "run_1",
        n: 10,
        aiCallsRequested: 0,
        goal: "EMAIL",
        uniqueRate: 1.0,
        meanNearestNeighbor: 0.9,
        minNearestNeighbor: 0.7,
        tooClosePairRate: 0.0,
        exactCollisions: 0,
        knobs: {},
        copy: null,
        popups: [],
        succeeded: true,
        errorMessage: null,
        createdAt: new Date("2026-09-04T22:00:00.000Z"),
      },
    ];
    vi.mocked(prisma.testerDiversityRun.findMany).mockResolvedValue(fakeRows as any);
    vi.mocked(prisma.testerDiversityRun.count).mockResolvedValue(2);

    const page = await listDiversityRuns({ page: 0, pageSize: 10 });
    expect(page.total).toBe(2);
    expect(page.runs).toHaveLength(2);
    expect(page.runs[0].id).toBe("run_2");
    expect(page.runs[1].id).toBe("run_1");
  });

  it("deletes an individual run", async () => {
    vi.mocked(prisma.testerDiversityRun.delete).mockResolvedValue({ id: "run_123" } as any);
    const delResult = await deleteDiversityRun("run_123");
    expect(delResult.deleted).toBe(true);
    expect(prisma.testerDiversityRun.delete).toHaveBeenCalledWith({ where: { id: "run_123" } });
  });

  it("clears all diversity runs", async () => {
    vi.mocked(prisma.testerDiversityRun.deleteMany).mockResolvedValue({ count: 5 });
    const cleared = await clearDiversityRuns();
    expect(cleared.removed).toBe(5);
    expect(prisma.testerDiversityRun.deleteMany).toHaveBeenCalledWith({});
  });
});
