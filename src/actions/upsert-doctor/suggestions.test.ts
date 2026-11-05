import { describe, expect, it } from "vitest";

import { healthInsuranceSuggestions } from "./schema";

describe("healthInsuranceSuggestions", () => {
  it("puts the CRM state's own plans first", () => {
    const goias = healthInsuranceSuggestions("GO");
    expect(goias[0]).toBe("Ipasgo Saúde");
    expect(goias).toContain("Unimed");

    const minas = healthInsuranceSuggestions("MG");
    expect(minas.slice(0, 2)).toEqual(["IPSEMG", "Cemig Saúde"]);
  });

  it("offers only national plans without a state, or for one without regional plans", () => {
    const national = healthInsuranceSuggestions();
    expect(national).toContain("Bradesco Saúde");
    expect(national).not.toContain("Ipasgo Saúde");
    expect(healthInsuranceSuggestions("AC")).toEqual(national);
  });

  it("doesn't repeat a plan", () => {
    for (const state of ["GO", "SP", "RJ", "RS", undefined]) {
      const list = healthInsuranceSuggestions(state);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
