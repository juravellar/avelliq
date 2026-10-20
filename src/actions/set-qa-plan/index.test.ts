import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  update: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/db", () => ({
  db: {
    update: () => ({
      set: (values: unknown) => ({
        where: async () => mocks.update(values),
      }),
    }),
  },
}));

import { setQaPlan } from ".";

const qa = {
  id: "qa",
  email: "qa@avelliq.com",
  emailVerified: true,
  staffRole: "qa",
};

describe("setQaPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: qa });
  });

  it("lets QA pick a plan to test with, and go back to its own", async () => {
    expect((await setQaPlan({ plan: "essential" }))?.data).toEqual({
      plan: "essential",
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ qaPlan: "essential" }),
    );
    await setQaPlan({ plan: null });
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ qaPlan: null }),
    );
  });

  it("refuses everyone else, including the rest of the team", async () => {
    for (const staffRole of [null, "support", "admin"]) {
      mocks.getSession.mockResolvedValue({ user: { ...qa, staffRole } });
      expect((await setQaPlan({ plan: "professional" }))?.serverError).toMatch(
        /Só contas QA/,
      );
    }
    mocks.getSession.mockResolvedValue({
      user: { ...qa, emailVerified: false },
    });
    expect((await setQaPlan({ plan: "professional" }))?.serverError).toMatch(
      /Só contas QA/,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("only takes the plans that exist", async () => {
    const result = await setQaPlan({ plan: "enterprise" as "free" });
    expect(result?.validationErrors).toBeDefined();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
