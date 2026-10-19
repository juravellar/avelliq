"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";

const schema = z
  .object({
    // Not trimmed: spaces are part of the password.
    password: z
      .string()
      .min(8, { message: "Senha deve ter no mínimo 8 caracteres" })
      .max(128, { message: "Senha deve ter no máximo 128 caracteres" }),
    confirm: z.string(),
  })
  .refine(({ password, confirm }) => password === confirm, {
    message: "As senhas não são iguais",
    path: ["confirm"],
  });

function InvalidLink() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Link inválido ou expirado</CardTitle>
        <CardDescription>
          O link para criar uma nova senha vale por 1 hora e só pode ser usado
          uma vez. Peça um novo.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-col gap-2">
        <Button asChild className="w-full">
          <Link href="/esqueci-senha">Pedir um novo link</Link>
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/entrar">Voltar para o login</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [expired, setExpired] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  if (!token || expired) {
    return <InvalidLink />;
  }

  const onSubmit = async ({ password }: z.infer<typeof schema>) => {
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    if (error) {
      if (error.code === "INVALID_TOKEN") {
        setExpired(true);
        return;
      }
      toast.error("Não foi possível salvar a nova senha. Tente de novo.");
      return;
    }
    // The reset revokes every session, but a signed cookie on this device can
    // still pass for up to 5 minutes and the sign-in page would send the user
    // straight back in. Clear it, even when no one was signed in here.
    await authClient.signOut().catch(() => undefined);
    toast.success("Senha alterada. Entre com a nova senha.");
    router.push("/entrar");
  };

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <CardHeader>
            <CardTitle>Criar nova senha</CardTitle>
            <CardDescription>
              Depois de salvar, os outros aparelhos são desconectados em até 5
              minutos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova senha</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repita a nova senha</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar nova senha"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
