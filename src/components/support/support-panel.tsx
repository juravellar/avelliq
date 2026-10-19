"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { sendSupportRequest } from "@/actions/send-support-request";
import {
  SUPPORT_TOPICS,
  type SupportRequest,
  supportRequestSchema,
} from "@/actions/send-support-request/schema";
import { actionErrorMessage } from "@/lib/action-errors";
import {
  POPULAR_ANSWERS,
  type SupportAnswer,
  type SupportLink,
} from "@/lib/support/answers";
import { findAnswer } from "@/lib/support/match";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
  links?: SupportLink[];
  suggestions?: SupportAnswer[];
  suggestionsLabel?: string;
  offerHuman?: boolean;
}

export interface SupportPanelProps {
  // Signed-in users don't type their name and e-mail in the form.
  user?: { name: string; email: string } | null;
  // Shown when the form can't send.
  supportEmail: string | null;
}

// A pause before each answer, so it reads as a reply rather than a flash.
const REPLY_DELAY_MS = 450;

// The help panel: automatic answers to common questions and, when they
// aren't enough, a form that e-mails the team. It stays mounted while closed,
// so the conversation survives reopening.
export default function SupportPanel({
  id,
  open,
  onClose,
  user,
  supportEmail,
}: SupportPanelProps & { id: string; open: boolean; onClose: () => void }) {
  const [view, setView] = useState<"chat" | "form">("chat");
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [misses, setMisses] = useState(0);
  const nextId = useRef(1);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 0,
      from: "bot",
      text: `Olá${user ? `, ${user.name.split(" ")[0]}` : ""}! Sou a ajuda do Avelliq. Escreva sua dúvida ou escolha um assunto:`,
      suggestions: POPULAR_ANSWERS,
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, typing, view, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (view === "chat") {
      inputRef.current?.focus();
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, view, onClose]);

  const push = (message: Omit<Message, "id">) =>
    setMessages((current) => [
      ...current,
      { ...message, id: nextId.current++ },
    ]);

  const reply = (message: Omit<Message, "id">) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      push(message);
    }, REPLY_DELAY_MS);
  };

  const answerWith = (
    answer: SupportAnswer,
    related: SupportAnswer[],
    offerHuman = false,
  ) => {
    setMisses(0);
    reply({
      from: "bot",
      text: answer.answer,
      links: answer.links,
      suggestions: related,
      suggestionsLabel: "Veja também:",
      offerHuman,
    });
  };

  const ask = (text: string) => {
    const question = text.trim();
    if (!question || typing) {
      return;
    }
    push({ from: "user", text: question });
    setDraft("");
    const result = findAnswer(question);
    if (result.kind === "answer") {
      answerWith(result.answer, result.related, result.offerHuman);
      return;
    }
    if (result.kind === "small-talk") {
      reply({ from: "bot", text: result.text, suggestions: POPULAR_ANSWERS });
      return;
    }
    if (result.kind === "human") {
      reply({
        from: "bot",
        text: "Posso tentar responder agora: escolha um assunto abaixo. Se preferir, fale com a nossa equipe.",
        suggestions: POPULAR_ANSWERS,
        offerHuman: true,
      });
      return;
    }
    // The first miss suggests rewording; from the second on, a person.
    const missed = misses + 1;
    setMisses(missed);
    reply({
      from: "bot",
      text:
        missed === 1
          ? "Não encontrei uma resposta para isso. Tente escrever de outro jeito ou escolha um assunto:"
          : "Ainda não encontrei. Nossa equipe pode ajudar, ou escolha um assunto:",
      suggestions: POPULAR_ANSWERS,
      offerHuman: missed >= 2,
    });
  };

  const choose = (answer: SupportAnswer) => {
    if (typing) {
      return;
    }
    push({ from: "user", text: answer.question });
    const result = findAnswer(answer.question);
    answerWith(
      answer,
      result.kind === "answer"
        ? result.related.filter(({ id }) => id !== answer.id)
        : [],
    );
  };

  const onSent = (email: string | undefined) => {
    setView("chat");
    setMisses(0);
    push({
      from: "bot",
      text: email
        ? `Mensagem enviada! Nossa equipe vai responder em ${email}.`
        : "Mensagem enviada! Nossa equipe vai responder por e-mail.",
    });
  };

  return (
    <div
      id={id}
      hidden={!open}
      role="dialog"
      aria-modal="false"
      aria-label="Ajuda do Avelliq"
      className="bg-background animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 flex h-[min(560px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-2xl border shadow-2xl duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
    >
      <header className="bg-avelliq text-avelliq-foreground flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
          <Image src="/logo-symbol.svg" alt="" width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-semibold">Ajuda Avelliq</p>
          <p className="text-xs opacity-85">
            {view === "form"
              ? "Fale com a nossa equipe"
              : "Respostas na hora, a qualquer momento"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar ajuda"
          className="rounded-md p-1 opacity-90 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {view === "chat" ? (
        <>
          <div
            ref={listRef}
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onChoose={choose}
                onHuman={() => setView("form")}
                onNavigate={onClose}
              />
            ))}
            {typing && <TypingDots />}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft);
            }}
            className="border-t px-3 pt-3 pb-2"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={300}
                placeholder="Escreva sua dúvida…"
                aria-label="Sua dúvida"
                className="border-input bg-background focus-visible:border-avelliq focus-visible:ring-avelliq/30 h-10 min-w-0 flex-1 rounded-full border px-4 text-sm outline-none focus-visible:ring-[3px]"
              />
              <button
                type="submit"
                disabled={!draft.trim() || typing}
                aria-label="Enviar pergunta"
                className="bg-avelliq text-avelliq-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[opacity,transform] active:scale-95 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setView("form")}
              className="text-muted-foreground hover:text-foreground mt-2 w-full text-center text-xs underline-offset-4 hover:underline"
            >
              Prefere falar com uma pessoa? Fale com a equipe
            </button>
          </form>
        </>
      ) : (
        <HumanForm
          user={user}
          supportEmail={supportEmail}
          onBack={() => setView("chat")}
          onSent={onSent}
        />
      )}
    </div>
  );
}

function MessageBubble({
  message,
  onChoose,
  onHuman,
  onNavigate,
}: {
  message: Message;
  onChoose: (answer: SupportAnswer) => void;
  onHuman: () => void;
  onNavigate: () => void;
}) {
  if (message.from === "user") {
    return (
      <div className="flex justify-end">
        <p className="bg-avelliq text-avelliq-foreground max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-line">
          {message.text}
        </p>
      </div>
    );
  }
  return (
    <div className="max-w-[92%] space-y-2">
      <p className="bg-avelliq-muted text-foreground rounded-2xl rounded-bl-md px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line">
        {message.text}
      </p>
      {message.links && message.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              onClick={onNavigate}
              className="bg-avelliq text-avelliq-foreground rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
            >
              {link.label} →
            </Link>
          ))}
        </div>
      )}
      {message.suggestions && message.suggestions.length > 0 && (
        <div className="space-y-1.5">
          {message.suggestionsLabel && (
            <p className="text-muted-foreground text-xs">
              {message.suggestionsLabel}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {message.suggestions.map((answer) => (
              <button
                key={answer.id}
                type="button"
                onClick={() => onChoose(answer)}
                className="border-avelliq/40 text-foreground hover:bg-avelliq-muted rounded-full border px-3 py-1 text-left text-xs transition-colors"
              >
                {answer.question}
              </button>
            ))}
          </div>
        </div>
      )}
      {message.offerHuman && (
        <button
          type="button"
          onClick={onHuman}
          className="border-avelliq text-foreground hover:bg-avelliq-muted w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
        >
          Falar com a equipe
        </button>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div
      className="bg-avelliq-muted flex w-14 items-center justify-center gap-1 rounded-2xl rounded-bl-md px-3 py-3"
      aria-label="Escrevendo"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

function HumanForm({
  user,
  supportEmail,
  onBack,
  onSent,
}: {
  user?: { name: string; email: string } | null;
  supportEmail: string | null;
  onBack: () => void;
  onSent: (email: string | undefined) => void;
}) {
  const pathname = usePathname();
  const form = useForm<SupportRequest>({
    // Signed-out visitors also have to say who they are.
    resolver: zodResolver(
      user
        ? supportRequestSchema
        : supportRequestSchema.superRefine((values, ctx) => {
            if (!values.name?.trim()) {
              ctx.addIssue({
                code: "custom",
                path: ["name"],
                message: "Informe seu nome.",
              });
            }
            if (!values.email?.trim()) {
              ctx.addIssue({
                code: "custom",
                path: ["email"],
                message: "Informe seu e-mail.",
              });
            }
          }),
    ),
    defaultValues: {
      topic: "duvida",
      message: "",
      name: "",
      email: "",
      leaveBlank: "",
    },
  });
  const send = useAction(sendSupportRequest, {
    onSuccess: ({ data }) => {
      form.reset();
      onSent(data?.replyTo);
    },
  });
  const errors = form.formState.errors;
  const field =
    "border-input bg-background focus-visible:border-avelliq focus-visible:ring-avelliq/30 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]";

  return (
    <form
      onSubmit={form.handleSubmit((values) =>
        send.execute({ ...values, page: pathname }),
      )}
      className="flex flex-1 flex-col overflow-y-auto"
      noValidate
    >
      <div className="flex-1 space-y-3 px-4 py-4">
        <p className="text-muted-foreground text-sm">
          {user
            ? `Vamos responder em ${user.email}.`
            : "Deixe seu contato e responderemos por e-mail."}
        </p>
        {!user && (
          <>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Nome</span>
              <input
                {...form.register("name")}
                autoComplete="name"
                className={field}
              />
              {errors.name && (
                <span className="text-destructive text-xs">
                  {errors.name.message}
                </span>
              )}
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">E-mail</span>
              <input
                {...form.register("email")}
                type="email"
                autoComplete="email"
                className={field}
              />
              {errors.email && (
                <span className="text-destructive text-xs">
                  {errors.email.message}
                </span>
              )}
            </label>
          </>
        )}
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Assunto</span>
          <select {...form.register("topic")} className={field}>
            {Object.entries(SUPPORT_TOPICS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Mensagem</span>
          <textarea
            {...form.register("message")}
            rows={5}
            maxLength={2000}
            placeholder="Conte o que aconteceu ou o que você precisa."
            className={cn(field, "resize-none")}
          />
          {errors.message && (
            <span className="text-destructive text-xs">
              {errors.message.message}
            </span>
          )}
        </label>
        <p className="text-muted-foreground text-xs">
          Não inclua dados de pacientes, como CPF ou informações de saúde.
        </p>
        {/* Off-screen trap for bots; people never see or reach it. Its name
            matches nothing browsers autofill (unlike "website"), so a real
            message isn't mistaken for a bot's. */}
        <input
          {...form.register("leaveBlank")}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
        {send.result.serverError && (
          <p role="alert" className="text-destructive text-sm">
            {actionErrorMessage(
              { serverError: send.result.serverError },
              supportEmail
                ? `Não foi possível enviar. Escreva para ${supportEmail}.`
                : "Não foi possível enviar.",
            )}
          </p>
        )}
      </div>
      <div className="flex gap-2 border-t px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          className="hover:bg-accent flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={send.isPending}
          className="bg-avelliq text-avelliq-foreground flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-[opacity,transform] active:scale-[0.98] disabled:opacity-60"
        >
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Enviar"
          )}
        </button>
      </div>
    </form>
  );
}
