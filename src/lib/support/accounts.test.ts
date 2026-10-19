import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { pageNumber, searchPattern } from "./accounts";

describe("searchPattern", () => {
  it("matches anywhere and takes wildcards literally", () => {
    expect(searchPattern("  maria ")).toBe("%maria%");
    expect(searchPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("pageNumber", () => {
  it("falls back to the first page", () => {
    expect(pageNumber(undefined)).toBe(1);
    expect(pageNumber("0")).toBe(1);
    expect(pageNumber("abc")).toBe(1);
    expect(pageNumber("2.5")).toBe(1);
    expect(pageNumber("3")).toBe(3);
  });
});
