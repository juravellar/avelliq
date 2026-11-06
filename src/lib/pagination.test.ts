import { describe, expect, it } from "vitest";

import { pageCount, pageNumber } from "./pagination";

describe("pageNumber", () => {
  it("falls back to the first page", () => {
    expect(pageNumber(undefined)).toBe(1);
    expect(pageNumber("0")).toBe(1);
    expect(pageNumber("abc")).toBe(1);
    expect(pageNumber("2.5")).toBe(1);
    expect(pageNumber("3")).toBe(3);
  });
});

describe("pageCount", () => {
  it("is at least one page", () => {
    expect(pageCount(0, 10)).toBe(1);
    expect(pageCount(11, 10)).toBe(2);
  });
});
