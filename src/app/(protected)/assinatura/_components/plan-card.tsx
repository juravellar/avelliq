"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createStripeCheckout } from "@/actions/create-stripe-checkout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { actionErrorMessage } from "@/lib/action-errors";
import {
  type BillingInterval,
  monthlyEquivalent,
  type PlanPrice,
  yearlySavingsPercent,
} from "@/lib/plan-price";
import type { Plan, PlanId } from "@/lib/plans";
import { customerPortalUrl } from "@/lib/stripe-mode";
import { cn } from "@/lib/utils";

import { useSessionUser } from "../../_components/session-provider";

const STRIPE_CHECKOUT_ORIGIN = "https://checkout.stripe.com";

interface PlanCardProps {
  plan: Plan;
  prices: Record<BillingInterval, PlanPrice | null> | null;
  interval: BillingInterval;
  recommended?: boolean;
  currentPlanId: PlanId;
  userEmail: string;
  // State of the current paid subscription, shown on its card.
  subscriptionNotice?: { endsOn: string | null; pastDue: boolean };
  className?: string;
}

export function PlanCard({
  plan,
  prices,
  interval,
  recommended = false,
  currentPlanId,
  userEmail,
  subscriptionNotice,
  className,
}: PlanCardProps) {
  const router = useRouter();
  // QA accounts manage their test subscription in the test portal.
  const { stripeMode } = useSessionUser();
  const createStripeCheckoutAction = useAction(createStripeCheckout, {
    onSuccess: ({ data }) => {
      // Only ever leave the app for Stripe's own checkout page.
      if (!data?.url || new URL(data.url).origin !== STRIPE_CHECKOUT_ORIGIN) {
        toast.error("Não foi possível iniciar o pagamento. Tente novamente.");
        return;
      }
      window.location.assign(data.url);
    },
    onError: ({ error }) => {
      toast.error(
        actionErrorMessage(
          error,
          "Não foi possível iniciar o pagamento. Tente novamente.",
        ),
      );
    },
  });

  // A plan without a yearly price stays monthly even when "Anual" is picked.
  const billedInterval: BillingInterval =
    interval === "yearly" && prices?.yearly ? "yearly" : "monthly";
  const price = prices?.[billedInterval] ?? null;
  const savings = yearlySavingsPercent(
    prices?.monthly ?? null,
    prices?.yearly ?? null,
  );

  const isCurrent = plan.id === currentPlanId;
  const hasPaidPlan = currentPlanId !== "free";

  // Plan changes and cancellations of an existing subscription go through the
  // Stripe customer portal, which handles proration and the end of the period.
  const openCustomerPortal = () => {
    router.push(customerPortalUrl(stripeMode, userEmail));
  };

  const action = (() => {
    if (plan.id === "free") {
      // Already canceled: the account returns to Free on its own.
      return isCurrent || subscriptionNotice?.endsOn
        ? null
        : { label: "Voltar para o Free", onClick: openCustomerPortal };
    }
    if (isCurrent) {
      const label = subscriptionNotice?.pastDue
        ? "Atualizar pagamento"
        : subscriptionNotice?.endsOn
          ? "Reativar assinatura"
          : "Gerenciar assinatura";
      return { label, onClick: openCustomerPortal };
    }
    if (hasPaidPlan) {
      return { label: `Mudar para ${plan.name}`, onClick: openCustomerPortal };
    }
    const paidPlanId = plan.id;
    return {
      label: `Assinar ${plan.name}`,
      onClick: () =>
        createStripeCheckoutAction.execute({
          plan: paidPlanId,
          interval: billedInterval,
        }),
    };
  })();

  return (
    <Card
      className={cn(
        "relative flex flex-col",
        recommended && !isCurrent && "border-primary ring-primary ring-1",
        isCurrent && "border-success ring-success ring-1",
        className,
      )}
    >
      {recommended && !isCurrent && (
        <Badge className="absolute -top-3 left-6 shadow-sm">Recomendado</Badge>
      )}
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-foreground text-2xl font-bold">{plan.name}</h3>
          {isCurrent &&
            (subscriptionNotice?.pastDue || subscriptionNotice?.endsOn ? (
              <Badge className="bg-warning-muted text-warning-foreground hover:bg-warning-muted shrink-0">
                {subscriptionNotice.pastDue
                  ? "Pagamento pendente"
                  : "Cancelada"}
              </Badge>
            ) : (
              <Badge className="bg-success-muted text-success-foreground hover:bg-success-muted shrink-0">
                Atual
              </Badge>
            ))}
        </div>
        {/* Two lines tall on every card, so the prices line up. */}
        <p className="text-muted-foreground @4xl:min-h-12">
          {plan.description}
        </p>
        {isCurrent && subscriptionNotice?.endsOn && (
          <p className="text-warning-foreground text-sm">
            Acesso até {subscriptionNotice.endsOn}. Depois disso, a conta volta
            para o Free.
          </p>
        )}
        {isCurrent && plan.id !== "free" ? (
          // The switch above shows prices to subscribe; this subscription may
          // be billed either way, which only Stripe knows.
          <div className="min-h-16">
            <p className="text-muted-foreground text-sm">
              Valor e forma de pagamento (mensal ou anual) em Gerenciar
              assinatura.
            </p>
          </div>
        ) : plan.id === "free" ? (
          <div className="min-h-16">
            <span className="text-foreground text-3xl font-bold">Grátis</span>
            <p className="text-muted-foreground text-sm">
              Sem cartão de crédito.
            </p>
          </div>
        ) : (
          price && (
            <div className="min-h-16">
              <div className="flex items-baseline">
                <span className="text-foreground text-3xl font-bold">
                  {price.amount}
                </span>
                {price.interval && (
                  <span className="text-muted-foreground ml-1">
                    / {price.interval}
                  </span>
                )}
              </div>
              {billedInterval === "yearly" ? (
                <p className="text-muted-foreground text-sm">
                  equivale a {monthlyEquivalent(price)}/mês
                  {savings ? (
                    <span className="text-success-foreground font-medium">
                      {" "}
                      · economize {savings}%
                    </span>
                  ) : null}
                </p>
              ) : interval === "yearly" ? (
                <p className="text-muted-foreground text-sm">
                  Disponível só no mensal.
                </p>
              ) : null}
            </div>
          )
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="border-border flex-1 space-y-4 border-t pt-6">
          {plan.features.map((feature) => (
            <div key={feature} className="flex items-start">
              <CheckCircle2 className="text-success h-5 w-5 flex-shrink-0" />
              <p className="text-muted-foreground ml-3">{feature}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 min-h-10">
          {plan.id === "free" && !isCurrent && subscriptionNotice?.endsOn && (
            <p className="text-muted-foreground text-center text-sm">
              A conta volta para o Free em {subscriptionNotice.endsOn}.
            </p>
          )}
          {action && (
            <Button
              className="w-full"
              variant={isCurrent ? "outline" : "default"}
              onClick={action.onClick}
              disabled={createStripeCheckoutAction.isExecuting}
            >
              {createStripeCheckoutAction.isExecuting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                action.label
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
