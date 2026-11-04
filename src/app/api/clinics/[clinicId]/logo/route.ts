import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { clinicsTable } from "@/db/schema";
import { decodeLogo } from "@/lib/branding";
import { getServerSession } from "@/lib/server-session";

// The clinic's logo as an image, for members of that clinic only. The layout
// links to it instead of embedding the data URL, which made every refresh of
// the layout download the logo again.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clinicId: string }> },
) {
  const session = await getServerSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { clinicId } = await params;
  if (!session.user.clinics.some((clinic) => clinic.id === clinicId)) {
    return new Response("Not found", { status: 404 });
  }
  // The version first: a browser that already has the logo gets its 304
  // without the (up to ~150 KB) data URL being read.
  const version = await db.query.clinicsTable.findFirst({
    columns: { logoUpdatedAt: true },
    where: and(
      eq(clinicsTable.id, clinicId),
      isNotNull(clinicsTable.logoDataUrl),
    ),
  });
  if (!version) {
    return new Response("Not found", { status: 404 });
  }
  // Revalidated on every use instead of cached for good, so a former member
  // (or the next person on a shared computer) goes through the membership
  // check above; an unchanged logo costs only a 304.
  const etag = `"${version.logoUpdatedAt?.getTime() ?? 0}"`;
  const headers = {
    "Cache-Control": "private, no-cache",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  const clinic = await db.query.clinicsTable.findFirst({
    columns: { logoDataUrl: true },
    where: eq(clinicsTable.id, clinicId),
  });
  const logo = decodeLogo(clinic?.logoDataUrl);
  if (!logo) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(Buffer.from(logo.base64, "base64"), {
    headers: { ...headers, "Content-Type": logo.contentType },
  });
}
