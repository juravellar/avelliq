"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";

import { UserFacingError } from "@/lib/action-errors";
import { auth } from "@/lib/auth";
import { passwordMessage } from "@/lib/password-messages";
import { userActionClient } from "@/lib/user-action";

// Gives an account created with Google a password, so it can also sign in
// with e-mail and password. Better Auth only allows this on the server.
export const setAccountPassword = userActionClient
  .schema(
    z.object({
      newPassword: z
        .string()
        .min(8, { message: "Use pelo menos 8 caracteres." })
        .max(128, { message: "Use até 128 caracteres." }),
    }),
  )
  .action(async ({ parsedInput }) => {
    try {
      await auth.api.setPassword({
        body: { newPassword: parsedInput.newPassword },
        headers: await headers(),
      });
    } catch (error) {
      const message =
        error instanceof APIError ? passwordMessage(error.body?.code) : null;
      if (message) {
        throw new UserFacingError(message);
      }
      throw error;
    }
    return { set: true };
  });
