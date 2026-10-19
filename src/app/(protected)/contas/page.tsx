import { Search } from "lucide-react";
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
import { resolvePlan } from "@/lib/plans";
import { getServerSession } from "@/lib/server-session";
import {
  type AccountRow,
  ACCOUNTS_PAGE_SIZE,
  listAccounts,
  pageNumber,
} from "@/lib/support/accounts";
import { isSupportOwner } from "@/lib/support/admin";

import { AdminToggle } from "./_components/admin-toggle";

interface AccountsPageProps {
  searchParams: Promise<{ busca?: string; pagina?: string }>;
}

const SIGN_IN_METHODS: Record<string, string> = {
  credential: "Senha",
  google: "Google",
};

const signInMethods = (account: AccountRow) =>
  account.providers.map((id) => SIGN_IN_METHODS[id] ?? id).join(" · ") || "—";

const pageHref = (search: string, page: number) => {
  const params = new URLSearchParams();
  if (search) params.set("busca", search);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/contas?${query}` : "/contas";
};

// Every Avelliq account, for the owners (SUPPORT_ADMIN_EMAILS). Here they
// find accounts and choose who else can answer support mail. For everyone
// else the page doesn't exist.
const AccountsPage = async ({ searchParams }: AccountsPageProps) => {
  const session = await getServerSession();
  if (!isSupportOwner(session?.user)) {
    notFound();
  }
  const params = await searchParams;
  const search = params.busca?.trim().slice(0, 100) ?? "";
  const page = pageNumber(params.pagina);
  const { rows, total } = await listAccounts({ search, page });
  const pages = Math.max(1, Math.ceil(total / ACCOUNTS_PAGE_SIZE));
  if (page > pages) {
    redirect(pageHref(search, pages));
  }

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Contas</PageTitle>
          <PageDescription>
            Todas as contas do Avelliq. Admins leem e respondem o Atendimento.
          </PageDescription>
        </PageHeaderContent>
      </PageHeader>
      <PageContent>
        <form action="/contas" className="flex max-w-xl gap-2" role="search">
          <Input
            name="busca"
            defaultValue={search}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar contas"
            maxLength={100}
          />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </form>
        <p className="text-muted-foreground text-sm">
          {total === 1 ? "1 conta" : `${total} contas`}
          {search ? ` para “${search}”` : ""}.
        </p>

        {rows.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border p-10 text-center text-sm">
            Nenhuma conta encontrada.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((account) => {
              const owner = isSupportOwner(account);
              return (
                <li
                  key={account.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {account.name}
                      </span>
                      {owner ? (
                        <Badge>Principal</Badge>
                      ) : (
                        account.supportAdmin && <Badge>Admin</Badge>
                      )}
                      {!account.emailVerified && (
                        <Badge variant="outline">E-mail não confirmado</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-sm">
                      {account.email}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Plano {resolvePlan(account.plan).name} ·{" "}
                      {account.clinicCount === 1
                        ? "1 clínica"
                        : `${account.clinicCount} clínicas`}{" "}
                      · Entra com {signInMethods(account)} · Criada em{" "}
                      {inClinicTimezone(account.createdAt).format("DD/MM/YYYY")}
                    </p>
                  </div>
                  {!owner && (
                    <AdminToggle
                      userId={account.id}
                      name={account.name}
                      admin={account.supportAdmin}
                      canGrant={account.emailVerified}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <Button variant="outline" asChild>
                <Link href={pageHref(search, page - 1)} prefetch={false}>
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
                <Link href={pageHref(search, page + 1)} prefetch={false}>
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

export default AccountsPage;
