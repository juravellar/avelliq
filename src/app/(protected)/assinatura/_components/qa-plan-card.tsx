"use client";

import { FlaskConical, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { setQaPlan } from "@/actions/set-qa-plan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionErrorMessage } from "@/lib/action-errors";
import { PAID_PLAN_IDS, type PlanId, PLANS } from "@/lib/plans";

const REAL_PLAN = "real";
const PLAN_IDS: PlanId[] = ["free", ...PAID_PLAN_IDS];

// Only for QA accounts: test the system as a customer on any plan, without
// paying.
export function QaPlanCard({
  simulatedPlan,
  stripeTestReady,
}: {
  simulatedPlan: PlanId | null;
  stripeTestReady: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const action = useAction(setQaPlan, {
    onSuccess: () => setError(null),
    onError: ({ error }) =>
      setError(actionErrorMessage(error, "Não foi possível trocar o plano.")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Simular plano (conta QA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          O sistema passa a funcionar como para um cliente nesse plano: limites,
          bloqueios e avisos. Escolher aqui não cobra nada nem mexe no Stripe.
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={simulatedPlan ?? REAL_PLAN}
            onValueChange={(value) =>
              action.execute({
                plan: value === REAL_PLAN ? null : (value as PlanId),
              })
            }
            disabled={action.isPending}
          >
            <SelectTrigger className="w-56" aria-label="Plano simulado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={REAL_PLAN}>Meu plano de verdade</SelectItem>
              {PLAN_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {PLANS[id].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {action.isPending && (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          )}
        </div>
        <p className="text-muted-foreground">
          {stripeTestReady
            ? "Para testar o pagamento, os botões de assinar abaixo usam o Stripe de teste: use o cartão 4242 4242 4242 4242, com qualquer validade futura e CVC. A assinatura de teste vira o plano simulado, e nada é cobrado."
            : "O Stripe de teste não está configurado neste ambiente, então os botões de assinar não funcionam para contas QA."}
        </p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
