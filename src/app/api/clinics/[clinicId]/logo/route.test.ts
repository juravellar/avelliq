import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.hoisted(() => vi.fn());
const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server-session", () => ({ getServerSession }));
vi.mock("@/db", () => ({
  db: { query: { clinicsTable: { findFirst } } },
}));

import { GET } from "./route";

const request = (clinicId: string, headers?: HeadersInit) =>
  GET(new Request("http://localhost", { headers }), {
    params: Promise.resolve({ clinicId }),
  });

describe("GET /api/clinics/[clinicId]/logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({
      user: { clinics: [{ id: "mine" }] },
    });
    // First the version, then (only if needed) the data URL itself.
    findFirst.mockImplementation(async ({ columns }) =>
      columns.logoDataUrl
        ? { logoDataUrl: "data:image/png;base64,iVBORw0KGgo=" }
        : { logoUpdatedAt: new Date(2_000) },
    );
  });

  it("serves the logo of a clinic the user belongs to, revalidated on each use", async () => {
    const response = await request("mine");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(response.headers.get("ETag")).toBe('"2000"');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array(Buffer.from("iVBORw0KGgo=", "base64")),
    );
  });

  it("hides other clinics' logos without querying them", async () => {
    const response = await request("someone-else");

    expect(response.status).toBe(404);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("asks for a session", async () => {
    getServerSession.mockResolvedValue(null);

    expect((await request("mine")).status).toBe(401);
  });

  it("answers 404 when the clinic has no logo", async () => {
    findFirst.mockResolvedValue(undefined);

    expect((await request("mine")).status).toBe(404);
  });

  it("answers 304 to a browser that already has this logo", async () => {
    const response = await request("mine", { "If-None-Match": '"2000"' });

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].columns).toEqual({ logoUpdatedAt: true });
  });

  it("still checks membership before a 304", async () => {
    const response = await request("someone-else", {
      "If-None-Match": '"2000"',
    });

    expect(response.status).toBe(404);
  });
});
