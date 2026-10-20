"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { UserFacingError } from "@/lib/action-errors";
import { canSimulatePlan } from "@/lib/support/admin";
import { userActionClient } from "@/lib/user-action";

// The plan a QA account tests with, without paying. null goes back to its
// real plan. Stripe and the real plan column are never touched.
export const setQaPlan = userActionClient
  .schema(
    z.object({
      plan: z.enum(["free", "essential", "professional"]).nullable(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    if (!canSimulatePlan(ctx.user)) {
      throw new UserFacingError("Só contas QA simulam planos.");
    }
    await db
      .update(usersTable)
      .set({ qaPlan: parsedInput.plan, updatedAt: new Date() })
      .where(eq(usersTable.id, ctx.user.id));
    // Limits, banners and the menu all follow the plan.
    revalidatePath("/", "layout");
    return { plan: parsedInput.plan };
  });
