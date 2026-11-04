import { ArrowLeft, Mail, Paperclip, Settings2, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageContainer, PageContent } from "@/components/ui/page-container";
import { inClinicTimezone } from "@/helpers/time";
import { getServerSession } from "@/lib/server-session";
import {
  canAnswerSupport,
  canSeeSupportInbox,
  isSupportOwner,
} from "@/lib/support/admin";
import { isReceivedEmailId } from "@/lib/support/inbox";
import { isOwnAddress } from "@/lib/support/inbox-helpers";
import {
  getTicket,
  isSupportTicket,
  ticketIdOfEmail,
} from "@/lib/support/tickets";
import {
  isFinalStatus,
  protocolOf,
  splitQuotedReply,
  STATUS_NAMES,
} from "@/lib/support/tickets-helpers";

import { StatusBadge, StatusSteps } from "../_components/status-badge";
import { TicketUpdateForm } from "../_components/ticket-update-form";

type Ticket = NonNullable<Awaited<ReturnType<typeof getTicket>>>;
type Message = Ticket["messages"][number];

const when = (date: Date) =>
  inClinicTimezone(date).format("DD/MM/YYYY [às] HH:mm");

const AUTHOR_ICONS = {
  customer: UserRound,
  team: Mail,
  system: Settings2,
};

const authorName = (message: Message, ticket: Ticket) =>
  message.author === "customer"
    ? `Cliente · ${ticket.customerName || ticket.customerEmail}`
    : message.author === "team"
      ? `Equipe · ${message.user?.name ?? "conta excluída"}`
      : "Sistema";

function TimelineItem({
  message,
  ticket,
}: {
  message: Message;
  ticket: Ticket;
}) {
  const Icon = AUTHOR_ICONS[message.author];
  const { reply, quoted } = splitQuotedReply(message.body ?? "");
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span
        className={
          message.author === "team"
            ? "bg-avelliq-muted text-avelliq flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            : "bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        }
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm font-semibold">
              {authorName(message, ticket)}
            </strong>
            {message.statusChange && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                mudou para <StatusBadge status={message.statusChange} />
              </span>
            )}
          </div>
          <time
            dateTime={message.createdAt.toISOString()}
            className="text-muted-foreground text-xs"
          >
            {when(message.createdAt)}
          </time>
        </div>
        {reply && (
          <p
            className={
              message.author === "system"
                ? "text-muted-foreground text-sm"
                : "text-sm leading-relaxed break-words whitespace-pre-wrap"
            }
          >
            {reply}
          </p>
        )}
        {quoted && (
          <details className="text-muted-foreground text-xs">
            <summary className="cursor-pointer select-none">
              Ver o trecho citado
            </summary>
            <pre className="mt-2 font-sans break-words whitespace-pre-wrap">
              {quoted}
            </pre>
          </details>
        )}
        {message.hadAttachments && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Paperclip className="h-3.5 w-3.5" aria-hidden />O cliente enviou
            anexos. Eles não são aceitos e não foram guardados.
          </p>
        )}
      </div>
    </li>
  );
}

// One support ticket: protocol, customer, the whole conversation and the
// team's update form. An old link to a received e-mail opens its ticket.
const TicketPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const session = await getServerSession();
  if (!canSeeSupportInbox(session?.user)) {
    notFound();
  }
  const { id } = await params;
  if (!isReceivedEmailId(id)) {
    notFound();
  }
  const ticket = await getTicket(id);
  if (!ticket) {
    const ticketId = await ticketIdOfEmail(id);
    if (ticketId) {
      redirect(`/atendimento/${ticketId}`);
    }
    notFound();
  }
  if (!isSupportOwner(session?.user) && !isSupportTicket(ticket)) {
    notFound();
  }

  const protocol = protocolOf(ticket.number);
  const final = isFinalStatus(ticket.status);
  const canEmail = !isOwnAddress(ticket.customerEmail);

  return (
    <PageContainer>
      <Button variant="ghost" asChild className="-ml-2 w-fit">
        <Link href="/atendimento" prefetch={false}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para os atendimentos
        </Link>
      </Button>
      <PageContent>
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h1 className="text-lg font-semibold">Protocolo {protocol}</h1>
                <p className="text-sm break-words">{ticket.subject}</p>
                <p className="text-muted-foreground text-xs">
                  Aberto em {when(ticket.createdAt)}
                  {ticket.source === "form"
                    ? " pelo formulário de ajuda"
                    : " por e-mail"}
                </p>
              </div>
              <StatusBadge status={ticket.status} className="text-sm" />
            </div>
            <StatusSteps status={ticket.status} />
          </CardHeader>
          <CardContent className="space-y-4 border-t pt-6">
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground font-medium">Cliente</dt>
              <dd className="break-words">{ticket.customerName || "—"}</dd>
              <dt className="text-muted-foreground font-medium">E-mail</dt>
              <dd className="break-all">{ticket.customerEmail}</dd>
              <dt className="text-muted-foreground font-medium">Recebido em</dt>
              <dd className="break-all">{ticket.inbox || "—"}</dd>
              {ticket.previousTicket && (
                <>
                  <dt className="text-muted-foreground font-medium">
                    Continua
                  </dt>
                  <dd>
                    <Link
                      href={`/atendimento/${ticket.previousTicket.id}`}
                      prefetch={false}
                      className="underline underline-offset-2"
                    >
                      Protocolo {protocolOf(ticket.previousTicket.number)}
                    </Link>
                  </dd>
                </>
              )}
            </dl>
            {ticket.context && (
              <div className="bg-muted/50 rounded-md border p-3 text-sm">
                <p className="text-muted-foreground mb-1 text-xs font-medium">
                  Dados da conta (só a equipe vê)
                </p>
                <p className="break-words whitespace-pre-wrap">
                  {ticket.context}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Histórico</h2>
          </CardHeader>
          <CardContent>
            <ol className="divide-y">
              {ticket.messages.map((message) => (
                <TimelineItem
                  key={message.id}
                  message={message}
                  ticket={ticket}
                />
              ))}
            </ol>
          </CardContent>
        </Card>

        {final ? (
          <p className="text-muted-foreground rounded-lg border p-4 text-sm">
            Este atendimento foi {STATUS_NAMES[ticket.status].toLowerCase()} e
            não pode mais ser alterado. Se o cliente responder, a mensagem abre
            um novo atendimento ligado a este protocolo.
          </p>
        ) : !canAnswerSupport(session?.user) ? (
          <p className="text-muted-foreground rounded-lg border p-4 text-sm">
            Contas QA veem o Atendimento para testar, mas não respondem nem
            mudam o status: a mensagem chegaria a um cliente de verdade.
          </p>
        ) : (
          <TicketUpdateForm
            ticketId={ticket.id}
            status={ticket.status}
            to={ticket.customerEmail}
            from={process.env.SUPPORT_EMAIL ?? null}
            canEmail={canEmail}
          />
        )}
      </PageContent>
    </PageContainer>
  );
};

export default TicketPage;
