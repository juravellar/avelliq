import { describe, expect, it } from "vitest";

import { PLANS } from "@/lib/plans";

import { clinicsPerPlan, planLine, plansSummary } from "./plan-text";

describe("plan texts", () => {
  it("describes each plan from its limits", () => {
    expect(planLine(PLANS.free)).toBe(
      "• Free: grátis por 3 meses, 1 clínica com 1 médico, até 20 pacientes e até 40 agendamentos por mês.",
    );
    expect(planLine(PLANS.essential)).toBe(
      "• Essencial: até 2 clínicas e, em cada uma, até 5 médicos, até 100 pacientes e até 200 agendamentos por mês.",
    );
    expect(planLine(PLANS.professional)).toBe(
      "• Profissional: clínicas, médicos, pacientes e agendamentos ilimitados.",
    );
    expect(clinicsPerPlan()).toBe(
      "Free: 1, Essencial: 2, Profissional: ilimitadas",
    );
  });

  it("follows a changed limit", () => {
    const bigger = {
      ...PLANS.essential,
      limits: { ...PLANS.essential.limits, patients: 150, doctors: null },
    };
    expect(planLine(bigger)).toContain("médicos ilimitados, até 150 pacientes");
    expect(plansSummary()).toContain("até 200 agendamentos");
  });
});
