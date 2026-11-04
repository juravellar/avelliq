import { ChevronRight, FileText, Inbox, Search } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PageContainer,
  PageContent,
  PageDescription,
  PageHeader,
  PageHeaderContent,
  PageTitle,
} from "@/components/ui/page-container";
import { inClinicTimezone } from "@/helpers/time";
import { getServerSession } from "@/lib/server-session";
import { pageNumber } from "@/lib/support/accounts";
import { canSeeSupportInbox, isSupportOwner } from "@/lib/support/admin";
import { isInboxConfigured } from "@/lib/support/inbox";
import {
  listTickets,
  syncInbox,
  type TicketFilter,
  TICKETS_PAGE_SIZE,
} from "@/lib/support/tickets";
import {
  isFinalStatus,
  protocolOf,
  STATUS_NAMES,
  SUPPORT_STATUSES,
} from "@/lib/support/tickets-helpers";
import { cn } from "@/lib/utils";

import { InboxProblem } from "./_components/inbox-states";
import { StatusBadge } from "./_components/status-badge";

interface InboxPageProps {
  searchParams: Promise<{ busca?: string; status?: string; pagina?: string }>;
}

const FILTERS: { value: TicketFilter | undefined; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "awaiting", label: "Aguardando a equipe" },
  ...SUPPORT_STATUSES.map((status) => ({
    value: status,
    label: STATUS_NAMES[status],
  })),
];

const isFilter = (value: string | undefined): value is TicketFilter =>
  FILTERS.some((filter) => filter.value === value);

const pageHref = ({
  search,
  filter,
  page,
}: {
  search: string;
  filter?: TicketFilter;
  page?: number;
}) => {
  const params = new URLSearchParams();
  if (search) params.set("busca", search);
  if (filter) params.set("status", filter);
  if (page && page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/atendimento?${query}` : "/atendimento";
};

// The support tickets: e-mails to the support address and help-form
// messages, each under a protocol, newest activity first. Opening the page
// brings in the e-mails received since the last visit.
const InboxPage = async ({ searchParams }: InboxPageProps) => {
  const session = await getServerSession();
  if (!canSeeSupportInbox(session?.user)) {
    notFound();
  }
  // Main accounts see all the domain's mail; the rest of the team only what
  // was sent to the support addresses.
  const seesAll = isSupportOwner(session?.user);
  const params = await searchParams;
  const search = params.busca?.trim().slice(0, 100) ?? "";
  const filter = isFilter(params.status) ? params.status : undefined;
  const page = pageNumber(params.pagina);

  let syncError: unknown;
  let waiting = 0;
  if (isInboxConfigured()) {
    try {
      waiting = await syncInbox();
    } catch (error) {
      syncError = error;
      console.error("Support inbox not synced:", (error as Error).message);
    }
  }

  const { rows, total } = await listTickets({ search, filter, page, seesAll });
  const pages = Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE));
  if (page > pages) {
    redirect(pageHref({ search, filter, page: pages }));
  }

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Atendimento</PageTitle>
          <PageDescription>
            E-mails recebidos
            {process.env.SUPPORT_EMAIL
              ? ` em ${process.env.SUPPORT_EMAIL}`
              : ""}{" "}
            e mensagens do &quot;Falar com a equipe&quot;, cada um com seu
            protocolo e o histórico da conversa.
          </PageDescription>
        </PageHeaderContent>
      </PageHeader>
      <PageContent>
        {(!isInboxConfigured() || syncError !== undefined) && (
          <InboxProblem error={syncError} />
        )}
        {waiting > 0 && (
          <p className="text-muted-foreground rounded-lg border p-3 text-sm">
            Ainda faltam {waiting} e-mails antigos para importar. Recarregue a
            página para continuar.
          </p>
        )}

        <form
          action="/atendimento"
          className="flex max-w-xl gap-2"
          role="search"
        >
          {filter && <input type="hidden" name="status" value={filter} />}
          <Input
            name="busca"
            defaultValue={search}
            placeholder="Protocolo, nome, e-mail, assunto ou texto"
            aria-label="Buscar atendimentos"
            maxLength={100}
          />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </form>

        <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Link
              key={option.label}
              href={pageHref({ search, filter: option.value })}
              prefetch={false}
              aria-current={option.value === filter ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                option.value === filter
                  ? "bg-foreground text-background border-foreground"
                  : "hover:bg-accent",
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <p className="text-muted-foreground text-sm">
          {total === 1 ? "1 atendimento" : `${total} atendimentos`}
          {search ? ` para “${search}”` : ""}.
        </p>

        {rows.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border p-10 text-center text-sm">
            <Inbox className="h-8 w-8" aria-hidden />
            Nenhum atendimento encontrado.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/atendimento/${ticket.id}`}
                  prefetch={false}
                  className="hover:bg-accent flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {protocolOf(ticket.number)}
                      </span>
                      <StatusBadge status={ticket.status} />
                      {ticket.awaitingTeam && !isFinalStatus(ticket.status) && (
                        <Badge className="shrink-0">Nova mensagem</Badge>
                      )}
                      {ticket.source === "form" && (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                          <FileText className="h-3 w-3" aria-hidden />
                          Formulário
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm font-medium">
                      {ticket.subject}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {ticket.customerName
                        ? `${ticket.customerName} · ${ticket.customerEmail}`
                        : ticket.customerEmail}
                    </p>
                  </div>
                  <time
                    dateTime={ticket.lastMessageAt.toISOString()}
                    className="text-muted-foreground shrink-0 text-xs"
                  >
                    {inClinicTimezone(ticket.lastMessageAt).format(
                      "DD/MM HH:mm",
                    )}
                  </time>
                  <ChevronRight
                    className="text-muted-foreground h-4 w-4 shrink-0"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <Button variant="outline" asChild>
                <Link
                  href={pageHref({ search, filter, page: page - 1 })}
                  prefetch={false}
                >
                  Anterior
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground text-sm">
              Página {page} de {pages}
            </span>
            {page < pages ? (
              <Button variant="outline" asChild>
                <Link
                  href={pageHref({ search, filter, page: page + 1 })}
                  prefetch={false}
                >
                  Próxima
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </div>
        )}
      </PageContent>
    </PageContainer>
  );
};

export default InboxPage;
