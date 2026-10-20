"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { inClinicTimezone } from "@/helpers/time";
import { accountStatus } from "@/lib/account-status";
import { customerPortalUrl } from "@/lib/stripe-mode";
import { cn } from "@/lib/utils";

import { useSessionUser } from "./session-provider";

function Banner({
  tone,
  children,
}: {
  tone: "warning" | "info";
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "border-b px-4 py-2 text-sm",
        tone === "warning"
          ? "border-warning-border bg-warning-muted text-warning-foreground"
          : "border-info-border bg-info-muted text-info-foreground",
      )}
    >
      {children}
    </div>
  );
}

const linkClass = "font-medium underline";

export function AccountStatusBanner() {
  const user = useSessionUser();
  const status = accountStatus(user);
  if (!status) {
    return null;
  }

  switch (status.kind) {
    case "payment-failed":
      return (
        <Banner tone="warning">
          Não conseguimos cobrar sua assinatura do plano {status.planName}.
          Atualize a forma de pagamento para não perder o acesso.{" "}
          <a
            href={customerPortalUrl(user.stripeMode, user.email)}
            className={linkClass}
          >
            Atualizar pagamento
          </a>
        </Banner>
      );
    case "clinic-read-only":
      return (
        <Banner tone="warning">
          Esta clínica está só leitura porque seu plano permite{" "}
          {status.clinicLimit}{" "}
          {status.clinicLimit === 1 ? "clínica" : "clínicas"}. Você pode ver os
          dados, mas não cadastrar nem editar.{" "}
          <Link href="/clinicas" className={linkClass}>
            Minhas clínicas
          </Link>
        </Banner>
      );
    case "choose-clinics":
      return (
        <Banner tone="warning">
          Você tem {status.clinicCount} clínicas e seu plano permite{" "}
          {status.clinicLimit}. Escolha quais continuam ativas.{" "}
          <Link href="/clinicas" className={linkClass}>
            Escolher clínicas
          </Link>
        </Banner>
      );
    case "subscription-ending":
      return (
        <Banner tone="info">
          Sua assinatura do plano {status.planName} foi cancelada e termina em{" "}
          {inClinicTimezone(status.endsAt).format("DD/MM/YYYY")}. Depois disso,
          a conta volta para o Free.{" "}
          <a
            href={customerPortalUrl(user.stripeMode, user.email)}
            className={linkClass}
          >
            Reativar assinatura
          </a>
        </Banner>
      );
    case "free-period-over":
      return (
        <Banner tone="warning">
          Seu período gratuito terminou. Você continua vendo seus dados, mas
          para cadastrar e editar é preciso{" "}
          <Link href="/assinatura" className={linkClass}>
            assinar um plano
          </Link>
          .
        </Banner>
      );
    case "free-period-ending":
      return (
        <Banner tone="info">
          {status.daysLeft === 0
            ? "Seu período gratuito termina hoje."
            : `Seu período gratuito termina em ${status.daysLeft} ${status.daysLeft === 1 ? "dia" : "dias"}.`}{" "}
          <Link href="/assinatura" className={linkClass}>
            Ver planos
          </Link>
        </Banner>
      );
  }
}
