"use server";

import { z } from "zod";

import { UserFacingError } from "@/lib/action-errors";
import { refreshInboxSoon } from "@/lib/support/inbox-refresh";
import {
  addCustomerMessage,
  customerTicket,
  customerTickets,
  markSeenByCustomer,
} from "@/lib/support/tickets";
import { protocolOf } from "@/lib/support/tickets-helpers";
import { userActionClient } from "@/lib/user-action";

// Tickets are found by e-mail. An unconfirmed address could belong to
// someone else, who would then read that person's conversations.
const confirmedEmail = (user: { email: string; emailVerified: boolean }) => {
  if (!user.emailVerified) {
    throw new UserFacingError(
      "Confirme seu e-mail para ver seus atendimentos aqui.",
    );
  }
  return user.email;
};

// "Meus atendimentos" in the help panel.
export const listMyTickets = userActionClient.action(async ({ ctx }) => {
  const email = confirmedEmail(ctx.user);
  // A fallback for an e-mail reply the webhook missed: it is brought in
  // right after, for the next look.
  refreshInboxSoon();
  const tickets = await customerTickets(email);
  return tickets.map((ticket) => ({
    id: ticket.id,
    protocol: protocolOf(ticket.number),
    subject: ticket.subject,
    status: ticket.status,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    unread: Boolean(ticket.unread),
  }));
});

const ticketInput = z.object({ ticketId: z.string().uuid() });

const loadTicket = async (ticketId: string, email: string) => {
  const ticket = await customerTicket(ticketId, email);
  if (!ticket) {
    throw new UserFacingError("Atendimento não encontrado.");
  }
  return {
    ...ticket,
    messages: ticket.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
  };
};

// Opening a ticket also marks the team's answers as seen.
export const getMyTicket = userActionClient
  .schema(ticketInput)
  .action(async ({ ctx, parsedInput }) => {
    const ticket = await loadTicket(
      parsedInput.ticketId,
      confirmedEmail(ctx.user),
    );
    await markSeenByCustomer(ticket.id);
    return ticket;
  });

export const replyMyTicket = userActionClient
  .schema(
    ticketInput.extend({
      message: z
        .string()
        .trim()
        .min(2, { message: "Escreva a mensagem." })
        .max(2000, { message: "Use até 2.000 caracteres." }),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const email = confirmedEmail(ctx.user);
    const result = await addCustomerMessage(
      parsedInput.ticketId,
      email,
      parsedInput.message,
    );
    if (result.error === "not-found") {
      throw new UserFacingError("Atendimento não encontrado.");
    }
    if (result.error === "final") {
      throw new UserFacingError(
        `Este atendimento já foi finalizado. Se não concordar com a resposta, abra um novo atendimento e informe o protocolo ${result.protocol}.`,
      );
    }
    return loadTicket(parsedInput.ticketId, email);
  });
