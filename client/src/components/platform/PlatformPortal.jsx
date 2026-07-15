import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
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
import { normalizarWhiteLabel } from "../branding/white-label-config.js";
import { rotaRestaurante } from "../../services/auth.js";
import {
  getPlatformSession,
  loginPlataforma,
  platformFetch,
  setPlatformSession,
} from "../../services/platform.js";
import "./PlatformPortal.css";

const PLANOS = {
  essencial: "Essencial",
  profissional: "Profissional",
  enterprise: "Enterprise",
};

const NOVO_RESTAURANTE = {
  nome: "",
  slug: "",
  plano: "essencial",
  limite_mesas: 20,
  mesas: 10,
  nome_master: "Master",
  login: "master",
  senha: "",
};

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
  const acesso = new URL(rotaRestaurante(dados.restaurante.slug), window.location.origin).toString();
  const texto = [
    `Restaurante: ${dados.restaurante.nome}`,
    `Acesso: ${acesso}`,
    `Usuário: ${dados.master.login}`,
    `Senha temporária: ${dados.senha_temporaria}`,
  ].join("\n");
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
  };

  return (
    <Modal titulo="Credencial do master" onClose={onClose} largura="560px">
      <div className="pf-credential-box">
        <div><span>Restaurante</span><strong>{dados.restaurante.nome}</strong></div>
        <div><span>Link</span><code>{acesso}</code></div>
        <div><span>Usuário</span><code>{dados.master.login}</code></div>
        <div><span>Senha temporária</span><code>{dados.senha_temporaria}</code></div>
      </div>
      <div className="pf-modal-actions">
        <button className="pf-button pf-button-secondary" type="button" onClick={copiar}>
          {copiado ? <Check size={17} /> : <Copy size={17} />}
          {copiado ? "Copiado" : "Copiar credencial"}
        </button>
        <a className="pf-button pf-button-primary" href={acesso} target="_blank" rel="noreferrer">
          <ExternalLink size={17} /> Abrir restaurante
        </a>
      </div>
    </Modal>
  );
}

function NovoRestaurante({ onClose, onCreated, request }) {
  const [form, setForm] = useState(NOVO_RESTAURANTE);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const alterar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const dados = await request("/api/platform/restaurantes", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          senha: form.senha || undefined,
          limite_mesas: Number(form.limite_mesas),
          mesas: Number(form.mesas),
        }),
      });
      onCreated(dados);
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal titulo="Cadastrar restaurante" onClose={onClose}>
      <form onSubmit={salvar}>
        <div className="pf-form-grid">
          <Campo label="Nome do restaurante" wide>
            <input required value={form.nome} onChange={(event) => alterar("nome", event.target.value)} />
          </Campo>
          <Campo label="Slug de acesso">
            <input value={form.slug} onChange={(event) => alterar("slug", event.target.value)} placeholder="gerado-pelo-nome" />
          </Campo>
          <Campo label="Plano">
            <select value={form.plano} onChange={(event) => alterar("plano", event.target.value)}>
              {Object.entries(PLANOS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Campo>
          <Campo label="Limite de mesas">
            <input type="number" min="1" max="500" required value={form.limite_mesas} onChange={(event) => alterar("limite_mesas", event.target.value)} />
          </Campo>
          <Campo label="Mesas iniciais">
            <input type="number" min="0" max={form.limite_mesas} required value={form.mesas} onChange={(event) => alterar("mesas", event.target.value)} />
          </Campo>
        </div>

        <div className="pf-form-section-title"><UsersRound size={16} /> Master do restaurante</div>
        <div className="pf-form-grid">
          <Campo label="Nome">
            <input required value={form.nome_master} onChange={(event) => alterar("nome_master", event.target.value)} />
          </Campo>
          <Campo label="Usuário">
            <input required value={form.login} onChange={(event) => alterar("login", event.target.value)} />
          </Campo>
          <Campo label="Senha temporária" wide>
            <input type="password" minLength={12} value={form.senha} onChange={(event) => alterar("senha", event.target.value)} placeholder="Gerada automaticamente" />
          </Campo>
        </div>

        <div className="pf-form-error" role="status">{erro}</div>
        <div className="pf-modal-actions">
          <button className="pf-button pf-button-secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="pf-button pf-button-primary" type="submit" disabled={salvando}>
            {salvando ? <LoaderCircle className="is-spinning" size={17} /> : <Plus size={17} />}
            Cadastrar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditarRestaurante({ restaurante, onClose, onSaved, request }) {
  const [form, setForm] = useState({
    nome: restaurante.nome,
    slug: restaurante.slug,
    plano: restaurante.plano,
    limite_mesas: restaurante.limite_mesas,
    ...normalizarWhiteLabel(restaurante),
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const alterar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const dados = await request(`/api/platform/restaurantes/${restaurante.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, limite_mesas: Number(form.limite_mesas) }),
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
          <Campo label="Plano">
            <select value={form.plano} onChange={(event) => alterar("plano", event.target.value)}>
              {Object.entries(PLANOS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Campo>
          <Campo label="Limite de mesas" wide>
            <input type="number" min={restaurante.mesas_cadastradas || 1} max="500" required value={form.limite_mesas} onChange={(event) => alterar("limite_mesas", event.target.value)} />
          </Campo>
        </div>

        <div className="pf-form-section-title"><Settings2 size={16} /> White label</div>
        <WhiteLabelFields value={form} onChange={setForm} />

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
                return (
                  <article className={`pf-restaurant-row ${arquivado ? "is-archived" : ""}`} key={restaurante.id}>
                    <div className="pf-restaurant-name">
                      <span className="pf-restaurant-mark">{restaurante.logo_url ? <img src={restaurante.logo_url} alt="" /> : <Building2 size={20} />}</span>
                      <div><strong>{restaurante.nome}</strong><small>ID {restaurante.id} · {restaurante.slug}</small></div>
                    </div>
                    <div><span className={`pf-plan is-${restaurante.plano}`}>{PLANOS[restaurante.plano] || restaurante.plano}</span></div>
                    <div className="pf-operation-data"><span><Table2 size={14} /> {restaurante.mesas_cadastradas}/{restaurante.limite_mesas}</span><span><UsersRound size={14} /> {restaurante.usuarios_ativos}</span><span className={`pf-status ${ativo ? "is-active" : arquivado ? "is-archived" : "is-paused"}`}>{ativo ? "Ativo" : arquivado ? "Arquivado" : "Suspenso"}</span></div>
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
