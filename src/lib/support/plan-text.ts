import { FREE_PERIOD_MONTHS } from "@/lib/free-period";
import { type Plan, type PlanId, PLANS } from "@/lib/plans";

// The plans as the help widget describes them, written from PLANS so a
// changed limit shows up in the answers too.

const ORDER: PlanId[] = ["free", "essential", "professional"];

const amount = (value: number | null, one: string, many: string) => {
  if (value === null) return `${many} ilimitados`;
  return value === 1 ? `1 ${one}` : `até ${value} ${many}`;
};

const clinicsOf = (plan: Plan) => {
  const { clinics } = plan.limits;
  if (clinics === null) return "clínicas ilimitadas";
  return clinics === 1 ? "1 clínica" : `até ${clinics} clínicas`;
};

const allUnlimited = (plan: Plan) =>
  Object.values(plan.limits).every((value) => value === null);

const joinList = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`
    : items.join("");

export const planLine = (plan: Plan) => {
  if (allUnlimited(plan)) {
    return `• ${plan.name}: clínicas, médicos, pacientes e agendamentos ilimitados.`;
  }
  const { doctors, patients, appointmentsPerMonth } = plan.limits;
  const perClinic = joinList([
    amount(doctors, "médico", "médicos"),
    amount(patients, "paciente", "pacientes"),
    appointmentsPerMonth === null
      ? "agendamentos ilimitados"
      : `${amount(appointmentsPerMonth, "agendamento", "agendamentos")} por mês`,
  ]);
  const free =
    plan.id === "free" ? `grátis por ${FREE_PERIOD_MONTHS} meses, ` : "";
  const scope = plan.limits.clinics === 1 ? "com" : "e, em cada uma,";
  return `• ${plan.name}: ${free}${clinicsOf(plan)} ${scope} ${perClinic}.`;
};

export const plansSummary = () =>
  `São três planos:\n${ORDER.map((id) => planLine(PLANS[id])).join("\n")}\nOs valores atualizados ficam na página de assinatura.`;

export const clinicsPerPlan = () =>
  ORDER.map((id) => {
    const { clinics } = PLANS[id].limits;
    return `${PLANS[id].name}: ${clinics === null ? "ilimitadas" : clinics}`;
  }).join(", ");
