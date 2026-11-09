import { z } from "zod";

import { SUPPORT_STATUSES } from "@/lib/support/tickets-helpers";

// Kept out of the "use server" module: Next.js rejects any non-async
// function there, the refine callback included.
export const updateSupportTicketSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(SUPPORT_STATUSES),
  message: z
    .string()
    .trim()
    .max(10_000, { message: "Use até 10.000 caracteres." })
    // Empty is a status-only update; otherwise the same 2-character
    // minimum as the customer's message.
    .refine((value) => value.length !== 1, {
      message: "Escreva a mensagem.",
    }),
});
