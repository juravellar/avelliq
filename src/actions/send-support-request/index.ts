"use server";

import { headers } from "next/headers";

import { UserFacingError } from "@/lib/action-errors";
import { auth } from "@/lib/auth";
import {
  isEmailConfigured,
  sendEmail,
  supportRequestContext,
  supportRequestEmail,
} from "@/lib/email";
import { actionClient } from "@/lib/next-safe-action";
import { resolvePlan } from "@/lib/plans";
import { senderKey, takeSupportSlot } from "@/lib/support/rate-limit";
import {
  acknowledge,
  createFormTicket,
  TICKET_HEADER,
} from "@/lib/support/tickets";

import { SUPPORT_TOPICS, supportRequestSchema } from "./schema";

const writeTo = () =>
  process.env.SUPPORT_EMAIL
    ? ` Escreva para ${process.env.SUPPORT_EMAIL}.`
    : " Tente de novo mais tarde.";

// The "Falar com a equipe" form: opens a ticket, tells the team by e-mail and
// sends the person the protocol.
export const sendSupportRequest = actionClient
  .schema(supportRequestSchema)
  .action(async ({ parsedInput }) => {
    if (parsedInput.leaveBlank) {
      // Looks sent to the bot; nothing goes out.
      return { sent: true };
    }

    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    const user = session?.user;
    const email = user?.email ?? parsedInput.email;
    const name = user?.name ?? parsedInput.name;
    if (!email || !name) {
      throw new UserFacingError(
        "Informe seu nome e e-mail para podermos responder.",
      );
    }

    // SUPPORT_INBOX is private (it may be a personal address); SUPPORT_EMAIL
    // is the public one.
    const inbox = process.env.SUPPORT_INBOX || process.env.SUPPORT_EMAIL;
    if (!isEmailConfigured() || !inbox) {
      throw new UserFacingError(
        `No momento não conseguimos enviar pelo formulário.${writeTo()}`,
      );
    }

    const giveSlotBack = takeSupportSlot(senderKey(user?.id, requestHeaders));
    if (!giveSlotBack) {
      throw new UserFacingError(
        `Você já enviou várias mensagens na última hora. Aguarde um pouco.${writeTo()}`,
      );
    }

    const request = {
      topic: SUPPORT_TOPICS[parsedInput.topic],
      message: parsedInput.message,
      name,
      email,
      account: user
        ? {
            userId: user.id,
            plan: resolvePlan(user.subscribedPlan).name,
            clinic: user.clinic?.name ?? null,
          }
        : undefined,
      page: parsedInput.page ?? null,
    };
    let ticket: Awaited<ReturnType<typeof createFormTicket>>;
    try {
      ticket = await createFormTicket({
        name,
        email,
        subject: `${request.topic}: ${request.message.replace(/\s+/g, " ").slice(0, 80)}`,
        message: request.message,
        context: supportRequestContext(request),
      });
    } catch (error) {
      giveSlotBack();
      console.error("Support ticket not created:", (error as Error).message);
      throw new UserFacingError(
        `Não foi possível enviar sua mensagem agora.${writeTo()}`,
      );
    }

    // The ticket is in the Atendimento already: the team's notice and the
    // customer's copy of the protocol are only logged when they fail.
    await sendEmail({
      to: inbox,
      replyTo: email,
      ...supportRequestEmail(request, ticket.protocol),
      headers: { [TICKET_HEADER]: ticket.protocol },
    }).catch((error) =>
      console.error("Support notice not sent:", (error as Error).message),
    );
    await acknowledge(ticket, []);
    return { sent: true, replyTo: email, protocol: ticket.protocol };
  });
