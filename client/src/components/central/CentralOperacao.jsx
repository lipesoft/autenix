import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  Copy,
  ExternalLink,
  LoaderCircle,
  LogOut,
  QrCode,
  Search,
  Settings2,
  Share2,
  Table2,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { API_URL } from "../../services/api.js";
import { authFetch, rotaRestaurante } from "../../services/auth.js";
import { useBranding } from "../branding/branding-context.js";
import "./CentralOperacao.css";

const SETORES = [
  {
    id: "admin",
    titulo: "Administração",
    descricao: "Cardápio, mesas, equipe e relatórios",
    destino: "admin",
    icon: Settings2,
  },
  {
    id: "garcom",
    titulo: "Garçom",
    descricao: "Mesas, chamadas e atendimento",
    destino: "garcom",
    icon: ClipboardList,
  },
  {
    id: "cozinha",
    titulo: "Cozinha",
    descricao: "Fila e preparo dos pedidos",
    destino: "cozinha",
    icon: ChefHat,
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    descricao: "Comandas, pagamentos e histórico",
    destino: "financeiro",
    icon: WalletCards,
  },
  {
    id: "cliente",
    titulo: "Cliente / Cardápio",
    descricao: "Cardápio digital e pedidos da mesa",
    destino: "cliente",
    icon: QrCode,
  },
  {
    id: "reservas",
    titulo: "Reservas",
    descricao: "Agenda e solicitacoes de mesa",
    destino: "reservas",
    icon: CalendarCheck,
  },
];

function urlCompleta(caminho) {
  return new URL(caminho, window.location.origin).toString();
}

function rotuloMesa(numero) {
  const valor = String(numero || "").trim();
  return /^mesa\b/i.test(valor) ? valor : `Mesa ${valor}`;
}

async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  document.execCommand("copy");
  campo.remove();
}

function LinkActions({ caminho, titulo, onFeedback }) {
  const link = urlCompleta(caminho);

  const copiar = async () => {
    try {
      await copiarTexto(link);
      onFeedback("Link copiado.");
    } catch {
      onFeedback("Não foi possível copiar o link.", true);
    }
  };

  const compartilhar = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url: link });
        onFeedback("Link compartilhado.");
        return;
      }
      await copiar();
    } catch (error) {
      if (error?.name !== "AbortError") {
        onFeedback("Não foi possível compartilhar o link.", true);
      }
    }
  };

  return (
    <div className="central-link-actions">
      <a
        className="central-icon-button"
        href={caminho}
        title={`Abrir ${titulo}`}
        aria-label={`Abrir ${titulo}`}
      >
        <ExternalLink size={17} />
      </a>
      <button
        className="central-icon-button"
        type="button"
        onClick={copiar}
        title={`Copiar link de ${titulo}`}
        aria-label={`Copiar link de ${titulo}`}
      >
        <Copy size={17} />
      </button>
      <button
        className="central-icon-button"
        type="button"
        onClick={compartilhar}
        title={`Compartilhar ${titulo}`}
        aria-label={`Compartilhar ${titulo}`}
      >
        <Share2 size={17} />
      </button>
    </div>
  );
}

export default function CentralOperacao({ usuario, onLogout }) {
  const marca = useBranding();
  const slug = usuario.restaurante_slug || "autenix";
  const [restaurante, setRestaurante] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("loading");
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const chamadas = [authFetch(`${API_URL}/api/restaurante`)];
        if (usuario.role === "admin" || usuario.role === "garcom") {
          chamadas.push(authFetch(`${API_URL}/api/mesas`));
        }
        const respostas = await Promise.all(chamadas);
        if (respostas.some((resposta) => !resposta.ok)) {
          throw new Error("Falha ao carregar a central");
        }
        const dadosRestaurante = await respostas[0].json();
        const dadosMesas = respostas[1] ? await respostas[1].json() : [];
        if (!ativo) return;
        setRestaurante(dadosRestaurante);
        setMesas(Array.isArray(dadosMesas) ? dadosMesas : []);
        setStatus("ready");
      } catch {
        if (ativo) setStatus("error");
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, [usuario.role]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = window.setTimeout(() => setFeedback(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const setores = usuario.role === "admin"
    ? SETORES
    : SETORES.filter(
      (setor) =>
        setor.id === usuario.role ||
        (usuario.role === "garcom" && setor.id === "reservas"),
    );

  const mesasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return mesas;
    return mesas.filter((mesa) => String(mesa.numero).toLowerCase().includes(termo));
  }, [busca, mesas]);

  const mostrarFeedback = (mensagem, erro = false) => {
    setFeedback({ mensagem, erro });
  };

  const sair = () => {
    onLogout();
    window.location.assign(rotaRestaurante(slug));
  };

  const acessoRestaurante = rotaRestaurante(slug);
  const nomeRestaurante = restaurante?.nome || usuario.restaurante_nome || "Restaurante";

  return (
    <div
      className="central-page"
      style={{
        "--central-primary": marca.corPrimaria,
        "--central-accent": marca.corDestaque,
      }}
    >
      <header className="central-header">
        <a className="central-brand" href={acessoRestaurante} aria-label={marca.nome}>
          {marca.logoUrl ? (
            <img src={marca.logoUrl} alt={marca.nome} />
          ) : (
            <span className="central-brand-name">{marca.nome}</span>
          )}
        </a>
        <div className="central-header-actions">
          <span className="central-user">
            <UsersRound size={16} />
            {usuario.nome || usuario.login}
          </span>
          <button
            className="central-icon-button central-logout"
            type="button"
            onClick={sair}
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="central-main">
        <section className="central-intro">
          <div className="central-restaurant-mark">
            {marca.logoUrl ? (
              <img src={marca.logoUrl} alt="" />
            ) : (
              <Building2 size={25} />
            )}
          </div>
          <div>
            <span className="central-eyebrow">Central de operação</span>
            <h1>{nomeRestaurante}</h1>
            <div className="central-identity">
              <span>ID {usuario.restaurante_id}</span>
              <span>{slug}</span>
              <span className="is-online">Operação ativa</span>
            </div>
          </div>
        </section>

        <section className="central-section" aria-labelledby="central-setores-title">
          <div className="central-section-heading">
            <div>
              <span className="central-section-kicker">Equipe</span>
              <h2 id="central-setores-title">Áreas do restaurante</h2>
            </div>
            <div className="central-access-link">
              <span>Link de acesso</span>
              <code>{urlCompleta(acessoRestaurante)}</code>
              <LinkActions
                caminho={acessoRestaurante}
                titulo={`acesso de ${nomeRestaurante}`}
                onFeedback={mostrarFeedback}
              />
            </div>
          </div>

          <div className="central-sector-grid">
            {setores.map((setor) => {
              const Icon = setor.icon;
              const caminho = setor.id === "cliente"
                ? mesas[0]
                  ? rotaRestaurante(slug, `mesa/${mesas[0].id}`)
                  : `${rotaRestaurante(slug, "central")}#central-mesas-title`
                : rotaRestaurante(slug, setor.destino);
              return (
                <article className="central-sector" key={setor.id}>
                  <div className="central-sector-icon"><Icon size={22} /></div>
                  <div className="central-sector-copy">
                    <h3>{setor.titulo}</h3>
                    <p>{setor.descricao}</p>
                  </div>
                  <LinkActions
                    caminho={caminho}
                    titulo={setor.titulo}
                    onFeedback={mostrarFeedback}
                  />
                </article>
              );
            })}
          </div>
        </section>

        {(usuario.role === "admin" || usuario.role === "garcom") && (
          <section className="central-section" aria-labelledby="central-mesas-title">
            <div className="central-section-heading central-table-heading">
              <div>
                <span className="central-section-kicker">Atendimento</span>
                <h2 id="central-mesas-title">Links do cardápio por mesa</h2>
              </div>
              <label className="central-search">
                <Search size={17} />
                <span className="sr-only">Buscar mesa</span>
                <input
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar mesa"
                />
              </label>
            </div>

            {status === "loading" && (
              <div className="central-state"><LoaderCircle className="is-spinning" /> Carregando mesas</div>
            )}
            {status === "error" && (
              <div className="central-state is-error">Não foi possível carregar as mesas.</div>
            )}
            {status === "ready" && (
              <div className="central-table-list">
                {mesasFiltradas.map((mesa) => {
                  const caminho = rotaRestaurante(slug, `mesa/${mesa.id}`);
                  const nomeMesa = rotuloMesa(mesa.numero);
                  return (
                    <article className="central-table-row" key={mesa.id}>
                      <div className="central-table-icon"><Table2 size={20} /></div>
                      <div className="central-table-copy">
                        <h3>{nomeMesa}</h3>
                        <span className={`central-table-status is-${mesa.status || "livre"}`}>
                          {mesa.status || "livre"}
                        </span>
                      </div>
                      <code>{urlCompleta(caminho)}</code>
                      <LinkActions
                        caminho={caminho}
                        titulo={`cardápio da ${nomeMesa.toLowerCase()}`}
                        onFeedback={mostrarFeedback}
                      />
                    </article>
                  );
                })}
                {!mesasFiltradas.length && (
                  <div className="central-state"><QrCode size={20} /> Nenhuma mesa encontrada.</div>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {feedback && (
        <div className={`central-toast ${feedback.erro ? "is-error" : ""}`} role="status">
          {feedback.mensagem}
        </div>
      )}
    </div>
  );
}
