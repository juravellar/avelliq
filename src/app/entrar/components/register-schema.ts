import { z } from "zod";

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, { message: "Nome de usuário é obrigatório" }),
    email: z
      .string()
      .trim()
      .min(1, { message: "Email é obrigatório" })
      .email({ message: "Email inválido" }),
    // Not trimmed: spaces are part of the password.
    password: z
      .string()
      .min(8, { message: "Senha deve ter no mínimo 8 caracteres" })
      .max(128, { message: "Senha deve ter no máximo 128 caracteres" }),
    // Typed twice: without a working "forgot password" email, a typo here
    // locks the person out of the account they just created.
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({
        message: "Aceite os Termos de Uso e a Política de Privacidade",
      }),
    }),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "As senhas não são iguais",
    path: ["confirmPassword"],
  });

export type RegisterValues = z.infer<typeof registerSchema>;
