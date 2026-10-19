"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { inClinicTimezone } from "@/helpers/time";
import { UserFacingError } from "@/lib/action-errors";
import { auth } from "@/lib/auth";
import { isEmailConfigured, sendEmail, supportReplyEmail } from "@/lib/email";
import { actionClient } from "@/lib/next-safe-action";
import { isSupportAdmin } from "@/lib/support/admin";
import { getReceivedEmail, isInboxConfigured } from "@/lib/support/inbox";
import {
  isOwnAddress,
  quotedOriginal,
  replySubject,
  replyTarget,
  threadHeaders,
} from "@/lib/support/inbox-helpers";

// Answers a received e-mail from the support address, in the same thread.
// Recipient, subject and thread come from the stored e-mail, not from the
// browser.
export const replySupportEmail = actionClient
  .schema(
    z.object({
      id: z.string().uuid(),
      message: z
        .string()
        .trim()
        .min(2, { message: "Escreva a resposta." })
        .max(10_000, { message: "Use até 10.000 caracteres." }),
    }),
  )
  .action(async ({ parsedInput }) => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!isSupportAdmin(session?.user)) {
      throw new UserFacingError("Acesso negado.");
    }
    const supportAddress = process.env.SUPPORT_EMAIL;
    if (!isInboxConfigured() || !isEmailConfigured() || !supportAddress) {
      throw new UserFacingError(
        "O atendimento por e-mail não está configurado (veja o README).",
      );
    }

    const original = await getReceivedEmail(parsedInput.id);
    const to = replyTarget(original);
    if (isOwnAddress(to)) {
      throw new UserFacingError(
        "Este e-mail veio de um endereço do próprio Avelliq, então não há para quem responder.",
      );
    }
    const receivedAt = inClinicTimezone(new Date(original.created_at)).format(
      "DD/MM/YYYY [às] HH:mm",
    );
    await sendEmail({
      from: `Avelliq <${supportAddress}>`,
      to,
      subject: replySubject(original.subject),
      ...supportReplyEmail(
        parsedInput.message,
        quotedOriginal(original, receivedAt),
      ),
      headers: threadHeaders(original),
    });
    return { sentTo: to };
  });
