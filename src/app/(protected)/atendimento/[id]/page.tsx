import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageContainer, PageContent } from "@/components/ui/page-container";
import { inClinicTimezone } from "@/helpers/time";
import { getServerSession } from "@/lib/server-session";
import { isSupportOwner, isSupportStaff } from "@/lib/support/admin";
import {
  getReceivedEmail,
  InboxError,
  isInboxConfigured,
  isReceivedEmailId,
} from "@/lib/support/inbox";
import {
  isForSupport,
  isHelpFormMessage,
  isOwnAddress,
  type ReceivedEmail,
  replyTarget,
} from "@/lib/support/inbox-helpers";

import { EmailBody, InboxProblem } from "../_components/inbox-states";
import { ReplyForm } from "../_components/reply-form";

const ReceivedEmailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const session = await getServerSession();
  if (!isSupportStaff(session?.user)) {
    notFound();
  }
  const { id } = await params;
  if (!isReceivedEmailId(id)) {
    notFound();
  }

  let email: ReceivedEmail | null = null;
  let error: unknown;
  if (isInboxConfigured()) {
    try {
      email = await getReceivedEmail(id);
    } catch (caught) {
      if (caught instanceof InboxError && caught.status === 404) {
        notFound();
      }
      error = caught;
      console.error("Support e-mail not loaded:", (caught as Error).message);
    }
  }
  if (email && !isSupportOwner(session?.user) && !isForSupport(email)) {
    notFound();
  }

  return (
    <PageContainer>
      <Button variant="ghost" asChild className="-ml-2 w-fit">
        <Link href="/atendimento" prefetch={false}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para a caixa de entrada
        </Link>
      </Button>
      <PageContent>
        {!email ? (
          <InboxProblem error={error} />
        ) : (
          <>
            <Card>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold break-words">
                    {email.subject || "(sem assunto)"}
                  </h1>
                  {isHelpFormMessage(email) && (
                    <Badge variant="secondary">Formulário</Badge>
                  )}
                </div>
                <dl className="text-muted-foreground grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="font-medium">De</dt>
                  <dd className="break-all">{email.from}</dd>
                  {email.reply_to && email.reply_to.length > 0 && (
                    <>
                      <dt className="font-medium">Responder para</dt>
                      <dd className="break-all">{email.reply_to.join(", ")}</dd>
                    </>
                  )}
                  <dt className="font-medium">Para</dt>
                  <dd className="break-all">{email.to.join(", ")}</dd>
                  <dt className="font-medium">Recebido em</dt>
                  <dd>
                    {inClinicTimezone(new Date(email.created_at)).format(
                      "DD/MM/YYYY [às] HH:mm",
                    )}
                  </dd>
                </dl>
              </CardHeader>
              <CardContent className="border-t pt-6">
                <EmailBody text={email.text} html={email.html} />
              </CardContent>
            </Card>
            {isOwnAddress(replyTarget(email)) ? (
              <p className="text-muted-foreground rounded-lg border p-4 text-sm">
                Este e-mail veio de um endereço do próprio Avelliq (
                {replyTarget(email)}), então não há para quem responder.
              </p>
            ) : (
              <ReplyForm
                id={email.id}
                to={replyTarget(email)}
                from={process.env.SUPPORT_EMAIL ?? null}
              />
            )}
          </>
        )}
      </PageContent>
    </PageContainer>
  );
};

export default ReceivedEmailPage;
