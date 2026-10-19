// Display name of each page, shared by the breadcrumb and anything else that
// names a page.
export const PAGE_TITLES: Record<string, string> = {
  "/painel": "Dashboard",
  "/agendamentos": "Agendamentos",
  "/medicos": "Médicos",
  "/pacientes": "Pacientes",
  "/assinatura": "Assinatura",
  "/clinicas": "Minhas clínicas",
  "/configuracoes-da-clinica": "Configurações da clínica",
  "/nova-clinica": "Nova clínica",
  "/minha-conta": "Minha conta",
  "/atendimento": "Atendimento",
};

export const pageTitle = (pathname: string) => {
  const root = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  return PAGE_TITLES[root] ?? null;
};
