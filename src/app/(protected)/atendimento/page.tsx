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
import { isSupportAdmin } from "@/lib/support/admin";
import {
  isInboxConfigured,
  isReceivedEmailId,
  listReceivedEmails,
} from "@/lib/support/inbox";
import {
  isHelpFormMessage,
  nameOf,
  type ReceivedEmailSummary,
  replyTarget,
} from "@/lib/support/inbox-helpers";

import { InboxProblem } from "./_components/inbox-states";

interface InboxPageProps {
  searchParams: Promise<{ depois?: string }>;
}

// Who wrote: for the help form, the person in Reply-To; otherwise the sender.
const senderOf = (email: ReceivedEmailSummary) =>
  isHelpFormMessage(email) ? replyTarget(email) : nameOf(email.from);

// The support inbox: e-mails received at the domain, newest first. Only
// Avelliq staff (SUPPORT_ADMIN_EMAILS) see it; for everyone else it doesn't
// exist.
const InboxPage = async ({ searchParams }: InboxPageProps) => {
  const session = await getServerSession();
  if (!isSupportAdmin(session?.user)) {
    notFound();
  }
  const { depois } = await searchParams;
  const after = depois && isReceivedEmailId(depois) ? depois : undefined;

  let page: Awaited<ReturnType<typeof listReceivedEmails>> | null = null;
  let error: unknown;
  if (isInboxConfigured()) {
    try {
      page = await listReceivedEmails(after);
    } catch (caught) {
      error = caught;
      console.error("Support inbox not loaded:", (caught as Error).message);
    }
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
            e mensagens do &quot;Falar com a equipe&quot;.
          </PageDescription>
        </PageHeaderContent>
      </PageHeader>
      <PageContent>
        {!page ? (
          <InboxProblem error={error} />
        ) : page.data.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border p-10 text-center text-sm">
            <Mail className="h-8 w-8" aria-hidden />
            Nenhum e-mail {after ? "mais antigo" : "recebido ainda"}.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {page.data.map((email) => (
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
        {page && (after || page.has_more) && (
          <div className="flex justify-between">
            {after ? (
              <Button variant="outline" asChild>
                <Link href="/atendimento" prefetch={false}>
                  Mais recentes
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {page.has_more && (
              <Button variant="outline" asChild>
                <Link
                  href={`/atendimento?depois=${page.data.at(-1)!.id}`}
                  prefetch={false}
                >
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
