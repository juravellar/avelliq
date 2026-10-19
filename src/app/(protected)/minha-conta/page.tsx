import { and, eq, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PageContainer,
  PageContent,
  PageDescription,
  PageHeader,
  PageHeaderContent,
  PageTitle,
} from "@/components/ui/page-container";
import { db } from "@/db";
import { accountsTable } from "@/db/schema";
import { inClinicTimezone } from "@/helpers/time";
import { isPaidPlan } from "@/lib/plans";
import { getServerSession } from "@/lib/server-session";

import { DeleteAccountCard } from "./_components/delete-account-card";
import { PasswordCard } from "./_components/password-card";

// Works without a clinic: deleting the account or downloading the data must
// not depend on having finished the sign-up.
const AccountPage = async () => {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/entrar");
  }
  const { user } = session;
  // Accounts created with Google have no password until they make one here.
  const passwordAccount = await db.query.accountsTable.findFirst({
    columns: { id: true },
    where: and(
      eq(accountsTable.userId, user.id),
      eq(accountsTable.providerId, "credential"),
      isNotNull(accountsTable.password),
    ),
  });

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Minha conta</PageTitle>
          <PageDescription>
            Seus dados, sua senha, sua privacidade e a exclusão da conta.
          </PageDescription>
        </PageHeaderContent>
      </PageHeader>
      <PageContent>
        <div className="grid max-w-2xl gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seus dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Nome:</span> {user.name}
              </p>
              <p className="break-all">
                <span className="text-muted-foreground">Email:</span>{" "}
                {user.email}
              </p>
              <p>
                <span className="text-muted-foreground">Conta criada em:</span>{" "}
                {inClinicTimezone(user.createdAt).format("DD/MM/YYYY")}
              </p>
            </CardContent>
          </Card>

          <PasswordCard hasPassword={!!passwordAccount} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Baixar meus dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Um arquivo JSON com sua conta e todas as suas clínicas, médicos,
                pacientes e agendamentos. Útil para guardar uma cópia ou levar
                os dados para outro sistema.
              </p>
              <Button asChild variant="outline">
                <a href="/api/account/export" download>
                  Baixar meus dados
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Privacidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Como tratamos os dados da sua conta e dos seus pacientes, e
                quais são os seus direitos pela LGPD.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Link href="/privacidade" className="underline">
                  Política de Privacidade
                </Link>
                <Link href="/termos" className="underline">
                  Termos de Uso
                </Link>
              </div>
            </CardContent>
          </Card>

          <DeleteAccountCard
            email={user.email}
            clinicCount={user.clinics.length}
            hasSubscription={isPaidPlan(user.plan)}
          />
        </div>
      </PageContent>
    </PageContainer>
  );
};

export default AccountPage;
