import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BadgeDollarSign,
  Building2,
  Check,
  CirclePause,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Table2,
  UsersRound,
  X,
} from "lucide-react";
import WhiteLabelFields from "../branding/WhiteLabelFields.jsx";
import {
  normalizarWhiteLabel,
  WHITE_LABEL_PADRAO,
} from "../branding/white-label-config.js";
import {
  normalizarSlugRestaurante,
  rotaRestaurante,
} from "../../services/auth.js";
import {
  getPlatformSession,
  loginPlataforma,
  platformFetch,
  setPlatformSession,
} from "../../services/platform.js";
import "./PlatformPortal.css";

const PLANOS_CATALOGO = {
  essencial: {
    nome: "Essencial",
    descricao: "Operacao enxuta para comecar com controle.",
    limite_mesas: 20,
    limite_usuarios: 5,
    limite_produtos: 120,
    mensalidade_centavos: 9900,
    recursos: ["Cardapio digital", "Pedidos em tempo real", "Relatorios basicos"],
  },
  profissional: {
    nome: "Profissional",
    descricao: "Mais equipe, cardapio completo e rotina intensa.",
    limite_mesas: 60,
    limite_usuarios: 15,
    limite_produtos: 400,
    mensalidade_centavos: 19900,
    recursos: ["White label", "Relatorios financeiros", "Gestao completa da equipe"],
  },
  enterprise: {
    nome: "Enterprise",
    descricao: "Operacoes maiores com limites personalizados.",
    limite_mesas: 500,
    limite_usuarios: 100,
    limite_produtos: 2000,
    mensalidade_centavos: 0,
    recursos: ["Limites ampliados", "Atendimento dedicado", "Personalizacao avancada"],
  },
};

const PLANOS = Object.fromEntries(
  Object.entries(PLANOS_CATALOGO).map(([id, plano]) => [id, plano.nome]),
);

const STATUS_COBRANCA = {
  trial: "Teste",
  ativo: "Ativo",
  pendente: "Pendente",
  atrasado: "Atrasado",
  isento: "Isento",
};

const CICLOS_COBRANCA = {
  mensal: "Mensal",
  anual: "Anual",
  experimental: "Experimental",
  personalizado: "Personalizado",
};

const formatarMoeda = (centavos = 0) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(centavos || 0) / 100);

const centavosParaCampo = (centavos = 0) => (Number(centavos || 0) / 100).toFixed(2);

const campoParaCentavos = (valor) => {
  const numero = Number(String(valor || "0").replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.round(numero * 100);
};

const dataParaCampo = (valor) => {
  if (!valor) return "";
  return String(valor).slice(0, 10);
};

function aplicarPlanoAoForm(planoId, atual = {}) {
  const plano = PLANOS_CATALOGO[planoId] || PLANOS_CATALOGO.essencial;
  const limiteMesas = Number(atual.limite_mesas || plano.limite_mesas);
  return {
    ...atual,
    plano: planoId,
    limite_mesas: plano.limite_mesas,
    limite_usuarios: plano.limite_usuarios,
    limite_produtos: plano.limite_produtos,
    mensalidade: centavosParaCampo(plano.mensalidade_centavos),
    mesas: Math.min(Number(atual.mesas || 10), limiteMesas, plano.limite_mesas),
  };
}

const NOVO_RESTAURANTE = {
  nome: "",
  slug: "",
  ...WHITE_LABEL_PADRAO,
  plano: "essencial",
  limite_mesas: 20,
  limite_usuarios: 5,
  limite_produtos: 120,
  mensalidade: "99.00",
  ciclo_cobranca: "mensal",
  status_cobranca: "trial",
  trial_termina_em: "",
  proxima_cobranca_em: "",
  observacoes_plano: "",
  mesas: 10,
  nome_master: "Master",
  login: "master",
  senha: "",
};

const ONBOARDING_STEPS = [
  { id: "identidade", label: "Identidade", icon: Building2 },
  { id: "plano", label: "Plano", icon: BadgeDollarSign },
  { id: "operacao", label: "Operacao", icon: Table2 },
  { id: "master", label: "Master", icon: UsersRound },
  { id: "marca", label: "Marca", icon: Settings2 },
];

const LOGO_INICIAL_MAX_MB = 3;
const LOGO_INICIAL_MAX_BYTES = LOGO_INICIAL_MAX_MB * 1024 * 1024;
const LOGO_INICIAL_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function linkAbsoluto(href) {
  return new URL(href, window.location.origin).toString();
}

function gerarLinksRestaurante(restaurante, mesaInicial = 1) {
  const slug = restaurante?.slug || "autenix";
  const links = [
    ["central", "Central de operacao", "Entrada principal da equipe", rotaRestaurante(slug, "central")],
    ["admin", "Administracao", "Cardapio, equipe, mesas e marca", rotaRestaurante(slug, "admin")],
    ["garcom", "Garcom", "Atendimento e comandas", rotaRestaurante(slug, "garcom")],
    ["cozinha", "Cozinha", "Painel de preparo", rotaRestaurante(slug, "cozinha")],
    ["financeiro", "Financeiro", "Fechamento e historico", rotaRestaurante(slug, "financeiro")],
    ["importacao", "Importacao inicial", "Admin com aba de importacao aberta", rotaRestaurante(slug, "admin?aba=importacao")],
  ];

  if (mesaInicial) {
    links.push([
      "cardapio",
      "Cardapio do cliente",
      `Mesa ${mesaInicial}`,
      rotaRestaurante(slug, `mesa/${mesaInicial}`),
    ]);
  }

  return links.map(([id, label, descricao, href]) => ({
    id,
    label,
    descricao,
    href: linkAbsoluto(href),
  }));
}

function numeroInteiro(valor, fallback = 0) {
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : fallback;
}

function Modal({ titulo, onClose, children, largura = "760px" }) {
  return (
    <div className="pf-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="pf-modal"
        style={{ maxWidth: largura }}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="pf-modal-header">
          <h2>{titulo}</h2>
          <button className="pf-icon-button" type="button" onClick={onClose} title="Fechar">
            <X size={19} />
          </button>
        </header>
        <div className="pf-modal-body">{children}</div>
      </section>
    </div>
  );
}

function Campo({ label, children, wide = false }) {
  return (
    <label className={`pf-field ${wide ? "is-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function PlanoCards({ value, onChange }) {
  return (
    <div className="pf-plan-options" role="radiogroup" aria-label="Plano contratado">
      {Object.entries(PLANOS_CATALOGO).map(([id, plano]) => (
        <button
          key={id}
          className={`pf-plan-option ${value === id ? "is-selected" : ""}`}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
        >
          <span>
            <strong>{plano.nome}</strong>
            <small>{formatarMoeda(plano.mensalidade_centavos)}</small>
          </span>
          <p>{plano.descricao}</p>
          <ul>
            <li>{plano.limite_mesas} mesas</li>
            <li>{plano.limite_usuarios} usuarios</li>
            <li>{plano.limite_produtos} produtos</li>
          </ul>
        </button>
      ))}
    </div>
  );
}

function PlanoResumo({ form }) {
  const plano = PLANOS_CATALOGO[form.plano] || PLANOS_CATALOGO.essencial;
  return (
    <aside className="pf-plan-summary" aria-label="Resumo do plano">
      <div>
        <span>Plano</span>
        <strong>{plano.nome}</strong>
      </div>
      <div>
        <span>Mensalidade</span>
        <strong>{formatarMoeda(campoParaCentavos(form.mensalidade))}</strong>
      </div>
      <div>
        <span>Limites</span>
        <strong>{form.limite_mesas} mesas / {form.limite_usuarios} usuarios / {form.limite_produtos} produtos</strong>
      </div>
    </aside>
  );
}

function PlatformLogin({ onLogin }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [status, setStatus] = useState("idle");
  const [erro, setErro] = useState("");

  const entrar = async (event) => {
    event.preventDefault();
    if (!login.trim() || !senha) return;
    setStatus("loading");
    setErro("");
    try {
      const session = await loginPlataforma(login.trim(), senha);
      onLogin(session);
    } catch (error) {
      setErro(error.message);
      setStatus("error");
    }
  };

  return (
    <main className="pf-login-page">
      <section className="pf-login-brand">
        <a href="/" aria-label="Autenix - início"><img src="/logoAutenix.png" alt="Autenix" /></a>
        <div>
          <span className="pf-kicker"><ShieldCheck size={15} /> Controle da plataforma</span>
          <h1>Gestão global do Autenix</h1>
          <p>Ambiente reservado à administração dos restaurantes clientes.</p>
        </div>
        <div className="pf-login-status"><span /> Acesso isolado dos restaurantes</div>
      </section>

      <section className="pf-login-panel">
        <form className="pf-login-form" onSubmit={entrar}>
          <span className="pf-kicker"><LockKeyhole size={15} /> Master da plataforma</span>
          <h2>Entrar na plataforma</h2>
          <p>Use sua credencial administrativa global.</p>

          <label htmlFor="platform-login">Usuário</label>
          <input
            id="platform-login"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
            autoFocus
          />

          <label htmlFor="platform-password">Senha</label>
          <div className="pf-password-field">
            <input
              id="platform-password"
              type={mostrarSenha ? "text" : "password"}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              autoComplete="current-password"
            />
            <button
              className="pf-icon-button"
              type="button"
              onClick={() => setMostrarSenha((atual) => !atual)}
              title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className={`pf-login-message ${erro ? "is-error" : ""}`} role="status">
            {erro}
          </div>
          <button
            className="pf-button pf-button-primary"
            type="submit"
            disabled={status === "loading" || !login.trim() || !senha}
          >
            {status === "loading" ? <LoaderCircle className="is-spinning" size={18} /> : <LockKeyhole size={17} />}
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}

function Credenciais({ dados, onClose }) {
  const mesaInicial = dados.onboarding?.mesa_inicial || 1;
  const acesso = linkAbsoluto(rotaRestaurante(dados.restaurante.slug));
  const links = gerarLinksRestaurante(dados.restaurante, mesaInicial);
  const texto = [
    `Restaurante: ${dados.restaurante.nome}`,
    `Acesso: ${acesso}`,
    `Usuario master: ${dados.master.login}`,
    `Senha temporaria: ${dados.senha_temporaria}`,
    "",
    "Links principais:",
    ...links.map((link) => `${link.label}: ${link.href}`),
  ].join("\n");
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
  };

  return (
    <Modal titulo="Onboarding concluido" onClose={onClose} largura="760px">
      <div className="pf-credential-box">
        <div><span>Restaurante</span><strong>{dados.restaurante.nome}</strong></div>
        <div><span>Link</span><code>{acesso}</code></div>
        <div><span>Usuario</span><code>{dados.master.login}</code></div>
        <div><span>Senha temporaria</span><code>{dados.senha_temporaria}</code></div>
      </div>
      {dados.aviso && <div className="pf-onboarding-warning" role="status">{dados.aviso}</div>}
      <div className="pf-onboarding-links">
        {links.map((link) => (
          <a key={link.id} href={link.href} target="_blank" rel="noreferrer">
            <strong>{link.label}</strong>
            <small>{link.descricao}</small>
            <ExternalLink size={15} />
          </a>
        ))}
      </div>
      <div className="pf-modal-actions">
        <button className="pf-button pf-button-secondary" type="button" onClick={copiar}>
          {copiado ? <Check size={17} /> : <Copy size={17} />}
          {copiado ? "Copiado" : "Copiar credenciais e links"}
        </button>
        <a
          className="pf-button pf-button-primary"
          href={links.find((link) => link.id === "central")?.href || acesso}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={17} /> Abrir central
        </a>
      </div>
    </Modal>
  );
}

function NovoRestaurante({ onClose, onCreated, request }) {
  const [form, setForm] = useState(() => ({ ...NOVO_RESTAURANTE }));
  const [etapa, setEtapa] = useState(0);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const etapaAtual = ONBOARDING_STEPS[etapa];
  const slugPreview = normalizarSlugRestaurante(form.slug || form.nome || "novo-restaurante");
  const mesasIniciais = numeroInteiro(Number(form.mesas), 0);
  const limiteMesas = numeroInteiro(Number(form.limite_mesas), 0);
  const marca = normalizarWhiteLabel(form);
  const EtapaIcon = etapaAtual.icon;
  const corPrimariaSegura = /^#[0-9a-f]{6}$/i.test(marca.cor_primaria)
    ? marca.cor_primaria
    : WHITE_LABEL_PADRAO.cor_primaria;
  const corDestaqueSegura = /^#[0-9a-f]{6}$/i.test(marca.cor_secundaria)
    ? marca.cor_secundaria
    : WHITE_LABEL_PADRAO.cor_secundaria;

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const alterar = (campo, valor) => {
    setErro("");
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };
  const alterarPlano = (plano) => {
    setErro("");
    setForm((atual) => aplicarPlanoAoForm(plano, atual));
  };

  const etapaValida = () => {
    if (etapaAtual.id === "identidade") return form.nome.trim().length >= 2 && slugPreview.length > 0;
    if (etapaAtual.id === "plano") {
      return Number(form.limite_mesas) >= 1
        && Number(form.limite_usuarios) >= 1
        && Number(form.limite_produtos) >= 1
        && campoParaCentavos(form.mensalidade) >= 0;
    }
    if (etapaAtual.id === "operacao") return mesasIniciais >= 0 && mesasIniciais <= limiteMesas;
    if (etapaAtual.id === "master") {
      return form.nome_master.trim().length >= 2
        && form.login.trim().length >= 3
        && (!form.senha || form.senha.length >= 12);
    }
    return /^#[0-9a-f]{6}$/i.test(marca.cor_primaria)
      && /^#[0-9a-f]{6}$/i.test(marca.cor_secundaria);
  };

  const avancar = () => {
    if (!etapaValida()) {
      setErro("Revise os campos desta etapa antes de continuar.");
      return;
    }
    setErro("");
    setEtapa((atual) => Math.min(atual + 1, ONBOARDING_STEPS.length - 1));
  };

  const selecionarLogo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!LOGO_INICIAL_MIMES.has(file.type)) {
      setErro("Use uma logo JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (file.size > LOGO_INICIAL_MAX_BYTES) {
      setErro(`Logo acima de ${LOGO_INICIAL_MAX_MB}MB.`);
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setForm((atual) => ({ ...atual, white_label_ativo: true, logo_url: "" }));
    setErro("");
  };

  const removerLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
  };

  const montarPayload = (extras = {}) => ({
    ...form,
    ...extras,
    slug: extras.slug ?? form.slug,
    senha: form.senha || undefined,
    limite_mesas: Number(form.limite_mesas),
    limite_usuarios: Number(form.limite_usuarios),
    limite_produtos: Number(form.limite_produtos),
    mensalidade_centavos: campoParaCentavos(form.mensalidade),
    mesas: Number(form.mesas),
  });

  const enviarLogoInicial = async (restauranteId) => {
    if (!logoFile) return null;
    const dadosLogo = new FormData();
    dadosLogo.append("imagem", logoFile);
    dadosLogo.append("tipo", "logo");
    dadosLogo.append("restaurante_id", String(restauranteId));
    return request("/api/platform/uploads/imagem", {
      method: "POST",
      body: dadosLogo,
    });
  };

  const salvar = async (event) => {
    event?.preventDefault?.();
    if (etapa < ONBOARDING_STEPS.length - 1) {
      avancar();
      return;
    }
    if (!etapaValida()) {
      setErro("Revise os campos desta etapa antes de cadastrar.");
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      let dados = await request("/api/platform/restaurantes", {
        method: "POST",
        body: JSON.stringify(montarPayload()),
      });

      let aviso = "";
      if (logoFile) {
        try {
          const logo = await enviarLogoInicial(dados.restaurante.id);
          const restauranteAtualizado = await request(`/api/platform/restaurantes/${dados.restaurante.id}`, {
            method: "PATCH",
            body: JSON.stringify(montarPayload({
              nome: dados.restaurante.nome,
              slug: dados.restaurante.slug,
              white_label_ativo: true,
              nome_exibicao: form.nome_exibicao || form.nome,
              logo_url: logo.url,
            })),
          });
          dados = { ...dados, restaurante: restauranteAtualizado };
        } catch (error) {
          aviso = `Restaurante criado, mas a logo inicial nao foi enviada: ${error.message}`;
        }
      }

      onCreated({
        ...dados,
        aviso,
        onboarding: { mesa_inicial: Number(form.mesas) > 0 ? 1 : null },
      });
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const renderEtapa = () => {
    if (etapaAtual.id === "identidade") {
      return (
        <div className="pf-form-grid">
          <Campo label="Nome do restaurante" wide>
            <input required value={form.nome} onChange={(event) => alterar("nome", event.target.value)} />
          </Campo>
          <Campo label="Slug de acesso">
            <input value={form.slug} onChange={(event) => alterar("slug", event.target.value)} placeholder="gerado-pelo-nome" />
          </Campo>
          <div className="pf-onboarding-preview is-wide">
            <span>URL principal</span>
            <code>{linkAbsoluto(rotaRestaurante(slugPreview))}</code>
          </div>
        </div>
      );
    }

    if (etapaAtual.id === "plano") {
      return (
        <>
          <PlanoCards value={form.plano} onChange={alterarPlano} />
          <PlanoResumo form={form} />
          <div className="pf-form-grid">
            <Campo label="Limite de mesas">
              <input type="number" min="1" max="500" required value={form.limite_mesas} onChange={(event) => alterar("limite_mesas", event.target.value)} />
            </Campo>
            <Campo label="Limite de usuarios">
              <input type="number" min="1" max="500" required value={form.limite_usuarios} onChange={(event) => alterar("limite_usuarios", event.target.value)} />
            </Campo>
            <Campo label="Limite de produtos">
              <input type="number" min="1" max="10000" required value={form.limite_produtos} onChange={(event) => alterar("limite_produtos", event.target.value)} />
            </Campo>
            <Campo label="Mensalidade (R$)">
              <input type="number" min="0" step="0.01" required value={form.mensalidade} onChange={(event) => alterar("mensalidade", event.target.value)} />
            </Campo>
            <Campo label="Status comercial">
              <select value={form.status_cobranca} onChange={(event) => alterar("status_cobranca", event.target.value)}>
                {Object.entries(STATUS_COBRANCA).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Campo>
            <Campo label="Ciclo">
              <select value={form.ciclo_cobranca} onChange={(event) => alterar("ciclo_cobranca", event.target.value)}>
                {Object.entries(CICLOS_COBRANCA).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Campo>
            <Campo label="Fim do teste">
              <input type="date" value={form.trial_termina_em} onChange={(event) => alterar("trial_termina_em", event.target.value)} />
            </Campo>
            <Campo label="Proxima cobranca">
              <input type="date" value={form.proxima_cobranca_em} onChange={(event) => alterar("proxima_cobranca_em", event.target.value)} />
            </Campo>
            <Campo label="Observacoes comerciais" wide>
              <textarea rows={3} maxLength={500} value={form.observacoes_plano} onChange={(event) => alterar("observacoes_plano", event.target.value)} />
            </Campo>
          </div>
        </>
      );
    }

    if (etapaAtual.id === "operacao") {
      return (
        <div className="pf-onboarding-split">
          <div className="pf-form-grid">
            <Campo label="Mesas iniciais" wide>
              <input type="number" min="0" max={form.limite_mesas} required value={form.mesas} onChange={(event) => alterar("mesas", event.target.value)} />
            </Campo>
          </div>
          <div className="pf-onboarding-checklist">
            <strong>Base criada automaticamente</strong>
            <span><Check size={15} /> Categorias iniciais do cardapio</span>
            <span><Check size={15} /> Mesas livres numeradas</span>
            <span><Check size={15} /> Link de cardapio por mesa</span>
            <span><Check size={15} /> Atalho para importacao CSV</span>
          </div>
        </div>
      );
    }

    if (etapaAtual.id === "master") {
      return (
        <div className="pf-form-grid">
          <Campo label="Nome do master">
            <input required value={form.nome_master} onChange={(event) => alterar("nome_master", event.target.value)} />
          </Campo>
          <Campo label="Usuario">
            <input required value={form.login} onChange={(event) => alterar("login", event.target.value)} />
          </Campo>
          <Campo label="Senha temporaria" wide>
            <input type="password" minLength={12} value={form.senha} onChange={(event) => alterar("senha", event.target.value)} placeholder="Gerada automaticamente" />
          </Campo>
          <div className="pf-onboarding-preview is-wide">
            <span>Acesso do master</span>
            <code>{form.login || "master"} / {form.senha ? "senha definida" : "senha gerada automaticamente"}</code>
          </div>
        </div>
      );
    }

    return (
      <div className="pf-brand-onboarding">
        <label className="pf-onboarding-toggle">
          <span>
            <strong>Ativar white label</strong>
            <small>Nome, cores e logo do cliente nas areas do restaurante.</small>
          </span>
          <input
            type="checkbox"
            checked={Boolean(form.white_label_ativo)}
            onChange={(event) => alterar("white_label_ativo", event.target.checked)}
          />
        </label>
        <div className="pf-form-grid">
          <Campo label="Nome exibido" wide>
            <input value={form.nome_exibicao} maxLength={80} onChange={(event) => alterar("nome_exibicao", event.target.value)} placeholder={form.nome || "Nome do restaurante"} />
          </Campo>
          <Campo label="Cor principal">
            <div className="pf-color-row">
              <input type="color" value={corPrimariaSegura} onChange={(event) => alterar("cor_primaria", event.target.value)} />
              <input value={form.cor_primaria} maxLength={7} onChange={(event) => alterar("cor_primaria", event.target.value)} />
            </div>
          </Campo>
          <Campo label="Cor de destaque">
            <div className="pf-color-row">
              <input type="color" value={corDestaqueSegura} onChange={(event) => alterar("cor_secundaria", event.target.value)} />
              <input value={form.cor_secundaria} maxLength={7} onChange={(event) => alterar("cor_secundaria", event.target.value)} />
            </div>
          </Campo>
        </div>
        <div className="pf-logo-picker">
          <div className="pf-logo-preview">
            {logoPreview ? <img src={logoPreview} alt="Previa da logo" /> : <Building2 size={26} />}
          </div>
          <div>
            <strong>Logo inicial</strong>
            <small>PNG, JPG, WEBP ou GIF ate {LOGO_INICIAL_MAX_MB}MB.</small>
            <div className="pf-logo-actions">
              <label className="pf-button pf-button-secondary">
                Selecionar logo
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selecionarLogo} />
              </label>
              {logoFile && (
                <button className="pf-icon-button" type="button" onClick={removerLogo} title="Remover logo">
                  <X size={17} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal titulo="Onboarding de restaurante" onClose={onClose} largura="960px">
      <div>
        <div className="pf-onboarding-progress">
          {ONBOARDING_STEPS.map((item, indice) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`${indice === etapa ? "is-active" : ""} ${indice < etapa ? "is-done" : ""}`}
                onClick={() => indice <= etapa && setEtapa(indice)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pf-onboarding-panel">
          <div className="pf-form-section-title">
            <EtapaIcon size={16} />
            {etapaAtual.label}
          </div>
          {renderEtapa()}
        </div>

        <div className="pf-form-error" role="status">{erro}</div>
        <div className="pf-modal-actions pf-onboarding-actions">
          <button className="pf-button pf-button-secondary" type="button" onClick={onClose}>Cancelar</button>
          <div>
            {etapa > 0 && (
              <button className="pf-button pf-button-secondary" type="button" onClick={() => setEtapa((atual) => atual - 1)}>
                Voltar
              </button>
            )}
            {etapa < ONBOARDING_STEPS.length - 1 ? (
              <button className="pf-button pf-button-primary" type="button" onClick={avancar} disabled={!etapaValida()}>
                Continuar
              </button>
            ) : (
              <button className="pf-button pf-button-primary" type="button" onClick={salvar} disabled={salvando || !etapaValida()}>
                {salvando ? <LoaderCircle className="is-spinning" size={17} /> : <Plus size={17} />}
                Criar restaurante
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EditarRestaurante({ restaurante, onClose, onSaved, request }) {
  const planoBase = PLANOS_CATALOGO[restaurante.plano] || PLANOS_CATALOGO.essencial;
  const [form, setForm] = useState({
    ...normalizarWhiteLabel(restaurante),
    nome: restaurante.nome || "",
    slug: restaurante.slug || "",
    plano: restaurante.plano || "essencial",
    limite_mesas: restaurante.limite_mesas ?? planoBase.limite_mesas,
    limite_usuarios: restaurante.limite_usuarios ?? planoBase.limite_usuarios,
    limite_produtos: restaurante.limite_produtos ?? planoBase.limite_produtos,
    mensalidade: centavosParaCampo(restaurante.mensalidade_centavos),
    ciclo_cobranca: restaurante.ciclo_cobranca || "mensal",
    status_cobranca: restaurante.status_cobranca || "trial",
    trial_termina_em: dataParaCampo(restaurante.trial_termina_em),
    proxima_cobranca_em: dataParaCampo(restaurante.proxima_cobranca_em),
    observacoes_plano: restaurante.observacoes_plano || "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const alterar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const alterarPlano = (plano) => setForm((atual) => aplicarPlanoAoForm(plano, atual));

  const salvar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const dados = await request(`/api/platform/restaurantes/${restaurante.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          limite_mesas: Number(form.limite_mesas),
          limite_usuarios: Number(form.limite_usuarios),
          limite_produtos: Number(form.limite_produtos),
          mensalidade_centavos: campoParaCentavos(form.mensalidade),
        }),
      });
      onSaved(dados);
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={`Editar ${restaurante.nome}`} onClose={onClose} largura="820px">
      <form onSubmit={salvar}>
        <div className="pf-form-grid">
          <Campo label="Nome" wide>
            <input required value={form.nome} onChange={(event) => alterar("nome", event.target.value)} />
          </Campo>
          <Campo label="Slug">
            <input required value={form.slug} onChange={(event) => alterar("slug", event.target.value)} />
          </Campo>
        </div>

        <div className="pf-form-section-title"><BadgeDollarSign size={16} /> Plano comercial</div>
        <PlanoCards value={form.plano} onChange={alterarPlano} />
        <PlanoResumo form={form} />

        <div className="pf-form-grid">
          <Campo label="Limite de mesas">
            <input type="number" min={restaurante.mesas_cadastradas || 1} max="500" required value={form.limite_mesas} onChange={(event) => alterar("limite_mesas", event.target.value)} />
          </Campo>
          <Campo label="Limite de usuarios">
            <input type="number" min={restaurante.usuarios_ativos || 1} max="500" required value={form.limite_usuarios} onChange={(event) => alterar("limite_usuarios", event.target.value)} />
          </Campo>
          <Campo label="Limite de produtos">
            <input type="number" min={restaurante.produtos_cadastrados || 1} max="10000" required value={form.limite_produtos} onChange={(event) => alterar("limite_produtos", event.target.value)} />
          </Campo>
          <Campo label="Mensalidade (R$)">
            <input type="number" min="0" step="0.01" required value={form.mensalidade} onChange={(event) => alterar("mensalidade", event.target.value)} />
          </Campo>
          <Campo label="Status comercial">
            <select value={form.status_cobranca} onChange={(event) => alterar("status_cobranca", event.target.value)}>
              {Object.entries(STATUS_COBRANCA).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Campo>
          <Campo label="Ciclo">
            <select value={form.ciclo_cobranca} onChange={(event) => alterar("ciclo_cobranca", event.target.value)}>
              {Object.entries(CICLOS_COBRANCA).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Campo>
          <Campo label="Fim do teste">
            <input type="date" value={form.trial_termina_em} onChange={(event) => alterar("trial_termina_em", event.target.value)} />
          </Campo>
          <Campo label="Proxima cobranca">
            <input type="date" value={form.proxima_cobranca_em} onChange={(event) => alterar("proxima_cobranca_em", event.target.value)} />
          </Campo>
          <Campo label="Observacoes comerciais" wide>
            <textarea rows={3} maxLength={500} value={form.observacoes_plano} onChange={(event) => alterar("observacoes_plano", event.target.value)} />
          </Campo>
        </div>

        <div className="pf-form-section-title"><Settings2 size={16} /> White label</div>
        <WhiteLabelFields
          value={form}
          onChange={setForm}
          uploadPath="/api/platform/uploads/imagem"
          uploadFields={{ tipo: "logo", restaurante_id: restaurante.id }}
          uploadHeaders={() => {
            const token = getPlatformSession()?.token;
            return token ? { Authorization: `Bearer ${token}` } : {};
          }}
        />

        <div className="pf-form-error" role="status">{erro}</div>
        <div className="pf-modal-actions">
          <button className="pf-button pf-button-secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="pf-button pf-button-primary" type="submit" disabled={salvando}>
            {salvando ? <LoaderCircle className="is-spinning" size={17} /> : <Check size={17} />}
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AlterarSenha({ onClose, request }) {
  const [form, setForm] = useState({ senha_atual: "", nova_senha: "", confirmar: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async (event) => {
    event.preventDefault();
    if (form.nova_senha !== form.confirmar) {
      setErro("As novas senhas não coincidem.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await request("/api/platform/minha-senha", {
        method: "PATCH",
        body: JSON.stringify({ senha_atual: form.senha_atual, nova_senha: form.nova_senha }),
      });
      onClose(true);
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal titulo="Alterar senha da plataforma" onClose={() => onClose(false)} largura="520px">
      <form onSubmit={salvar} className="pf-password-form">
        <Campo label="Senha atual"><input type="password" required value={form.senha_atual} onChange={(event) => setForm({ ...form, senha_atual: event.target.value })} /></Campo>
        <Campo label="Nova senha"><input type="password" required minLength={12} value={form.nova_senha} onChange={(event) => setForm({ ...form, nova_senha: event.target.value })} /></Campo>
        <Campo label="Confirmar nova senha"><input type="password" required minLength={12} value={form.confirmar} onChange={(event) => setForm({ ...form, confirmar: event.target.value })} /></Campo>
        <div className="pf-form-error" role="status">{erro}</div>
        <div className="pf-modal-actions">
          <button className="pf-button pf-button-secondary" type="button" onClick={() => onClose(false)}>Cancelar</button>
          <button className="pf-button pf-button-primary" type="submit" disabled={salvando}><KeyRound size={17} /> Atualizar senha</button>
        </div>
      </form>
    </Modal>
  );
}

function PlatformDashboard({ session, onLogout }) {
  const [restaurantes, setRestaurantes] = useState([]);
  const [status, setStatus] = useState("loading");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [modal, setModal] = useState(null);
  const [credenciais, setCredenciais] = useState(null);
  const [toast, setToast] = useState("");

  const request = useCallback(async (caminho, options = {}) => {
    const resposta = await platformFetch(caminho, options);
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.status === 401 || resposta.status === 403) {
      onLogout();
      throw new Error(dados.erro || "Sessão expirada.");
    }
    if (!resposta.ok) throw new Error(dados.erro || "Operação não concluída.");
    return dados;
  }, [onLogout]);

  const carregar = useCallback(async () => {
    setStatus("loading");
    try {
      const dados = await request("/api/platform/restaurantes");
      setRestaurantes(Array.isArray(dados) ? dados : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [request]);

  useEffect(() => {
    document.title = "Plataforma | Autenix";
    const timer = window.setTimeout(carregar, 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return restaurantes.filter((restaurante) => {
      const estado = restaurante.excluido_em
        ? "arquivados"
        : restaurante.ativo
          ? "ativos"
          : "suspensos";
      const correspondeFiltro = filtro === "todos" || filtro === estado;
      const correspondeBusca = !termo || [
        restaurante.nome,
        restaurante.slug,
        restaurante.master?.login,
        PLANOS[restaurante.plano],
        STATUS_COBRANCA[restaurante.status_cobranca],
        String(restaurante.id),
      ].some((valor) => String(valor || "").toLowerCase().includes(termo));
      return correspondeFiltro && correspondeBusca;
    });
  }, [busca, filtro, restaurantes]);

  const totais = useMemo(() => ({
    total: restaurantes.filter((item) => !item.excluido_em).length,
    ativos: restaurantes.filter((item) => item.ativo && !item.excluido_em).length,
    suspensos: restaurantes.filter((item) => !item.ativo && !item.excluido_em).length,
    mesas: restaurantes.reduce((soma, item) => soma + Number(item.mesas_cadastradas || 0), 0),
    receita: restaurantes.reduce((soma, item) => {
      if (!item.ativo || item.excluido_em || item.status_cobranca === "isento") return soma;
      return soma + Number(item.mensalidade_centavos || 0);
    }, 0),
  }), [restaurantes]);

  const atualizarItem = (item) => {
    setRestaurantes((atuais) => atuais.map((atual) => atual.id === item.id ? item : atual));
  };

  const alterarStatus = async (restaurante) => {
    try {
      const atualizado = await request(`/api/platform/restaurantes/${restaurante.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ ativo: !restaurante.ativo }),
      });
      atualizarItem(atualizado);
      setToast(atualizado.ativo ? "Restaurante ativado." : "Restaurante suspenso.");
    } catch (error) {
      setToast(error.message);
    }
  };

  const arquivar = async (restaurante) => {
    if (!window.confirm(`Arquivar ${restaurante.nome}? Os dados serão preservados.`)) return;
    try {
      await request(`/api/platform/restaurantes/${restaurante.id}`, { method: "DELETE" });
      await carregar();
      setToast("Restaurante arquivado.");
    } catch (error) {
      setToast(error.message);
    }
  };

  const redefinirMaster = async (restaurante) => {
    if (!window.confirm(`Gerar nova senha para o master de ${restaurante.nome}?`)) return;
    try {
      const dados = await request(`/api/platform/restaurantes/${restaurante.id}/redefinir-master`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setCredenciais({ restaurante, ...dados });
    } catch (error) {
      setToast(error.message);
    }
  };

  return (
    <div className="pf-page">
      <header className="pf-header">
        <a href="/" className="pf-brand" aria-label="Autenix"><img src="/logoAutenix.png" alt="Autenix" /></a>
        <div className="pf-header-actions">
          <span className="pf-user"><ShieldCheck size={16} /> {session.nome}</span>
          <button className="pf-header-button" type="button" onClick={() => setModal({ tipo: "senha" })} title="Alterar senha"><KeyRound size={18} /></button>
          <button className="pf-header-button" type="button" onClick={onLogout} title="Sair"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="pf-main">
        <div className="pf-page-heading">
          <div>
            <span className="pf-kicker"><Store size={15} /> Plataforma Autenix</span>
            <h1>Restaurantes</h1>
          </div>
          <button className="pf-button pf-button-primary" type="button" onClick={() => setModal({ tipo: "novo" })}>
            <Plus size={18} /> Novo restaurante
          </button>
        </div>

        <section className="pf-stats" aria-label="Resumo da plataforma">
          <article><Building2 size={19} /><span>Restaurantes</span><strong>{totais.total}</strong></article>
          <article className="is-green"><Check size={19} /><span>Ativos</span><strong>{totais.ativos}</strong></article>
          <article className="is-orange"><CirclePause size={19} /><span>Suspensos</span><strong>{totais.suspensos}</strong></article>
          <article className="is-blue"><Table2 size={19} /><span>Mesas</span><strong>{totais.mesas}</strong></article>
          <article className="is-teal"><BadgeDollarSign size={19} /><span>Receita prevista</span><strong>{formatarMoeda(totais.receita)}</strong></article>
        </section>

        <section className="pf-directory">
          <div className="pf-toolbar">
            <label className="pf-search"><Search size={18} /><span className="sr-only">Buscar restaurante</span><input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome, slug, ID ou master" /></label>
            <div className="pf-filters" role="tablist" aria-label="Filtrar restaurantes">
              {["todos", "ativos", "suspensos", "arquivados"].map((item) => (
                <button key={item} className={filtro === item ? "is-active" : ""} type="button" onClick={() => setFiltro(item)}>{item}</button>
              ))}
            </div>
            <button className="pf-icon-button" type="button" onClick={carregar} title="Atualizar"><RefreshCw size={18} /></button>
          </div>

          {status === "loading" && <div className="pf-state"><LoaderCircle className="is-spinning" /> Carregando restaurantes</div>}
          {status === "error" && <div className="pf-state is-error">Não foi possível carregar os restaurantes.</div>}
          {status === "ready" && (
            <div className="pf-list">
              <div className="pf-list-head"><span>Restaurante</span><span>Plano</span><span>Operação</span><span>Master</span><span>Ações</span></div>
              {visiveis.map((restaurante) => {
                const arquivado = Boolean(restaurante.excluido_em);
                const ativo = restaurante.ativo === 1 && !arquivado;
                const statusComercial = restaurante.status_cobranca || "trial";
                return (
                  <article className={`pf-restaurant-row ${arquivado ? "is-archived" : ""}`} key={restaurante.id}>
                    <div className="pf-restaurant-name">
                      <span className="pf-restaurant-mark">{restaurante.logo_url ? <img src={restaurante.logo_url} alt="" /> : <Building2 size={20} />}</span>
                      <div><strong>{restaurante.nome}</strong><small>ID {restaurante.id} / {restaurante.slug}</small></div>
                    </div>
                    <div className="pf-plan-cell">
                      <span className={`pf-plan is-${restaurante.plano}`}>{PLANOS[restaurante.plano] || restaurante.plano}</span>
                      <small>{formatarMoeda(restaurante.mensalidade_centavos)} / {CICLOS_COBRANCA[restaurante.ciclo_cobranca] || restaurante.ciclo_cobranca}</small>
                      <span className={`pf-billing is-${statusComercial}`}>{STATUS_COBRANCA[statusComercial] || statusComercial}</span>
                    </div>
                    <div className="pf-operation-data">
                      <span><Table2 size={14} /> {restaurante.mesas_cadastradas}/{restaurante.limite_mesas}</span>
                      <span><UsersRound size={14} /> {restaurante.usuarios_ativos}/{restaurante.limite_usuarios}</span>
                      <span><Package size={14} /> {restaurante.produtos_cadastrados || 0}/{restaurante.limite_produtos}</span>
                      <span className={`pf-status ${ativo ? "is-active" : arquivado ? "is-archived" : "is-paused"}`}>{ativo ? "Ativo" : arquivado ? "Arquivado" : "Suspenso"}</span>
                    </div>
                    <div className="pf-master"><strong>{restaurante.master?.nome || "Sem master"}</strong><small>{restaurante.master?.login || "-"}</small></div>
                    <div className="pf-row-actions">
                      <a className="pf-icon-button" href={rotaRestaurante(restaurante.slug)} target="_blank" rel="noreferrer" title="Abrir restaurante"><ExternalLink size={17} /></a>
                      <button className="pf-icon-button" type="button" onClick={() => setModal({ tipo: "editar", restaurante })} title="Editar"><Pencil size={17} /></button>
                      {!arquivado && <button className="pf-icon-button" type="button" onClick={() => redefinirMaster(restaurante)} title="Redefinir master"><KeyRound size={17} /></button>}
                      <button className="pf-icon-button" type="button" onClick={() => alterarStatus(restaurante)} title={ativo ? "Suspender" : "Ativar"}>{ativo ? <CirclePause size={17} /> : <Check size={17} />}</button>
                      {!arquivado && <button className="pf-icon-button is-danger" type="button" onClick={() => arquivar(restaurante)} title="Arquivar"><Archive size={17} /></button>}
                    </div>
                  </article>
                );
              })}
              {!visiveis.length && <div className="pf-state">Nenhum restaurante encontrado.</div>}
            </div>
          )}
        </section>
      </main>

      {modal?.tipo === "novo" && <NovoRestaurante request={request} onClose={() => setModal(null)} onCreated={(dados) => { setModal(null); setCredenciais(dados); carregar(); }} />}
      {modal?.tipo === "editar" && <EditarRestaurante restaurante={modal.restaurante} request={request} onClose={() => setModal(null)} onSaved={(dados) => { atualizarItem(dados); setModal(null); setToast("Restaurante atualizado."); }} />}
      {modal?.tipo === "senha" && <AlterarSenha request={request} onClose={(alterada) => { setModal(null); if (alterada) setToast("Senha da plataforma atualizada."); }} />}
      {credenciais && <Credenciais dados={credenciais} onClose={() => setCredenciais(null)} />}
      {toast && <div className="pf-toast" role="status">{toast}</div>}
    </div>
  );
}

export default function PlatformPortal() {
  const [session, setSession] = useState(() => getPlatformSession());

  useEffect(() => {
    document.title = "Plataforma | Autenix";
  }, []);

  const sair = useCallback(() => {
    setPlatformSession(null);
    setSession(null);
  }, []);

  return session
    ? <PlatformDashboard session={session} onLogout={sair} />
    : <PlatformLogin onLogin={setSession} />;
}
