import { useEffect } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { useBranding } from "../branding/branding-context.js";
import {
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
} from "./privacy-consent.js";
import "./LegalPages.css";

const controlador = {
  nome: "Autenix",
  contato: "privacidade@autenix.com.br",
  comercial: "comercial@autenix.com.br",
};

function LegalShell({ eyebrow, title, subtitle, children, version }) {
  const marca = useBranding();

  useEffect(() => {
    document.title = `${title} - Autenix`;
  }, [title]);

  return (
    <main className="legal-page">
      <header className="legal-header">
        <a href="/" className="legal-back">
          <ArrowLeft size={17} /> Voltar
        </a>
        <img src="/logoAutenix.png" alt="Autenix" />
      </header>

      <section className="legal-hero">
        <span><ShieldCheck size={16} /> {eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <small>
          Versao {version} - aplicavel ao {marca.nome || "Autenix"}
        </small>
      </section>

      <section className="legal-content">
        {children}
      </section>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <article className="legal-section">
      <h2>{title}</h2>
      {children}
    </article>
  );
}

function BulletList({ items }) {
  return (
    <ul className="legal-list">
      {items.map((item) => (
        <li key={item}>
          <CheckCircle2 size={16} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalShell
      eyebrow="Privacidade e LGPD"
      title="Politica de Privacidade"
      subtitle="Como o Autenix trata dados pessoais em landing page, reservas, atendimento, painel de restaurante e plataforma SaaS."
      version={PRIVACY_POLICY_VERSION}
    >
      <Section title="1. Controlador dos dados">
        <p>
          O controlador da plataforma Autenix e {controlador.nome}. Restaurantes
          clientes podem atuar como controladores dos dados dos seus proprios
          clientes e colaboradores, enquanto o Autenix atua como operador quando
          processa esses dados para executar o sistema.
        </p>
        <p>
          Contato de privacidade: <a href={`mailto:${controlador.contato}`}>{controlador.contato}</a>.
        </p>
      </Section>

      <Section title="2. Dados coletados">
        <BulletList
          items={[
            "Dados de acesso: login, perfil, restaurante vinculado e eventos de autenticacao.",
            "Dados operacionais: mesas, pedidos, itens, pagamentos, reservas, fila, cozinha e financeiro.",
            "Dados de titulares: nome, telefone, e-mail opcional e observacoes informadas em reservas ou contato comercial.",
            "Dados tecnicos: IP pseudonimizado, user agent pseudonimizado, logs de seguranca, request_id e horarios.",
            "Dados comerciais: plano, limites contratados, status comercial, historico de alteracoes e white label.",
          ]}
        />
      </Section>

      <Section title="3. Finalidades">
        <BulletList
          items={[
            "Executar o fluxo do restaurante: cardapio, pedidos, cozinha, garcom, reservas, fila e fechamento.",
            "Autenticar usuarios e aplicar controle de acesso por perfil e restaurante.",
            "Registrar auditoria, diagnostico tecnico, seguranca e prevencao contra fraude.",
            "Atender solicitacoes comerciais e demonstracoes pedidas pelo titular.",
            "Cumprir obrigacoes legais e preservar historico operacional quando necessario.",
          ]}
        />
      </Section>

      <Section title="4. Base legal">
        <p>
          O tratamento pode ocorrer por execucao de contrato, legitimo interesse,
          cumprimento de obrigacao legal, exercicio regular de direitos e
          consentimento quando a coleta depender de aceite especifico, como
          preferencias de cookies opcionais e formularios publicos.
        </p>
      </Section>

      <Section title="5. Retencao">
        <p>
          Dados operacionais sao retidos enquanto houver contrato ativo com o
          restaurante e pelo prazo necessario para suporte, auditoria, obrigacoes
          legais e defesa de direitos. Logs tecnicos e consentimentos sao mantidos
          pelo periodo necessario para demonstrar seguranca e conformidade. Dados
          de marketing devem ser removidos quando o titular retirar consentimento.
        </p>
      </Section>

      <Section title="6. Compartilhamento">
        <p>
          O Autenix pode usar provedores de infraestrutura, hospedagem, banco de
          dados, armazenamento e notificacoes para executar o servico. Esses
          provedores devem tratar dados somente conforme instrucao operacional e
          medidas de seguranca aplicaveis.
        </p>
      </Section>

      <Section title="7. Cookies e tecnologias semelhantes">
        <p>
          Hoje o Autenix nao grava cookies proprios essenciais. A aplicacao usa
          armazenamento local do navegador para lembrar preferencias de
          privacidade e sessionStorage para sessoes temporarias de login. Scripts
          opcionais de estatistica ou marketing so podem ser carregados apos o
          consentimento correspondente.
        </p>
      </Section>

      <Section title="8. Seguranca">
        <BulletList
          items={[
            "Senhas nao sao expostas no frontend.",
            "Tokens ficam em sessionStorage para reduzir persistencia apos fechar a aba.",
            "Service role, DATABASE_URL e segredos permanecem somente no backend/infraestrutura.",
            "RLS, tenant-aware backend e auditoria reduzem risco de vazamento entre restaurantes.",
            "Logs nao devem registrar senha, token, header Authorization ou payload sensivel completo.",
          ]}
        />
      </Section>

      <Section title="9. Direitos do titular">
        <p>
          O titular pode solicitar confirmacao de tratamento, acesso, correcao,
          portabilidade, revisao, informacoes de compartilhamento, anonimizacao,
          bloqueio, exclusao e revogacao de consentimento quando aplicavel.
        </p>
        <p>
          Solicite pelo e-mail <a href={`mailto:${controlador.contato}`}>{controlador.contato}</a>.
        </p>
      </Section>

      <Section title="10. Pendencias juridicas">
        <p>
          Esta politica e uma primeira camada tecnica de conformidade. Antes de
          escala comercial ampla, recomenda-se revisao juridica, DPA com
          restaurantes clientes, politica de retencao formal e canal operacional
          para atendimento de titulares.
        </p>
      </Section>
    </LegalShell>
  );
}

export function TermsOfUsePage() {
  return (
    <LegalShell
      eyebrow="Condicoes comerciais"
      title="Termos de Uso"
      subtitle="Regras de uso do Autenix para restaurantes, equipe operacional, clientes finais e administradores da plataforma."
      version={TERMS_VERSION}
    >
      <Section title="1. Uso permitido">
        <p>
          O Autenix deve ser usado para gestao operacional de restaurantes:
          cardapio, pedidos, mesas, equipe, cozinha, reservas, fila, financeiro,
          relatorios, white label e administracao SaaS.
        </p>
      </Section>

      <Section title="2. Responsabilidades do restaurante">
        <BulletList
          items={[
            "Cadastrar dados verdadeiros e manter usuarios atualizados.",
            "Conceder acesso apenas a colaboradores autorizados.",
            "Usar senhas fortes e remover acessos quando alguem sair da equipe.",
            "Informar corretamente clientes sobre reservas, fila e atendimento.",
            "Respeitar leis fiscais, trabalhistas, consumeristas e de protecao de dados.",
          ]}
        />
      </Section>

      <Section title="3. Responsabilidades do Autenix">
        <BulletList
          items={[
            "Disponibilizar a plataforma conforme plano contratado e condicoes tecnicas.",
            "Aplicar controles razoaveis de seguranca, isolamento e auditoria.",
            "Manter logs e diagnosticos necessarios para suporte e investigacao.",
            "Comunicar incidentes relevantes conforme exigencias legais e contratuais.",
          ]}
        />
      </Section>

      <Section title="4. Planos, limites e cobranca">
        <p>
          Planos podem limitar restaurantes, mesas, usuarios, produtos,
          importacoes, reservas, relatorios e white label. O restaurante nao deve
          tentar burlar limites tecnicos ou manipular plano pelo frontend.
        </p>
      </Section>

      <Section title="5. Disponibilidade e suporte">
        <p>
          O Autenix busca disponibilidade continua, mas pode passar por janelas
          de manutencao, falhas de infraestrutura ou indisponibilidade de
          provedores externos. Rotinas de backup, restore, monitoramento e
          rollback devem seguir a documentacao operacional do projeto.
        </p>
      </Section>

      <Section title="6. Cancelamento, pausa e exclusao">
        <p>
          A plataforma pode pausar ou excluir logicamente restaurantes por
          inadimplencia, encerramento contratual, abuso, risco de seguranca ou
          decisao administrativa. A exclusao logica preserva historico operacional
          quando necessario para auditoria e obrigacoes legais.
        </p>
      </Section>

      <Section title="7. Propriedade intelectual">
        <p>
          Codigo, marca, layout, fluxos, documentacao e identidade do Autenix
          pertencem ao Autenix ou seus licenciadores. Logos, marcas e conteudos
          enviados pelos restaurantes continuam pertencendo aos respectivos
          titulares, com licenca de uso para operar o servico.
        </p>
      </Section>

      <Section title="8. Limitacoes">
        <p>
          O sistema nao substitui consultoria juridica, contabil ou fiscal. O
          restaurante continua responsavel pela correta emissao fiscal,
          precificacao, atendimento, entrega, relacao com clientes e cumprimento
          das leis aplicaveis ao seu negocio.
        </p>
      </Section>

      <Section title="9. Contato">
        <p>
          Duvidas comerciais ou contratuais: <a href={`mailto:${controlador.comercial}`}>{controlador.comercial}</a>.
        </p>
      </Section>
    </LegalShell>
  );
}
