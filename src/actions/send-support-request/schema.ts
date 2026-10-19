import { z } from "zod";

export const SUPPORT_TOPICS = {
  duvida: "Dúvida",
  problema: "Problema técnico",
  cobranca: "Assinatura e cobrança",
  sugestao: "Sugestão",
  outro: "Outro",
} as const;

export type SupportTopic = keyof typeof SUPPORT_TOPICS;

const TOPIC_IDS = Object.keys(SUPPORT_TOPICS) as [
  SupportTopic,
  ...SupportTopic[],
];

// Shared by the form and the action. Name and e-mail are only asked from
// people who aren't signed in; the session has them otherwise.
export const supportRequestSchema = z.object({
  topic: z.enum(TOPIC_IDS),
  message: z
    .string()
    .trim()
    .min(10, { message: "Conte um pouco mais (pelo menos 10 caracteres)." })
    .max(2000, { message: "Use até 2.000 caracteres." }),
  name: z.string().trim().max(120).optional(),
  email: z
    .union([
      z.string().trim().email({ message: "E-mail inválido." }),
      z.literal(""),
    ])
    .optional(),
  page: z.string().max(200).optional(),
  // Hidden from people; bots that fill every field reveal themselves.
  website: z.string().max(200).optional(),
});

export type SupportRequest = z.infer<typeof supportRequestSchema>;
