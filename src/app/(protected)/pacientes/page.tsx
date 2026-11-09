import { asc, count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DataTable } from "@/components/ui/data-table";
import {
  PageActions,
  PageContainer,
  PageContent,
  PageDescription,
  PageHeader,
  PageHeaderContent,
  PageTitle,
} from "@/components/ui/page-container";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { db } from "@/db";
import { patientsTable } from "@/db/schema";
import { createGate } from "@/lib/create-gate";
import { writeBlock } from "@/lib/free-period";
import { pageCount, pageNumber } from "@/lib/pagination";
import { getPlanUsage } from "@/lib/plan-usage";
import { getServerSession } from "@/lib/server-session";

import AddPatientButton from "./_components/add-patient-button";
import { PATIENT_ROW_COLUMNS } from "./_components/patient-row";
import { patientsTableColumns } from "./_components/table.columns";

const PAGE_SIZE = 50;

interface PatientsPageProps {
  searchParams: Promise<{ pagina?: string }>;
}

const pageHref = (page: number) =>
  page > 1 ? `/pacientes?pagina=${page}` : "/pacientes";

const PatientsPage = async ({ searchParams }: PatientsPageProps) => {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/entrar");
  }
  if (!session.user.clinic) {
    redirect("/nova-clinica");
  }
  const page = pageNumber((await searchParams).pagina);
  const clinicId = session.user.clinic.id;
  // One page at a time, with only the columns the list shows. The name alone
  // is not unique, so the id keeps the order stable between pages.
  const [patients, [{ total }]] = await Promise.all([
    db.query.patientsTable.findMany({
      where: eq(patientsTable.clinicId, clinicId),
      columns: PATIENT_ROW_COLUMNS,
      orderBy: [asc(patientsTable.name), asc(patientsTable.id)],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db
      .select({ total: count() })
      .from(patientsTable)
      .where(eq(patientsTable.clinicId, clinicId)),
  ]);
  // After deleting the last patient of the last page, show the new last one.
  const pages = pageCount(total, PAGE_SIZE);
  if (page > pages) {
    redirect(pageHref(pages));
  }
  const usage = await getPlanUsage(
    session.user.clinic.id,
    session.user.plan,
    session.user.clinics.length,
  );
  const block = writeBlock(session.user);
  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Pacientes</PageTitle>
          <PageDescription>
            Gerencie os pacientes da sua clínica
          </PageDescription>
        </PageHeaderContent>
        <PageActions>
          <AddPatientButton
            gate={createGate(usage.patients, block, {
              one: "paciente",
              many: "pacientes",
            })}
          />
        </PageActions>
      </PageHeader>
      <PageContent>
        <DataTable columns={patientsTableColumns} data={patients} />
        <PaginationLinks page={page} pages={pages} href={pageHref} />
      </PageContent>
    </PageContainer>
  );
};

export default PatientsPage;
