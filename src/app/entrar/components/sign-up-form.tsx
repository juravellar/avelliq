"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ACCEPT_TERMS_HEADER, TERMS_VERSION } from "@/lib/terms";

import { authClient } from "../../../lib/auth-client";
import { registerSchema, type RegisterValues } from "./register-schema";

const SignUpForm = () => {
  const router = useRouter();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false as unknown as true,
    },
  });

  async function onSubmit(values: RegisterValues) {
    await authClient.signUp.email(
      {
        email: values.email,
        password: values.password,
        name: values.username,
        callbackURL: "/painel",
      },
      {
        // The server records the acceptance only with this header.
        headers: { [ACCEPT_TERMS_HEADER]: TERMS_VERSION },
        onSuccess: (ctx) => {
          // Without a session token the account still needs its email
          // confirmed (only when an email provider is configured).
          if (!ctx.data?.token) {
            toast.success(
              "Conta criada! Enviamos um link de confirmação para o seu email.",
            );
            form.reset();
            return;
          }
          router.push("/painel");
        },
        onError: (ctx) => {
          if (ctx.error.code === "USER_ALREADY_EXISTS") {
            toast.error("Email já cadastrado");
            return;
          }
          toast.error("Erro ao criar conta");
        },
      },
    );
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <CardHeader>
            <CardTitle>Criar conta</CardTitle>
            {/* The side panel with this offer is hidden on phones. */}
            <CardDescription>
              Grátis por 3 meses no plano Free, sem cartão de crédito.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome de usuário</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Digite seu nome de usuário"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Digite seu email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete="new-password"
                      placeholder="Mínimo de 8 caracteres"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repita a senha</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete="new-password"
                      placeholder="Digite a senha de novo"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="accent-primary mt-0.5 h-4 w-4 shrink-0"
                        checked={field.value === true}
                        onChange={(event) =>
                          field.onChange(event.target.checked)
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormLabel className="text-sm leading-snug font-normal">
                      <span>
                        Li e aceito os{" "}
                        <Link
                          href="/termos"
                          target="_blank"
                          className="underline"
                        >
                          Termos de Uso
                        </Link>{" "}
                        e a{" "}
                        <Link
                          href="/privacidade"
                          target="_blank"
                          className="underline"
                        >
                          Política de Privacidade
                        </Link>
                        .
                      </span>
                    </FormLabel>
                  </div>
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Criar conta"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default SignUpForm;
