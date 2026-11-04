# 🩺 Avelliq

![Avelliq: dashboard da clínica com faturamento, agendamentos, pacientes e médicos](public/tela.png)

Sistema de agendamento para clínicas médicas: cadastro de médicos com dias e horários de atendimento, pacientes, consultas com horários livres calculados automaticamente, e um dashboard de faturamento. Toda conta começa no plano Free, e os planos pagos são cobrados via Stripe.

🔗 **Aplicação online:** [www.avelliq.com.br](https://www.avelliq.com.br)

> 💳 **Os planos pagos usam o modo de testes do Stripe.** Use o cartão `4242 4242 4242 4242`, com qualquer data de validade futura, CVC e CEP. **Não use dados reais de cartão.**

> 🧪 **Vai testar o sistema?** Comece pelo [Guia de testes (QA)](#-guia-de-testes-qa): ele explica, sem precisar ler código, o que testar e o resultado esperado.

### Do bootcamp ao Avelliq

O projeto começou em junho de 2025 como o Doutor Agenda, no bootcamp "SaaS de Agendamentos para Clínicas" da Full Stack Club. Ficou parado por mais de um ano e, em outubro de 2026, foi retomado e virou o Avelliq. Ainda está em construção.

![Antes e depois: o Doutor Agenda de 2025, com uma tabela simples de agendamentos, e o Avelliq de 2026, com um calendário semanal e a marca da clínica. Dados fictícios.](public/avelliq-antes-depois.png)

---

## ✨ Funcionalidades

- **Autenticação** com e-mail e senha ou conta Google ([Better Auth](https://www.better-auth.com)), com recuperação de senha por e-mail. Em Minha conta dá para alterar a senha, e quem entrou pelo Google pode criar uma para também entrar com e-mail e senha. Se o login com Google falhar, a tela de login explica o motivo. O caso mais comum: já existe uma conta com o mesmo e-mail, criada com senha e sem o e-mail confirmado. O Better Auth não liga o Google a ela, porque quem criou a conta pode não ser o dono do endereço, e a pessoa precisa confirmar o e-mail entrando com a senha.
- **E-mails com a cara do Avelliq:** confirmação de e-mail, redefinição de senha, aviso de protocolo, respostas do Atendimento e avisos do formulário de ajuda saem com o mesmo layout (logo, cartão branco com a faixa azul, botão e rodapé), feito com tabelas e estilos inline para funcionar no Gmail e no Outlook. Todo e-mail tem também a versão em texto puro. O layout fica em [`src/lib/email.ts`](src/lib/email.ts).
- **Clínica:** cada usuário trabalha dentro da sua clínica, e os dados de uma clínica não são visíveis para outra.
- **Médicos:** especialidade, valor da consulta, dias da semana e horário de atendimento.
- **Pacientes:** cadastro e listagem. Além dos dados básicos, a clínica pode registrar data de nascimento, CPF, endereço (preenchido pelo CEP), convênio, contato de emergência e observações administrativas.
- **Agendamentos:** só oferece horários dentro do expediente do médico e que ainda não estejam ocupados.
- **Dashboard:** faturamento, número de consultas, médicos e especialidades mais procurados, e os agendamentos do dia.
- **Marca da clínica (white label):** em Configurações da clínica, cada clínica envia o próprio logo (PNG, JPG ou WebP, reduzido para 128 px e guardado no banco) e escolhe a cor principal. O menu passa a mostrar a marca da clínica e os botões usam a cor dela, com o texto em branco ou preto conforme o contraste.
- **Tema claro e escuro:** segue o tema do sistema ou a escolha feita no menu do rodapé (Tema).
- **Ajuda no app:** um botão "Ajuda" no canto da tela responde na hora às dúvidas mais comuns (planos, cadastros, agendamentos, conta), por palavras-chave, sem IA. Quando a resposta não resolve, "Falar com a equipe" abre um formulário que cria um atendimento e mostra o número do protocolo na hora. A pessoa recebe o protocolo por e-mail, e a equipe recebe um aviso por e-mail. As respostas prontas ficam em [`src/lib/support/answers.ts`](src/lib/support/answers.ts). Quem está logado, com o e-mail confirmado, vê em **Meus atendimentos**, dentro da Ajuda, os atendimentos do seu e-mail: o protocolo, o status, as respostas da equipe (assinadas como "Equipe Avelliq", sem dizer quem respondeu) e um campo para responder dali mesmo, no mesmo histórico dos e-mails. O botão Ajuda mostra quantos atendimentos têm resposta nova, e um atendimento finalizado oferece abrir outro já citando o protocolo. Sem o e-mail confirmado, a lista não aparece, porque os atendimentos são achados pelo endereço.
- **Atendimento (equipe do Avelliq):** em `/atendimento`, cada e-mail enviado ao `sac@` e cada mensagem do formulário de ajuda vira um atendimento, com protocolo (`AV-000123`) e o histórico da conversa.
  - **Protocolo:** quem escreve recebe o protocolo por e-mail, e todo e-mail do atendimento leva o protocolo no assunto. O aviso automático só vai para e-mails recentes, de remetentes que passaram na verificação DMARC e que não são respostas automáticas (fora do escritório, listas, avisos de erro), para não criar um ciclo de e-mails automáticos. Para e-mails importados, o aviso só sai em produção (`VERCEL_ENV=production`): abrir o Atendimento localmente ou num deploy de preview importa a mesma caixa para outro banco, e o cliente receberia um protocolo com outro número.
  - **Conversa:** quando o cliente responde, a mensagem entra no mesmo atendimento, achado pelo protocolo no assunto ou pelos cabeçalhos `In-Reply-To` e `References`. Só conta se o remetente (`From`, e não o `Reply-To`, que qualquer um preenche) for o e-mail do cliente e o e-mail não tiver falhado na verificação DMARC. Domínios sem política DMARC chegam como "gray" e são aceitos: copiar o protocolo ou falsificar o remetente não basta para escrever no atendimento de outra pessoa. Um e-mail falsificado abre um atendimento à parte, com um aviso no histórico. O trecho que o programa de e-mail do cliente citou fica recolhido no histórico.
  - **Status:** Recebido, Em análise, Concluído e Arquivado. A equipe muda o status e responde no mesmo formulário. Concluir ou arquivar exige uma mensagem, e o cliente recebe o aviso de que, se não concordar, deve abrir um novo atendimento informando o protocolo. Um atendimento finalizado não muda mais: se o cliente responder, a resposta abre um novo atendimento ligado ao anterior.
  - **Busca e filtros:** por protocolo (com ou sem `AV-`), nome, e-mail, assunto ou texto das mensagens, e por status, incluindo "Aguardando a equipe" (o cliente escreveu por último).
  - **Aviso do formulário:** o e-mail que avisa a equipe de uma mensagem do formulário volta para a caixa de entrada. Ele leva no cabeçalho `X-Avelliq-Protocol` o protocolo e uma assinatura feita com o `BETTER_AUTH_SECRET`, e por ela é ligado ao atendimento que o formulário já abriu, em vez de abrir outro. A assinatura não depende do DMARC, que chega como "gray" enquanto o domínio do Avelliq não publica uma política.
  - **Alerta para a equipe:** quem vê o Atendimento tem no cabeçalho, sempre visível, inclusive com o menu lateral fechado e no celular, um sino com o número de atendimentos aguardando a equipe (o cliente escreveu por último e o atendimento não foi finalizado). O sino leva ao filtro "Aguardando a equipe". O item Atendimento do menu mostra o mesmo número, e "Outros" ganha um ponto quando está recolhido. A contagem é atualizada a cada minuto com a aba aberta, e, a cada 2 minutos no máximo, os e-mails novos do Resend são importados em segundo plano, sem atrasar a página. Assim o alerta pega um e-mail novo mesmo que ninguém abra o Atendimento.
  - **Importação:** ao abrir `/atendimento`, o sistema traz do Resend os e-mails recebidos desde a última visita, até 10 por vez, com uma pausa entre eles (o Resend aceita cerca de 2 chamadas por segundo), e os guarda no banco. Um e-mail que não consegue ser importado fica para a próxima visita, sem segurar os mais novos. Textos com mais de 50.000 caracteres são cortados. Na primeira vez, importa também os e-mails antigos, aos poucos, sem enviar o aviso de protocolo para eles. Sem `RESEND_RECEIVING_API_KEY`, a tela mostra só os atendimentos do formulário.
  - **Quem vê:** só a equipe do Avelliq. As contas principais veem tudo o que chega ao domínio. Admin e Suporte veem e respondem só os atendimentos do formulário e os enviados ao `SUPPORT_EMAIL` ou ao `SUPPORT_INBOX`. QA vê, mas não responde nem muda o status.
  - **Anexos:** não são aceitos. Se o cliente mandar um, o histórico avisa, mas o arquivo não é guardado.
  - **Registro e prazo:** cada resposta e mudança de status fica no histórico com quem a fez e no registro de auditoria. Os atendimentos são apagados 2 anos depois da última mensagem, ou junto com a conta do cliente, e entram na exportação de dados dele.
  - **Por dentro:** tabelas `support_tickets` e `support_messages`. As regras ficam em [`src/lib/support/tickets-helpers.ts`](src/lib/support/tickets-helpers.ts) e o acesso ao banco em [`src/lib/support/tickets.ts`](src/lib/support/tickets.ts).
- **Contas e cargos da equipe:** em `/contas`, a lista de todas as contas do Avelliq com busca por nome ou e-mail, plano, clínicas e forma de entrar. Ali se escolhe o cargo de cada pessoa da equipe; só contas com e-mail confirmado entram na equipe, e cada mudança fica no registro de auditoria com quem a fez. Principal, Admin e Suporte não precisam de plano: usam o sistema sem limites e sem o fim do período gratuito. A tela Assinatura continua mostrando os planos, e quem quiser pode assinar.
  - **Principal** (`SUPPORT_ADMIN_EMAILS`): vê tudo e escolhe quem é Admin, Suporte e QA. Não aparece como cargo no banco e não pode ser tirada pela tela.
  - **Admin:** vê o Atendimento e a tela Contas, e escolhe quem é Suporte e QA. Não pode tornar ninguém Admin nem mudar outro Admin.
  - **Suporte:** vê e responde o Atendimento.
  - **QA:** testa o sistema. Vê todas as telas, inclusive o Atendimento e a tela Contas, mas não responde clientes nem muda cargos. Segue as regras de plano como um cliente e, em Assinatura, escolhe qual plano simular (Free, Essencial ou Profissional), sem pagar e sem mexer no Stripe. Para testar o pagamento, os botões de assinar das contas QA usam sempre o Stripe de teste (cartão 4242 4242 4242 4242), e a assinatura de teste vira o plano simulado, nunca um plano pago de verdade.
- **Planos** Free, Essencial e Profissional, com Stripe Checkout para assinar e o portal do cliente para trocar de plano ou cancelar.
- **LGPD:** Política de Privacidade e Termos de Uso com aceite registrado, exportação dos dados, exclusão da conta, registro de auditoria e limpeza automática de dados antigos. Detalhes e pendências em [`docs/lgpd`](docs/lgpd/README.md).
- **Sessão:** quem fica 12 horas sem usar o sistema precisa entrar de novo. Usar o sistema adia esse prazo, renovado no máximo uma vez por hora.

## 💼 Planos

| | Free | Essencial | Profissional |
|---|---|---|---|
| Cobrança | Grátis por 3 meses | Mensal ou anual | Mensal ou anual |
| Clínicas | 1 | 2 | Ilimitadas |
| Médicos (por clínica) | 1 | 5 | Ilimitados |
| Pacientes (por clínica) | 20 | 100 | Ilimitados |
| Agendamentos por mês (por clínica) | 40 | 200 | Ilimitados |

- **Limites:** os limites são verificados no servidor, ao cadastrar médicos, pacientes e agendamentos. Ficam em [`src/lib/plans.ts`](src/lib/plans.ts).
- **Visibilidade:** a página de assinatura mostra o uso de cada limite. Os botões de cadastro mostram o uso e, no limite, abrem um aviso explicando o motivo, com o caminho para o plano maior. Um aviso no topo das páginas informa cancelamento agendado, pagamento pendente e o fim do período gratuito.
- **Preços:** o valor exibido de cada plano pago vem do próprio Stripe, então é sempre o mesmo cobrado no checkout.
- **Plano anual:** opcional. Com os preços anuais configurados (`STRIPE_*_ANNUAL_PRICE_ID`), a página de assinatura ganha a escolha Mensal/Anual e mostra a economia em relação a 12 meses do mensal. Sem eles, só o mensal aparece.
- **No banco:** um usuário sem assinatura tem `plan` vazio e é tratado como Free.
- **Várias clínicas:** o seletor no rodapé do menu troca a clínica aberta; cada clínica tem seus próprios médicos, pacientes e agendamentos. Em **Minhas clínicas**, quem tem mais clínicas do que o plano permite (depois de um downgrade) escolhe quais continuam ativas; as outras ficam só leitura, sem perder dados. A primeira escolha é livre e, depois, vale uma alteração a cada 30 dias; para mais, o usuário fala com o suporte.
- **Fim do Free:** 3 meses depois da criação da clínica, a conta fica só leitura. Dá para ver os dados, mas cadastrar, editar e excluir exige um plano pago. Clínicas criadas antes dessa regra contam os 3 meses a partir de 15/10/2026. O prazo é controlado pelo app, não pelo Stripe.

## 🧪 Guia de testes (QA)

Esta seção é para quem testa o Avelliq pelo navegador, sem precisar ler código.

### Antes de começar

1. **Crie uma conta** em [www.avelliq.com.br](https://www.avelliq.com.br) e confirme o e-mail pelo link recebido.
2. **Peça o cargo de QA** a um Admin ou a uma conta principal. Eles dão o cargo na tela **Contas**. Só contas com e-mail confirmado podem receber cargo.
3. **Recarregue a página.** O cargo pode levar até 5 minutos para aparecer.

**O que QA pode fazer:**

- Ver todas as telas, inclusive **Atendimento** e **Contas**. QA não responde clientes nem muda cargos.
- Testar os planos como um cliente: em **Assinatura**, o cartão **Simular plano (conta QA)** escolhe Free, Essencial ou Profissional. O sistema passa a aplicar os limites, bloqueios e avisos desse plano. Nada é cobrado. Para voltar, escolha **Meu plano de verdade**.

**Regras para os testes:**

- **Dados fictícios:** use só nomes, e-mails, CPFs e telefones inventados. Nunca cadastre dados reais de pacientes.
- **Pagamento:** se testar o checkout do Stripe, use só o cartão de teste `4242 4242 4242 4242`.
- **Bugs:** ao reportar um bug, descreva o passo a passo, o resultado esperado e o resultado obtido, e anexe um print. Não coloque senhas nem dados pessoais no relato.

### Roteiro de testes

| Área | Como testar | Resultado esperado |
|---|---|---|
| Cadastro e e-mail | Crie uma conta com e-mail e senha | Chega um e-mail "Confirme seu email" com o botão **Confirmar meu email**. A conta só entra depois de confirmar |
| Esqueci minha senha | Em **Entrar**, use "Esqueci minha senha" | Chega um e-mail com o botão **Criar uma nova senha**. O link vale por 1 hora. Depois de trocar a senha, os outros aparelhos saem da conta |
| Login com Google | Entre com uma conta Google | Entra sem pedir senha. Em **Minha conta** dá para criar uma senha |
| Sessão | Fique 12 horas sem usar o sistema | Pede para entrar de novo |
| Médicos | Cadastre um médico com dias e horário de atendimento | Ele aparece na lista e nos agendamentos |
| Pacientes | Cadastre um paciente e preencha o CEP | O endereço é preenchido sozinho. Dois pacientes da mesma clínica não podem ter o mesmo CPF |
| Agendamentos | Crie uma consulta | Só aparecem horários dentro do expediente do médico e ainda livres. O mesmo horário do mesmo médico não pode ser marcado duas vezes |
| Calendário | Em **Agendamentos**, troque para **Calendário** | A semana mostra as consultas nos horários certos (horário de Brasília) |
| Dashboard | Abra o **Dashboard** | Faturamento, número de consultas e agendamentos do dia batem com o que foi cadastrado |
| Limites do plano | Simule o Free e cadastre mais de 1 médico, 20 pacientes ou 40 consultas no mês | No limite, o botão abre um aviso explicando o motivo e o caminho para o plano maior. Veja a tabela de [Planos](#-planos) |
| Várias clínicas | Simule o Essencial e crie 2 clínicas | O seletor no rodapé do menu troca de clínica, e os dados de uma clínica não aparecem na outra |
| Downgrade | Simule o Profissional, crie 3 clínicas e depois simule o Essencial | **Minhas clínicas** pede para escolher quais 2 continuam ativas. As outras ficam só leitura, sem perder dados |
| Marca da clínica | Em **Configurações da clínica**, envie um logo e escolha uma cor | O menu mostra o logo, e os botões usam a cor escolhida com o texto legível |
| Tema | No menu do rodapé, troque o tema | Claro e escuro funcionam em todas as telas |
| Ajuda | Clique em **Ajuda** e digite uma dúvida | Aparece uma resposta pronta. "Falar com a equipe" envia a mensagem e mostra o protocolo (`AV-000123`). Chega um e-mail com o protocolo, e a mensagem aparece no **Atendimento** |
| Atendimento: conversa | Responda o e-mail do protocolo pelo seu programa de e-mail e abra o **Atendimento** | A resposta aparece no histórico do mesmo protocolo, com a etiqueta "Nova mensagem" na lista |
| Ajuda: meus atendimentos | Logado com o e-mail de um atendimento já respondido, abra **Ajuda → Meus atendimentos** | O botão Ajuda mostra o número de respostas novas. A conversa mostra as respostas da "Equipe Avelliq", e ao abrir o aviso some. Uma resposta escrita ali aparece no **Atendimento** da equipe como "Nova mensagem" |
| Atendimento: alerta | Com uma conta da equipe, feche o menu lateral e mande um e-mail para o `sac@` (ou responda um atendimento) | Em até uns 3 minutos aparece o sino no cabeçalho com o número de atendimentos aguardando. No celular ele também aparece. Clicar leva ao filtro "Aguardando a equipe" |
| Atendimento: busca | Busque pelo protocolo, pelo seu e-mail ou por uma palavra da mensagem, e use os filtros de status | Só aparecem os atendimentos que combinam. QA vê tudo, mas não tem o formulário de resposta |
| Atendimento: conclusão | Com uma conta de Suporte, escolha **Concluído** sem escrever mensagem, depois com mensagem | Sem mensagem, o sistema recusa. Com mensagem, chega um e-mail com o protocolo e o aviso de como contestar, e o atendimento não pode mais ser alterado |
| Atendimento: contestação | Responda o e-mail de um atendimento concluído | Abre um novo atendimento, com novo protocolo, que mostra "Continua: Protocolo ..." |
| LGPD | Em **Minha conta**, use **Baixar meus dados** e **Excluir conta** | O download traz os dados da conta, incluindo os atendimentos do suporte. A exclusão apaga a conta e encerra a sessão |
| Celular | Repita os fluxos principais com a tela do celular | Nada fica cortado e não aparece rolagem para o lado |

**Fim do período gratuito:** o Free vira só leitura 3 meses depois da criação da clínica, e esse prazo não dá para adiantar pela tela. Para testar esse caso, peça a quem desenvolve para ajustar a data da clínica num banco de testes.

## 🚀 Tecnologias

| Área | Ferramentas |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions), React 19, TypeScript |
| Banco de dados | PostgreSQL, Drizzle ORM |
| Autenticação | Better Auth |
| Pagamentos | Stripe |
| Interface | Tailwind CSS, shadcn/ui (Radix UI), React Hook Form, Zod |
| Dados no cliente | next-safe-action, TanStack Query, nuqs |
| Datas | dayjs, date-fns |
| Testes | Vitest |
| Deploy | Vercel |

---

## 🧑‍💻 Rodando localmente

**Pré-requisitos:** Node.js 20+ e um banco PostgreSQL.

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o `.env.example` para `.env` e preencha as variáveis abaixo:

   ```bash
   cp .env.example .env
   ```

   | Variável | Para quê |
   |---|---|
   | `DATABASE_URL` | Conexão com o PostgreSQL |
   | `BETTER_AUTH_SECRET` | Chave usada para assinar as sessões (gere uma string aleatória longa) |
   | `BETTER_AUTH_URL` | URL base da aplicação, por exemplo `http://localhost:3000` |
   | `NEXT_PUBLIC_APP_URL` | URL pública da aplicação, usada nos redirecionamentos do Stripe e nos links dos e-mails (o logo dos e-mails vem sempre de www.avelliq.com.br) |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Login com Google |
   | `STRIPE_SECRET_KEY` | Chave secreta do Stripe que cobra os clientes: a de testes enquanto o sistema não cobra de verdade, depois a real. Contas QA nunca usam esta chave. O checkout abre na página hospedada pelo Stripe, sem Stripe.js no app, então a chave pública não é usada |
   | `STRIPE_ESSENTIAL_PLAN_PRICE_ID` | ID do preço mensal do plano Essencial no Stripe |
   | `STRIPE_PROFESSIONAL_PLAN_PRICE_ID` | ID do preço mensal do plano Profissional no Stripe |
   | `STRIPE_ESSENTIAL_ANNUAL_PRICE_ID`, `STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID` | IDs dos preços anuais (opcionais). Com eles, a página de assinatura mostra a opção Mensal/Anual com a economia calculada. Libere também os preços anuais em **Stripe → Customer portal → Products**, senão quem assina não consegue trocar de plano pelo portal |
   | `STRIPE_WEBHOOK_SECRET` | Segredo do webhook (veja a seção do Stripe abaixo) |
   | `NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL` | Link do portal do cliente do Stripe. No Stripe, configure o link de retorno do portal para `/assinatura` |
   | `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_WEBHOOK_SECRET` | Chave e segredo do webhook do Stripe **de teste**, usados só pelas contas QA (veja "Stripe de teste para contas QA"). Opcionais: sem eles, contas QA não conseguem assinar |
   | `STRIPE_TEST_ESSENTIAL_PLAN_PRICE_ID`, `STRIPE_TEST_PROFESSIONAL_PLAN_PRICE_ID` (e os `STRIPE_TEST_*_ANNUAL_PRICE_ID`, opcionais) | IDs dos preços no Stripe de teste, com os mesmos nomes dos de produção acrescidos de `TEST_` |
   | `NEXT_PUBLIC_STRIPE_TEST_CUSTOMER_PORTAL_URL` | Link do portal do cliente no Stripe de teste, para as contas QA |
   | `SUPPORT_EMAIL` | E-mail de suporte e canal de privacidade, mostrado na Política de Privacidade, nos Termos e a quem precisa alterar as clínicas ativas antes dos 30 dias. Use um e-mail do domínio, não um pessoal |
   | `SUPPORT_INBOX` | Caixa que recebe o aviso por e-mail de cada mensagem do "Falar com a equipe" (opcional; sem ela, vai para `SUPPORT_EMAIL`, o recomendado). Nunca aparece nas páginas. O atendimento em si sempre aparece na tela de Atendimento, mas um e-mail pessoal aqui faz quem responder pelo programa de e-mail mostrar esse endereço ao cliente, e essa resposta não entra no histórico. Exige `RESEND_API_KEY` e `EMAIL_FROM` |
   | `RESEND_RECEIVING_API_KEY` | Chave do Resend com permissão **Full access**, usada só pela tela de Atendimento para importar os e-mails recebidos (a chave de envio, `RESEND_API_KEY`, pode continuar só com envio). Opcional |
   | `SUPPORT_ADMIN_EMAILS` | E-mails (separados por vírgula) das contas principais do Avelliq: veem o Atendimento e a tela Contas, onde escolhem quem é Admin, Suporte e QA. A conta precisa ter o e-mail confirmado. Opcional |
   | `LEGAL_CNPJ` | CNPJ mostrado na Política de Privacidade e nos Termos (opcional). Fica fora do código porque o repositório é público |
   | `RESEND_API_KEY`, `EMAIL_FROM` | Envio de emails pelo [Resend](https://resend.com). Com as duas definidas, a conta só é liberada depois de confirmar o email e o "Esqueci minha senha" fica disponível (opcional) |
   | `CRON_SECRET` | Segredo da limpeza diária (Vercel Cron) de sessões expiradas e registros de auditoria com mais de 5 anos. Sem ele, a limpeza não roda |

3. Crie as tabelas no banco a partir do schema:

   ```bash
   npx drizzle-kit push
   ```

   Use `push`, não `migrate`: as primeiras migrações da pasta `drizzle/` são da versão original do projeto e não rodam em sequência num banco vazio.

4. Inicie o servidor de desenvolvimento e abra [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção. Na Vercel (produção), antes confere se o banco tem todas as colunas e índices do schema |
| `npm start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm test` | Testes com Vitest |
| `npm run test:integration` | Testes contra um PostgreSQL real (defina `INTEGRATION_DATABASE_URL` com um banco de teste) |
| `npx drizzle-kit studio` | Interface visual do banco |

### Stripe em ambiente local

Para receber os eventos de pagamento na sua máquina, use a [Stripe CLI](https://docs.stripe.com/stripe-cli):

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

O comando `stripe listen` mostra um segredo `whsec_...`. Coloque esse valor em `STRIPE_WEBHOOK_SECRET` no `.env`.

### Stripe de teste para contas QA

Clientes, contas principais, Admin e Suporte pagam pelo Stripe configurado em `STRIPE_SECRET_KEY`. Contas QA pagam sempre pelo Stripe **de teste**, mesmo depois que a produção passar a usar as chaves reais. Assim elas testam o checkout, o portal e as trocas de plano com cartões de teste, sem cobrança.

Para configurar, no painel do Stripe em **modo de teste**:

1. Copie a chave secreta (`sk_test_...`) para `STRIPE_TEST_SECRET_KEY`.
2. Crie os mesmos produtos e preços da produção e coloque os IDs em `STRIPE_TEST_*_PRICE_ID`.
3. Ative o portal do cliente, com o link de retorno para `/assinatura`, e coloque o link em `NEXT_PUBLIC_STRIPE_TEST_CUSTOMER_PORTAL_URL`.
4. Crie um webhook para o **mesmo** endereço da produção (`/api/stripe/webhook`), com os mesmos eventos (`customer.subscription.*` e `invoice.paid`), e coloque o segredo em `STRIPE_TEST_WEBHOOK_SECRET`.

Como funciona:

- **Webhook:** o endpoint confere a assinatura de cada evento com os dois segredos para saber de qual Stripe ele veio.
- **Só contas QA:** um evento do Stripe de teste só altera contas QA. Os de outras contas são ignorados, para que quem tenha a chave de teste não consiga liberar um plano pago para ninguém.
- **Nunca vira plano pago:** a assinatura de teste grava só o plano simulado da QA (`qa_plan`) e o cliente e a assinatura de teste, em colunas próprias (`stripe_test_customer_id`, `stripe_test_subscription_id`). Por isso uma conta que deixa de ser QA não fica com um plano pago de verdade.
- **Exclusão de conta:** cancela também as assinaturas de teste.
- **Mesma conta do Stripe nos dois papéis:** enquanto o Stripe de produção ainda for a área restrita (chaves `sk_test_`), as duas configurações podem apontar para a mesma conta. O checkout marca as assinaturas de QA (`stripeMode: test` nos metadados), e cada webhook só processa as suas. Mesmo assim, cada configuração precisa do seu próprio destino de webhook, com segredo próprio.

---

## 🧭 Rotas

As páginas usam endereços em português: `/painel`, `/agendamentos`, `/medicos`, `/pacientes`, `/assinatura`, `/clinicas`, `/configuracoes-da-clinica`, `/nova-clinica`, `/minha-conta`, `/atendimento`, `/contas`, `/entrar`, `/esqueci-senha` e `/redefinir-senha`. Os endereços antigos em inglês redirecionam permanentemente para os novos (veja `next.config.ts`). As rotas de API continuam em `/api/...`.

---

## 🗄️ Banco de produção

O banco de produção foi criado com `drizzle-kit push` e não tem o histórico do `drizzle-kit migrate`. Cada mudança de schema gera um arquivo novo em `drizzle/` (`npx drizzle-kit generate --name <nome>`), que é aplicado à mão, **antes do merge** do código que depende dele:

```bash
psql "$DATABASE_URL" -P pager=off -f drizzle/000X_nome.sql
```

Se a migração for esquecida, o deploy não chega a ir ao ar: no build de produção da Vercel, [`scripts/check-db-schema.mjs`](scripts/check-db-schema.mjs) compara as colunas e os índices do schema com os do banco e falha o build listando o que falta, e a versão anterior continua no ar. Para rodar a mesma verificação localmente: `CHECK_DB_SCHEMA=1 npm run build`.

Não cole a `DATABASE_URL` em chats, issues ou commits.

---

## 🕒 Fuso horário

A clínica opera no fuso `America/Sao_Paulo`, mas o servidor pode estar em qualquer fuso (na Vercel, é UTC). Por isso:

- O horário de atendimento dos médicos e a data das consultas são **gravados em UTC**.
- Tudo o que é exibido ou escolhido na interface está **no horário da clínica**.
- As conversões ficam todas em [`src/helpers/time.ts`](src/helpers/time.ts). Use essas funções em vez de converter datas diretamente com `dayjs()` ou `new Date()`, que dependem do fuso de quem executa o código.

---

## 📋 Próximos passos

- [ ] Autenticação em dois fatores
- [ ] Campo `status` nos agendamentos
- [ ] Manter o histórico de agendamentos ao excluir um médico (hoje são apagados junto)
- [ ] Content Security Policy para scripts, com nonce por requisição
