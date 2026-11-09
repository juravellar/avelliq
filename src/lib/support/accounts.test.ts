import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { searchPattern } from "./accounts";

describe("searchPattern", () => {
  it("matches anywhere and takes wildcards literally", () => {
    expect(searchPattern("  maria ")).toBe("%maria%");
    expect(searchPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
