import { SUPPORT_ANSWERS, type SupportAnswer } from "./answers";

// Lowercase, no accents, no punctuation, single spaces: "Não consigo
// entrar!" and "nao consigo entrar" are the same question.
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // "e-mail" and "email" are written both ways.
    .replace(/\be mail\b/g, "email");

// Words that only connect others: "apagar minha conta" means "apagar conta".
const FILLER = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "no",
  "na",
  "nos",
  "nas",
  "em",
  "meu",
  "minha",
  "meus",
  "minhas",
  "seu",
  "sua",
  "pra",
  "para",
  "pro",
  "eu",
  "me",
]);

// The words that carry meaning, for matching keywords.
const meaningful = (text: string) =>
  normalize(text)
    .split(" ")
    .filter((word) => word && !FILLER.has(word));

const GREETINGS = new Set([
  "oi",
  "ola",
  "opa",
  "e ai",
  "bom dia",
  "boa tarde",
  "boa noite",
  "oi tudo bem",
  "ola tudo bem",
]);
const THANKS = new Set([
  "obrigado",
  "obrigada",
  "muito obrigado",
  "muito obrigada",
  "obg",
  "valeu",
  "brigado",
  "brigada",
]);
const GOODBYES = new Set(["tchau", "ate mais", "ate logo", "falou", "fui"]);

const HUMAN_REQUEST = [
  "atendente",
  "humano",
  "atendimento humano",
  "falar com alguem",
  "falar com uma pessoa",
  "pessoa real",
  "suporte",
  "sac",
  "fale conosco",
  "contato",
  "reclamacao",
  "reclamar",
];

export type SupportReply =
  | {
      kind: "answer";
      answer: SupportAnswer;
      related: SupportAnswer[];
      // The message also asked for a person.
      offerHuman: boolean;
    }
  | { kind: "small-talk"; text: string }
  | { kind: "human" }
  | { kind: "none" };

// A keyword matches whole words only ("cor" isn't in "corrigir"), ignoring
// filler words; a one-word keyword also matches its plural or singular.
const containsKeyword = (tokens: string[], keyword: string) => {
  const parts = meaningful(keyword);
  if (parts.length === 0) {
    return false;
  }
  if (parts.length === 1) {
    const [word] = parts;
    return tokens.some(
      (token) => token === word || token === `${word}s` || `${token}s` === word,
    );
  }
  return ` ${tokens.join(" ")} `.includes(` ${parts.join(" ")} `);
};

// How many answers use each word in their keywords. A word many answers
// share ("paciente", "plano") says little about which one is meant; a word
// only one answer uses ("cpf", "remarcar") says a lot.
const answersUsingWord = new WeakMap<SupportAnswer[], Map<string, number>>();
const wordSpread = (answers: SupportAnswer[]) => {
  let spread = answersUsingWord.get(answers);
  if (!spread) {
    spread = new Map();
    for (const answer of answers) {
      const used = new Set(answer.keywords.flatMap(meaningful));
      for (const word of used) {
        spread.set(word, (spread.get(word) ?? 0) + 1);
      }
    }
    answersUsingWord.set(answers, spread);
  }
  return spread;
};

// Each matched keyword adds its words, each weighted by how specific it is,
// so longer and rarer keywords count more.
const scoreOf = (
  tokens: string[],
  answer: SupportAnswer,
  spread: Map<string, number>,
) => {
  // "paciente" and "pacientes" each match both forms; count the word once.
  const counted = new Set<string>();
  let score = 0;
  for (const keyword of answer.keywords) {
    const parts = meaningful(keyword);
    const canonical =
      parts.length === 1 ? parts[0].replace(/s$/, "") : parts.join(" ");
    if (counted.has(canonical) || !containsKeyword(tokens, keyword)) {
      continue;
    }
    counted.add(canonical);
    for (const word of parts) {
      score += 1 / (spread.get(word) ?? 1);
    }
  }
  return score;
};

export const findAnswer = (
  message: string,
  answers: SupportAnswer[] = SUPPORT_ANSWERS,
): SupportReply => {
  const text = normalize(message);
  if (!text) {
    return { kind: "none" };
  }
  if (GREETINGS.has(text)) {
    return {
      kind: "small-talk",
      text: "Olá! Em que posso ajudar? Escreva sua dúvida ou escolha um dos assuntos abaixo.",
    };
  }
  if (THANKS.has(text)) {
    return {
      kind: "small-talk",
      text: "Por nada! Se precisar de mais alguma coisa, é só escrever.",
    };
  }
  if (GOODBYES.has(text)) {
    return {
      kind: "small-talk",
      text: "Até mais! Estamos por aqui quando precisar.",
    };
  }

  const tokens = meaningful(text);
  const spread = wordSpread(answers);
  const ranked = answers
    .map((answer) => ({
      answer,
      score: scoreOf(tokens, answer, spread),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  const wantsHuman = HUMAN_REQUEST.some((keyword) =>
    containsKeyword(tokens, keyword),
  );

  if (ranked.length === 0) {
    return wantsHuman ? { kind: "human" } : { kind: "none" };
  }
  return {
    kind: "answer",
    answer: ranked[0].answer,
    related: ranked.slice(1, 4).map(({ answer }) => answer),
    offerHuman: wantsHuman,
  };
};
