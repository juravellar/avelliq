# LGPD no Avelliq

O Avelliq trata dados de saúde (agendamentos revelam que uma pessoa buscou atendimento médico), que a LGPD classifica como **dados pessoais sensíveis** (art. 5º, II). Este documento resume o que o sistema já faz e o que depende da empresa.

> Os textos da Política de Privacidade, dos Termos de Uso e os modelos desta pasta foram escritos como ponto de partida. **Revise com um advogado antes de considerá-los definitivos.**

## Papéis

| Dado | Controlador | Operador |
|---|---|---|
| Conta (nome, email, senha, plano) | Avelliq | — |
| Atendimentos do suporte (mensagens e protocolo) | Avelliq | — |
| Pacientes, médicos, agendamentos | Clínica | Avelliq |

## O que o sistema já faz

| Requisito | Onde |
|---|---|
| Transparência (arts. 6º, VI e 9º) | [`/privacidade`](../../src/app/(legal)/privacidade/page.tsx) e [`/termos`](../../src/app/(legal)/termos/page.tsx) |
| Registro do aceite, com versão | Cadastro por email exige o aceite, e o servidor recusa sem ele. Contas existentes aceitam ao entrar. Ao mudar os textos, aumente `TERMS_VERSION` em [`src/lib/terms.ts`](../../src/lib/terms.ts) para pedir o aceite de novo |
| Acesso e portabilidade (art. 18, II e V) | *Minha conta → Baixar meus dados* (JSON com conta, clínicas, médicos, pacientes, agendamentos e os atendimentos do suporte ligados ao e-mail da conta) |
| Correção (art. 18, III) | Telas de edição de clínica, médicos e pacientes |
| Eliminação (art. 18, VI) | *Minha conta → Excluir conta*: cancela a assinatura e apaga a conta, as clínicas que só ela administra e os atendimentos do suporte ligados ao e-mail da conta. Para quem não consegue entrar, a conta principal exclui pela tela Contas, depois de digitar o e-mail da conta, com o motivo "Pedido do titular" |
| Retenção e descarte (arts. 15 e 16) | Cron diário (`/api/cron/data-retention`) apaga sessões expiradas, registros de auditoria com mais de 5 anos e atendimentos do suporte 2 anos depois da última mensagem |
| Responsabilização (arts. 6º, X e 37) | Tabela `audit_logs`: quem criou, alterou ou excluiu cada cadastro, só com ids |
| Segurança (art. 46) | HTTPS e HSTS, senhas com hash, isolamento por clínica, cabeçalhos contra clickjacking, logs de erro sem dados pessoais, verificação de email (com Resend configurado) |
| Localização | Aplicação e banco em São Paulo (`gru1` e Neon `sa-east-1`) |

## O que depende da empresa

- [x] **Identificação:** as páginas mostram o CNPJ só se `LEGAL_CNPJ` estiver definido na Vercel. **Nenhum dado pessoal da responsável vai para o repositório, que é público.**
- [x] **Canal de comunicação:** como agente de pequeno porte, o Avelliq é dispensado de indicar encarregado (Resolução CD/ANPD nº 2/2022, art. 11). A política aponta para `SUPPORT_EMAIL`, que deve ser um e-mail do domínio, não pessoal. Reavaliar se o tratamento passar a ser de alto risco (por exemplo, grande volume de dados de saúde).
- [ ] **Contrato com as clínicas:** assinar o [acordo de tratamento de dados](acordo-de-tratamento-de-dados.md) ou incorporá-lo aos termos (art. 39).
- [ ] **Fornecedores:** guardar os DPAs de Vercel, Neon, Stripe, Google e Resend. O ViaCEP (consulta pública de CEP) recebe só o CEP digitado no cadastro de paciente, além do IP de quem preenche, e está listado na Política de Privacidade.
- [ ] **Incidentes:** adotar o [plano de resposta](plano-de-resposta-a-incidentes.md) e definir os responsáveis.
- [ ] **Backups:** confirmar no Neon o período de retenção do histórico e que ele fica na mesma região.
- [ ] **Registro das operações de tratamento (art. 37):** manter este documento atualizado.
- [ ] **Relatório de impacto (art. 38):** recomendado por haver dados sensíveis.

## Dados de pacientes

Além de nome, email, telefone e sexo, a clínica pode preencher data de nascimento, CPF (único por clínica), endereço, convênio, contato de emergência e observações administrativas. O Avelliq **não é prontuário**: o formulário e os Termos pedem que diagnósticos, exames e prescrições não sejam registrados. Guardar dados clínicos traria as exigências do CFM (prontuário eletrônico, guarda por 20 anos), que o sistema não atende hoje.

Ao mudar a lista de dados coletados, a Política de Privacidade muda junto, e `TERMS_VERSION` sobe para que todos aceitem de novo.

## Limites conhecidos

- **Limite de tentativas de login e de redefinição de senha:** o Better Auth limita (3 a cada 10 s no login, 3 por minuto na redefinição), mas guarda o contador na memória de cada instância da Vercel, então o limite real é aproximado. Guardar no banco (`rateLimit.storage: "database"`) exige uma tabela nova e uma escrita a cada requisição de autenticação; vale fazer quando houver tráfego que justifique.
- **Auditoria:** registra alterações, não leituras. Registrar cada visualização exigiria outra estrutura de logs.
- **Médico excluído:** os agendamentos dele são apagados junto. A exclusão fica na auditoria, mas o histórico de faturamento daquele médico se perde.
- **CSP:** não restringe scripts. Isso exigiria nonce por requisição e liberar o Stripe.js.
