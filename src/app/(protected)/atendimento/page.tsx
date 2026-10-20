import { ChevronRight, FileText, Mail } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { canSeeSupportInbox, isSupportOwner } from "@/lib/support/admin";
import {
  isInboxConfigured,
  isReceivedEmailId,
  listReceivedEmails,
} from "@/lib/support/inbox";
import {
  inboxPageLinks,
  isForSupport,
  isHelpFormMessage,
  nameOf,
  type ReceivedEmailSummary,
  replyTarget,
} from "@/lib/support/inbox-helpers";

import { InboxProblem } from "./_components/inbox-states";

interface InboxPageProps {
  searchParams: Promise<{ depois?: string; antes?: string }>;
}

// Who wrote: for the help form, the person in Reply-To; otherwise the sender.
const senderOf = (email: ReceivedEmailSummary) =>
  isHelpFormMessage(email) ? replyTarget(email) : nameOf(email.from);

// The support inbox: e-mails received at the domain, newest first. Only
// Avelliq staff (SUPPORT_ADMIN_EMAILS) see it; for everyone else it doesn't
// exist.
const InboxPage = async ({ searchParams }: InboxPageProps) => {
  const session = await getServerSession();
  if (!canSeeSupportInbox(session?.user)) {
    notFound();
  }
  // Main accounts see all the domain's mail; the rest of the team only what
  // was sent to the support addresses.
  const seesAll = isSupportOwner(session?.user);
  const { depois, antes } = await searchParams;
  const after = depois && isReceivedEmailId(depois) ? depois : undefined;
  const before =
    !after && antes && isReceivedEmailId(antes) ? antes : undefined;

  let page: Awaited<ReturnType<typeof listReceivedEmails>> | null = null;
  let emails: ReceivedEmailSummary[] = [];
  let error: unknown;
  if (isInboxConfigured()) {
    try {
      page = await listReceivedEmails({ after, before });
      emails = seesAll
        ? page.data
        : page.data.filter((email) => isForSupport(email));
    } catch (caught) {
      error = caught;
      console.error("Support inbox not loaded:", (caught as Error).message);
    }
  }

  const { newer, older } = page
    ? inboxPageLinks(page, { after, before })
    : { newer: null, older: null };

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
            e mensagens do &quot;Falar com a equipe&quot;.
          </PageDescription>
        </PageHeaderContent>
      </PageHeader>
      <PageContent>
        {!page ? (
          <InboxProblem error={error} />
        ) : emails.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border p-10 text-center text-sm">
            <Mail className="h-8 w-8" aria-hidden />
            {page.data.length > 0
              ? "Nenhum e-mail para o suporte nesta página."
              : `Nenhum e-mail ${after ? "mais antigo" : before ? "mais recente" : "recebido ainda"}.`}
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {emails.map((email) => (
              <li key={email.id}>
                <Link
                  href={`/atendimento/${email.id}`}
                  prefetch={false}
                  className="hover:bg-accent flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {senderOf(email)}
                      </span>
                      {isHelpFormMessage(email) && (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                          <FileText className="h-3 w-3" aria-hidden />
                          Formulário
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-sm">
                      {email.subject || "(sem assunto)"}
                    </p>
                  </div>
                  <time
                    dateTime={email.created_at}
                    className="text-muted-foreground shrink-0 text-xs"
                  >
                    {inClinicTimezone(new Date(email.created_at)).format(
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
        {page && (newer || older) && (
          <div className="flex justify-between">
            {newer ? (
              <Button variant="outline" asChild>
                <Link href={newer} prefetch={false}>
                  Mais recentes
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {older && (
              <Button variant="outline" asChild>
                <Link href={older} prefetch={false}>
                  Mais antigos
                </Link>
              </Button>
            )}
          </div>
        )}
      </PageContent>
    </PageContainer>
  );
};

export default InboxPage;
