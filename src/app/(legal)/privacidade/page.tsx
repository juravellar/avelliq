import type { Metadata } from "next";
import Link from "next/link";

import {
  ContactEmail,
  legalCnpj,
  LegalDocument,
} from "../_components/legal-document";

export const metadata: Metadata = {
  title: "Política de Privacidade | Avelliq",
};

export default function PrivacyPolicyPage() {
  const cnpj = legalCnpj();
  return (
    <LegalDocument title="Política de Privacidade">
      <p>
        Esta política explica quais dados pessoais o Avelliq trata, para quê,
        com quem eles são compartilhados, por quanto tempo ficam guardados e
        como você exerce seus direitos, nos termos da Lei Geral de Proteção de
        Dados (Lei nº 13.709/2018, &quot;LGPD&quot;).
      </p>

      <h2>1. Quem é responsável por cada dado</h2>
      {cnpj && <p>O Avelliq está inscrito no CNPJ sob o nº {cnpj}.</p>}
      <ul>
        <li>
          <strong>Dados da sua conta</strong> (nome, email, senha, plano): o
          Avelliq é o <strong>controlador</strong>.
        </li>
        <li>
          <strong>Dados que a clínica cadastra</strong> (pacientes, médicos e
          agendamentos): a <strong>clínica</strong> é a controladora e o Avelliq
          é o <strong>operador</strong>, que trata esses dados somente para
          prestar o serviço e conforme as instruções da clínica. Pedidos de
          pacientes sobre os próprios dados devem ser feitos à clínica; o
          Avelliq apoia a clínica a atendê-los.
        </li>
      </ul>

      <h2>2. Dados que tratamos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> nome, email, senha (guardada apenas como hash,
          nunca em texto) e, se você entra com Google, a foto do perfil.
        </li>
        <li>
          <strong>Acesso:</strong> endereço IP e navegador de cada sessão,
          usados para manter você conectado e para segurança.
        </li>
        <li>
          <strong>Assinatura:</strong> plano, situação da assinatura e
          identificadores do cliente no Stripe. Os dados do cartão são
          informados diretamente ao Stripe e não passam pelo Avelliq.
        </li>
        <li>
          <strong>Clínica:</strong> nome, endereço e telefone e, se a clínica
          quiser, o logo e a cor usados no aplicativo.
        </li>
        <li>
          <strong>Médicos:</strong> nome, especialidade, dias e horários de
          atendimento e valor da consulta.
        </li>
        <li>
          <strong>Pacientes:</strong> nome, email, telefone e sexo e, se a
          clínica preencher, data de nascimento, CPF, endereço, convênio e
          número da carteirinha, contato de emergência e observações
          administrativas. O Avelliq não guarda informações clínicas
          (diagnósticos, exames, prescrições).
        </li>
        <li>
          <strong>Agendamentos:</strong> data, horário, médico, paciente e
          valor. Como revelam que uma pessoa buscou atendimento médico, são
          tratados como <strong>dados pessoais sensíveis</strong> (art. 5º, II,
          da LGPD).
        </li>
        <li>
          <strong>Registro de auditoria:</strong> quem criou, alterou ou excluiu
          cada cadastro e quando, guardando apenas identificadores, sem nomes ou
          contatos.
        </li>
      </ul>

      <h2>3. Para que usamos e com qual base legal</h2>
      <ul>
        <li>
          Criar e manter sua conta, prestar o serviço e cobrar a assinatura:
          execução de contrato (art. 7º, V).
        </li>
        <li>
          Manter registros de cobrança e de auditoria: cumprimento de obrigação
          legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI).
        </li>
        <li>
          Proteger a conta contra acessos indevidos: legítimo interesse (art.
          7º, IX) e garantia da prevenção à fraude e da segurança do titular
          (art. 11, II, g).
        </li>
        <li>
          Os dados de saúde dos pacientes são tratados pela clínica, com base
          legal definida por ela, normalmente a tutela da saúde (art. 11, II,
          f). O Avelliq não usa esses dados para nenhuma finalidade própria, não
          os vende e não os usa para publicidade.
        </li>
      </ul>

      <h2>4. Com quem compartilhamos</h2>
      <p>
        Usamos fornecedores que tratam dados em nosso nome, apenas para prestar
        o serviço:
      </p>
      <ul>
        <li>
          <strong>Vercel</strong> (hospedagem do aplicativo, executado na região
          de São Paulo);
        </li>
        <li>
          <strong>Neon</strong> (banco de dados, hospedado em São Paulo);
        </li>
        <li>
          <strong>Stripe</strong> (pagamentos): recebe nome e email do titular
          da conta;
        </li>
        <li>
          <strong>Google</strong>, se você escolher entrar com sua conta Google;
        </li>
        <li>
          <strong>Resend</strong> (envio de emails do sistema, como a
          confirmação de cadastro);
        </li>
        <li>
          <strong>ViaCEP</strong> (serviço público de consulta de endereço): ao
          preencher o cadastro de um paciente, recebe apenas o CEP digitado (e,
          como em qualquer acesso pela internet, o endereço IP de quem
          preenche), para completar rua, bairro, cidade e UF.
        </li>
      </ul>
      <p>
        Alguns desses fornecedores são sediados nos Estados Unidos, o que pode
        caracterizar transferência internacional de dados. Ela ocorre nas
        hipóteses do art. 33 da LGPD, com as garantias contratuais de proteção
        de dados oferecidas por esses fornecedores. Os dados de pacientes,
        médicos e agendamentos ficam armazenados no Brasil.
      </p>

      <h2>5. Por quanto tempo guardamos</h2>
      <ul>
        <li>
          Dados da conta e da clínica: enquanto a conta existir. Ao excluir a
          conta, eles são apagados imediatamente.
        </li>
        <li>
          Sessões de acesso (IP e navegador): apagadas automaticamente depois
          que expiram.
        </li>
        <li>
          Registros de cobrança no Stripe: pelo prazo exigido pela legislação
          fiscal, mesmo após a exclusão da conta.
        </li>
        <li>
          Registro de auditoria: até 5 anos, contendo apenas identificadores.
        </li>
        <li>
          Cópias de segurança do banco de dados: substituídas automaticamente
          dentro do período de retenção do provedor.
        </li>
      </ul>

      <h2>6. Seus direitos</h2>
      <p>
        Você pode, a qualquer momento (art. 18 da LGPD): confirmar se tratamos
        seus dados e acessá-los; corrigi-los; pedir a portabilidade; pedir a
        exclusão; saber com quem foram compartilhados; e revogar consentimentos.
      </p>
      <p>
        Em{" "}
        <Link href="/minha-conta" className="underline">
          Minha conta
        </Link>
        , você baixa uma cópia de todos os seus dados e exclui sua conta. Os
        cadastros de médicos, pacientes e da clínica podem ser corrigidos nas
        próprias telas. Para os demais pedidos, escreva para <ContactEmail />.
        Você também pode reclamar à Autoridade Nacional de Proteção de Dados
        (ANPD).
      </p>

      <h2>7. Segurança</h2>
      <p>
        Usamos conexões criptografadas (HTTPS), senhas guardadas como hash,
        separação dos dados de cada clínica, controle de acesso por conta,
        registro de auditoria das alterações e registros de erro sem dados
        pessoais. Em caso de incidente de segurança que possa causar risco ou
        dano relevante, comunicaremos os afetados e a ANPD, conforme o art. 48
        da LGPD.
      </p>

      <h2>8. Canal de comunicação</h2>
      <p>
        Como agente de tratamento de pequeno porte, o Avelliq não é obrigado a
        indicar um encarregado (Resolução CD/ANPD nº 2/2022, art. 11) e mantém
        este canal para os titulares: <ContactEmail />. Use-o para dúvidas sobre
        esta política ou para exercer seus direitos; os pedidos são respondidos
        em até 15 dias.
      </p>
      <p>
        Mensagens enviadas pelo botão de ajuda (opção &quot;Falar com a
        equipe&quot;) chegam por e-mail à nossa equipe, enviadas pelo Resend,
        com nome, e-mail, assunto e mensagem e, se você estiver logado, a
        clínica e o plano. Elas servem só para responder ao seu pedido. Não
        inclua dados de pacientes nessas mensagens.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Quando esta política mudar, a nova versão será publicada nesta página e
        você será avisado no aplicativo para aceitá-la.
      </p>
    </LegalDocument>
  );
}
