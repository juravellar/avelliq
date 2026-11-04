import { isValidInboundSignature } from "@/lib/support/inbound-signature";
import { getReceivedEmail, isInboxConfigured } from "@/lib/support/inbox";
import { importReceivedEmail } from "@/lib/support/tickets";

// Resend calls this as soon as an e-mail reaches the domain
// (event email.received), so it shows up in the Atendimento and in the
// customer's "Meus atendimentos" right away. The page's own import stays as
// a fallback: an e-mail already stored is skipped, so a delivery repeated
// by Resend changes nothing.
export async function POST(request: Request) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret || !isInboxConfigured()) {
    return new Response("Not configured", { status: 503 });
  }
  const body = await request.text();
  if (
    !isValidInboundSignature({
      secret,
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signatures: request.headers.get("svix-signature"),
      body,
    })
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(body) as {
    type?: string;
    data?: { email_id?: string };
  };
  if (event.type !== "email.received" || !event.data?.email_id) {
    // Other events subscribed by mistake are acknowledged and ignored.
    return Response.json({ ignored: true });
  }
  try {
    await importReceivedEmail(await getReceivedEmail(event.data.email_id));
  } catch (error) {
    // Resend retries a failed delivery; the message holds no personal data.
    console.error("Inbound e-mail not imported:", (error as Error).message);
    return new Response("Import failed", { status: 500 });
  }
  return Response.json({ imported: true });
}
