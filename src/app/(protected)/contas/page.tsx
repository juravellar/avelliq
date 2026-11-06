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
import { PaginationLinks } from "@/components/ui/pagination-links";
import { inClinicTimezone } from "@/helpers/time";
import { pageNumber } from "@/lib/pagination";
import { resolvePlan } from "@/lib/plans";
import { getServerSession } from "@/lib/server-session";
import {
  type AccountFilter,
  type AccountRow,
  ACCOUNTS_PAGE_SIZE,
  countDeletionRequests,
  listAccounts,
} from "@/lib/support/accounts";
import {
  canBlock,
  canChangeRole,
  canDeleteAccount,
  canRequestDeletion,
  canSeeAccounts,
  isSupportOwner,
  MODERATION_REASONS,
  rolesManagedBy,
  STAFF_ROLE_NAMES,
} from "@/lib/support/admin";
import { cn } from "@/lib/utils";

import { AccountActions } from "./_components/account-actions";
import { RolePicker } from "./_components/role-picker";

interface AccountsPageProps {
  searchParams: Promise<{ busca?: string; pagina?: string; filtro?: string }>;
}

const FILTERS: { value: AccountFilter | undefined; label: string }[] = [
  { value: undefined, label: "Todas" },
  { value: "exclusao", label: "Exclusão pedida" },
  { value: "bloqueadas", label: "Bloqueadas" },
];

const isFilter = (value: string | undefined): value is AccountFilter =>
  value === "exclusao" || value === "bloqueadas";

const SIGN_IN_METHODS: Record<string, string> = {
  credential: "Senha",
  google: "Google",
};

const signInMethods = (account: AccountRow) =>
  account.providers.map((id) => SIGN_IN_METHODS[id] ?? id).join(" · ") || "—";

const pageHref = (search: string, page: number, filter?: AccountFilter) => {
  const params = new URLSearchParams();
  if (search) params.set("busca", search);
  if (filter) params.set("filtro", filter);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/contas?${query}` : "/contas";
};

// Every Avelliq account, for the owners (SUPPORT_ADMIN_EMAILS) and admins.
// Here they find accounts and choose Avelliq's team: owners choose admins and
// support, admins only support. For everyone else the page doesn't exist.
const AccountsPage = async ({ searchParams }: AccountsPageProps) => {
  const session = await getServerSession();
  if (!canSeeAccounts(session?.user)) {
    notFound();
  }
  const roles = rolesManagedBy(session?.user);
  const params = await searchParams;
  const search = params.busca?.trim().slice(0, 100) ?? "";
  const page = pageNumber(params.pagina);
  const filter = isFilter(params.filtro) ? params.filtro : undefined;
  const [{ rows, total }, deletionRequests] = await Promise.all([
    listAccounts({ search, filter, page }),
    countDeletionRequests(),
  ]);
  const pages = Math.max(1, Math.ceil(total / ACCOUNTS_PAGE_SIZE));
  if (page > pages) {
    redirect(pageHref(search, pages, filter));
  }
  const viewer = session!.user;

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Contas</PageTitle>
          <PageDescription>
            Todas as contas do Avelliq. Principal, Admin e Suporte usam o
            sistema sem plano; Suporte também responde o Atendimento; QA testa
            com o plano que escolher e só olha esta tela; Admin escolhe quem é
            Suporte e QA e pode bloquear contas. Só a conta principal exclui
            contas: Admin pede a exclusão a ela.
          </PageDescription>
        </PageHeaderContent>
      </PageHeader>
      <PageContent>
        {deletionRequests > 0 &&
          isSupportOwner(viewer) &&
          filter !== "exclusao" && (
            <Link
              href={pageHref("", 1, "exclusao")}
              prefetch={false}
              className="border-warning-border bg-warning-muted text-warning-foreground rounded-lg border p-3 text-sm"
            >
              {deletionRequests === 1
                ? "1 pedido de exclusão aguarda a sua decisão."
                : `${deletionRequests} pedidos de exclusão aguardam a sua decisão.`}{" "}
              <span className="underline underline-offset-2">Ver pedidos</span>
            </Link>
          )}
        <form action="/contas" className="flex max-w-xl gap-2" role="search">
          {filter && <input type="hidden" name="filtro" value={filter} />}
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
        <nav aria-label="Filtrar contas" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Link
              key={option.label}
              href={pageHref(search, 1, option.value)}
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
                        account.staffRole && (
                          <Badge variant="secondary">
                            {STAFF_ROLE_NAMES[account.staffRole]}
                          </Badge>
                        )
                      )}
                      {!account.emailVerified && (
                        <Badge variant="outline">E-mail não confirmado</Badge>
                      )}
                      {account.blockedAt && (
                        <Badge variant="destructive">
                          Bloqueada
                          {account.blockedReason
                            ? ` · ${MODERATION_REASONS[account.blockedReason]}`
                            : ""}
                        </Badge>
                      )}
                      {account.deletionRequestedAt && (
                        <Badge className="bg-warning-muted text-warning-foreground border-warning-border">
                          Exclusão pedida
                          {account.deletionRequestReason
                            ? ` · ${MODERATION_REASONS[account.deletionRequestReason]}`
                            : ""}
                        </Badge>
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
                  <div className="flex flex-wrap items-center gap-2">
                    {canChangeRole(viewer, account) && (
                      <RolePicker
                        userId={account.id}
                        name={account.name}
                        role={account.staffRole}
                        roles={roles}
                        canJoin={account.emailVerified}
                      />
                    )}
                    <AccountActions
                      userId={account.id}
                      name={account.name}
                      blocked={Boolean(account.blockedAt)}
                      deletionRequested={Boolean(account.deletionRequestedAt)}
                      allowed={{
                        block: canBlock(viewer, account),
                        requestDeletion: canRequestDeletion(viewer, account),
                        cancelRequest:
                          canDeleteAccount(viewer, account) ||
                          (canRequestDeletion(viewer, account) &&
                            account.deletionRequestedBy === viewer.id),
                        delete: canDeleteAccount(viewer, account),
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <PaginationLinks
          page={page}
          pages={pages}
          href={(target) => pageHref(search, target, filter)}
        />
      </PageContent>
    </PageContainer>
  );
};

export default AccountsPage;
