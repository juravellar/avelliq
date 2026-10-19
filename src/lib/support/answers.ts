// The help widget's automatic answers. Each one is matched by keywords (see
// match.ts); write keywords the way people ask, without accents. Links point
// to pages of the app, which send signed-out visitors to the sign-in page.

import { FREE_PERIOD_MONTHS } from "@/lib/free-period";

import { clinicsPerPlan, plansSummary } from "./plan-text";

export interface SupportLink {
  label: string;
  href: string;
}

export interface SupportAnswer {
  id: string;
  // Shown as a clickable suggestion.
  question: string;
  keywords: string[];
  answer: string;
  links?: SupportLink[];
  // Offered when the conversation starts.
  popular?: boolean;
}

export const SUPPORT_ANSWERS: SupportAnswer[] = [
  // Planos e pagamento
  {
    id: "planos",
    question: "Quais são os planos e quanto custam?",
    keywords: [
      "plano",
      "planos",
      "preco",
      "precos",
      "valor do plano",
      "quanto custa",
      "mensalidade",
      "essencial",
      "profissional",
      "assinar",
    ],
    answer: plansSummary(),
    links: [{ label: "Ver planos", href: "/assinatura" }],
    popular: true,
  },
  {
    id: "gratis",
    question: "Como funciona o período grátis?",
    keywords: [
      "gratis",
      "gratuito",
      "periodo gratis",
      "teste",
      "trial",
      "free",
      "3 meses",
      "tres meses",
      "periodo de teste",
    ],
    answer: `Toda conta começa no plano Free, gratuito por ${FREE_PERIOD_MONTHS} meses contados a partir da criação da primeira clínica, sem cartão de crédito. Depois desse prazo a conta fica só leitura: você continua vendo todos os dados, mas para cadastrar e editar é preciso assinar um plano.`,
    links: [{ label: "Ver planos", href: "/assinatura" }],
    popular: true,
  },
  {
    id: "anual",
    question: "Existe plano anual?",
    keywords: [
      "anual",
      "por ano",
      "pagamento anual",
      "desconto",
      "plano anual",
      "12 meses",
    ],
    answer:
      'Sim. Na página de assinatura, escolha "Anual" acima dos planos: o ano inteiro é cobrado de uma vez, com desconto em relação a 12 mensalidades. O card de cada plano mostra quanto você economiza.',
    links: [{ label: "Ver planos", href: "/assinatura" }],
  },
  {
    id: "pagamento",
    question: "Quais formas de pagamento são aceitas?",
    keywords: [
      "forma de pagamento",
      "formas de pagamento",
      "cartao",
      "cartao de credito",
      "boleto",
      "pix",
      "pagar",
      "pagamento",
    ],
    answer:
      "O pagamento é feito com cartão de crédito, pelo Stripe, em uma página segura. Os dados do cartão vão direto para o Stripe e não passam pelo Avelliq.",
    links: [{ label: "Ver planos", href: "/assinatura" }],
  },
  {
    id: "cancelar",
    question: "Como cancelo ou mudo meu plano?",
    keywords: [
      "cancelar",
      "cancelo",
      "cancela",
      "cancelamento",
      "cancelar o plano",
      "cancelar meu plano",
      "cancelar a assinatura",
      "cancelar minha assinatura",
      "mudo meu plano",
      "mudar meu plano",
      "mudar de plano",
      "trocar de plano",
      "mudar plano",
      "trocar plano",
      "upgrade",
      "downgrade",
      "gerenciar assinatura",
      "atualizar cartao",
      "trocar cartao",
      "fatura",
      "faturas",
      "recibo",
    ],
    answer:
      'Na página de assinatura, clique em "Gerenciar assinatura". Lá você troca de plano, atualiza o cartão, vê as faturas ou cancela. Ao cancelar, o plano continua valendo até o fim do período já pago e depois a conta volta para o Free.',
    links: [{ label: "Abrir assinatura", href: "/assinatura" }],
    popular: true,
  },
  {
    id: "limite",
    question: "Atingi o limite do meu plano. E agora?",
    keywords: [
      "limite",
      "atingi o limite",
      "limite do plano",
      "nao consigo cadastrar",
      "nao consigo adicionar",
      "botao bloqueado",
    ],
    answer:
      "Cada plano tem limites de clínicas, médicos, pacientes e agendamentos por mês. Ao chegar no limite, o botão de cadastro explica o motivo. Para cadastrar mais, escolha um plano maior. O uso atual de cada limite aparece na página de assinatura.",
    links: [{ label: "Ver uso e planos", href: "/assinatura" }],
  },
  {
    id: "somente-leitura",
    question: "Por que minha clínica está só leitura?",
    keywords: [
      "so leitura",
      "somente leitura",
      "leitura",
      "nao consigo editar",
      "bloqueada",
      "clinica bloqueada",
      "periodo gratuito terminou",
    ],
    answer:
      "Há dois motivos possíveis:\n• O período grátis de 3 meses terminou: assine um plano para voltar a cadastrar e editar.\n• Você tem mais clínicas do que o plano permite (por exemplo, depois de mudar para um plano menor): em Minhas clínicas, escolha quais continuam ativas. As outras ficam só leitura, sem perder dados.",
    links: [
      { label: "Minhas clínicas", href: "/clinicas" },
      { label: "Ver planos", href: "/assinatura" },
    ],
  },

  // Uso do sistema
  {
    id: "medico",
    question: "Como cadastro um médico?",
    keywords: [
      "medico",
      "medicos",
      "cadastrar medico",
      "adicionar medico",
      "doutor",
      "profissional de saude",
      "especialidade",
    ],
    answer:
      'Em Médicos, clique em "Adicionar médico". Informe nome, especialidade, os dias e horários de atendimento e o valor da consulta. Os horários de atendimento definem quais horários aparecem livres na hora de agendar.',
    links: [{ label: "Abrir médicos", href: "/medicos" }],
    popular: true,
  },
  {
    id: "horario-medico",
    question: "Como mudo os horários de atendimento de um médico?",
    keywords: [
      "horario de atendimento",
      "horarios de atendimento",
      "dias de atendimento",
      "expediente",
      "disponibilidade",
      "agenda do medico",
    ],
    answer:
      'Em Médicos, clique em "Ver detalhes" no card do médico e ajuste os dias e horários de atendimento. As consultas são marcadas em horários de 30 em 30 minutos dentro desse expediente.',
    links: [{ label: "Abrir médicos", href: "/medicos" }],
  },
  {
    id: "paciente",
    question: "Como cadastro um paciente?",
    keywords: [
      "paciente",
      "pacientes",
      "cadastrar paciente",
      "adicionar paciente",
      "novo paciente",
    ],
    answer:
      'Em Pacientes, clique em "Adicionar paciente". Só nome, e-mail, telefone e sexo são obrigatórios. Você também pode registrar data de nascimento, CPF, endereço (preenchido pelo CEP), convênio, contato de emergência e observações administrativas.',
    links: [{ label: "Abrir pacientes", href: "/pacientes" }],
    popular: true,
  },
  {
    id: "cpf",
    question: "Por que o CPF do paciente não é aceito?",
    keywords: [
      "cpf",
      "cpf do paciente",
      "cpf invalido",
      "cpf duplicado",
      "mesmo cpf",
      "cpf ja cadastrado",
      "cpf nao e aceito",
    ],
    answer:
      'O CPF é opcional, mas quando informado precisa ser válido (os dígitos verificadores são conferidos) e não pode se repetir entre pacientes da mesma clínica. Se aparecer "Já existe um paciente com este CPF", procure o paciente na lista em vez de cadastrá-lo de novo.',
    links: [{ label: "Abrir pacientes", href: "/pacientes" }],
  },
  {
    id: "cep",
    question: "O endereço não foi preenchido pelo CEP",
    keywords: [
      "cep",
      "endereco",
      "endereco nao preencheu",
      "preencher endereco",
    ],
    answer:
      "Ao digitar os 8 números do CEP, rua, bairro, cidade e UF são preenchidos automaticamente pelo ViaCEP. Se o CEP não for encontrado ou o serviço estiver fora do ar, é só digitar o endereço manualmente.",
  },
  {
    id: "dados-clinicos",
    question: "Posso registrar diagnósticos e prescrições?",
    keywords: [
      "diagnostico",
      "prontuario",
      "prescricao",
      "receita",
      "exame",
      "exames",
      "historico medico",
      "anamnese",
    ],
    answer:
      'Não. O Avelliq é um sistema de agendamento, não um prontuário eletrônico. Use as observações do paciente só para informações administrativas, como "prefere contato por WhatsApp". Dados clínicos têm exigências legais próprias que o sistema não atende.',
  },
  {
    id: "agendamento",
    question: "Como marco uma consulta?",
    keywords: [
      "agendamento",
      "agendar",
      "marcar consulta",
      "marcar horario",
      "nova consulta",
      "novo agendamento",
      "consulta",
    ],
    answer:
      'Em Agendamentos, clique em "Novo agendamento" e escolha o paciente, o médico, a data e um horário livre. O valor vem preenchido com o valor padrão do médico, e você pode alterá-lo. No modo Calendário, basta clicar num horário livre.',
    links: [{ label: "Abrir agendamentos", href: "/agendamentos" }],
    popular: true,
  },
  {
    id: "calendario",
    question: "Como vejo a agenda em calendário?",
    keywords: [
      "calendario",
      "agenda",
      "semana",
      "visao semanal",
      "ver horarios",
      "grade",
    ],
    answer:
      'Em Agendamentos, escolha "Calendário" no topo da página. Ele mostra a semana em horários de 30 minutos; dá para filtrar por médico e navegar pelas semanas. Clique num horário livre para agendar ou num agendamento para editá-lo.',
    links: [
      { label: "Abrir calendário", href: "/agendamentos?visao=calendario" },
    ],
  },
  {
    id: "horario-indisponivel",
    question: "Por que não aparece o horário que eu quero?",
    keywords: [
      "horario nao aparece",
      "nao aparece o horario",
      "horario que eu quero",
      "horarios livres",
      "sem horario",
      "nenhum horario",
      "horario indisponivel",
      "nao aparece horario",
      "dia desabilitado",
    ],
    answer:
      "Só aparecem os horários em que o médico atende e que ainda estão livres. Confira os dias e horários de atendimento dele em Médicos. Se o horário já tem outra consulta com o mesmo médico, ele fica indisponível.",
    links: [{ label: "Abrir médicos", href: "/medicos" }],
  },
  {
    id: "editar-agendamento",
    question: "Como remarco ou cancelo uma consulta?",
    keywords: [
      "remarcar",
      "remarco",
      "remarcar consulta",
      "remarcar uma consulta",
      "remarcar o agendamento",
      "cancelar consulta",
      "cancelar uma consulta",
      "cancelar a consulta",
      "cancelo uma consulta",
      "cancelo a consulta",
      "desmarcar",
      "cancelar agendamento",
      "editar agendamento",
      "excluir agendamento",
      "apagar agendamento",
      "mudar horario",
    ],
    answer:
      "Na lista de agendamentos, clique nos três pontinhos do agendamento e escolha Editar (para mudar data, horário, médico ou valor) ou Deletar. No calendário, clique no agendamento para editá-lo.",
    links: [{ label: "Abrir agendamentos", href: "/agendamentos" }],
  },
  {
    id: "valor-consulta",
    question: "Posso cobrar um valor diferente numa consulta?",
    keywords: [
      "valor da consulta",
      "preco da consulta",
      "desconto na consulta",
      "valor diferente",
      "mudar valor",
    ],
    answer:
      'Sim. O valor de cada agendamento começa com o valor padrão do médico, mas pode ser alterado no próprio agendamento. Abaixo do campo há o atalho "Usar valor padrão" para voltar ao valor do médico.',
  },
  {
    id: "painel",
    question: "O que o painel mostra?",
    keywords: [
      "painel",
      "dashboard",
      "faturamento",
      "relatorio",
      "metricas",
      "receita",
    ],
    answer:
      "O painel mostra o faturamento, o número de agendamentos, pacientes e médicos no período escolhido, um gráfico dos últimos dias, os médicos e especialidades com mais agendamentos e as consultas de hoje. Mude o período no seletor de datas no topo.",
    links: [{ label: "Abrir painel", href: "/painel" }],
  },

  // Clínicas e marca
  {
    id: "clinicas",
    question: "Posso ter mais de uma clínica?",
    keywords: [
      "outra clinica",
      "mais de uma clinica",
      "nova clinica",
      "varias clinicas",
      "trocar de clinica",
      "mudar de clinica",
      "filial",
    ],
    answer: `Sim, conforme o plano (${clinicsPerPlan()}). No menu do rodapé, à esquerda, use "Nova clínica" para criar e clique no nome de uma clínica para trocar. Cada clínica tem seus próprios médicos, pacientes e agendamentos.`,
    links: [{ label: "Minhas clínicas", href: "/clinicas" }],
  },
  {
    id: "marca",
    question: "Como coloco o logo e a cor da minha clínica?",
    keywords: [
      "logo",
      "logotipo",
      "cor",
      "marca",
      "personalizar",
      "identidade visual",
      "white label",
    ],
    answer:
      "Em Configurações da clínica, envie o logo (PNG, JPG ou WebP) e escolha a cor principal. O logo e o nome da clínica passam a aparecer no menu, e os botões usam a cor escolhida.",
    links: [
      { label: "Configurações da clínica", href: "/configuracoes-da-clinica" },
    ],
  },
  {
    id: "tema",
    question: "Tem modo escuro?",
    keywords: [
      "modo escuro",
      "tema escuro",
      "dark mode",
      "tema",
      "claro",
      "escuro",
    ],
    answer:
      'Sim. No menu do rodapé, à esquerda, abra "Tema" e escolha Claro, Escuro ou Igual ao sistema.',
  },

  {
    id: "celular",
    question: "Funciona no celular?",
    keywords: [
      "celular",
      "smartphone",
      "iphone",
      "android",
      "tablet",
      "aplicativo",
      "app",
      "baixar o app",
    ],
    answer:
      "Sim. O Avelliq funciona no navegador do celular e do tablet, sem precisar instalar nada: acesse www.avelliq.com.br e entre com sua conta. No celular, o menu abre pelo botão no canto superior esquerdo e o calendário mostra um dia por vez.",
  },

  // Conta e acesso
  {
    id: "senha",
    question: "Esqueci minha senha",
    keywords: [
      "senha",
      "esqueci a senha",
      "esqueci minha senha",
      "trocar senha",
      "alterar senha",
      "redefinir senha",
      "recuperar senha",
      "criar senha",
      "nao consigo entrar",
      "login",
    ],
    answer:
      'Na tela de entrada, clique em "Esqueci minha senha" e informe seu e-mail: enviamos um link (válido por 1 hora) para criar uma nova senha. Já dentro do sistema, abra Minha conta (no menu do rodapé) para trocar a senha. Quem entra pelo Google também cria uma senha ali, para poder entrar com e-mail e senha.',
    links: [
      { label: "Esqueci minha senha", href: "/esqueci-senha" },
      { label: "Minha conta", href: "/minha-conta" },
    ],
    popular: true,
  },
  {
    id: "confirmar-email",
    question: "Não recebi o e-mail de confirmação",
    keywords: [
      "confirmar email",
      "confirmacao de email",
      "email de confirmacao",
      "nao recebi o email",
      "nao chegou",
      "verificar email",
    ],
    answer:
      "Confira a caixa de spam e as promoções, procurando por e-mails do Avelliq. Ao tentar entrar com uma conta ainda não confirmada, um novo link é enviado.",
  },
  {
    id: "google",
    question: "Posso entrar com a conta Google?",
    keywords: ["google", "gmail", "entrar com google", "login google"],
    answer:
      'Sim. Na tela de entrada, use "Entrar com Google". Se você já criou a conta com e-mail e senha usando o mesmo endereço, as duas formas levam à mesma conta.',
  },
  {
    id: "excluir-conta",
    question: "Como excluo minha conta ou baixo meus dados?",
    keywords: [
      "excluir conta",
      "apagar conta",
      "deletar conta",
      "encerrar conta",
      "baixar dados",
      "exportar dados",
      "copia dos dados",
      "meus dados",
    ],
    answer:
      "Em Minha conta você baixa uma cópia de todos os seus dados e das suas clínicas e pode excluir a conta. A exclusão apaga a conta e as clínicas que só você administra, com médicos, pacientes e agendamentos, e cancela a assinatura. Não dá para desfazer.",
    links: [{ label: "Minha conta", href: "/minha-conta" }],
  },
  {
    id: "seguranca",
    question: "Os dados dos meus pacientes estão seguros?",
    keywords: [
      "seguranca",
      "seguro",
      "lgpd",
      "privacidade",
      "dados dos pacientes",
      "onde ficam os dados",
      "sigilo",
    ],
    answer:
      "Sim. Os dados ficam armazenados no Brasil (São Paulo), com conexão criptografada, senhas guardadas como hash, separação entre clínicas e registro de auditoria das alterações. A clínica é a controladora dos dados dos pacientes, e o Avelliq os trata só para prestar o serviço, conforme a LGPD.",
    links: [{ label: "Política de Privacidade", href: "/privacidade" }],
  },
];

export const POPULAR_ANSWERS = SUPPORT_ANSWERS.filter(({ popular }) => popular);
