import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  PageActions,
  PageContainer,
  PageContent,
  PageDescription,
  PageHeader,
  PageHeaderContent,
  PageTitle,
} from "@/components/ui/page-container";
import { inClinicTimezone } from "@/helpers/time";
import { clinicChoiceStatus } from "@/lib/clinic-access";
import { resolvePlan } from "@/lib/plans";
import { getServerSession } from "@/lib/server-session";

import { ClinicChooser } from "./_components/clinic-chooser";
import { NewClinicButton } from "./_components/new-clinic-button";

const ClinicsPage = async () => {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/entrar");
  }
  if (!session.user.clinic) {
    redirect("/nova-clinica");
  }
  const { clinics, clinicLimit, overClinicLimit } = session.user;
  const plan = resolvePlan(session.user.plan);
  const canAddClinic = clinicLimit === null || clinics.length < clinicLimit;
  const choice = clinicChoiceStatus(
    session.user.clinicChoiceMadeAt,
    session.user.clinicChoiceChangedAt,
  );

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Minhas clínicas</PageTitle>
          <PageDescription>
            {session.user.planExempt
              ? "Como equipe do Avelliq, você pode ter clínicas ilimitadas."
              : clinicLimit === null
                ? `Seu plano ${plan.name} permite clínicas ilimitadas.`
                : `Seu plano ${plan.name} permite ${clinicLimit} ${clinicLimit === 1 ? "clínica" : "clínicas"}. Você tem ${clinics.length}.`}
          </PageDescription>
        </PageHeaderContent>
        <PageActions>
          {canAddClinic ? (
            <NewClinicButton />
          ) : (
            <Button asChild variant="outline">
              <Link href="/assinatura">Ver planos para mais clínicas</Link>
            </Button>
          )}
        </PageActions>
      </PageHeader>
      <PageContent>
        <ClinicChooser
          clinics={clinics.map(({ id, name, writable }) => ({
            id,
            name,
            writable,
          }))}
          activeClinicId={session.user.clinic.id}
          clinicLimit={clinicLimit}
          mustChoose={overClinicLimit}
          firstChoice={!session.user.clinicChoiceMadeAt}
          nextChangeOn={
            choice.nextChangeAt
              ? inClinicTimezone(choice.nextChangeAt).format("DD/MM/YYYY")
              : null
          }
          supportEmail={process.env.SUPPORT_EMAIL ?? null}
        />
      </PageContent>
    </PageContainer>
  );
};

export default ClinicsPage;
