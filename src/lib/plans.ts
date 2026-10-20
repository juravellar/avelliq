export type PlanId = "free" | "essential" | "professional";
export type PaidPlanId = Exclude<PlanId, "free">;

export const PAID_PLAN_IDS: PaidPlanId[] = ["essential", "professional"];

// null means unlimited.
export interface PlanLimits {
  clinics: number | null;
  doctors: number | null;
  patients: number | null;
  appointmentsPerMonth: number | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    description: "Para conhecer a plataforma por 3 meses",
    limits: { clinics: 1, doctors: 1, patients: 20, appointmentsPerMonth: 40 },
    features: [
      "Grátis por 3 meses",
      "1 clínica",
      "1 médico",
      "Até 20 pacientes",
      "Até 40 agendamentos por mês",
      "Dashboard com métricas",
    ],
  },
  essential: {
    id: "essential",
    name: "Essencial",
    description: "Para profissionais autônomos ou pequenas clínicas",
    limits: {
      clinics: 2,
      doctors: 5,
      patients: 100,
      appointmentsPerMonth: 200,
    },
    features: [
      "Até 2 clínicas",
      "Até 5 médicos por clínica",
      "Até 100 pacientes por clínica",
      "Até 200 agendamentos por mês por clínica",
      "Dashboard com métricas",
      "Suporte por e-mail",
    ],
  },
  professional: {
    id: "professional",
    name: "Profissional",
    description: "Para clínicas com uma equipe maior",
    limits: {
      clinics: null,
      doctors: null,
      patients: null,
      appointmentsPerMonth: null,
    },
    features: [
      "Clínicas ilimitadas",
      "Médicos ilimitados",
      "Pacientes ilimitados",
      "Agendamentos ilimitados",
      "Dashboard com métricas",
      "Suporte prioritário",
    ],
  },
};

// Users without a paid subscription have plan = null in the database.
export const resolvePlan = (plan: string | null | undefined): Plan =>
  plan === "essential" || plan === "professional" ? PLANS[plan] : PLANS.free;

// The limits of Avelliq's own team: the unlimited plan, without paying.
export const STAFF_PLAN: PlanId = "professional";

export const isPaidPlan = (plan: string | null | undefined) =>
  resolvePlan(plan).id !== "free";
