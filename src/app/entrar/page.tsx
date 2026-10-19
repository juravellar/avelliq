import {
  Building2,
  CalendarCheck,
  ChartColumn,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SupportWidget } from "@/components/support/support-widget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isEmailConfigured } from "@/lib/email";

import { auth } from "../../lib/auth";
import LoginForm from "./components/login-form";
import SignUpForm from "./components/sign-up-form";

export const metadata: Metadata = { title: "Entrar | Avelliq" };

const BENEFITS = [
  {
    icon: CalendarCheck,
    text: "Horários livres calculados na hora, sem agendamento em cima de outro.",
  },
  {
    icon: Building2,
    text: "Médicos, pacientes e várias clínicas no mesmo lugar.",
  },
  {
    icon: ChartColumn,
    text: "Faturamento e atendimentos do período num só painel.",
  },
  {
    icon: ShieldCheck,
    text: "Dados guardados no Brasil, com controles da LGPD.",
  },
];

const AuthenticationPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/painel");
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <aside className="bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Image src="/logo-symbol.svg" alt="" width={32} height={32} />
          Avelliq
        </div>
        <div className="relative max-w-md space-y-8">
          <h1 className="text-3xl leading-tight font-semibold">
            A agenda da sua clínica, organizada do jeito certo.
          </h1>
          <ul className="space-y-4 text-sm text-white/90">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/70">
          Comece grátis por 3 meses no plano Free. Sem cartão de crédito.
        </p>
      </aside>

      <main className="flex flex-col items-center justify-center gap-6 p-4 sm:p-8">
        <div className="flex items-center gap-2 text-lg font-semibold lg:hidden">
          <Image src="/logo-symbol.svg" alt="" width={28} height={28} />
          Avelliq
        </div>
        <Tabs defaultValue="login" className="w-full max-w-[420px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">Criar conta</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm canResetPassword={isEmailConfigured()} />
          </TabsContent>
          <TabsContent value="register">
            <SignUpForm />
          </TabsContent>
        </Tabs>
        <nav className="text-muted-foreground flex gap-4 text-xs">
          <Link href="/termos" className="hover:underline">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="hover:underline">
            Política de Privacidade
          </Link>
        </nav>
      </main>
      <SupportWidget supportEmail={process.env.SUPPORT_EMAIL ?? null} />
    </div>
  );
};

export default AuthenticationPage;
