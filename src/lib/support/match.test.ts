import { describe, expect, it } from "vitest";

import { SUPPORT_ANSWERS } from "./answers";
import { findAnswer, normalize } from "./match";

const answerId = (message: string) => {
  const reply = findAnswer(message);
  return reply.kind === "answer" ? reply.answer.id : reply.kind;
};

describe("normalize", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalize("  Não consigo ENTRAR!! ")).toBe("nao consigo entrar");
    expect(normalize("Meu E-mail")).toBe("meu email");
  });
});

describe("findAnswer", () => {
  it("answers every suggested question with its own answer", () => {
    for (const answer of SUPPORT_ANSWERS) {
      expect(answerId(answer.question), answer.question).toBe(answer.id);
    }
  });

  it("understands the way people ask", () => {
    expect(answerId("quanto custa o avelliq?")).toBe("planos");
    expect(answerId("como faço pra cancelar minha assinatura")).toBe(
      "cancelar",
    );
    expect(answerId("esqueci a senha")).toBe("senha");
    expect(answerId("quero colocar o logotipo da clinica")).toBe("marca");
    expect(answerId("como remarcar uma consulta?")).toBe("editar-agendamento");
    expect(answerId("Aceita PIX?")).toBe("pagamento");
    expect(answerId("tem modo escuro")).toBe("tema");
    expect(answerId("quero mudar a cor dos botões")).toBe("marca");
    expect(answerId("como apagar minha conta")).toBe("excluir-conta");
    expect(answerId("tem app pra android?")).toBe("celular");
    expect(answerId("não recebi o e-mail")).toBe("confirmar-email");
    expect(answerId("meu período grátis acabou")).toBe("gratis");
  });

  it("matches whole words only", () => {
    // "cor" (brand color) must not match "corrigir".
    expect(answerId("como corrigir")).toBe("none");
  });

  it("matches plurals of one-word keywords", () => {
    expect(answerId("cadastrar pacientes")).toBe("paciente");
  });

  it("answers small talk", () => {
    expect(findAnswer("Olá!").kind).toBe("small-talk");
    expect(findAnswer("obrigada").kind).toBe("small-talk");
    expect(findAnswer("tchau").kind).toBe("small-talk");
  });

  it("offers a person when asked, answering first when it can", () => {
    expect(findAnswer("quero falar com um atendente").kind).toBe("human");
    const reply = findAnswer("atendente, preciso cancelar o plano");
    expect(reply.kind === "answer" && reply.answer.id).toBe("cancelar");
    expect(reply.kind === "answer" && reply.offerHuman).toBe(true);
  });

  it("admits when it has no answer", () => {
    expect(findAnswer("qual a capital da australia").kind).toBe("none");
    expect(findAnswer("   ").kind).toBe("none");
  });

  it("suggests related answers", () => {
    const reply = findAnswer("plano anual com desconto, como pagar?");
    expect(reply.kind).toBe("answer");
    expect(reply.kind === "answer" && reply.related.length).toBeGreaterThan(0);
  });
});
