"use server";

import { headers } from "next/headers";

import { UserFacingError } from "@/lib/action-errors";
import { auth } from "@/lib/auth";
import { isEmailConfigured, sendEmail, supportRequestEmail } from "@/lib/email";
import { actionClient } from "@/lib/next-safe-action";
import { resolvePlan } from "@/lib/plans";
import { senderKey, takeSupportSlot } from "@/lib/support/rate-limit";

import { SUPPORT_TOPICS, supportRequestSchema } from "./schema";

const writeTo = () =>
  process.env.SUPPORT_EMAIL
    ? ` Escreva para ${process.env.SUPPORT_EMAIL}.`
    : " Tente de novo mais tarde.";

// The "Falar com a equipe" form: e-mails the support inbox, with "Reply"
// going to the person who wrote.
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

    try {
      await sendEmail({
        to: inbox,
        replyTo: email,
        ...supportRequestEmail({
          topic: SUPPORT_TOPICS[parsedInput.topic],
          message: parsedInput.message,
          name,
          email,
          account: user
            ? {
                userId: user.id,
                plan: resolvePlan(user.plan).name,
                clinic: user.clinic?.name ?? null,
              }
            : undefined,
          page: parsedInput.page ?? null,
        }),
      });
    } catch (error) {
      giveSlotBack();
      console.error("Support request not sent:", (error as Error).message);
      throw new UserFacingError(
        `Não foi possível enviar sua mensagem agora.${writeTo()}`,
      );
    }
    return { sent: true, replyTo: email };
  });
