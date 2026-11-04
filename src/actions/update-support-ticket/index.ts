"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { supportMessagesTable, supportTicketsTable } from "@/db/schema";
import { inClinicTimezone } from "@/helpers/time";
import { UserFacingError } from "@/lib/action-errors";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { isEmailConfigured, sendEmail, supportReplyEmail } from "@/lib/email";
import { actionClient } from "@/lib/next-safe-action";
import { canAnswerSupport, isSupportOwner } from "@/lib/support/admin";
import { isOwnAddress } from "@/lib/support/inbox-helpers";
import {
  customerTicketUrl,
  getTicket,
  isSupportTicket,
} from "@/lib/support/tickets";
import {
  isFinalStatus,
  protocolOf,
  quoteMessage,
  STATUS_NAMES,
  SUPPORT_STATUSES,
  ticketSubject,
  ticketThreadHeaders,
  updateProblem,
} from "@/lib/support/tickets-helpers";

// The team's update to a ticket: a message to the customer, a new status, or
// both. Recipient, subject and thread come from the stored ticket, not from
// the browser.
export const updateSupportTicket = actionClient
  .schema(
    z.object({
      ticketId: z.string().uuid(),
      status: z.enum(SUPPORT_STATUSES),
      message: z
        .string()
        .trim()
        .max(10_000, { message: "Use até 10.000 caracteres." }),
    }),
  )
  .action(async ({ parsedInput: { ticketId, status, message } }) => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!canAnswerSupport(session?.user)) {
      throw new UserFacingError("Acesso negado.");
    }
    const ticket = await getTicket(ticketId);
    if (
      !ticket ||
      (!isSupportOwner(session?.user) && !isSupportTicket(ticket))
    ) {
      throw new UserFacingError("Atendimento não encontrado.");
    }
    if (message.length === 1) {
      throw new UserFacingError("Escreva a mensagem.");
    }
    const problem = updateProblem({
      current: ticket.status,
      next: status,
      message,
      canEmail: !isOwnAddress(ticket.customerEmail),
    });
    if (problem) {
      throw new UserFacingError(problem);
    }

    const protocol = protocolOf(ticket.number);
    if (message) {
      const supportAddress = process.env.SUPPORT_EMAIL;
      if (!isEmailConfigured() || !supportAddress) {
        throw new UserFacingError(
          "O envio de e-mails do atendimento não está configurado (veja o README).",
        );
      }
      const customerMessages = ticket.messages.filter(
        ({ author }) => author === "customer",
      );
      const last = customerMessages.at(-1);
      await sendEmail({
        from: `Avelliq <${supportAddress}>`,
        to: ticket.customerEmail,
        subject: ticketSubject(protocol, ticket.subject, { reply: true }),
        ...supportReplyEmail({
          answer: message,
          quoted: last?.body
            ? quoteMessage(
                ticket.customerName || ticket.customerEmail,
                inClinicTimezone(last.createdAt).format(
                  "DD/MM/YYYY [às] HH:mm",
                ),
                last.body,
              )
            : "",
          protocol,
          finalStatusName: isFinalStatus(status)
            ? STATUS_NAMES[status].toLowerCase()
            : undefined,
          ticketUrl: await customerTicketUrl(ticket),
        }),
        headers: ticketThreadHeaders(
          customerMessages.map(({ messageId }) => messageId ?? ""),
        ),
      });
    }

    // The message already went out: if storing it fails, the error says so
    // instead of inviting a second send.
    const statusChange = status !== ticket.status ? status : null;
    try {
      await db.transaction(async (tx) => {
        await tx.insert(supportMessagesTable).values({
          ticketId: ticket.id,
          author: "team",
          userId: session!.user.id,
          body: message || null,
          statusChange,
        });
        await tx
          .update(supportTicketsTable)
          .set({
            status,
            ...(message
              ? { awaitingTeam: false, lastMessageAt: new Date() }
              : {}),
          })
          .where(eq(supportTicketsTable.id, ticket.id));
      });
    } catch (error) {
      console.error("Support update not stored:", (error as Error).message);
      throw new UserFacingError(
        message
          ? "A mensagem foi enviada ao cliente, mas não entrou no histórico. Não envie de novo; recarregue a página."
          : "Não foi possível mudar o status. Tente de novo.",
      );
    }

    // Who on the team answered or changed which ticket. The update is
    // already done, so a failure here is only logged.
    const audits = [
      ...(message ? (["support.replied"] as const) : []),
      ...(statusChange ? (["support.status-changed"] as const) : []),
    ];
    for (const action of audits) {
      await recordAudit({
        userId: session!.user.id,
        clinicId: null,
        action,
        entityId: ticket.id,
      }).catch((error) =>
        console.error("Support update not audited:", (error as Error).message),
      );
    }
    return { sentTo: message ? ticket.customerEmail : null, protocol };
  });
