import {
  Building2,
  CalendarDays,
  type LucideIcon,
  Stethoscope,
  UsersRound,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PlanUsage, Usage } from "@/lib/plan-usage-types";
import { isAtLimit } from "@/lib/plan-usage-types";
import { cn } from "@/lib/utils";

interface Metric {
  key: keyof PlanUsage;
  label: string;
  icon: LucideIcon;
  note?: string;
}

const METRICS: Metric[] = [
  { key: "clinics", label: "Clínicas", icon: Building2 },
  { key: "doctors", label: "Médicos nesta clínica", icon: Stethoscope },
  { key: "patients", label: "Pacientes nesta clínica", icon: UsersRound },
  {
    key: "appointmentsPerMonth",
    label: "Agendamentos este mês",
    icon: CalendarDays,
    note: "A contagem recomeça no dia 1º.",
  },
];

const statusText = ({ used, limit }: Usage, planName: string) => {
  if (limit === null) {
    return `Sem limite no plano ${planName}`;
  }
  const remaining = limit - used;
  if (remaining <= 0) {
    return "Limite atingido";
  }
  return remaining === 1 ? "Resta 1" : `Restam ${remaining}`;
};

function UsageTile({
  metric,
  usage,
  planName,
}: {
  metric: Metric;
  usage: Usage;
  planName: string;
}) {
  const atLimit = isAtLimit(usage);
  const Icon = metric.icon;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4",
        atLimit ? "border-warning-border bg-warning-muted" : "bg-muted/40",
      )}
    >
      <div className="text-foreground/80 flex items-center gap-2 text-sm font-medium">
        <Icon className="text-muted-foreground h-4 w-4" aria-hidden />
        {metric.label}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-foreground text-3xl font-semibold">
          {usage.used}
        </span>
        {usage.limit !== null && (
          <span className="text-muted-foreground text-base">
            de {usage.limit}
          </span>
        )}
      </div>

      {usage.limit !== null && (
        <Progress
          value={Math.min(100, (usage.used / usage.limit) * 100)}
          aria-label={`${metric.label}: ${usage.used} de ${usage.limit}`}
          className={cn(
            atLimit && "[&>[data-slot=progress-indicator]]:bg-warning",
          )}
        />
      )}

      <div className="space-y-0.5">
        <p
          className={cn(
            "text-sm",
            atLimit
              ? "text-warning-foreground font-medium"
              : "text-muted-foreground",
          )}
        >
          {statusText(usage, planName)}
        </p>
        {metric.note && (
          <p className="text-muted-foreground text-xs">{metric.note}</p>
        )}
      </div>
    </div>
  );
}

export function PlanUsageCard({
  planName,
  usage,
}: {
  planName: string;
  usage: PlanUsage;
}) {
  const anyAtLimit = METRICS.some(({ key }) => isAtLimit(usage[key]));
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Seu uso no plano {planName}</CardTitle>
        <p className="text-muted-foreground text-sm">
          Cadastros da sua clínica e o que o seu plano permite.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-4">
          {METRICS.map((metric) => (
            <UsageTile
              key={metric.key}
              metric={metric}
              usage={usage[metric.key]}
              planName={planName}
            />
          ))}
        </div>
        {anyAtLimit && (
          <p className="text-warning-foreground text-sm">
            Você atingiu um limite do seu plano. Para continuar cadastrando,
            escolha um plano maior abaixo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
