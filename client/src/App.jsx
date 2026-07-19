import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import {
  Copy,
  ExternalLink,
  History,
  LayoutGrid,
  LogOut,
  Mail,
  MessageCircle,
  Palette,
  Save,
} from "lucide-react";
import BrandingProvider from "./components/branding/BrandingProvider.jsx";
import {
  notificarMarcaAtualizada,
  useBranding,
} from "./components/branding/branding-context.js";
import WhiteLabelFields from "./components/branding/WhiteLabelFields.jsx";
import {
  normalizarWhiteLabel,
  WHITE_LABEL_PADRAO,
} from "./components/branding/white-label-config.js";
import CentralOperacao from "./components/central/CentralOperacao.jsx";
import ImportacaoDados from "./components/importacao/ImportacaoDados.jsx";
import LandingPage from "./components/landing/LandingPage.jsx";
import PlatformPortal from "./components/platform/PlatformPortal.jsx";
import ImageUploadField from "./components/upload/ImageUploadField.jsx";
import { API_URL as API } from "./services/api.js";
import {
  authFetch,
  authHeaders,
  getUsuarioSessao,
  loginUsuario,
  normalizarSlugRestaurante,
  rotaRestaurante,
} from "./services/auth.js";
import {
  chaveChamada,
  deveUsarSocketIo,
  pedidoProntoParaRetirada,
  SYNC_INTERVALS,
} from "./services/realtime.js";

const ROLE_DETAILS = {
  admin: {
    label: "Administração",
    hint: "Produtos, categorias, mesas, equipe e relatórios.",
  },
  garcom: {
    label: "Garçom",
    hint: "Mesas, chamadas, pedidos e fechamento de conta.",
  },
  cozinha: {
    label: "Cozinha",
    hint: "Kanban de preparo e pedidos em tempo real.",
  },
  financeiro: {
    label: "Financeiro",
    hint: "Comandas, pagamentos, histórico e exportação PDF.",
  },
};

const ADMIN_TABS = [
  "produtos",
  "categorias",
  "mesas",
  "reservas",
  "equipe",
  "relatorios",
  "marca",
  "importacao",
];

const DIAS_SEMANA_RESERVA = [
  [0, "Dom"],
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sab"],
];

const RESERVA_CONFIG_PADRAO = {
  ativo: 1,
  dias_semana: [0, 1, 2, 3, 4, 5, 6],
  hora_inicio: "18:00",
  hora_fim: "23:00",
  intervalo_minutos: 30,
  duracao_minutos: 90,
  antecedencia_minutos: 60,
  horizonte_dias: 30,
  limite_reservas_horario: 0,
  limite_pessoas_horario: 0,
  permitir_fila: 1,
};

let socket = null;
let socketIdentity = null;
const SOCKET_IO_ENABLED = deveUsarSocketIo({
  dev: import.meta.env.DEV,
  flag: import.meta.env.VITE_ENABLE_SOCKET_IO,
});
const noopSocket = {
  on: () => noopSocket,
  off: () => noopSocket,
  emit: () => false,
  disconnect: () => {},
};

function getSocket({ mesaId = null, restauranteSlug = null, sessaoMesa = null } = {}) {
  if (!SOCKET_IO_ENABLED) return noopSocket;
  const sessao = getUsuarioSessao();
  const token = sessao?.token || null;
  const contextoPublico = !token && mesaId && restauranteSlug && sessaoMesa
    ? { mesa_id: mesaId, restaurante_slug: restauranteSlug, sessao: sessaoMesa }
    : {};
  const identity = token
    ? `token:${token}`
    : `public:${restauranteSlug || "none"}:${mesaId || "none"}:${sessaoMesa || "none"}`;

  if (socket && socketIdentity !== identity) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socketIdentity = identity;
    socket = io(API, {
      auth: token ? { token } : contextoPublico,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

function useOperationalSync(callback, intervalMs, enabled = true) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;

    const executar = () => {
      if (document.visibilityState !== "hidden") {
        callbackRef.current?.();
      }
    };
    const intervalo = window.setInterval(executar, intervalMs);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") executar();
    };

    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [enabled, intervalMs]);
}

function apiComRestaurante(caminho, restauranteSlug) {
  const url = new URL(`${API}${caminho}`);
  url.searchParams.set("restaurante_slug", restauranteSlug || "autenix");
  return url.toString();
}

function apiComSessaoMesa(caminho, restauranteSlug, sessaoMesa) {
  const url = new URL(apiComRestaurante(caminho, restauranteSlug));
  if (sessaoMesa) url.searchParams.set("sessao", sessaoMesa);
  return url.toString();
}

// ─── IDENTIDADE VISUAL ────────────────────────────────────────────────────────
// Base compartilhada com a landing page e cores de marca aplicadas por tenant.

let T = {
  // Backgrounds
  bg: "#f4f6f7",
  bg2: "#ffffff",
  card: "#ffffff",
  card2: "#f7f8f6",
  // Bordas
  border: "#dde3ea",
  border2: "#c8d0da",
  // Textos
  text: "var(--app-text, #132331)",
  text2: "var(--app-text-secondary, #4f6070)",
  muted: "color-mix(in srgb, var(--app-text-secondary, #4f6070) 72%, transparent)",
  heading: "var(--app-heading, #0b2134)",
  onPrimary: "var(--app-on-primary, #ffffff)",
  // Cores da logo
  accent: "var(--app-accent, #f2742d)",
  accent2: "var(--app-accent-dark, #c9511c)",
  navy: "var(--app-primary, #0b2134)",
  // Status
  green: "#218c72",
  red: "#b84234",
  blue: "#327ca4",
  amber: "#b66a18",
  // Efeitos
  accentGlow: "color-mix(in srgb, var(--app-accent, #f2742d) 12%, transparent)",
  navyGlow: "rgba(11,33,52,0.08)",
  shadow: "rgba(6,19,31,0.10)",
  inputBg: "#f8f9f8",
};

// ─── SOM ─────────────────────────────────────────────────────────────────────
function playBeep(freq = 880, dur = 0.18, vol = 0.4) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch {
    // Alguns navegadores bloqueiam audio sem interacao previa do usuario.
  }
}
function playNotifSound(type = "chamada") {
  if (type === "chamada") {
    playBeep(880, 0.15, 0.4);
    setTimeout(() => playBeep(1100, 0.2, 0.4), 180);
  } else if (type === "conta") {
    playBeep(700, 0.12, 0.35);
    setTimeout(() => playBeep(900, 0.12, 0.35), 160);
    setTimeout(() => playBeep(700, 0.2, 0.35), 320);
  } else if (type === "pronto") {
    playBeep(660, 0.12, 0.3);
    setTimeout(() => playBeep(880, 0.12, 0.3), 140);
    setTimeout(() => playBeep(1100, 0.2, 0.35), 280);
  }
}

// ─── NOTIF BANNER ────────────────────────────────────────────────────────────
function NotifBanner({ notifs, onDismiss }) {
  const cores = { chamada: T.accent, conta: T.amber, pronto: T.green };
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "calc(100% - 32px)",
        maxWidth: 460,
        pointerEvents: "none",
      }}
    >
      {notifs.map((n) => (
        <div
          key={n.id}
          className="notif-in"
          style={{
            background: cores[n.type] || T.accent,
            color: T.onPrimary,
            borderRadius: 8,
            padding: "13px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            boxShadow: "0 8px 32px rgba(0,0,0,.55)",
            pointerEvents: "all",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{n.titulo}</div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.85,
                marginTop: 3,
                lineHeight: 1.4,
              }}
            >
              {n.corpo}
            </div>
          </div>
          <button
            onClick={() => onDismiss(n.id)}
            style={{
              background: "rgba(0,0,0,.18)",
              border: "none",
              borderRadius: 8,
              color: T.onPrimary,
              cursor: "pointer",
              padding: "3px 10px",
              fontWeight: 700,
              fontSize: 13,
              marginLeft: 14,
              flexShrink: 0,
            }}
          >
            X
          </button>
        </div>
      ))}
    </div>
  );
}

function useNotifs() {
  const [notifs, setNotifs] = useState([]);
  const push = useCallback((titulo, corpo, type = "chamada") => {
    playNotifSound(type);
    const id = Date.now() + Math.random();
    setNotifs((prev) => [...prev, { id, titulo, corpo, type }]);
    setTimeout(
      () => setNotifs((prev) => prev.filter((n) => n.id !== id)),
      7000,
    );
  }, []);
  const dismiss = useCallback(
    (id) => setNotifs((prev) => prev.filter((n) => n.id !== id)),
    [],
  );
  return { notifs, push, dismiss };
}

// ─── CSS GLOBAL (reativo ao tema) ────────────────────────────────────────────
function gerarCSS(t = T) {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-text-size-adjust: 100%; }
  body { background: ${t.bg}; color: ${t.text}; font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.5; min-height: 100vh; overflow-x: hidden; }
  .autenix-brand-scope { color: ${t.text}; }
  .autenix-brand-scope h1,
  .autenix-brand-scope h2,
  .autenix-brand-scope h3,
  .autenix-brand-scope h4 { color: ${t.heading}; }
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${t.border2}; border-radius: 2px; }
  .scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .scroll-x::-webkit-scrollbar { display: none; }
  .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
  .badge-pendente   { background: rgba(200,113,74,.15);  color: ${t.accent};  border: 1px solid rgba(200,113,74,.3); }
  .badge-preparo    { background: rgba(91,155,213,.12);  color: ${t.blue};    border: 1px solid rgba(91,155,213,.3); }
  .badge-pronto     { background: rgba(76,175,130,.12);  color: ${t.green};   border: 1px solid rgba(76,175,130,.3); }
  .badge-finalizado { background: rgba(122,112,106,.12); color: ${t.muted};   border: 1px solid rgba(122,112,106,.3); }
  .badge-entregue   { background: rgba(91,155,213,.12);  color: ${t.blue};    border: 1px solid rgba(91,155,213,.3); }
  .badge-cancelado  { background: rgba(224,92,92,.1);    color: ${t.red};     border: 1px solid rgba(224,92,92,.25); }
  .badge-confirmada { background: rgba(46,139,87,.10);   color: ${t.green};   border: 1px solid rgba(46,139,87,.28); }
  .badge-fila       { background: rgba(231,143,64,.12);  color: ${t.amber};   border: 1px solid rgba(231,143,64,.3); }
  .badge-chamada    { background: rgba(91,155,213,.12);  color: ${t.blue};    border: 1px solid rgba(91,155,213,.3); }
  .badge-cancelada  { background: rgba(224,92,92,.1);    color: ${t.red};     border: 1px solid rgba(224,92,92,.25); }
  .badge-concluida  { background: rgba(91,155,213,.12);  color: ${t.blue};    border: 1px solid rgba(91,155,213,.3); }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes ring    { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-15deg)} 40%{transform:rotate(15deg)} 60%{transform:rotate(-8deg)} 80%{transform:rotate(8deg)} }
  @keyframes notifIn { 0%{opacity:0;transform:translateX(-50%) translateY(-16px) scale(.96)} 100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
  @keyframes floatUp { 0%{opacity:0;transform:translateY(14px)} 100%{opacity:1;transform:translateY(0)} }
  .fade-up  { animation: fadeUp .3s ease both; }
  .fade-in  { animation: fadeIn .25s ease both; }
  .pulse    { animation: pulse 1.8s infinite; }
  .ring     { animation: ring .6s ease; }
  .float-up { animation: floatUp .4s cubic-bezier(.175,.885,.32,1.275) both; }
  .notif-in { animation: notifIn .35s cubic-bezier(.175,.885,.32,1.275) both; }
  .drag-over { outline: 2px dashed ${t.accent} !important; background: ${t.accentGlow} !important; }
  .app-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.03); }
  .app-btn:focus-visible { outline: 3px solid ${t.accentGlow}; outline-offset: 2px; }
  .app-card { box-shadow: 0 5px 16px rgba(6,19,31,.045); }
  input, select, textarea {
    background: ${t.inputBg}; border: 1px solid ${t.border2};
    border-radius: 7px; color: ${t.text}; font-family: 'Inter',sans-serif;
    font-size: 14px; padding: 10px 14px; width: 100%; outline: none; transition: border-color .2s;
    box-shadow: inset 0 1px 3px rgba(16,31,47,0.06);
  }
  input:focus, select:focus, textarea:focus { border-color: ${t.accent}; }
  input::placeholder, textarea::placeholder { color: ${t.muted}; }
  select option { background: ${t.card2}; color: ${t.text}; }
  a { color: inherit; }
  .panel-header {
    background: ${t.bg2};
    border-bottom: 1px solid ${t.border};
    border-top: 3px solid ${t.accent};
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }
  .panel-header-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .panel-header-copy { min-width: 0; }
  .panel-header-title { font-family: 'Manrope', sans-serif; font-weight: 800; font-size: 15px; color: ${t.text}; line-height: 1.2; }
  .panel-header-subtitle { color: ${t.muted}; font-size: 12px; margin-top: 2px; }
  .panel-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  .panel-user-pill {
    border: 1px solid ${t.border};
    background: ${t.card};
    color: ${t.text2};
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 600;
    max-width: 220px;
  }
  /* ─── RESPONSIVIDADE ─── */
  button { -webkit-tap-highlight-color: transparent; }

  @media (max-width: 640px) {
    .panel-header { align-items: flex-start; }
    .panel-header-actions { justify-content: flex-start; width: 100%; }
    .panel-user-pill { max-width: 100%; }
  }

  /* Cliente — mobile first */
  @media (max-width: 380px) {
    .cliente-grid { grid-template-columns: 1fr !important; }
    .cliente-filtros button { padding: 5px 10px !important; font-size: 11px !important; }
  }

  /* Garçom — mobile */
  @media (max-width: 480px) {
    .garcom-mesas { grid-template-columns: 1fr 1fr !important; }
    .garcom-mesas .mesa-num { font-size: 20px !important; }
  }

  /* Cozinha — tablet */
  @media (max-width: 900px) {
    .cozinha-col { font-size: 12px; }
    .cozinha-col-header { font-size: 11px !important; padding: 8px !important; }
    .cozinha-col .col-action-btn { font-size: 10px !important; padding: 4px 7px !important; }
  }
  @media (max-width: 600px) {
    .cozinha-col { min-width: 100px !important; }
  }

  /* Admin — notebook */
  .admin-tabs { display: flex; overflow-x: auto; white-space: nowrap; scrollbar-width: none; }
  .admin-tabs::-webkit-scrollbar { display: none; }
  .admin-tabs button { min-width: 80px; }
  .admin-content { width: 100%; max-width: 860px; margin: 0 auto; padding: 14px; }
  .admin-user-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .admin-user-copy { min-width: 0; }
  .admin-user-actions { display: flex; flex-shrink: 0; gap: 6px; }
  .admin-report-periods { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .admin-report-filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; align-items: end; gap: 10px; margin-top: 12px; }
  .admin-report-date { min-width: 0; display: grid; gap: 5px; }
  .admin-report-date span { color: ${t.muted}; font-size: 11px; font-weight: 700; }
  .admin-report-date input { width: 100%; min-width: 0; }
  .admin-report-actions { display: flex; align-items: center; gap: 8px; }
  .admin-report-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .admin-report-copy { min-width: 0; }
  .admin-report-value { flex-shrink: 0; text-align: right; }
  .public-reserva-layout { display: grid; grid-template-columns: minmax(0, .95fr) minmax(320px, 1.05fr); gap: 18px; }
  .public-reserva-highlights { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 28px; }
  .admin-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .admin-form-grid .is-full { grid-column: 1 / -1; }
  .admin-reserva-row { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(150px, .55fr) auto; gap: 14px; align-items: center; }
  .admin-reserva-copy { min-width: 0; }
  .admin-reserva-meta { color: ${t.muted}; font-size: 12px; margin-top: 4px; }
  .admin-reserva-actions { display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
  @media (max-width: 768px) {
    .admin-tabs button { font-size: 12px !important; min-width: 64px; }
    .admin-produto-acoes { flex-direction: column !important; }
    .public-reserva-layout { grid-template-columns: 1fr; }
    .admin-report-filters { grid-template-columns: 1fr 1fr; }
    .admin-report-actions { grid-column: 1 / -1; }
    .admin-reserva-row { grid-template-columns: 1fr; align-items: stretch; }
    .admin-reserva-actions { justify-content: flex-start; }
  }
  @media (max-width: 560px) {
    .admin-content { padding: 12px; }
    .public-reserva-highlights { grid-template-columns: 1fr; }
    .admin-form-grid { grid-template-columns: 1fr; }
    .admin-form-grid .is-full { grid-column: auto; }
    .admin-user-row { align-items: stretch; flex-direction: column; }
    .admin-user-actions { width: 100%; }
    .admin-user-actions .app-btn { flex: 1; }
    .admin-reserva-actions { display: grid; grid-template-columns: 1fr; width: 100%; }
    .admin-reserva-actions .app-btn { width: 100%; }
    .admin-report-periods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .admin-report-periods button { width: 100%; }
    .admin-report-filters { grid-template-columns: 1fr; }
    .admin-report-actions { grid-column: auto; display: grid; grid-template-columns: 1fr; width: 100%; }
    .admin-report-actions .app-btn { width: 100%; }
    .admin-report-row { align-items: flex-start; flex-direction: column; gap: 10px; }
    .admin-report-value { width: 100%; padding-top: 9px; border-top: 1px solid ${t.border}; text-align: left; }
  }

  /* Financeiro — qualquer tela */
  @media (max-width: 700px) {
    .fin-resumo { grid-template-columns: 1fr 1fr !important; }
    .fin-mesas  { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 480px) {
    .fin-resumo { grid-template-columns: 1fr !important; }
    .fin-filtros-datas { flex-direction: column !important; }
    .fin-filtros-datas input { width: 100% !important; }
  }

  /* Scroll horizontal */
  .scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .scroll-x::-webkit-scrollbar { display: none; }

  /* Texto truncado */
  .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  @media print {
    body { background: white !important; color: black !important; }
    .no-print { display: none !important; }
  }
`;
}
// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────
function Btn({
  children,
  onClick,
  variant = "primary",
  sm,
  disabled,
  style,
  full,
  type,
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 8,
    fontFamily: "'Inter',sans-serif",
    fontWeight: 600,
    transition: "all .18s",
    opacity: disabled ? 0.45 : 1,
    whiteSpace: "nowrap",
    padding: sm ? "5px 13px" : "11px 20px",
    fontSize: sm ? 12 : 14,
    width: full ? "100%" : undefined,
  };
  const v = {
    primary: {
      background: T.accent,
      color: T.onPrimary,
      boxShadow: "0 5px 14px rgba(242,116,45,0.18)",
    },
    navy: { background: T.navy, color: T.onPrimary },
    ghost: {
      background: "transparent",
      color: T.text2,
      border: `1px solid ${T.border2}`,
    },
    danger: {
      background: "rgba(192,57,43,.08)",
      color: T.red,
      border: "1px solid rgba(192,57,43,.3)",
    },
    success: {
      background: "rgba(46,139,87,.08)",
      color: T.green,
      border: "1px solid rgba(46,139,87,.3)",
    },
    info: {
      background: "rgba(36,113,163,.08)",
      color: T.blue,
      border: "1px solid rgba(36,113,163,.3)",
    },
    amber: {
      background: "rgba(183,119,13,.08)",
      color: T.amber,
      border: "1px solid rgba(183,119,13,.3)",
    },
  };
  return (
    <button
      type={type}
      className={`app-btn app-btn-${variant}`}
      style={{ ...base, ...v[variant], ...style }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Card({
  children,
  style,
  className,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
}) {
  return (
    <div
      className={["app-card", className].filter(Boolean).join(" ")}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: 16,
        transition: "background .3s, border-color .3s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ status }) {
  const l = {
    pendente: "Pendente",
    preparo: "Preparando",
    pronto: "Pronto",
    finalizado: "Finalizado",
    entregue: "Entregue",
    confirmada: "Confirmada",
    fila: "Na fila",
    chamada: "Chamado",
    cancelada: "Cancelada",
    concluida: "Concluida",
  };
  return <span className={`badge badge-${status}`}>{l[status] || status}</span>;
}

function Modal({ children, onClose }) {
  return (
    <div
      className="fade-in"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,.78)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.card,
          border: `1px solid ${T.border2}`,
          borderRadius: 8,
          padding: 24,
          width: "100%",
          maxWidth: 420,
          maxHeight: "92vh",
          overflowY: "auto",
          transition: "background .3s",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Logo({ size = "md", center = false }) {
  const marca = useBranding();
  const logo = marca.logoUrl;
  const h = size === "lg" ? 140 : size === "sm" ? 28 : 36;
  const fs = size === "lg" ? 26 : size === "sm" ? 15 : 19;
  if (logo)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: center ? "center" : "flex-start",
          gap: 8,
        }}
      >
        <img
          src={logo}
          alt={marca.nome}
          style={{ height: h, objectFit: "contain", display: "block" }}
        />
      </div>
    );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <span
        style={{
          fontFamily: "'Manrope',sans-serif",
          fontWeight: 800,
          fontSize: fs,
          color: T.heading,
        }}
      >
        {marca.nome}
      </span>
    </div>
  );
}

function roleLabel(role) {
  return ROLE_DETAILS[role]?.label || role || "Equipe";
}

function rotuloMesa(numero) {
  const valor = String(numero || "").trim();
  return /^mesa\b/i.test(valor) ? valor : `Mesa ${valor}`;
}

function PanelHeader({ title, subtitle, usuario, onLogout, actions }) {
  return (
    <div className="panel-header">
      <div className="panel-header-main">
        <Logo />
        <div className="panel-header-copy">
          <div className="panel-header-title">{title}</div>
          {subtitle && <div className="panel-header-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="panel-header-actions">
        {actions}
        {usuario && (
          <span className="panel-user-pill truncate">
            {usuario.nome || usuario.login || roleLabel(usuario.role)} -{" "}
            {roleLabel(usuario.role)}
          </span>
        )}
        <a
          href={rotaRestaurante(usuario?.restaurante_slug || "autenix", "central")}
          style={{
            textDecoration: "none",
            border: `1px solid ${T.border2}`,
            borderRadius: 8,
            padding: "5px 13px",
            fontSize: 12,
            fontWeight: 700,
            color: T.text2,
            background: T.card,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <LayoutGrid size={14} /> Central
          </span>
        </a>
        {onLogout && (
          <Btn sm variant="ghost" onClick={onLogout}>
            <LogOut size={14} /> Sair
          </Btn>
        )}
      </div>
    </div>
  );
}

// Formata forma de pagamento
const formataPag = (v) =>
  ({
    credito: "Cartão de Crédito",
    debito: "Cartão de Débito",
    dinheiro: "Dinheiro",
    pix: "PIX",
  })[v] || v;

const EMOJIS = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

// ─── TELA LOGIN ───────────────────────────────────────────────────────────────
function TelaLoginSenha({ titulo, subtitulo, onLogin, senhaCorreta }) {
  const css = gerarCSS(T);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);
  const tentar = () => {
    if (senha === senhaCorreta) onLogin();
    else {
      setErro(true);
      setSenha("");
      setTimeout(() => setErro(false), 1500);
    }
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: T.bg,
        padding: 24,
      }}
    >
      <style>{css}</style>
      <Logo size="lg" center />
      <div
        style={{
          marginTop: 40,
          width: "100%",
          maxWidth: 360,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          padding: 32,
          boxShadow: "0 4px 24px rgba(16,31,47,0.10)",
        }}
      >
        <div
          style={{
            fontFamily: "'Manrope',sans-serif",
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          {titulo}
        </div>
        {subtitulo && (
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 22 }}>
            {subtitulo}
          </div>
        )}
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tentar()}
          style={{
            marginBottom: 10,
            marginTop: 18,
            borderColor: erro ? T.red : undefined,
          }}
          autoFocus
        />
        {erro && (
          <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>
            Senha incorreta.
          </div>
        )}
        <Btn full onClick={tentar}>
          Entrar
        </Btn>
      </div>
    </div>
  );
}

// Login com usuário e senha (garçom, financeiro, cozinha)
function TelaLogin({ titulo, role, onLogin, restauranteSlug = "autenix" }) {
  const css = gerarCSS(T);
  const [loginVal, setLoginVal] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const info = ROLE_DETAILS[role] || { label: titulo, hint: "Acesso interno" };

  const tentar = async () => {
    if (!loginVal.trim() || !senha.trim()) {
      setErro("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    setErro("");
    try {
      const d = await loginUsuario(loginVal.trim(), senha.trim(), restauranteSlug);
      if (role && d.role !== role && d.role !== "admin") {
        setErro("Você não tem permissão para este painel.");
        return;
      }
      onLogin(d);
    } catch (error) {
      setErro(error.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(180deg,${T.bg2} 0%,${T.bg} 44%)`,
        padding: 20,
      }}
    >
      <style>{css}</style>
      <a
        href={rotaRestaurante(restauranteSlug)}
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          textDecoration: "none",
          color: T.text2,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Central
      </a>
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          padding: 28,
          boxShadow: "0 18px 50px rgba(16,31,47,0.10)",
        }}
      >
        <Logo size="md" />
        <div
          style={{
            fontFamily: "'Manrope',sans-serif",
            fontSize: 24,
            fontWeight: 700,
            marginTop: 22,
            marginBottom: 4,
          }}
        >
          {info.label}
        </div>
        <div style={{ color: T.text2, fontSize: 13, marginBottom: 22 }}>
          {info.hint}
        </div>
        <div
          style={{
            color: T.accent,
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginBottom: 8,
          }}
        >
          Login seguro
        </div>
        <input
          placeholder="Usuário"
          value={loginVal}
          onChange={(e) => setLoginVal(e.target.value)}
          style={{ marginBottom: 10 }}
          autoFocus
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tentar()}
          style={{ marginBottom: 10, borderColor: erro ? T.red : undefined }}
        />
        {erro && (
          <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>
            {erro}
          </div>
        )}
        <Btn full onClick={tentar} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Btn>
      </div>
    </div>
  );
}

function dataLocalISO(data = new Date()) {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dataReservaInicial() {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  return dataLocalISO(data);
}

function horaLocalHHMM(data = new Date()) {
  const horas = String(data.getHours()).padStart(2, "0");
  const minutos = String(data.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
}

function urlAbsoluta(caminho) {
  return new URL(caminho, window.location.origin).toString();
}

function copiarTexto(texto) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(texto);
  }
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
  return Promise.resolve();
}

function normalizarNumeroWhatsApp(numero) {
  let digitos = String(numero || "").replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return /^[0-9]{12,15}$/.test(digitos) ? digitos : "";
}

function linkAcompanhamentoReserva(reserva, restauranteSlug = "autenix") {
  if (!reserva?.codigo_acompanhamento) return "";
  return urlAbsoluta(
    rotaRestaurante(
      restauranteSlug,
      `reservas/acompanhar/${reserva.codigo_acompanhamento}`,
    ),
  );
}

function textoStatusReserva(status) {
  return {
    pendente: "solicitacao recebida",
    confirmada: "reserva confirmada",
    fila: "na fila de espera",
    chamada: "mesa sendo chamada",
    concluida: "atendimento iniciado",
    cancelada: "reserva cancelada",
  }[status] || "reserva";
}

function mensagemReservaParaCliente(reserva, restauranteSlug, nomeRestaurante) {
  const link = linkAcompanhamentoReserva(reserva, restauranteSlug);
  const partes = [
    `Ola, ${reserva.nome_cliente}.`,
    `Sua reserva no ${nomeRestaurante || "restaurante"} esta como ${textoStatusReserva(reserva.status)}.`,
    `Data: ${formatarDataReserva(reserva.data_reserva)} as ${reserva.horario}.`,
  ];
  if (reserva.status === "fila" && reserva.posicao_fila) {
    partes.push(`Posicao na fila: ${reserva.posicao_fila}.`);
  }
  if (reserva.status === "chamada") {
    partes.push("Procure a equipe para ser acomodado.");
  }
  if (link) partes.push(`Acompanhe aqui: ${link}`);
  return partes.join("\n");
}

function linkWhatsApp(numero, mensagem) {
  const destino = normalizarNumeroWhatsApp(numero);
  if (!destino) return "";
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensagem)}`;
}

function linkEmail(destino, assunto, mensagem) {
  const email = String(destino || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`;
}

function formatarDataReserva(data) {
  const partes = String(data || "").split("-");
  if (partes.length !== 3) return data || "-";
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function normalizarConfigReservaFrontend(config = {}) {
  return {
    ...RESERVA_CONFIG_PADRAO,
    ...config,
    ativo: Number(config.ativo ?? RESERVA_CONFIG_PADRAO.ativo),
    permitir_fila: Number(config.permitir_fila ?? RESERVA_CONFIG_PADRAO.permitir_fila),
    dias_semana: Array.isArray(config.dias_semana)
      ? config.dias_semana.map(Number).filter((dia) => dia >= 0 && dia <= 6)
      : RESERVA_CONFIG_PADRAO.dias_semana,
    intervalo_minutos: Number(
      config.intervalo_minutos ?? RESERVA_CONFIG_PADRAO.intervalo_minutos,
    ),
    duracao_minutos: Number(
      config.duracao_minutos ?? RESERVA_CONFIG_PADRAO.duracao_minutos,
    ),
    antecedencia_minutos: Number(
      config.antecedencia_minutos ?? RESERVA_CONFIG_PADRAO.antecedencia_minutos,
    ),
    horizonte_dias: Number(config.horizonte_dias ?? RESERVA_CONFIG_PADRAO.horizonte_dias),
    limite_reservas_horario: Number(
      config.limite_reservas_horario ??
        RESERVA_CONFIG_PADRAO.limite_reservas_horario,
    ),
    limite_pessoas_horario: Number(
      config.limite_pessoas_horario ??
        RESERVA_CONFIG_PADRAO.limite_pessoas_horario,
    ),
  };
}

function textoDiasReserva(dias = []) {
  const selecionados = DIAS_SEMANA_RESERVA
    .filter(([dia]) => dias.map(Number).includes(dia))
    .map(([, label]) => label);
  return selecionados.length === 7 ? "Todos os dias" : selecionados.join(", ");
}

function formatarDataHoraReservaEvento(valor) {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rotuloEventoReserva(tipo) {
  return {
    criada: "Reserva criada",
    status_alterado: "Status alterado",
    mesa_alterada: "Mesa alterada",
    compartilhamento: "Compartilhamento",
    notificacao_automatica: "Notificacao automatica",
  }[tipo] || "Evento";
}

function rotuloOrigemEventoReserva(origem) {
  return {
    publica: "Cliente",
    admin: "Administracao",
    garcom: "Garcom",
    sistema: "Sistema",
  }[origem] || origem || "Sistema";
}

function textoAutorEventoReserva(evento) {
  if (evento?.usuario_nome) {
    return `${evento.usuario_nome} (${roleLabel(evento.usuario_role)})`;
  }
  return rotuloOrigemEventoReserva(evento?.origem);
}

function TelaReservasPublicas({ restauranteSlug = "autenix" }) {
  const marca = useBranding();
  const css = gerarCSS(T);
  const [modo, setModo] = useState("reserva");
  const [form, setForm] = useState({
    nome_cliente: "",
    telefone: "",
    email: "",
    data_reserva: dataReservaInicial(),
    horario: "19:30",
    quantidade_pessoas: 2,
    salao_id: "",
    observacao: "",
  });
  const [status, setStatus] = useState({ tipo: "idle", mensagem: "" });
  const [disponibilidade, setDisponibilidade] = useState(null);
  const [acompanhamento, setAcompanhamento] = useState(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    document.title = `Reservas - ${marca.nome}`;
  }, [marca.nome]);

  useEffect(() => {
    let ativo = true;
    const params = new URLSearchParams();
    if (modo === "reserva") {
      params.set("data_reserva", form.data_reserva);
      params.set("quantidade_pessoas", String(form.quantidade_pessoas || 2));
      if (form.salao_id) params.set("salao_id", form.salao_id);
    }
    const query = params.toString();
    fetch(
      apiComRestaurante(
        `/api/reservas/disponibilidade${query ? `?${query}` : ""}`,
        restauranteSlug,
      ),
    )
      .then((resposta) => resposta.json())
      .then((dados) => {
        if (ativo) setDisponibilidade(dados);
      })
      .catch(() => {
        if (ativo) setDisponibilidade(null);
      });
    return () => {
      ativo = false;
    };
  }, [
    restauranteSlug,
    modo,
    form.data_reserva,
    form.quantidade_pessoas,
    form.salao_id,
  ]);

  useEffect(() => {
    const saloesAtivos = Array.isArray(disponibilidade?.saloes)
      ? disponibilidade.saloes.filter((salao) => Number(salao.ativo) === 1)
      : [];
    if (saloesAtivos.length && !form.salao_id) {
      setForm((atual) => ({ ...atual, salao_id: String(saloesAtivos[0].id) }));
    }
  }, [disponibilidade?.saloes, form.salao_id]);

  const atualizar = (campo, valor) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const selecionarModo = (novoModo) => {
    setModo(novoModo);
    setStatus({ tipo: "idle", mensagem: "" });
    setAcompanhamento(null);
    setCopiado(false);
    if (novoModo === "fila") {
      setForm((atual) => ({
        ...atual,
        data_reserva: dataLocalISO(),
        horario: horaLocalHHMM(),
      }));
    } else {
      setForm((atual) => ({
        ...atual,
        data_reserva: dataReservaInicial(),
        horario: atual.horario || "19:30",
      }));
    }
  };

  const enviar = async (event) => {
    event.preventDefault();
    setStatus({ tipo: "loading", mensagem: "" });
    setAcompanhamento(null);
    setCopiado(false);
    try {
      const resposta = await fetch(`${API}/api/reservas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          restaurante_slug: restauranteSlug,
          quantidade_pessoas: Number(form.quantidade_pessoas),
          tipo: modo,
        }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(dados.erro || "Nao foi possivel enviar a reserva");
      }
      const linkAcompanhamento = dados.acompanhamento_url
        ? new URL(dados.acompanhamento_url).pathname
        : rotaRestaurante(
          restauranteSlug,
          `reservas/acompanhar/${dados.reserva?.codigo_acompanhamento || ""}`,
        );
      setAcompanhamento({
        reserva: dados.reserva,
        caminho: linkAcompanhamento,
      });
      setStatus({
        tipo: "success",
        mensagem:
          modo === "fila"
            ? "Voce entrou na fila. Use o link abaixo para acompanhar."
            : "Reserva recebida. Use o link abaixo para acompanhar.",
      });
      setForm((atual) => ({
        ...atual,
        nome_cliente: "",
        telefone: "",
        email: "",
        observacao: "",
      }));
    } catch (error) {
      setStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const linkAcompanhamento = acompanhamento?.caminho
    ? urlAbsoluta(acompanhamento.caminho)
    : "";
  const mensagemParaRestaurante = acompanhamento?.reserva
    ? [
        `Ola, sou ${acompanhamento.reserva.nome_cliente}.`,
        `Quero acompanhar minha ${acompanhamento.reserva.tipo === "fila" ? "fila de espera" : "reserva"}.`,
        linkAcompanhamento,
      ].filter(Boolean).join("\n")
    : "";
  const whatsappRestaurante = linkWhatsApp(
    marca.whatsappNumero,
    mensagemParaRestaurante,
  );
  const configuracaoReservas = normalizarConfigReservaFrontend(
    disponibilidade?.configuracao,
  );
  const saloesReserva = Array.isArray(disponibilidade?.saloes)
    ? disponibilidade.saloes.filter((salao) => Number(salao.ativo) === 1)
    : [];
  const horariosReserva = Array.isArray(disponibilidade?.horarios)
    ? disponibilidade.horarios
    : [];
  const horarioSelecionado = horariosReserva.find(
    (slot) => slot.horario === form.horario,
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg,${T.bg2} 0%,${T.bg} 48%)`,
      }}
    >
      <style>{css}</style>
      <header className="panel-header">
        <div className="panel-header-main">
          <Logo />
          <div className="panel-header-copy">
            <div className="panel-header-title">Reservas</div>
            <div className="panel-header-subtitle">{marca.nome}</div>
          </div>
        </div>
        <div className="panel-header-actions">
          <a
            href={rotaRestaurante(restauranteSlug)}
            style={{
              textDecoration: "none",
              color: T.text2,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Voltar
          </a>
        </div>
      </header>

      <main
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "0 auto",
          padding: "28px 14px 42px",
        }}
      >
        <Card style={{ padding: "clamp(18px, 4vw, 28px)" }}>
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                color: T.accent,
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}
            >
              Reserva online
            </div>
            <h1
              style={{
                fontFamily: "'Manrope',sans-serif",
                fontSize: "clamp(28px, 7vw, 42px)",
                lineHeight: 1.05,
                letterSpacing: 0,
                marginBottom: 10,
              }}
            >
              Reserve sua mesa.
            </h1>
            <p
              style={{
                color: T.text2,
                fontSize: 14,
                maxWidth: 520,
              }}
            >
              Escolha uma data ou entre na fila de espera agora. Depois acompanhe
              tudo pelo link.
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                marginTop: 14,
                padding: "7px 10px",
                borderRadius: 999,
                background: T.card2,
                color:
                  !configuracaoReservas.ativo
                    ? T.red
                    : disponibilidade?.restaurante_cheio
                      ? T.amber
                      : T.green,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "currentColor",
                }}
              />
              {disponibilidade
                ? !configuracaoReservas.ativo
                  ? "Reservas online pausadas"
                  : disponibilidade.restaurante_cheio
                    ? configuracaoReservas.permitir_fila
                      ? "Restaurante cheio · fila disponivel"
                      : "Restaurante cheio agora"
                    : `${disponibilidade.mesas_livres} mesa(s) livres agora`
                : "Consulta de disponibilidade ativa"}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {[
              ["reserva", "Reserva programada"],
              ["fila", "Fila agora"],
            ].map(([valor, label]) => (
              <button
                key={valor}
                type="button"
                disabled={valor === "fila" && !configuracaoReservas.permitir_fila}
                onClick={() => selecionarModo(valor)}
                style={{
                  minHeight: 42,
                  borderRadius: 8,
                  border: `1px solid ${modo === valor ? T.accent : T.border}`,
                  background: modo === valor ? T.accentGlow : T.card2,
                  color: modo === valor ? T.accent : T.text2,
                  cursor:
                    valor === "fila" && !configuracaoReservas.permitir_fila
                      ? "not-allowed"
                      : "pointer",
                  fontFamily: "Inter,sans-serif",
                  fontSize: 13,
                  fontWeight: 800,
                  opacity: valor === "fila" && !configuracaoReservas.permitir_fila ? 0.45 : 1,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={enviar}>
            <div className="admin-form-grid">
              <input
                className="is-full"
                placeholder="Nome completo *"
                value={form.nome_cliente}
                onChange={(e) => atualizar("nome_cliente", e.target.value)}
                required
              />
              <input
                placeholder="Telefone *"
                value={form.telefone}
                onChange={(e) => atualizar("telefone", e.target.value)}
                required
              />
              <input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => atualizar("email", e.target.value)}
              />
              <input
                type="date"
                min={dataLocalISO()}
                value={form.data_reserva}
                onChange={(e) => atualizar("data_reserva", e.target.value)}
                disabled={modo === "fila"}
                required
              />
              <input
                type="time"
                value={form.horario}
                onChange={(e) => atualizar("horario", e.target.value)}
                disabled={modo === "fila"}
                required
              />
              <input
                type="number"
                min="1"
                max="100"
                value={form.quantidade_pessoas}
                onChange={(e) => atualizar("quantidade_pessoas", e.target.value)}
                required
              />
              {saloesReserva.length > 0 && (
                <select
                  value={form.salao_id}
                  onChange={(e) => atualizar("salao_id", e.target.value)}
                  disabled={modo === "fila"}
                >
                  {saloesReserva.map((salao) => (
                    <option key={salao.id} value={salao.id}>
                      {salao.nome} · até {salao.capacidade_pessoas} pessoas
                    </option>
                  ))}
                </select>
              )}
              <textarea
                className="is-full"
                placeholder="Observacao (opcional: area, aniversario, acessibilidade...)"
                value={form.observacao}
                onChange={(e) => atualizar("observacao", e.target.value)}
                style={{ minHeight: 72, resize: "vertical" }}
              />
            </div>
            {modo === "reserva" && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  background: T.card2,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>
                      Horarios disponiveis
                    </div>
                    <div style={{ color: T.muted, fontSize: 11 }}>
                      {configuracaoReservas.ativo
                        ? `${configuracaoReservas.hora_inicio} as ${configuracaoReservas.hora_fim} · ${textoDiasReserva(configuracaoReservas.dias_semana)}`
                        : "Reservas online pausadas"}
                    </div>
                  </div>
                  {horarioSelecionado && !horarioSelecionado.disponivel && (
                    <span style={{ color: T.red, fontSize: 11, fontWeight: 800 }}>
                      {horarioSelecionado.motivo}
                    </span>
                  )}
                </div>
                {horariosReserva.length === 0 ? (
                  <div style={{ color: T.muted, fontSize: 12 }}>
                    Selecione uma data para consultar a agenda.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(86px,1fr))",
                      gap: 7,
                    }}
                  >
                    {horariosReserva.map((slot) => (
                      <button
                        key={slot.horario}
                        type="button"
                        disabled={!slot.disponivel}
                        onClick={() => atualizar("horario", slot.horario)}
                        title={slot.motivo || "Disponivel"}
                        style={{
                          minHeight: 34,
                          borderRadius: 8,
                          border: `1px solid ${
                            form.horario === slot.horario ? T.accent : T.border
                          }`,
                          background:
                            form.horario === slot.horario
                              ? T.accentGlow
                              : slot.disponivel
                                ? T.card
                                : "rgba(120,120,120,.08)",
                          color: slot.disponivel ? T.text2 : T.muted,
                          cursor: slot.disponivel ? "pointer" : "not-allowed",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {slot.horario}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div
              role="status"
              style={{
                minHeight: 34,
                paddingTop: 12,
                color:
                  status.tipo === "error"
                    ? T.red
                    : status.tipo === "success"
                      ? T.green
                      : T.muted,
                fontSize: 13,
                fontWeight: status.tipo === "success" ? 700 : 500,
              }}
            >
              {status.mensagem}
            </div>
            {acompanhamento?.caminho && (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 12,
                  marginBottom: 12,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  background: T.card2,
                }}
              >
                <div style={{ color: T.text2, fontSize: 12, fontWeight: 700 }}>
                  Link de acompanhamento
                </div>
                <a
                  href={acompanhamento.caminho}
                  style={{
                    color: T.accent,
                    fontSize: 13,
                    fontWeight: 800,
                    overflowWrap: "anywhere",
                  }}
                >
                  {linkAcompanhamento}
                </a>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn
                    sm
                    variant="ghost"
                    type="button"
                    onClick={async () => {
                      await copiarTexto(linkAcompanhamento);
                      setCopiado(true);
                    }}
                  >
                    <Copy size={14} />
                    {copiado ? "Copiado" : "Copiar link"}
                  </Btn>
                  <Btn
                    sm
                    variant="info"
                    type="button"
                    onClick={() => window.open(acompanhamento.caminho, "_self")}
                  >
                    <ExternalLink size={14} />
                    Acompanhar
                  </Btn>
                  {whatsappRestaurante && (
                    <Btn
                      sm
                      variant="success"
                      type="button"
                      onClick={() => window.open(whatsappRestaurante, "_blank")}
                    >
                      <MessageCircle size={14} />
                      WhatsApp
                    </Btn>
                  )}
                </div>
              </div>
            )}
            <Btn
              full
              disabled={
                status.tipo === "loading" ||
                !form.nome_cliente.trim() ||
                !form.telefone.trim()
              }
            >
              {status.tipo === "loading"
                ? "Enviando..."
                : modo === "fila"
                  ? "Entrar na fila"
                  : "Solicitar reserva"}
            </Btn>
          </form>
        </Card>
      </main>
    </div>
  );
}

function TelaAcompanhamentoReserva({ restauranteSlug = "autenix", codigo }) {
  const marca = useBranding();
  const css = gerarCSS(T);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch(
        apiComRestaurante(`/api/reservas/acompanhar/${codigo}`, restauranteSlug),
      );
      const json = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(json.erro || "Nao foi possivel carregar o acompanhamento");
      }
      setDados(json);
      setErro("");
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, [codigo, restauranteSlug]);

  useEffect(() => {
    document.title = `Acompanhar reserva - ${marca.nome}`;
  }, [marca.nome]);

  useEffect(() => {
    carregar();
    const intervalo = window.setInterval(carregar, 15000);
    return () => window.clearInterval(intervalo);
  }, [carregar]);

  const reserva = dados?.reserva;
  const linkAtual = reserva
    ? linkAcompanhamentoReserva(reserva, restauranteSlug)
    : "";
  const contatoRestaurante = dados?.restaurante?.whatsapp_numero || marca.whatsappNumero;
  const whatsappRestaurante = reserva
    ? linkWhatsApp(
        contatoRestaurante,
        [
          `Ola, sou ${reserva.nome_cliente}.`,
          `Estou acompanhando minha ${reserva.tipo === "fila" ? "fila de espera" : "reserva"}.`,
          linkAtual,
        ].filter(Boolean).join("\n"),
      )
    : "";
  const statusTexto = {
    pendente: "Solicitacao recebida",
    confirmada: "Reserva confirmada",
    fila: "Voce esta na fila",
    chamada: "Sua mesa esta sendo chamada",
    concluida: "Atendimento iniciado",
    cancelada: "Reserva cancelada",
  }[reserva?.status] || "Acompanhamento";
  const proximoPasso = {
    pendente: "Aguarde a confirmacao da equipe.",
    confirmada: "Chegue no horario combinado e informe o nome da reserva.",
    fila: "Acompanhe sua posicao. A equipe chamara quando houver mesa disponivel.",
    chamada: "Procure a equipe do restaurante para ser acomodado.",
    concluida: "Seu atendimento foi iniciado.",
    cancelada: "Fale com o restaurante se quiser fazer uma nova reserva.",
  }[reserva?.status] || "Acompanhe as atualizacoes por aqui.";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg,${T.bg2} 0%,${T.bg} 52%)`,
      }}
    >
      <style>{css}</style>
      <header className="panel-header">
        <div className="panel-header-main">
          <Logo />
          <div className="panel-header-copy">
            <div className="panel-header-title">Acompanhamento</div>
            <div className="panel-header-subtitle">{marca.nome}</div>
          </div>
        </div>
      </header>

      <main
        style={{
          width: "min(720px, calc(100% - 28px))",
          margin: "0 auto",
          padding: "34px 0 48px",
        }}
      >
        <Card style={{ padding: 24, textAlign: "center" }}>
          {carregando && (
            <div style={{ color: T.muted, fontSize: 14 }}>Carregando...</div>
          )}
          {!carregando && erro && (
            <>
              <div
                style={{
                  fontFamily: "'Manrope',sans-serif",
                  fontSize: 24,
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                Nao encontramos esta reserva
              </div>
              <div style={{ color: T.red, fontSize: 13 }}>{erro}</div>
            </>
          )}
          {!carregando && reserva && (
            <>
              <Badge status={reserva.status} />
              <h1
                style={{
                  fontFamily: "'Manrope',sans-serif",
                  fontSize: "clamp(28px, 7vw, 46px)",
                  lineHeight: 1.05,
                  margin: "18px 0 8px",
                  letterSpacing: 0,
                }}
              >
                {statusTexto}
              </h1>
              <div style={{ color: T.text2, fontSize: 15 }}>
                {reserva.nome_cliente} · {reserva.quantidade_pessoas} pessoa(s)
              </div>
              <div style={{ color: T.muted, fontSize: 13, marginTop: 6 }}>
                {formatarDataReserva(reserva.data_reserva)} as {reserva.horario}
                {reserva.mesa_numero ? ` · Mesa ${reserva.mesa_numero}` : ""}
                {reserva.salao_nome ? ` · ${reserva.salao_nome}` : ""}
              </div>

              {reserva.status === "fila" && (
                <div
                  style={{
                    margin: "26px auto 0",
                    width: "min(280px, 100%)",
                    padding: 18,
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: T.card2,
                  }}
                >
                  <div style={{ color: T.muted, fontSize: 12, fontWeight: 800 }}>
                    SUA POSICAO
                  </div>
                  <div
                    style={{
                      color: T.accent,
                      fontFamily: "'Manrope',sans-serif",
                      fontSize: 54,
                      fontWeight: 900,
                      lineHeight: 1,
                      marginTop: 6,
                    }}
                  >
                    {reserva.posicao_fila || "-"}
                  </div>
                  <div style={{ color: T.text2, fontSize: 13, marginTop: 8 }}>
                    {reserva.pessoas_antes
                      ? `${reserva.pessoas_antes} grupo(s) na frente`
                      : "Voce e o proximo da fila"}
                  </div>
                </div>
              )}

              {reserva.status === "chamada" && (
                <div style={{ color: T.green, fontSize: 15, fontWeight: 800, marginTop: 24 }}>
                  Procure a equipe do restaurante para ser acomodado.
                </div>
              )}

              <div
                style={{
                  marginTop: 22,
                  padding: 14,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: T.card2,
                  textAlign: "left",
                }}
              >
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 800 }}>
                  PROXIMO PASSO
                </div>
                <div style={{ color: T.text2, fontSize: 14, marginTop: 4 }}>
                  {proximoPasso}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 16,
                }}
              >
                <Btn
                  sm
                  variant="ghost"
                  type="button"
                  onClick={async () => {
                    await copiarTexto(linkAtual);
                    setCopiado(true);
                  }}
                >
                  <Copy size={14} />
                  {copiado ? "Copiado" : "Copiar link"}
                </Btn>
                {whatsappRestaurante && (
                  <Btn
                    sm
                    variant="success"
                    type="button"
                    onClick={() => window.open(whatsappRestaurante, "_blank")}
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </Btn>
                )}
              </div>

              <div style={{ color: T.muted, fontSize: 12, marginTop: 24 }}>
                Atualizacao automatica a cada 15 segundos.
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}

function AcoesCompartilhamentoReserva({
  reserva,
  restauranteSlug,
  nomeRestaurante,
  onFeedback,
  onShare,
}) {
  const [copiado, setCopiado] = useState(false);
  const link = linkAcompanhamentoReserva(reserva, restauranteSlug);
  const mensagem = mensagemReservaParaCliente(
    reserva,
    restauranteSlug,
    nomeRestaurante,
  );
  const whatsapp = linkWhatsApp(reserva?.telefone, mensagem);
  const email = linkEmail(
    reserva?.email,
    `Reserva - ${nomeRestaurante || "Restaurante"}`,
    mensagem,
  );

  if (!link) return null;

  return (
    <>
      <Btn
        sm
        variant="ghost"
        type="button"
        onClick={async () => {
          await copiarTexto(link);
          setCopiado(true);
          onShare?.("link");
          onFeedback?.("Link de acompanhamento copiado.");
        }}
      >
        <Copy size={14} />
        {copiado ? "Link copiado" : "Copiar link"}
      </Btn>
      {whatsapp && (
        <Btn
          sm
          variant="success"
          type="button"
          onClick={() => {
            onShare?.("whatsapp");
            window.open(whatsapp, "_blank");
          }}
        >
          <MessageCircle size={14} />
          WhatsApp
        </Btn>
      )}
      {email && (
        <Btn
          sm
          variant="info"
          type="button"
          onClick={() => {
            onShare?.("email");
            window.open(email, "_blank");
          }}
        >
          <Mail size={14} />
          Email
        </Btn>
      )}
    </>
  );
}

function HistoricoReservaModal({
  reserva,
  eventos,
  carregando,
  erro,
  onClose,
}) {
  return (
    <Modal onClose={onClose}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: T.text,
              fontFamily: "'Manrope',sans-serif",
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            <History size={19} color={T.accent} />
            Historico
          </div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
            {reserva?.nome_cliente} · {formatarDataReserva(reserva?.data_reserva)} as{" "}
            {reserva?.horario}
          </div>
        </div>
        {reserva?.status && <Badge status={reserva.status} />}
      </div>

      {carregando ? (
        <div style={{ color: T.muted, fontSize: 13, padding: "12px 0" }}>
          Carregando historico...
        </div>
      ) : erro ? (
        <div style={{ color: T.red, fontSize: 13, padding: "12px 0" }}>
          {erro}
        </div>
      ) : !eventos?.length ? (
        <div style={{ color: T.muted, fontSize: 13, padding: "12px 0" }}>
          Nenhum evento registrado para esta reserva.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {eventos.map((evento) => (
            <div
              key={evento.id}
              style={{
                display: "grid",
                gridTemplateColumns: "14px 1fr",
                gap: 10,
                alignItems: "start",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  marginTop: 6,
                  background: T.accent,
                  boxShadow: `0 0 0 4px ${T.accentGlow}`,
                }}
              />
              <div
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: 11,
                  background: T.card2,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 5,
                  }}
                >
                  <strong style={{ color: T.text, fontSize: 13 }}>
                    {rotuloEventoReserva(evento.tipo)}
                  </strong>
                  <span style={{ color: T.muted, fontSize: 11 }}>
                    {formatarDataHoraReservaEvento(evento.criado_em)}
                  </span>
                </div>
                <div style={{ color: T.text2, fontSize: 13 }}>
                  {evento.descricao}
                </div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 6 }}>
                  {textoAutorEventoReserva(evento)}
                </div>
                {(evento.status_anterior ||
                  evento.status_novo ||
                  evento.mesa_id_anterior ||
                  evento.mesa_id_novo) && (
                  <div style={{ color: T.muted, fontSize: 11, marginTop: 6 }}>
                    {[
                      evento.status_anterior || evento.status_novo
                        ? `Status: ${evento.status_anterior || "-"} -> ${evento.status_novo || "-"}`
                        : "",
                      evento.mesa_id_anterior || evento.mesa_id_novo
                        ? `Mesa: ${evento.mesa_id_anterior || "-"} -> ${evento.mesa_id_novo || "-"}`
                        : "",
                    ].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Btn
        variant="ghost"
        type="button"
        full
        style={{ marginTop: 16 }}
        onClick={onClose}
      >
        Fechar
      </Btn>
    </Modal>
  );
}

// ─── BOAS-VINDAS MESA ─────────────────────────────────────────────────────────
function TelaBoasVindas({ mesaNumero, onContinuar }) {
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const entrar = () => {
    const n = nome.trim();
    if (!n) return;
    onContinuar(`${n}${sobrenome.trim() ? " " + sobrenome.trim() : ""}`);
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: T.bg,
        padding: 20,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 250,
          background: `radial-gradient(ellipse at 50% 0%,${T.accentGlow} 0%,transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          textAlign: "center",
          width: "100%",
          maxWidth: 380,
        }}
      >
        <Logo size="lg" center />
        <div
          style={{
            marginTop: 28,
            fontFamily: "'Manrope',sans-serif",
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          Bem-vindo à<br />
          <span style={{ color: T.accent }}>{rotuloMesa(mesaNumero)}</span>
        </div>
        <div
          style={{
            color: T.text2,
            fontSize: 14,
            marginTop: 10,
            marginBottom: 28,
          }}
        >
          Para um atendimento personalizado,
          <br />
          nos diga seu nome
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            textAlign: "left",
          }}
        >
          <input
            placeholder="Nome *"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
          />
          <input
            placeholder="Sobrenome (opcional)"
            value={sobrenome}
            onChange={(e) => setSobrenome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()}
          />
          <Btn
            full
            onClick={entrar}
            disabled={!nome.trim()}
            style={{ marginTop: 6, padding: "14px 20px", fontSize: 15 }}
          >
            Ver Cardápio
          </Btn>
        </div>
      </div>
    </div>
  );
}

function TelaSessaoMesaBloqueada({ mesaNumero, mensagem, carregando = false }) {
  const css = gerarCSS(T);
  return (
    <>
      <style>{css}</style>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: T.bg,
          padding: 20,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            padding: 22,
            borderRadius: 12,
            background: T.bg2,
            border: `1px solid ${T.border}`,
            boxShadow: "0 16px 40px rgba(15,23,42,.14)",
          }}
        >
          <Logo size="lg" center />
          <div
            style={{
              marginTop: 26,
              fontFamily: "'Manrope',sans-serif",
              fontSize: 23,
              fontWeight: 800,
              lineHeight: 1.2,
              color: T.text,
            }}
          >
            {carregando ? "Verificando atendimento" : "Atendimento nao iniciado"}
          </div>
          <div style={{ marginTop: 8, color: T.accent, fontWeight: 800 }}>
            {rotuloMesa(mesaNumero)}
          </div>
          <div
            style={{
              color: T.text2,
              fontSize: 14,
              marginTop: 14,
              lineHeight: 1.55,
            }}
          >
            {carregando
              ? "Estamos validando o QR Code desta mesa."
              : mensagem || "Escaneie o QR Code atualizado da mesa ou solicite ajuda da equipe."}
          </div>
          {!carregando && (
            <Btn
              full
              variant="ghost"
              onClick={() => window.location.reload()}
              style={{ marginTop: 18 }}
            >
              Tentar novamente
            </Btn>
          )}
        </div>
      </div>
    </>
  );
}

// ─── PAINEL CLIENTE ───────────────────────────────────────────────────────────
function PainelCliente({ mesa_id, restauranteSlug = "autenix", sessaoMesa = "" }) {
  const marca = useBranding();
  const [nomeCliente, setNomeCliente] = useState(null);
  const [mesa, setMesa] = useState(null);
  const [cardapio, setCardapio] = useState({ categorias: [], produtos: [] });
  const [carrinho, setCarrinho] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [aba, setAba] = useState("cardapio");
  const [catAtiva, setCatAtiva] = useState(null);
  const [obs, setObs] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState(null);
  const [carrinhoModal, setCarrinhoModal] = useState(false);
  const [cancelandoItem, setCancelandoItem] = useState(null);
  const [sessaoBloqueada, setSessaoBloqueada] = useState(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);

  const css = gerarCSS(T);
  const mesaNumero = mesa?.numero || mesa_id;
  useEffect(() => {
    document.title = `${rotuloMesa(mesaNumero)} - ${marca.nome}`;
  }, [marca.nome, mesaNumero]);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };
  const bloquearSessaoMesa = useCallback((msg) => {
    setSessaoBloqueada(msg || "Atendimento da mesa nao iniciado ou encerrado.");
    setPedidos([]);
    setCarrinho([]);
  }, []);

  const fetchCardapio = useCallback(async () => {
    const r = await fetch(apiComRestaurante("/api/cardapio", restauranteSlug));
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.erro || "Nao foi possivel carregar o cardapio");
    setCardapio(dados);
  }, [restauranteSlug]);
  const fetchPedidos = useCallback(async () => {
    const r = await fetch(
      apiComSessaoMesa(`/api/pedidos?mesa_id=${mesa_id}`, restauranteSlug, sessaoMesa),
    );
    const d = await r.json();
    if (!r.ok) {
      if (r.status === 403) bloquearSessaoMesa(d.erro);
      throw new Error(d.erro || "Nao foi possivel carregar os pedidos");
    }
    setPedidos(d.filter((p) => p.status !== "finalizado"));
  }, [bloquearSessaoMesa, mesa_id, restauranteSlug, sessaoMesa]);
  const fetchMesa = useCallback(async () => {
    const r = await fetch(
      apiComSessaoMesa(`/api/mesas/${mesa_id}`, restauranteSlug, sessaoMesa),
    );
    const dados = await r.json();
    if (!r.ok) {
      if (r.status === 403) bloquearSessaoMesa(dados.erro);
      throw new Error(dados.erro || "Nao foi possivel carregar a mesa");
    }
    setSessaoBloqueada(null);
    setMesa(dados);
  }, [bloquearSessaoMesa, mesa_id, restauranteSlug, sessaoMesa]);

  useOperationalSync(() => {
    if (!sessaoMesa || sessaoBloqueada) return;
    Promise.all([fetchMesa(), fetchPedidos()]).catch(() => {});
  }, SYNC_INTERVALS.mesaCliente, Boolean(sessaoMesa && !sessaoBloqueada));

  useOperationalSync(() => {
    fetchCardapio().catch(() => {});
  }, SYNC_INTERVALS.cardapio, true);

  useEffect(() => {
    let ativo = true;
    const carregamentoInicial = window.setTimeout(() => {
      Promise.all([fetchMesa(), fetchCardapio(), fetchPedidos()])
        .catch(() => {})
        .finally(() => {
          if (ativo) setVerificandoSessao(false);
        });
    }, 0);

    const s = sessaoMesa
      ? getSocket({ mesaId: mesa_id, restauranteSlug, sessaoMesa })
      : null;
    s?.on("cardapio_atualizado", fetchCardapio);
    s?.on("pedido_atualizado", fetchPedidos);
    // Item 3: ao fechar mesa, reseta tudo para tela de boas-vindas
    s?.on("mesa_fechada", (id) => {
      if (String(id) === String(mesa_id)) {
        setPedidos([]);
        setCarrinho([]);
        setNomeCliente(null);
        bloquearSessaoMesa("Atendimento encerrado. Solicite um novo QR Code para a equipe.");
      }
    });
    return () => {
      ativo = false;
      window.clearTimeout(carregamentoInicial);
      s?.off("cardapio_atualizado");
      s?.off("pedido_atualizado");
      s?.off("mesa_fechada");
    };
  }, [
    bloquearSessaoMesa,
    fetchCardapio,
    fetchMesa,
    fetchPedidos,
    mesa_id,
    restauranteSlug,
    sessaoMesa,
  ]);

  const add = (p) =>
    setCarrinho((prev) => {
      const ex = prev.find((i) => i.produto_id === p.id);
      if (ex)
        return prev.map((i) =>
          i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i,
        );
      return [
        ...prev,
        { produto_id: p.id, nome: p.nome, preco: p.preco, quantidade: 1 },
      ];
    });
  const rem = (id) =>
    setCarrinho((prev) => {
      const ex = prev.find((i) => i.produto_id === id);
      if (ex?.quantidade === 1) return prev.filter((i) => i.produto_id !== id);
      return prev.map((i) =>
        i.produto_id === id ? { ...i, quantidade: i.quantidade - 1 } : i,
      );
    });
  const qtd = (id) =>
    carrinho.find((i) => i.produto_id === id)?.quantidade || 0;
  const totalCarrinho = carrinho.reduce(
    (s, i) => s + i.preco * i.quantidade,
    0,
  );
  const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0);

  const enviarPedido = async () => {
    if (!carrinho.length) return;
    setEnviando(true);
    const itens = carrinho.map((i) => ({
      ...i,
      observacao: obs[i.produto_id] || "",
    }));
    const resposta = await fetch(`${API}/api/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesa_id,
        itens,
        nome_cliente: nomeCliente,
        restaurante_slug: restauranteSlug,
        sessao: sessaoMesa,
      }),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      setEnviando(false);
      if (resposta.status === 403) bloquearSessaoMesa(dados.erro);
      showToast(dados.erro || "Nao foi possivel enviar o pedido.");
      return;
    }
    setCarrinho([]);
    setObs({});
    setEnviando(false);
    setCarrinhoModal(false);
    showToast("Pedido enviado para a cozinha!");
    fetchPedidos();
    setAba("pedidos");
  };

  // Item 6: cancelar item — só se ainda pendente
  const cancelarItem = async (item) => {
    if (item.status !== "pendente" || cancelandoItem) return;
    setCancelandoItem(item.id);
    try {
      const resposta = await fetch(`${API}/api/itens/${item.id}/cancelar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa_id,
          restaurante_slug: restauranteSlug,
          sessao: sessaoMesa,
        }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        if (resposta.status === 403) bloquearSessaoMesa(dados.erro);
        showToast(dados.erro || "Nao foi possivel cancelar o item.");
        return;
      }
      fetchPedidos();
      showToast("Item cancelado.");
    } finally {
      setCancelandoItem(null);
    }
  };

  const produtos =
    catAtiva === null
      ? cardapio.produtos
      : cardapio.produtos.filter((p) => p.categoria_id === catAtiva);

  if (sessaoBloqueada)
    return (
      <TelaSessaoMesaBloqueada
        mesaNumero={mesaNumero}
        mensagem={sessaoBloqueada}
      />
    );

  if (verificandoSessao)
    return (
      <TelaSessaoMesaBloqueada mesaNumero={mesaNumero} carregando />
    );

  if (!nomeCliente)
    return (
      <>
        <style>{css}</style>
        <TelaBoasVindas mesaNumero={mesaNumero} onContinuar={setNomeCliente} />
      </>
    );

  return (
    <>
      <style>{css}</style>
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          minHeight: "100vh",
          background: T.bg,
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: T.bg2,
            borderBottom: `1px solid ${T.border}`,
            padding: "12px 14px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Logo size="sm" />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, color: T.muted }}>
                {nomeCliente} · {rotuloMesa(mesaNumero)}
              </div>
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {[
              ["cardapio", "Cardápio"],
              ["pedidos", "Meus Pedidos"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setAba(id)}
                style={{
                  flex: 1,
                  padding: "9px 4px 11px",
                  background: "transparent",
                  border: "none",
                  borderBottom:
                    aba === id
                      ? `2px solid ${T.accent}`
                      : "2px solid transparent",
                  color: aba === id ? T.accent : T.muted,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Inter,sans-serif",
                  transition: "color .15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className="fade-up"
            style={{
              position: "fixed",
              top: 68,
              left: "50%",
              transform: "translateX(-50%)",
              background: T.card2,
              border: `1px solid ${T.border2}`,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 500,
              zIndex: 100,
              color: T.green,
              whiteSpace: "nowrap",
              boxShadow: "0 8px 24px rgba(0,0,0,.5)",
            }}
          >
            {toast}
          </div>
        )}

        <div
          style={{
            padding: "14px 12px",
            paddingBottom: totalItens > 0 ? 160 : 100,
            overflowX: "hidden",
          }}
        >
          {/* CARDÁPIO */}
          {aba === "cardapio" && (
            <div className="fade-up">
              {/* Filtro horizontal */}
              <div
                className="scroll-x"
                style={{
                  display: "flex",
                  gap: 7,
                  paddingBottom: 12,
                  marginBottom: 12,
                }}
              >
                <button
                  onClick={() => setCatAtiva(null)}
                  style={{
                    flexShrink: 0,
                    padding: "7px 16px",
                    background:
                      catAtiva === null
                        ? `linear-gradient(135deg,${T.accent},${T.accent2})`
                        : T.card,
                    border: `1px solid ${catAtiva === null ? "transparent" : T.border}`,
                    borderRadius: 99,
                    color: catAtiva === null ? "#0d0f0e" : T.text2,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "Inter,sans-serif",
                  }}
                >
                  Todos
                </button>
                {cardapio.categorias.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCatAtiva(c.id)}
                    style={{
                      flexShrink: 0,
                      padding: "7px 16px",
                      background:
                        catAtiva === c.id
                          ? `linear-gradient(135deg,${T.accent},${T.accent2})`
                          : T.card,
                      border: `1px solid ${catAtiva === c.id ? "transparent" : T.border}`,
                      borderRadius: 99,
                      color: catAtiva === c.id ? "#0d0f0e" : T.text2,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "Inter,sans-serif",
                    }}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>

              {/* Grid 2 colunas */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {produtos.map((p, i) => {
                  const q = qtd(p.id);
                  return (
                    <div
                      key={p.id}
                      className="fade-up"
                      style={{
                        animationDelay: `${i * 0.03}s`,
                        background: T.card,
                        border: `1px solid ${q > 0 ? T.accent : T.border}`,
                        borderRadius: 8,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        transition: "border-color .2s",
                      }}
                    >
                      <div
                        style={{
                          height: 110,
                          background: T.card2,
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          color: T.muted,
                          fontStyle: "italic",
                        }}
                      >
                        {p.imagem ? (
                          <img
                            src={p.imagem}
                            alt={p.nome}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              padding: 8,
                              textAlign: "center",
                              lineHeight: 1.3,
                            }}
                          >
                            {p.nome}
                          </span>
                        )}
                        {q > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: 7,
                              right: 7,
                              background: `linear-gradient(135deg,${T.accent},${T.accent2})`,
                              color: "#0d0f0e",
                              borderRadius: 99,
                              width: 22,
                              height: 22,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: 11,
                            }}
                          >
                            {q}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          padding: "10px 10px 12px",
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              lineHeight: 1.3,
                            }}
                          >
                            {p.nome}
                          </div>
                          {p.descricao && (
                            <div
                              style={{
                                color: T.muted,
                                fontSize: 11,
                                marginTop: 3,
                              }}
                            >
                              {p.descricao.slice(0, 45)}
                              {p.descricao.length > 45 ? "..." : ""}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 10,
                          }}
                        >
                          <span
                            style={{
                              color: T.accent,
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            R$ {p.preco.toFixed(2)}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            {q > 0 && (
                              <button
                                onClick={() => rem(p.id)}
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 7,
                                  background: T.card2,
                                  border: `1px solid ${T.border2}`,
                                  color: T.text,
                                  fontSize: 15,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                -
                              </button>
                            )}
                            <button
                              onClick={() => add(p)}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 7,
                                background: `linear-gradient(135deg,${T.accent},${T.accent2})`,
                                border: "none",
                                color: "#0d0f0e",
                                fontSize: 15,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {produtos.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "48px 0",
                    color: T.muted,
                  }}
                >
                  Nenhum item nessa categoria
                </div>
              )}
            </div>
          )}

          {/* MEUS PEDIDOS */}
          {aba === "pedidos" && (
            <div className="fade-up" style={{ width: "100%" }}>
              {pedidos.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "64px 0",
                    color: T.muted,
                  }}
                >
                  Nenhum pedido ainda
                </div>
              ) : (
                pedidos.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      marginBottom: 12,
                      background: T.card,
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      padding: 16,
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: `1px solid ${T.border}`,
                      }}
                    >
                      <span style={{ fontSize: 13, color: T.muted }}>
                        Total:{" "}
                        <span style={{ color: T.accent, fontWeight: 700 }}>
                          R${" "}
                          {p.itens
                            ?.filter((i) => i.status !== "cancelado")
                            .reduce((s, i) => s + i.preco * i.quantidade, 0)
                            .toFixed(2)}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 10,
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Manrope',sans-serif",
                          fontWeight: 700,
                        }}
                      >
                        Pedido #{p.numero_dia || p.id}
                      </div>
                      <Badge status={p.status} />
                    </div>
                    {p.itens?.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: "8px 0",
                          borderTop: `1px solid ${T.border}`,
                          opacity: item.status === "cancelado" ? 0.4 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          <span style={{ color: T.text2, fontSize: 13 }}>
                            {item.quantidade}x {item.nome}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <span style={{ color: T.accent, fontSize: 13 }}>
                              R$ {(item.preco * item.quantidade).toFixed(2)}
                            </span>
                            <Badge status={item.status} />
                            {/* Item 6: cancelar se ainda pendente */}
                            {item.status === "pendente" && (
                              <button
                                onClick={() => cancelarItem(item)}
                                disabled={cancelandoItem === item.id}
                                style={{
                                  fontSize: 11,
                                  color: T.red,
                                  background: "rgba(248,113,113,.1)",
                                  border: "1px solid rgba(248,113,113,.25)",
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                  cursor: cancelandoItem === item.id ? "wait" : "pointer",
                                  fontFamily: "Inter,sans-serif",
                                  opacity: cancelandoItem === item.id ? 0.65 : 1,
                                }}
                              >
                                {cancelandoItem === item.id ? "Cancelando..." : "Cancelar"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: `1px solid ${T.border}`,
                      }}
                    >
                      <span style={{ fontSize: 13, color: T.muted }}>
                        Total:{" "}
                        <span style={{ color: T.accent, fontWeight: 700 }}>
                          R${" "}
                          {p.itens
                            ?.filter((i) => i.status !== "cancelado")
                            .reduce((s, i) => s + i.preco * i.quantidade, 0)
                            .toFixed(2)}
                        </span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Botao flutuante carrinho */}
        {totalItens > 0 && aba === "cardapio" && (
          <div
            className="float-up"
            style={{
              position: "fixed",
              bottom: 90,
              left: "50%",
              transform: "translateX(-50%)",
              width: "calc(100% - 28px)",
              maxWidth: 452,
              zIndex: 60,
            }}
          >
            <button
              onClick={() => setCarrinhoModal(true)}
              style={{
                width: "100%",
                padding: "14px 20px",
                background: `linear-gradient(135deg,${T.accent},${T.accent2})`,
                border: "none",
                borderRadius: 8,
                color: "#0d0f0e",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                boxShadow: "0 8px 28px rgba(201,169,110,.35)",
                fontFamily: "Inter,sans-serif",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    background: "rgba(0,0,0,.2)",
                    borderRadius: 8,
                    padding: "2px 10px",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {totalItens}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  Ver Pedido
                </span>
              </div>
              <span style={{ fontWeight: 800, fontSize: 16 }}>
                R$ {totalCarrinho.toFixed(2)}
              </span>
            </button>
          </div>
        )}

        {/* Bottom bar */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 480,
            background: T.bg2,
            borderTop: `1px solid ${T.border}`,
            padding: "10px 12px",
            display: "flex",
            gap: 8,
            zIndex: 50,
          }}
        >
          {/* Bottom bar — apenas aviso */}
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: 480,
              background: T.bg2,
              borderTop: `1px solid ${T.border}`,
              padding: "14px 12px",
              zIndex: 50,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, color: T.text2, fontWeight: 500 }}>
              Qualquer dúvida, chame o garçom
            </div>
          </div>
        </div>

        {/* Modal carrinho / confirmar pedido */}
        {carrinhoModal && (
          <Modal onClose={() => setCarrinhoModal(false)}>
            <div
              style={{
                fontFamily: "'Manrope',sans-serif",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              Seu Pedido
            </div>
            {carrinho.map((item) => (
              <div
                key={item.produto_id}
                style={{
                  marginBottom: 10,
                  paddingBottom: 10,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, marginRight: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {item.nome}
                    </div>
                    <div
                      style={{ color: T.accent, fontWeight: 700, marginTop: 2 }}
                    >
                      R$ {(item.preco * item.quantidade).toFixed(2)}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    <button
                      onClick={() => rem(item.produto_id)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: T.card2,
                        border: `1px solid ${T.border2}`,
                        color: T.text,
                        cursor: "pointer",
                        fontSize: 16,
                      }}
                    >
                      -
                    </button>
                    <span
                      style={{
                        fontWeight: 700,
                        minWidth: 18,
                        textAlign: "center",
                      }}
                    >
                      {item.quantidade}
                    </span>
                    <button
                      onClick={() =>
                        add({
                          id: item.produto_id,
                          nome: item.nome,
                          preco: item.preco,
                        })
                      }
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: T.card2,
                        border: `1px solid ${T.border2}`,
                        color: T.text,
                        cursor: "pointer",
                        fontSize: 16,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  placeholder="Observacao (ex: sem cebola)"
                  value={obs[item.produto_id] || ""}
                  onChange={(e) =>
                    setObs((p) => ({ ...p, [item.produto_id]: e.target.value }))
                  }
                  style={{ marginTop: 8, fontSize: 13 }}
                />
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                marginBottom: 14,
              }}
            >
              <span style={{ fontWeight: 600, color: T.text2 }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: T.accent }}>
                R$ {totalCarrinho.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn
                variant="ghost"
                onClick={() => setCarrinhoModal(false)}
                style={{ flex: 1 }}
              >
                Continuar
              </Btn>
              <Btn
                onClick={enviarPedido}
                disabled={enviando}
                style={{ flex: 2 }}
              >
                {enviando ? "Enviando..." : "Confirmar Pedido"}
              </Btn>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}

// ─── PAINEL GARÇOM ────────────────────────────────────────────────────────────
function PainelGarcom({ usuario, onLogout }) {
  const marca = useBranding();
  const [chamadas, setChamadas] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [contaModal, setContaModal] = useState(null);
  const [formaPagSel, setFormaPagSel] = useState(null);
  const [obsFormaPag, setObsFormaPag] = useState("");
  const [pedidosModal, setPedidosModal] = useState(null);
  const [historicoModal, setHistoricoModal] = useState(null);
  const [historicoItens, setHistoricoItens] = useState([]);
  const [historicoErro, setHistoricoErro] = useState("");
  const [visaoGarcom, setVisaoGarcom] = useState(() =>
    new URLSearchParams(window.location.search).get("aba") === "reservas"
      ? "reservas"
      : "mesas",
  );
  const [reservasGarcom, setReservasGarcom] = useState([]);
  const [reservaStatusGarcom, setReservaStatusGarcom] = useState({
    tipo: "idle",
    mensagem: "",
  });
  const [reservaAtualizando, setReservaAtualizando] = useState(null);
  const [historicoReservaGarcom, setHistoricoReservaGarcom] = useState(null);

  // Cardápio para fazer pedido
  const [cardapioModal, setCardapioModal] = useState(null); // mesa selecionada
  const [cardapio, setCardapio] = useState({ categorias: [], produtos: [] });
  const [carrinhoPedido, setCarrinhoPedido] = useState([]);
  const [catAtiva, setCatAtiva] = useState(null);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [pedidoStatusGarcom, setPedidoStatusGarcom] = useState("");
  const bellRef = useRef(null);
  const chamadasConhecidasRef = useRef(new Set());
  const chamadasInicializadasRef = useRef(false);
  const pedidosProntosConhecidosRef = useRef(new Set());
  const pedidosProntosInicializadosRef = useRef(false);
  const { notifs, push, dismiss } = useNotifs();

  const css = gerarCSS(T);
  useEffect(() => {
    document.title = `Garçom - ${marca.nome}`;
  }, [marca.nome]);

  const fetchChamadas = useCallback(async (opcoes = {}) => {
    const r = await authFetch(`${API}/api/chamadas`);
    const dados = await r.json();
    const lista = Array.isArray(dados) ? dados : [];
    setChamadas(lista);

    const proximas = new Set(lista.map(chaveChamada).filter(Boolean));
    if (!chamadasInicializadasRef.current) {
      chamadasInicializadasRef.current = true;
      chamadasConhecidasRef.current = proximas;
      return;
    }

    if (opcoes.notificarNovas) {
      lista
        .filter((chamada) => !chamadasConhecidasRef.current.has(chaveChamada(chamada)))
        .forEach((chamada) => {
          const isPag = chamada.motivo?.startsWith("conta:");
          const forma = isPag ? formataPag(chamada.motivo.split(":")[1]) : null;
          const cliente = chamada.nome_cliente || "Cliente";
          push(
            isPag
              ? `${cliente} da Mesa ${chamada.mesa_numero} solicitou a conta`
              : `${cliente} da Mesa ${chamada.mesa_numero} solicitando garçom`,
            isPag ? `Forma de pagamento: ${forma}` : "Dirija-se a mesa",
            isPag ? "conta" : "chamada",
          );
          bellRef.current?.classList.add("ring");
          setTimeout(() => bellRef.current?.classList.remove("ring"), 700);
        });
    }
    chamadasConhecidasRef.current = proximas;
  }, [push]);
  const fetchMesas = useCallback(async () => {
    const r = await authFetch(`${API}/api/mesas`);
    setMesas(await r.json());
  }, []);
  const fetchPedidos = useCallback(async (opcoes = {}) => {
    const r = await authFetch(`${API}/api/pedidos`);
    const dados = await r.json();
    const lista = Array.isArray(dados) ? dados : [];
    setPedidos(lista);

    const prontos = new Set(
      lista
        .filter(pedidoProntoParaRetirada)
        .map((pedido) => String(pedido.id)),
    );
    if (!pedidosProntosInicializadosRef.current) {
      pedidosProntosInicializadosRef.current = true;
      pedidosProntosConhecidosRef.current = prontos;
      return;
    }

    if (opcoes.notificarProntos) {
      lista
        .filter(pedidoProntoParaRetirada)
        .filter((pedido) => !pedidosProntosConhecidosRef.current.has(String(pedido.id)))
        .forEach((pedido) => {
          push(
            `Pedido pronto na Mesa ${pedido.mesa_numero}`,
            "Retire na cozinha e entregue ao cliente.",
            "pronto",
          );
        });
    }
    pedidosProntosConhecidosRef.current = prontos;
  }, [push]);
  const fetchReservasGarcom = useCallback(async () => {
    const hoje = dataLocalISO();
    const ate = dataLocalISO(new Date(Date.now() + 1000 * 60 * 60 * 24 * 14));
    const r = await authFetch(`${API}/api/reservas?de=${hoje}&ate=${ate}`);
    const dados = await r.json().catch(() => []);
    if (!r.ok) {
      throw new Error(dados.erro || "Nao foi possivel carregar reservas");
    }
    setReservasGarcom(Array.isArray(dados) ? dados : []);
  }, []);

  const fetchCardapio = useCallback(async () => {
    const r = await fetch(
      apiComRestaurante("/api/cardapio", usuario.restaurante_slug),
    );
    setCardapio(await r.json());
  }, [usuario.restaurante_slug]);

  const addCarrinho = (p) =>
    setCarrinhoPedido((prev) => {
      const ex = prev.find((i) => i.produto_id === p.id);
      if (ex)
        return prev.map((i) =>
          i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i,
        );
      return [
        ...prev,
        { produto_id: p.id, nome: p.nome, preco: p.preco, quantidade: 1 },
      ];
    });
  const remCarrinho = (id) =>
    setCarrinhoPedido((prev) => {
      const ex = prev.find((i) => i.produto_id === id);
      if (ex?.quantidade === 1) return prev.filter((i) => i.produto_id !== id);
      return prev.map((i) =>
        i.produto_id === id ? { ...i, quantidade: i.quantidade - 1 } : i,
      );
    });
  const qtdCarrinho = (id) =>
    carrinhoPedido.find((i) => i.produto_id === id)?.quantidade || 0;
  const totalCarrinho = carrinhoPedido.reduce(
    (s, i) => s + i.preco * i.quantidade,
    0,
  );

  const abrirCardapio = (mesa) => {
    setCardapioModal(mesa);
    setCarrinhoPedido([]);
    setCatAtiva(null);
    setPedidoStatusGarcom("");
    fetchCardapio();
  };

  const enviarPedidoGarcom = async () => {
    if (!carrinhoPedido.length || !cardapioModal) return;
    setEnviandoPedido(true);
    setPedidoStatusGarcom("");
    try {
      const resposta = await authFetch(`${API}/api/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa_id: cardapioModal.id,
          itens: carrinhoPedido.map((i) => ({ ...i, observacao: "" })),
          restaurante_slug: usuario.restaurante_slug,
        }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(dados.erro || "Nao foi possivel enviar o pedido.");
      }

      const numeroMesa = cardapioModal.numero;
      setCardapioModal(null);
      setCarrinhoPedido([]);
      push("Pedido enviado", `Mesa ${numeroMesa} enviada para a cozinha.`, "pronto");
      await Promise.all([fetchPedidos(), fetchMesas()]);
    } catch (error) {
      setPedidoStatusGarcom(error.message);
      push("Pedido nao enviado", error.message, "erro");
    } finally {
      setEnviandoPedido(false);
    }
  };

  useEffect(() => {
    fetchChamadas();
    fetchMesas();
    fetchPedidos();
    fetchReservasGarcom().catch((error) =>
      setReservaStatusGarcom({ tipo: "error", mensagem: error.message }),
    );
    const s = getSocket();

    // Cliente chama garçom com nome e mesa.
    s.on("chamada_garcom", (data) => {
      fetchChamadas();
      const isPag = data.motivo?.startsWith("conta:");
      const forma = isPag ? formataPag(data.motivo.split(":")[1]) : null;
      const cliente = data.nome_cliente || "Cliente";
      // Item 5: exibe nome + mesa na notificacao
      if (isPag) {
        // Item 2: forma de pagamento na notificacao
        push(
          `${cliente} da Mesa ${data.mesa_numero} solicitou a conta`,
          `Forma de pagamento: ${forma}`,
          "conta",
        );
      } else {
        push(
          `${cliente} da Mesa ${data.mesa_numero} solicitando garçom`,
          "Dirija-se a mesa",
          "chamada",
        );
      }
      bellRef.current?.classList.add("ring");
      setTimeout(() => bellRef.current?.classList.remove("ring"), 700);
    });

    // Pedido pronto na cozinha
    s.on("pedido_pronto", () => {
      fetchPedidos();
      playNotifSound("pronto");
    });

    s.on("chamada_atendida", fetchChamadas);
    s.on("mesa_atualizada", fetchMesas);
    s.on("novo_pedido", fetchPedidos);
    s.on("pedido_atualizado", fetchPedidos);
    s.on("nova_reserva", fetchReservasGarcom);
    s.on("reserva_atualizada", fetchReservasGarcom);
    return () => {
      s.off("chamada_garcom");
      s.off("pedido_pronto");
      s.off("chamada_atendida");
      s.off("mesa_atualizada");
      s.off("novo_pedido");
      s.off("pedido_atualizado");
      s.off("nova_reserva");
      s.off("reserva_atualizada");
    };
  }, [fetchChamadas, fetchMesas, fetchPedidos, fetchReservasGarcom, push]);

  useOperationalSync(() => {
    fetchChamadas({ notificarNovas: true });
    fetchMesas();
    fetchPedidos({ notificarProntos: true });
    fetchReservasGarcom().catch((error) =>
      setReservaStatusGarcom({ tipo: "error", mensagem: error.message }),
    );
  }, SYNC_INTERVALS.equipe, true);

  const atenderChamada = async (id) => {
    await authFetch(`${API}/api/chamadas/${id}/atender`, { method: "PATCH" });
    fetchChamadas();
  };

  const fecharMesa = async (mesa_id, forma_pagamento, obs_pagamento) => {
    await authFetch(`${API}/api/mesas/${mesa_id}/fechar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forma_pagamento, obs_pagamento }),
    });
    setContaModal(null);
    setFormaPagSel(null);
    setObsFormaPag("");
    fetchMesas();
    fetchPedidos();
  };

  const verHistoricoMesa = async (mesa) => {
    const r = await authFetch(`${API}/api/pedidos?mesa_id=${mesa.id}`);
    const d = await r.json().catch(() => []);
    if (!r.ok || !Array.isArray(d)) {
      const mensagem = d.erro || "Nao foi possivel carregar o historico da mesa.";
      setHistoricoItens([]);
      setHistoricoErro(mensagem);
      setHistoricoModal(mesa);
      push("Histórico da mesa", mensagem, "erro");
      return;
    }
    setHistoricoErro("");
    setHistoricoItens(d.filter((p) => p.status !== "finalizado"));
    setHistoricoModal(mesa);
  };

  const confirmarRetirada = async (pedido_id) => {
    await authFetch(`${API}/api/pedidos/${pedido_id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "entregue",
        garcom_id: usuario?.id,
        garcom_nome: usuario?.nome,
      }),
    });
    fetchPedidos();
  };

  const alterarReservaGarcom = async (reserva, status, mesaId) => {
    setReservaAtualizando(reserva.id);
    setReservaStatusGarcom({ tipo: "loading", mensagem: "" });
    try {
      const payload = { status };
      if (mesaId !== undefined) payload.mesa_id = mesaId || null;
      const r = await authFetch(`${API}/api/reservas/${reserva.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(dados.erro || "Nao foi possivel atualizar a reserva");
      }
      setReservaStatusGarcom({ tipo: "success", mensagem: "Reserva atualizada." });
      fetchReservasGarcom();
      fetchMesas();
    } catch (error) {
      setReservaStatusGarcom({ tipo: "error", mensagem: error.message });
      push("Reservas", error.message, "conta");
    } finally {
      setReservaAtualizando(null);
    }
  };

  const abrirHistoricoReservaGarcom = async (reserva) => {
    setHistoricoReservaGarcom({
      reserva,
      eventos: [],
      carregando: true,
      erro: "",
    });
    try {
      const r = await authFetch(`${API}/api/reservas/${reserva.id}/eventos`);
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(dados.erro || "Nao foi possivel carregar o historico");
      }
      setHistoricoReservaGarcom({
        reserva,
        eventos: Array.isArray(dados.eventos) ? dados.eventos : [],
        carregando: false,
        erro: "",
      });
    } catch (error) {
      setHistoricoReservaGarcom({
        reserva,
        eventos: [],
        carregando: false,
        erro: error.message,
      });
    }
  };

  const registrarCompartilhamentoReservaGarcom = async (reserva, canal) => {
    try {
      await authFetch(`${API}/api/reservas/${reserva.id}/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal }),
      });
    } catch (error) {
      console.warn("Nao foi possivel registrar compartilhamento:", error);
    }
  };

  const pedidosAbertosDaMesa = (mid) =>
    pedidos.filter((p) => p.mesa_id === mid && p.status !== "finalizado");
  const pedidosDaMesa = (mid) =>
    pedidosAbertosDaMesa(mid).filter((p) => p.status !== "entregue");
  const totalPedido = (pedido) =>
    pedido.itens
      ?.filter((i) => i.status !== "cancelado")
      .reduce((s, i) => s + i.preco * i.quantidade, 0) || 0;
  const totalMesa = (mid) =>
    pedidosAbertosDaMesa(mid).reduce((s, p) => s + totalPedido(p), 0);
  const totalPedidosAtivosMesa = (mid) =>
    pedidosDaMesa(mid).reduce((s, p) => s + totalPedido(p), 0);
  const abrirFechamentoMesa = (mesa) => {
    setContaModal({
      ...mesa,
      pedidos: pedidosAbertosDaMesa(mesa.id),
      total: totalMesa(mesa.id),
    });
  };
  const pedidosProntos = pedidos.filter(pedidoProntoParaRetirada);
  const pedidosContaModal = contaModal
    ? contaModal.pedidos || pedidosAbertosDaMesa(contaModal.id)
    : [];
  const totalContaModal = contaModal
    ? Number(contaModal.total ?? totalMesa(contaModal.id))
    : 0;
  const reservasHojeGarcom = reservasGarcom.filter(
    (reserva) => reserva.data_reserva === dataLocalISO(),
  );
  const reservasAtivasGarcom = reservasGarcom.filter((reserva) =>
    ["pendente", "confirmada", "fila", "chamada"].includes(reserva.status),
  );
  const reservasSemMesaGarcom = reservasAtivasGarcom.filter((reserva) => !reserva.mesa_id);
  const reservasFilaGarcom = reservasGarcom.filter((reserva) => reserva.status === "fila");
  const reservasChamadasGarcom = reservasGarcom.filter((reserva) => reserva.status === "chamada");
  const mesasDisponiveisParaReserva = (reserva) =>
    mesas.filter(
      (mesa) =>
        mesa.status === "livre" || String(mesa.id) === String(reserva.mesa_id || ""),
    );

  return (
    <>
      <style>{css}</style>
      <NotifBanner notifs={notifs} onDismiss={dismiss} />
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <PanelHeader
          title="Garçom"
          subtitle="Chamadas, mesas e pedidos do salão"
          usuario={usuario}
          onLogout={onLogout}
          actions={
            <>
              <span
                ref={bellRef}
                style={{ fontSize: 18, transition: "transform .1s" }}
              ></span>
              {chamadas.length + pedidosProntos.length > 0 && (
                <span
                  className="pulse"
                  style={{
                    background: T.red,
                    color: "#fff",
                    borderRadius: 99,
                    padding: "2px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {chamadas.length + pedidosProntos.length}
                </span>
              )}
            </>
          }
        />
        <div style={{ padding: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {[
              ["mesas", "Mesas"],
              ["reservas", `Reservas (${reservasAtivasGarcom.length})`],
            ].map(([valor, label]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setVisaoGarcom(valor)}
                style={{
                  minHeight: 42,
                  borderRadius: 8,
                  border: `1px solid ${visaoGarcom === valor ? T.accent : T.border}`,
                  background: visaoGarcom === valor ? T.accentGlow : T.card,
                  color: visaoGarcom === valor ? T.accent : T.text2,
                  cursor: "pointer",
                  fontFamily: "Inter,sans-serif",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {visaoGarcom === "mesas" && (
            <>
          {/* Chamadas — Item 5: mostra nome + mesa */}
          {chamadas.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.accent,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                Chamadas Pendentes
              </div>
              {chamadas.map((c) => {
                const isPag = c.motivo?.startsWith("conta:");
                const forma = isPag ? formataPag(c.motivo.split(":")[1]) : null;
                const cliente = c.nome_cliente || "Cliente";
                return (
                  <Card
                    key={c.id}
                    className="fade-up"
                    style={{
                      marginBottom: 8,
                      borderColor: isPag ? T.amber : T.border,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        {/* Item 5: "{nome} da mesa X solicitando..." */}
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {isPag
                            ? `${cliente} da Mesa ${c.mesa_numero} solicitou a conta`
                            : `${cliente} da Mesa ${c.mesa_numero} solicitando garçom`}
                        </div>
                        {isPag && (
                          <div
                            style={{
                              fontSize: 13,
                              color: T.amber,
                              marginTop: 4,
                            }}
                          >
                            Pagamento: {forma}
                          </div>
                        )}
                        <div
                          style={{ fontSize: 11, color: T.muted, marginTop: 3 }}
                        >
                          {new Date(c.criado_em).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <Btn
                        sm
                        variant={isPag ? "amber" : "success"}
                        onClick={() => atenderChamada(c.id)}
                      >
                        {isPag ? "Ir cobrar" : "Atender"}
                      </Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Prontos para buscar */}
          {pedidosProntos.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.green,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                Prontos para Buscar
              </div>
              {pedidosProntos.map((p) => (
                <Card
                  key={p.id}
                  className="fade-up"
                  style={{ marginBottom: 8, borderColor: T.green }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        Mesa {p.mesa_numero} - Pedido #{p.numero_dia || p.id}
                      </div>
                      <div
                        style={{ color: T.muted, fontSize: 12, marginTop: 2 }}
                      >
                        {
                          p.itens?.filter((i) => i.status !== "cancelado")
                            .length
                        }{" "}
                        item(s) prontos
                      </div>
                    </div>
                    <Btn
                      sm
                      variant="success"
                      onClick={() => confirmarRetirada(p.id)}
                    >
                      Peguei
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Mesas */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.muted,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            Mesas
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(145px,1fr))",
              gap: 10,
            }}
          >
            {mesas.map((m) => (
              <Card
                key={m.id}
                style={{
                  textAlign: "center",
                  borderColor: m.status === "ocupada" ? T.accent : T.border,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Manrope',sans-serif",
                    fontSize: 26,
                    fontWeight: 700,
                  }}
                >
                  {m.numero}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    margin: "6px 0 8px",
                    color: m.status === "ocupada" ? T.accent : T.green,
                  }}
                >
                  {m.status === "ocupada" ? "Ocupada" : "Livre"}
                </div>
                {m.status === "ocupada" && (
                  <>
                    <div
                      style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}
                    >
                      Total:{" "}
                      <span style={{ color: T.accent, fontWeight: 700 }}>
                        R$ {totalMesa(m.id).toFixed(2)}
                      </span>
                    </div>
                    <Btn
                      sm
                      full
                      variant="info"
                      onClick={() => setPedidosModal(m)}
                      style={{ marginBottom: 6 }}
                    >
                      Ver Pedidos
                    </Btn>
                    <Btn
                      sm
                      full
                      variant="ghost"
                      onClick={() => verHistoricoMesa(m)}
                      style={{ marginBottom: 6 }}
                    >
                      Histórico
                    </Btn>
                    <Btn
                      sm
                      full
                      variant="success"
                      onClick={() => abrirCardapio(m)}
                      style={{ marginBottom: 6 }}
                    >
                      Fazer Pedido
                    </Btn>
                    <Btn
                      sm
                      full
                      variant="danger"
                      onClick={() => abrirFechamentoMesa(m)}
                    >
                      Fechar Mesa
                    </Btn>
                  </>
                )}
                {m.status === "livre" && (
                  <Btn
                    sm
                    full
                    variant="success"
                    onClick={() => abrirCardapio(m)}
                    style={{ marginTop: 6 }}
                  >
                    Fazer Pedido
                  </Btn>
                )}
              </Card>
            ))}
          </div>
            </>
          )}

          {visaoGarcom === "reservas" && (
            <div className="fade-up">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                {[
                  ["Hoje", reservasHojeGarcom.length, T.accent],
                  ["Ativas", reservasAtivasGarcom.length, T.green],
                  ["Fila", reservasFilaGarcom.length, T.amber],
                  ["Chamados", reservasChamadasGarcom.length, T.green],
                  ["Sem mesa", reservasSemMesaGarcom.length, T.muted],
                ].map(([label, total, cor]) => (
                  <Card key={label} style={{ background: T.card2 }}>
                    <div style={{ color: T.muted, fontSize: 12, marginBottom: 4 }}>
                      {label}
                    </div>
                    <div
                      style={{
                        color: cor,
                        fontFamily: "'Manrope',sans-serif",
                        fontSize: 26,
                        fontWeight: 800,
                      }}
                    >
                      {total}
                    </div>
                  </Card>
                ))}
              </div>

              <div
                role="status"
                style={{
                  minHeight: 24,
                  marginBottom: 10,
                  color:
                    reservaStatusGarcom.tipo === "error"
                      ? T.red
                      : reservaStatusGarcom.tipo === "success"
                        ? T.green
                        : T.muted,
                  fontSize: 12,
                  fontWeight: reservaStatusGarcom.tipo === "success" ? 800 : 600,
                }}
              >
                {reservaStatusGarcom.mensagem}
              </div>

              {reservasGarcom.length === 0 ? (
                <Card>
                  <div style={{ color: T.muted, fontSize: 13 }}>
                    Nenhuma reserva para os próximos dias.
                  </div>
                </Card>
              ) : (
                reservasGarcom.map((reserva) => {
                  const atualizando = reservaAtualizando === reserva.id;
                  const mesasDaReserva = mesasDisponiveisParaReserva(reserva);
                  return (
                    <Card
                      key={reserva.id}
                      style={{
                        marginBottom: 10,
                        borderColor:
                          reserva.status === "confirmada"
                            ? T.green
                            : reserva.status === "cancelada"
                              ? "rgba(192,57,43,.35)"
                              : T.border,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                          gap: 14,
                          alignItems: "start",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                              marginBottom: 6,
                            }}
                          >
                            <strong>{reserva.nome_cliente}</strong>
                            <Badge status={reserva.status} />
                          </div>
                          <div style={{ color: T.text2, fontSize: 13 }}>
                            {formatarDataReserva(reserva.data_reserva)} as {reserva.horario}
                          </div>
                          <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                            {reserva.quantidade_pessoas} pessoa(s) · {reserva.telefone}
                            {reserva.email ? ` · ${reserva.email}` : ""}
                            {reserva.salao_nome ? ` · ${reserva.salao_nome}` : ""}
                          </div>
                          <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                            {reserva.tipo === "fila" ? "Fila de espera" : "Reserva programada"}
                            {reserva.status === "fila" && reserva.posicao_fila
                              ? ` · Posicao ${reserva.posicao_fila}`
                              : ""}
                            {reserva.codigo_acompanhamento
                              ? ` · Cod. ${reserva.codigo_acompanhamento}`
                              : ""}
                          </div>
                          {reserva.observacao && (
                            <div style={{ color: T.muted, fontSize: 12, marginTop: 6 }}>
                              {reserva.observacao}
                            </div>
                          )}
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              color: T.muted,
                              fontSize: 11,
                              fontWeight: 800,
                              marginBottom: 6,
                              textTransform: "uppercase",
                            }}
                          >
                            Mesa
                          </label>
                          <select
                            value={reserva.mesa_id || ""}
                            disabled={atualizando || ["concluida", "cancelada"].includes(reserva.status)}
                            onChange={(e) =>
                              alterarReservaGarcom(reserva, reserva.status, e.target.value)
                            }
                            style={{
                              width: "100%",
                              height: 38,
                              border: `1px solid ${T.border2}`,
                              borderRadius: 8,
                              background: T.card2,
                              color: T.text,
                              fontSize: 13,
                              padding: "0 10px",
                            }}
                          >
                            <option value="">Sem mesa</option>
                            {mesasDaReserva.map((mesa) => (
                              <option key={mesa.id} value={mesa.id}>
                                Mesa {mesa.numero}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 14,
                        }}
                      >
                        {reserva.status === "pendente" && (
                          <Btn
                            sm
                            variant="success"
                            disabled={atualizando}
                            onClick={() => alterarReservaGarcom(reserva, "confirmada")}
                          >
                            Confirmar chegada
                          </Btn>
                        )}
                        {["pendente", "confirmada"].includes(reserva.status) && (
                          <Btn
                            sm
                            variant="amber"
                            disabled={atualizando}
                            onClick={() => alterarReservaGarcom(reserva, "fila")}
                          >
                            Colocar na fila
                          </Btn>
                        )}
                        {reserva.status === "fila" && (
                          <Btn
                            sm
                            variant="info"
                            disabled={atualizando}
                            onClick={() => alterarReservaGarcom(reserva, "chamada")}
                          >
                            Chamar cliente
                          </Btn>
                        )}
                        {reserva.status === "chamada" && (
                          <Btn
                            sm
                            variant="ghost"
                            disabled={atualizando}
                            onClick={() => alterarReservaGarcom(reserva, "fila")}
                          >
                            Voltar para fila
                          </Btn>
                        )}
                        {["confirmada", "fila", "chamada"].includes(reserva.status) && (
                          <Btn
                            sm
                            variant="success"
                            disabled={atualizando || !reserva.mesa_id}
                            onClick={() => alterarReservaGarcom(reserva, "concluida")}
                          >
                            Acomodar
                          </Btn>
                        )}
                        {["pendente", "confirmada", "fila", "chamada"].includes(reserva.status) && (
                          <Btn
                            sm
                            variant="danger"
                            disabled={atualizando}
                            onClick={() => alterarReservaGarcom(reserva, "cancelada")}
                          >
                            Cancelar
                          </Btn>
                        )}
                        {reserva.status === "cancelada" && (
                          <Btn
                            sm
                            variant="ghost"
                            disabled={atualizando}
                            onClick={() => alterarReservaGarcom(reserva, "pendente")}
                          >
                            Reabrir
                          </Btn>
                        )}
                        <Btn
                          sm
                          variant="ghost"
                          type="button"
                          onClick={() => abrirHistoricoReservaGarcom(reserva)}
                        >
                          <History size={14} />
                          Historico
                        </Btn>
                        <AcoesCompartilhamentoReserva
                          reserva={reserva}
                          restauranteSlug={usuario.restaurante_slug}
                          nomeRestaurante={marca.nome}
                          onFeedback={(mensagem) =>
                            setReservaStatusGarcom({ tipo: "success", mensagem })
                          }
                          onShare={(canal) =>
                            registrarCompartilhamentoReservaGarcom(reserva, canal)
                          }
                        />
                        {atualizando && (
                          <span style={{ color: T.muted, fontSize: 12, alignSelf: "center" }}>
                            Atualizando...
                          </span>
                        )}
                        {!reserva.mesa_id &&
                          ["confirmada", "fila", "chamada"].includes(reserva.status) && (
                            <span style={{ color: T.muted, fontSize: 12, alignSelf: "center" }}>
                              Defina uma mesa para acomodar.
                            </span>
                          )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </div>

        {historicoReservaGarcom && (
          <HistoricoReservaModal
            reserva={historicoReservaGarcom.reserva}
            eventos={historicoReservaGarcom.eventos}
            carregando={historicoReservaGarcom.carregando}
            erro={historicoReservaGarcom.erro}
            onClose={() => setHistoricoReservaGarcom(null)}
          />
        )}

        {/* Modal ver pedidos da mesa */}
        {pedidosModal && (
          <Modal onClose={() => setPedidosModal(null)}>
            <div
              style={{
                fontFamily: "'Manrope',sans-serif",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              Mesa {pedidosModal.numero} — Pedidos
            </div>
            {pedidosDaMesa(pedidosModal.id).length === 0 ? (
              <div
                style={{
                  color: T.muted,
                  textAlign: "center",
                  padding: "24px 0",
                }}
              >
                Sem pedidos ativos
              </div>
            ) : (
              pedidosDaMesa(pedidosModal.id).map((p) => (
                <div key={p.id} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 12, color: T.muted }}>
                      Pedido #{p.numero_dia || p.id}
                    </span>
                    <Badge status={p.status} />
                  </div>
                  {p.itens?.map((i) => (
                    <div
                      key={i.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        padding: "4px 0",
                        borderTop: `1px solid ${T.border}`,
                        opacity: i.status === "cancelado" ? 0.4 : 1,
                      }}
                    >
                      <span
                        style={{
                          textDecoration:
                            i.status === "cancelado" ? "line-through" : "none",
                        }}
                      >
                        {i.quantidade}x {i.nome}
                      </span>
                      <span style={{ color: T.accent }}>
                        R$ {(i.preco * i.quantidade).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 0",
                borderTop: `1px solid ${T.border2}`,
                marginBottom: 12,
              }}
            >
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: T.accent }}>
                R$ {totalPedidosAtivosMesa(pedidosModal.id).toFixed(2)}
              </span>
            </div>
            <Btn variant="ghost" full onClick={() => setPedidosModal(null)}>
              Fechar
            </Btn>
          </Modal>
        )}

        {historicoModal && (
          <Modal onClose={() => setHistoricoModal(null)}>
            <div
              style={{
                fontFamily: "'Manrope',sans-serif",
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              Histórico - Mesa {historicoModal.numero}
            </div>
            {historicoErro ? (
              <div style={{ color: T.red }}>{historicoErro}</div>
            ) : historicoItens.length === 0 ? (
              <div style={{ color: T.muted }}>Nenhum pedido encontrado.</div>
            ) : (
              historicoItens.map((p) => (
                <div key={p.id} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 12, color: T.muted }}>
                      Pedido #{p.numero_dia || p.id}
                    </span>
                    <Badge status={p.status} />
                  </div>
                  {p.itens
                    ?.filter((i) => i.status !== "cancelado")
                    .map((i) => (
                      <div
                        key={i.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 13,
                          padding: "4px 0",
                          borderTop: `1px solid ${T.border}`,
                        }}
                      >
                        <span>
                          {i.quantidade}x {i.nome}
                        </span>
                        <span style={{ color: T.accent }}>
                          R$ {(i.preco * i.quantidade).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: 6,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: T.muted }}>Subtotal: </span>
                    <span
                      style={{
                        color: T.accent,
                        fontWeight: 700,
                        marginLeft: 6,
                      }}
                    >
                      R${" "}
                      {p.itens
                        ?.filter((i) => i.status !== "cancelado")
                        .reduce((s, i) => s + i.preco * i.quantidade, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
            {historicoItens.length > 0 && (
              <div
                style={{
                  borderTop: `2px solid ${T.border2}`,
                  paddingTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: 700 }}>Total</span>
                <span
                  style={{ fontWeight: 800, fontSize: 18, color: T.accent }}
                >
                  R${" "}
                  {historicoItens
                    .flatMap(
                      (p) =>
                        p.itens?.filter((i) => i.status !== "cancelado") || [],
                    )
                    .reduce((s, i) => s + i.preco * i.quantidade, 0)
                    .toFixed(2)}
                </span>
              </div>
            )}
            <Btn
              variant="ghost"
              full
              onClick={() => setHistoricoModal(null)}
              style={{ marginTop: 16 }}
            >
              Fechar
            </Btn>
          </Modal>
        )}

        {/* Modal fechar conta */}
        {contaModal && (
          <Modal onClose={() => { setContaModal(null); setFormaPagSel(null); setObsFormaPag(""); }}>
            <div style={{ fontFamily: "'Manrope',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
              Fechar Mesa {contaModal.numero}
            </div>

            {/* Itens consumidos */}
            {pedidosContaModal.length === 0 ? (
              <div
                style={{
                  color: T.muted,
                  fontSize: 13,
                  padding: "10px 0 16px",
                  borderTop: `1px solid ${T.border}`,
                }}
              >
                Nenhum pedido aberto para esta mesa.
              </div>
            ) : (
              pedidosContaModal.map((p) => (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Pedido #{p.numero_dia || p.id}</div>
                {p.itens?.map((i) => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderTop: `1px solid ${T.border}`, opacity: i.status === "cancelado" ? 0.4 : 1 }}>
                    <span style={{ textDecoration: i.status === "cancelado" ? "line-through" : "none" }}>{i.quantidade}x {i.nome}</span>
                    <span style={{ color: T.accent }}>R$ {(i.preco * i.quantidade).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              ))
            )}

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${T.border2}`, marginBottom: 20 }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: T.accent }}>R$ {totalContaModal.toFixed(2)}</span>
            </div>

            {/* Forma de pagamento — OBRIGATÓRIA */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: T.text }}>
                Forma de Pagamento <span style={{ color: T.red }}>*</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[["credito","Cartão Crédito"],["debito","Cartão Débito"],["dinheiro","Dinheiro"],["pix","PIX"]].map(([val, label]) => (
                  <div key={val} onClick={() => setFormaPagSel(val)} style={{
                    padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                    border: `1.5px solid ${formaPagSel === val ? T.accent : T.border}`,
                    background: formaPagSel === val ? T.accentGlow : T.card2,
                    color: formaPagSel === val ? T.accent : T.text2,
                    fontWeight: formaPagSel === val ? 700 : 400,
                    fontSize: 13, transition: "all .15s",
                  }}>{label}</div>
                ))}
              </div>
              {/* Campo para múltiplas formas ou observação */}
              <input
                placeholder="Observação (ex: metade credito, metade pix)"
                value={obsFormaPag}
                onChange={e => setObsFormaPag(e.target.value)}
                style={{ marginTop: 10, fontSize: 13 }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setContaModal(null); setFormaPagSel(null); setObsFormaPag(""); }} style={{ flex: 1 }}>Cancelar</Btn>
              <Btn variant="danger" disabled={!formaPagSel} onClick={() => fecharMesa(contaModal.id, formaPagSel, obsFormaPag)} style={{ flex: 1 }}>
                Confirmar Fechamento
              </Btn>
            </div>
          </Modal>
        )}
      </div>

      {/* Modal Cardápio — fazer pedido pela mesa */}
      {cardapioModal && (
        <Modal onClose={() => setCardapioModal(null)}>
          <div
            style={{
              fontFamily: "'Manrope',sans-serif",
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Pedido - Mesa {cardapioModal.numero}
          </div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 14 }}>
            Selecione os itens do cardápio
          </div>

          {/* Filtro categorias */}
          <div
            className="scroll-x"
            style={{
              display: "flex",
              gap: 7,
              paddingBottom: 10,
              marginBottom: 12,
            }}
          >
            <button
              onClick={() => setCatAtiva(null)}
              style={{
                flexShrink: 0,
                padding: "5px 14px",
                borderRadius: 99,
                border: `1px solid ${catAtiva === null ? T.accent : T.border}`,
                background: catAtiva === null ? T.accentGlow : "transparent",
                color: catAtiva === null ? T.accent : T.text2,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "Inter,sans-serif",
              }}
            >
              Todos
            </button>
            {cardapio.categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatAtiva(c.id)}
                style={{
                  flexShrink: 0,
                  padding: "5px 14px",
                  borderRadius: 99,
                  border: `1px solid ${catAtiva === c.id ? T.accent : T.border}`,
                  background: catAtiva === c.id ? T.accentGlow : "transparent",
                  color: catAtiva === c.id ? T.accent : T.text2,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Inter,sans-serif",
                }}
              >
                {c.nome}
              </button>
            ))}
          </div>

          {/* Lista de produtos */}
          <div style={{ maxHeight: 280, overflowY: "auto", marginBottom: 14 }}>
            {(catAtiva === null
              ? cardapio.produtos
              : cardapio.produtos.filter((p) => p.categoria_id === catAtiva)
            ).map((p) => {
              const q = qtdCarrinho(p.id);
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: `1px solid ${T.border}`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {p.nome}
                    </div>
                    <div
                      style={{ color: T.accent, fontSize: 13, fontWeight: 700 }}
                    >
                      R$ {p.preco.toFixed(2)}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {q > 0 && (
                      <button
                        onClick={() => remCarrinho(p.id)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          background: T.card2,
                          border: `1px solid ${T.border2}`,
                          color: "black",
                          cursor: "pointer",
                          fontSize: 14,
                          fontWeight: 800,
                        }}
                      >
                        -
                      </button>
                    )}
                    {q > 0 && (
                      <span
                        style={{
                          fontWeight: 700,
                          minWidth: 16,
                          textAlign: "center",
                        }}
                      >
                        {q}
                      </span>
                    )}
                    <button
                      onClick={() => addCarrinho(p)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: `linear-gradient(135deg,${T.accent},${T.accent2})`,
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total e confirmar */}
          {carrinhoPedido.length > 0 && (
            <div
              style={{
                borderTop: `1px solid ${T.border2}`,
                paddingTop: 12,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 600 }}>Total</span>
                <span
                  style={{ fontWeight: 800, color: T.accent, fontSize: 16 }}
                >
                  R$ {totalCarrinho.toFixed(2)}
                </span>
              </div>
              {carrinhoPedido.map((i) => (
                <div
                  key={i.produto_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: T.muted,
                  }}
                >
                  <span>
                    {i.quantidade}x {i.nome}
                  </span>
                  <span>R$ {(i.preco * i.quantidade).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <div
            role="status"
            style={{
              minHeight: pedidoStatusGarcom ? 22 : 0,
              marginBottom: pedidoStatusGarcom ? 10 : 0,
              color: T.red,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {pedidoStatusGarcom}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn
              variant="ghost"
              onClick={() => setCardapioModal(null)}
              style={{ flex: 1 }}
            >
              Cancelar
            </Btn>
            <Btn
              onClick={enviarPedidoGarcom}
              disabled={!carrinhoPedido.length || enviandoPedido}
              style={{ flex: 2 }}
            >
              {enviandoPedido ? "Enviando..." : "Confirmar Pedido"}
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── PAINEL COZINHA ───────────────────────────────────────────────────────────
function PainelCozinha({ usuario, onLogout }) {
  const marca = useBranding();
  const [pedidos, setPedidos] = useState([]);
  const [chamadas, setChamadas] = useState([]);
  const [dragging, setDragging] = useState(null);

  const css = gerarCSS(T);
  useEffect(() => {
    document.title = `Cozinha - ${marca.nome}`;
  }, [marca.nome]);

  const fetchPedidos = useCallback(async () => {
    const [r1, r2, r3] = await Promise.all([
      authFetch(`${API}/api/pedidos?status=pendente`),
      authFetch(`${API}/api/pedidos?status=preparo`),
      authFetch(`${API}/api/pedidos?status=pronto`),
    ]);
    const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
    setPedidos([...d1, ...d2, ...d3]);
  }, []);
  const fetchChamadas = useCallback(async () => {
    const r = await authFetch(`${API}/api/chamadas`);
    setChamadas(await r.json());
  }, []);

  useEffect(() => {
    const carregamentoInicial = window.setTimeout(() => {
      fetchPedidos();
      fetchChamadas();
    }, 0);
    const s = getSocket();
    s.on("novo_pedido", fetchPedidos);
    s.on("pedido_atualizado", fetchPedidos);
    s.on("chamada_garcom", fetchChamadas);
    s.on("chamada_atendida", fetchChamadas);
    return () => {
      window.clearTimeout(carregamentoInicial);
      s.off("novo_pedido");
      s.off("pedido_atualizado");
      s.off("chamada_garcom");
      s.off("chamada_atendida");
    };
  }, [fetchPedidos, fetchChamadas]);

  useOperationalSync(() => {
    fetchPedidos();
    fetchChamadas();
  }, SYNC_INTERVALS.equipe, true);

  // Move todos os itens do pedido para um status
  const moverTudo = async (pedido, novoStatus) => {
    const itensAlvo =
      pedido.itens?.filter(
        (i) => i.status !== "cancelado" && i.status !== novoStatus,
      ) || [];
    await Promise.all(
      itensAlvo.map((i) =>
        authFetch(`${API}/api/itens/${i.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: novoStatus }),
        }),
      ),
    );
    if (novoStatus === "pronto") {
      getSocket().emit("pedido_ficou_pronto", {
        pedido_id: pedido.id,
        mesa_numero: pedido.mesa_numero,
      });
    }
    fetchPedidos();
  };

  const atenderChamada = async (id) => {
    await authFetch(`${API}/api/chamadas/${id}/atender`, { method: "PATCH" });
    fetchChamadas();
  };
  const onDropColuna = async (novoStatus) => {
    if (!dragging) return;
    await moverTudo(dragging, novoStatus);
    setDragging(null);
  };

  // Classifica pedidos por status predominante (ignora cancelados)
  const itensSemCancelados = (p) =>
    p.itens?.filter((i) => i.status !== "cancelado") || [];
  const pendentes = pedidos.filter(
    (p) =>
      itensSemCancelados(p).length > 0 &&
      itensSemCancelados(p).every((i) => i.status === "pendente"),
  );
  const preparando = pedidos.filter(
    (p) =>
      itensSemCancelados(p).some((i) => i.status === "preparo") &&
      !itensSemCancelados(p).every((i) => i.status === "pronto"),
  );
  const prontos = pedidos.filter(
    (p) =>
      itensSemCancelados(p).length > 0 &&
      itensSemCancelados(p).every((i) => i.status === "pronto"),
  );

  const colunas = [
    {
      key: "pendente",
      label: "Recebido",
      cor: T.accent,
      lista: pendentes,
      proxLabel: "Preparando",
      proxKey: "preparo",
    },
    {
      key: "preparo",
      label: "Preparando",
      cor: T.blue,
      lista: preparando,
      proxLabel: "Pronto",
      proxKey: "pronto",
    },
    {
      key: "pronto",
      label: "Pronto",
      cor: T.green,
      lista: prontos,
      voltaLabel: "Preparando",
      voltaKey: "preparo",
    },
  ];

  return (
    <>
      <style>{css}</style>
      <div
        style={{
          height: "100vh",
          background: T.bg,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <PanelHeader
          title="Cozinha"
          subtitle="Kanban de preparo em tempo real"
          usuario={usuario}
          onLogout={onLogout}
          actions={
            pedidos.length > 0 ? (
              <span
                className="pulse"
                style={{
                  background: T.red,
                  color: "#fff",
                  borderRadius: 99,
                  padding: "3px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {pedidos.length} ativo{pedidos.length > 1 ? "s" : ""}
              </span>
            ) : null
          }
        />

        {/* Chamadas */}
        {chamadas.length > 0 && (
          <div
            style={{
              background: `${T.accent}10`,
              borderBottom: `1px solid ${T.accent}33`,
              padding: "8px 14px",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            {chamadas.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "5px 10px",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  Mesa {c.mesa_numero}
                </span>
                <span style={{ color: T.muted, fontSize: 12 }}>
                  {c.motivo?.startsWith("conta") ? "Conta" : "Garçom"}
                </span>
                <Btn sm variant="success" onClick={() => atenderChamada(c.id)}>
                  Ok
                </Btn>
              </div>
            ))}
          </div>
        )}

        {/* Kanban 3 colunas */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {colunas.map((col, ci) => (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.background = T.accentGlow;
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.background = "";
              }}
              onDrop={(e) => {
                e.currentTarget.style.background = "";
                onDropColuna(col.key);
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: ci < 2 ? `1px solid ${T.border}` : undefined,
                overflow: "hidden",
              }}
            >
              {/* Header coluna */}
              <div
                style={{
                  padding: "10px 10px 8px",
                  borderBottom: `2px solid ${col.cor}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: col.cor }}>
                  {col.label}
                </div>
                <div
                  style={{
                    background: col.cor + "22",
                    color: col.cor,
                    borderRadius: 99,
                    width: 22,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {col.lista.length}
                </div>
              </div>

              {/* Botao mover tudo avançar */}
              {col.lista.length > 0 && col.proxKey && (
                <button
                  onClick={() =>
                    col.lista.forEach((p) => moverTudo(p, col.proxKey))
                  }
                  style={{
                    margin: "6px 8px 0",
                    padding: "5px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    background: col.cor + "18",
                    border: `1px solid ${col.cor}44`,
                    borderRadius: 8,
                    color: col.cor,
                    cursor: "pointer",
                    fontFamily: "Inter,sans-serif",
                  }}
                >
                  Mover tudo para {col.proxLabel}
                </button>
              )}

              {/* Cards */}
              <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
                {col.lista.length === 0 ? (
                  <div
                    style={{
                      border: `1.5px dashed ${T.border}`,
                      borderRadius: 8,
                      padding: "24px 8px",
                      textAlign: "center",
                      color: T.muted,
                      fontSize: 11,
                      marginTop: 8,
                    }}
                  >
                    Arraste aqui
                  </div>
                ) : (
                  col.lista.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragging(p)}
                      className="fade-up"
                      style={{
                        background: T.card,
                        border: `1px solid ${T.border}`,
                        borderLeft: `3px solid ${col.cor}`,
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 8,
                        cursor: "grab",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                          alignItems: "flex-start",
                          gap: 6,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontFamily: "'Manrope',sans-serif",
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            Mesa {p.mesa_numero}
                          </div>
                          <div style={{ color: T.muted, fontSize: 10 }}>
                            #{p.id} ·{" "}
                            {new Date(p.criado_em).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            flexShrink: 0,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          {/* Item 8: voltar status */}
                          {col.voltaKey && (
                            <Btn
                              sm
                              variant="ghost"
                              onClick={() => moverTudo(p, col.voltaKey)}
                            >
                              Voltar
                            </Btn>
                          )}
                          {col.proxKey && (
                            <Btn
                              sm
                              variant={
                                col.key === "pendente" ? "info" : "success"
                              }
                              onClick={() => moverTudo(p, col.proxKey)}
                            >
                              {col.proxLabel}
                            </Btn>
                          )}
                        </div>
                      </div>
                      {itensSemCancelados(p).map((item) => (
                        <div
                          key={item.id}
                          style={{
                            fontSize: 12,
                            padding: "3px 0",
                            borderTop: `1px solid ${T.border}`,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: T.text2 }}>
                            {item.quantidade}x {item.nome}
                          </span>
                          {item.observacao && (
                            <span style={{ color: T.amber, fontSize: 10 }}>
                              ! {item.observacao}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── PAINEL ADMIN ─────────────────────────────────────────────────────────────
function PainelAdmin({ usuario, onLogout }) {
  const marca = useBranding();
  const [aba, setAba] = useState(() => {
    const abaInicial = new URLSearchParams(window.location.search).get("aba");
    return ADMIN_TABS.includes(abaInicial) ? abaInicial : "produtos";
  });
  const [cardapio, setCardapio] = useState({ categorias: [], produtos: [] });
  const [busca, setBusca] = useState("");
  const [novoP, setNovoP] = useState({
    categoria_id: "",
    nome: "",
    descricao: "",
    preco: "",
    imagem: "",
  });
  const [editando, setEditando] = useState(null);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [qrModal, setQrModal] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [novaMesa, setNovaMesa] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [novoUsuario, setNovoUsuario] = useState({
    nome: "",
    login: "",
    role: "garcom",
    senha: "",
  });
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [relatorio, setRelatorio] = useState({
    dados: [],
    totalGeral: 0,
    carregando: false,
  });
  const [periodoRel, setPeriodoRel] = useState("hoje");
  const [dataInicioRel, setDataInicioRel] = useState("");
  const [dataFimRel, setDataFimRel] = useState("");
  const [marcaConfig, setMarcaConfig] = useState(WHITE_LABEL_PADRAO);
  const [marcaStatus, setMarcaStatus] = useState({ tipo: "idle", mensagem: "" });
  const [reservas, setReservas] = useState([]);
  const [reservaStatus, setReservaStatus] = useState({ tipo: "idle", mensagem: "" });
  const [reservaConfig, setReservaConfig] = useState(RESERVA_CONFIG_PADRAO);
  const [reservaSaloes, setReservaSaloes] = useState([]);
  const [reservaConfigStatus, setReservaConfigStatus] = useState({
    tipo: "idle",
    mensagem: "",
  });
  const [novoSalaoReserva, setNovoSalaoReserva] = useState({
    nome: "",
    capacidade_pessoas: 40,
  });
  const [historicoReservaAdmin, setHistoricoReservaAdmin] = useState(null);
  const [novaReserva, setNovaReserva] = useState({
    tipo: "reserva",
    nome_cliente: "",
    telefone: "",
    email: "",
    data_reserva: dataReservaInicial(),
    horario: "19:30",
    quantidade_pessoas: 2,
    mesa_id: "",
    salao_id: "",
    observacao: "",
  });

  const css = gerarCSS(T);
  useEffect(() => {
    document.title = `Admin - ${marca.nome}`;
  }, [marca.nome]);

  const fetchCardapio = useCallback(async () => {
    const r = await fetch(
      apiComRestaurante("/api/cardapio", usuario.restaurante_slug),
    );
    setCardapio(await r.json());
  }, [usuario.restaurante_slug]);
  const fetchMesas = useCallback(async () => {
    const r = await authFetch(`${API}/api/mesas`);
    setMesas(await r.json());
  }, []);
  const fetchUsuarios = useCallback(async () => {
    const r = await authFetch(`${API}/api/usuarios`);
    setUsuarios(await r.json());
  }, []);
  const fetchReservas = useCallback(async () => {
    const r = await authFetch(`${API}/api/reservas`);
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.erro || "Nao foi possivel carregar reservas");
    setReservas(Array.isArray(dados) ? dados : []);
  }, []);
  const fetchReservaConfiguracao = useCallback(async () => {
    const r = await authFetch(`${API}/api/reservas/configuracao`);
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(dados.erro || "Nao foi possivel carregar regras de reserva");
    }
    setReservaConfig(normalizarConfigReservaFrontend(dados.configuracao));
    setReservaSaloes(Array.isArray(dados.saloes) ? dados.saloes : []);
  }, []);
  const recarregarReservas = useCallback(() => {
    fetchReservas().catch((error) =>
      setReservaStatus({ tipo: "error", mensagem: error.message }),
    );
  }, [fetchReservas]);
  const fetchRestaurante = useCallback(async () => {
    const r = await authFetch(`${API}/api/restaurante`);
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.erro || "Não foi possível carregar a marca");
    setMarcaConfig(normalizarWhiteLabel(dados));
  }, []);
  const fetchRelatorio = useCallback(async (periodo, di, df) => {
    setRelatorio((prev) => ({ ...prev, carregando: true }));
    let url = `${API}/api/relatorio?periodo=${periodo || "hoje"}`;
    if (di) url += `&dataInicio=${di}`;
    if (df) url += `&dataFim=${df}`;
    const r = await authFetch(url);
    const d = await r.json();
    setRelatorio({
      dados: d.rows || [],
      totalGeral: d.totalGeral || 0,
      carregando: false,
    });
  }, []);

  useEffect(() => {
    fetchCardapio();
    fetchMesas();
    fetchUsuarios();
    recarregarReservas();
    fetchReservaConfiguracao().catch((error) =>
      setReservaConfigStatus({ tipo: "error", mensagem: error.message }),
    );
    fetchRelatorio("hoje");
    const s = getSocket();
    s.on("cardapio_atualizado", fetchCardapio);
    s.on("nova_reserva", recarregarReservas);
    s.on("reserva_atualizada", recarregarReservas);
    return () => {
      s.off("cardapio_atualizado", fetchCardapio);
      s.off("nova_reserva", recarregarReservas);
      s.off("reserva_atualizada", recarregarReservas);
    };
  }, [
    fetchCardapio,
    fetchMesas,
    fetchUsuarios,
    recarregarReservas,
    fetchReservaConfiguracao,
    fetchRelatorio,
  ]);

  useOperationalSync(() => {
    fetchCardapio();
    fetchMesas();
    fetchUsuarios();
    recarregarReservas();
  }, SYNC_INTERVALS.admin, true);

  useEffect(() => {
    fetchRestaurante().catch((error) => {
      setMarcaStatus({ tipo: "error", mensagem: error.message });
    });
  }, [fetchRestaurante]);

  const salvarMarca = async () => {
    setMarcaStatus({ tipo: "loading", mensagem: "" });
    try {
      const r = await authFetch(`${API}/api/restaurante/white-label`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(marcaConfig),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro || "Não foi possível salvar a marca");
      setMarcaConfig((atual) => normalizarWhiteLabel({ ...atual, ...dados }));
      notificarMarcaAtualizada(dados);
      setMarcaStatus({ tipo: "success", mensagem: "Marca atualizada em todas as áreas." });
    } catch (error) {
      setMarcaStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const salvarProduto = async () => {
    if (!novoP.nome || !novoP.preco) return;
    await authFetch(`${API}/api/produtos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novoP),
    });
    setNovoP({
      categoria_id: "",
      nome: "",
      descricao: "",
      preco: "",
      imagem: "",
    });
    fetchCardapio();
  };
  const salvarEdicao = async () => {
    if (!editando) return;
    await authFetch(`${API}/api/produtos/${editando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editando),
    });
    setEditando(null);
    fetchCardapio();
  };
  const deletarProduto = async (id) => {
    if (!confirm("Deletar produto?")) return;
    await authFetch(`${API}/api/produtos/${id}`, { method: "DELETE" });
    fetchCardapio();
  };
  const toggleDisponivel = async (p) => {
    await authFetch(`${API}/api/produtos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, disponivel: p.disponivel ? 0 : 1 }),
    });
    fetchCardapio();
  };
  const salvarCategoria = async () => {
    if (!novaCategoria.trim()) return;
    await authFetch(`${API}/api/categorias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novaCategoria.trim() }),
    });
    setNovaCategoria("");
    fetchCardapio();
  };
  const deletarCategoria = async (id) => {
    if (!confirm("Deletar categoria?")) return;
    await authFetch(`${API}/api/categorias/${id}`, { method: "DELETE" });
    fetchCardapio();
  };
  const criarMesa = async () => {
    if (!novaMesa.trim()) return;
    await authFetch(`${API}/api/mesas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero: novaMesa.trim() }),
    });
    setNovaMesa("");
    fetchMesas();
  };
  const deletarMesa = async (id) => {
    if (!confirm("Deletar mesa?")) return;
    await authFetch(`${API}/api/mesas/${id}`, { method: "DELETE" });
    fetchMesas();
  };
  const verQR = async (mesa_id) => {
    const r = await authFetch(`${API}/api/mesas/${mesa_id}/atendimento/iniciar`, {
      method: "POST",
    });
    const dados = await r.json();
    if (!r.ok) {
      alert(dados.erro || "Nao foi possivel iniciar o atendimento");
      return;
    }
    setQrModal(dados);
    fetchMesas();
  };
  const encerrarAtendimento = async (mesa) => {
    if (!confirm(`Encerrar atendimento da ${rotuloMesa(mesa.numero)}?`)) return;
    const r = await authFetch(`${API}/api/mesas/${mesa.id}/atendimento/encerrar`, {
      method: "POST",
    });
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(dados.erro || "Nao foi possivel encerrar o atendimento");
      return;
    }
    fetchMesas();
  };

  const alterarDiaReservaConfig = (dia) => {
    setReservaConfig((atual) => {
      const dias = atual.dias_semana.map(Number);
      const existe = dias.includes(dia);
      const proximos = existe
        ? dias.filter((item) => item !== dia)
        : [...dias, dia].sort((a, b) => a - b);
      return { ...atual, dias_semana: proximos.length ? proximos : dias };
    });
  };

  const salvarReservaConfiguracao = async () => {
    setReservaConfigStatus({ tipo: "loading", mensagem: "" });
    try {
      const r = await authFetch(`${API}/api/reservas/configuracao`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reservaConfig),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(dados.erro || "Nao foi possivel salvar regras");
      }
      setReservaConfig(normalizarConfigReservaFrontend(dados.configuracao));
      setReservaSaloes(Array.isArray(dados.saloes) ? dados.saloes : []);
      setReservaConfigStatus({ tipo: "success", mensagem: "Regras de reserva salvas." });
    } catch (error) {
      setReservaConfigStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const adicionarSalaoReserva = async () => {
    if (!novoSalaoReserva.nome.trim()) return;
    setReservaConfigStatus({ tipo: "loading", mensagem: "" });
    try {
      const r = await authFetch(`${API}/api/reservas/saloes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...novoSalaoReserva,
          capacidade_pessoas: Number(novoSalaoReserva.capacidade_pessoas),
          ordem: reservaSaloes.length + 1,
          ativo: 1,
        }),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro || "Nao foi possivel criar salao");
      setNovoSalaoReserva({ nome: "", capacidade_pessoas: 40 });
      await fetchReservaConfiguracao();
      setReservaConfigStatus({ tipo: "success", mensagem: "Salao criado." });
    } catch (error) {
      setReservaConfigStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const atualizarSalaoReservaLocal = (id, campo, valor) => {
    setReservaSaloes((atuais) =>
      atuais.map((salao) =>
        salao.id === id ? { ...salao, [campo]: valor } : salao,
      ),
    );
  };

  const salvarSalaoReserva = async (salao) => {
    setReservaConfigStatus({ tipo: "loading", mensagem: "" });
    try {
      const r = await authFetch(`${API}/api/reservas/saloes/${salao.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: salao.nome,
          capacidade_pessoas: Number(salao.capacidade_pessoas),
          ativo: Number(salao.ativo),
          ordem: Number(salao.ordem || 0),
        }),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro || "Nao foi possivel salvar salao");
      await fetchReservaConfiguracao();
      setReservaConfigStatus({ tipo: "success", mensagem: "Salao salvo." });
    } catch (error) {
      setReservaConfigStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const desativarSalaoReserva = async (salao) => {
    if (!confirm(`Desativar ${salao.nome}?`)) return;
    setReservaConfigStatus({ tipo: "loading", mensagem: "" });
    try {
      const r = await authFetch(`${API}/api/reservas/saloes/${salao.id}`, {
        method: "DELETE",
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro || "Nao foi possivel desativar salao");
      await fetchReservaConfiguracao();
      setReservaConfigStatus({ tipo: "success", mensagem: "Salao desativado." });
    } catch (error) {
      setReservaConfigStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const salvarReservaAdmin = async () => {
    if (!novaReserva.nome_cliente.trim() || !novaReserva.telefone.trim()) return;
    setReservaStatus({ tipo: "loading", mensagem: "" });
    try {
      const r = await authFetch(`${API}/api/reservas/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...novaReserva,
          mesa_id: novaReserva.mesa_id || null,
          salao_id: novaReserva.salao_id || null,
          quantidade_pessoas: Number(novaReserva.quantidade_pessoas),
        }),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro || "Nao foi possivel criar reserva");
      setReservaStatus({ tipo: "success", mensagem: "Reserva criada." });
      setNovaReserva({
        tipo: "reserva",
        nome_cliente: "",
        telefone: "",
        email: "",
        data_reserva: dataReservaInicial(),
        horario: "19:30",
        quantidade_pessoas: 2,
        mesa_id: "",
        salao_id: novaReserva.salao_id,
        observacao: "",
      });
      recarregarReservas();
    } catch (error) {
      setReservaStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const alterarTipoNovaReserva = (tipo) => {
    setReservaStatus({ tipo: "idle", mensagem: "" });
    setNovaReserva((atual) => ({
      ...atual,
      tipo,
      data_reserva: tipo === "fila" ? dataLocalISO() : dataReservaInicial(),
      horario: tipo === "fila" ? horaLocalHHMM() : atual.horario || "19:30",
      mesa_id: tipo === "fila" ? "" : atual.mesa_id,
    }));
  };

  const alterarStatusReserva = async (id, status, mesaId) => {
    setReservaStatus({ tipo: "loading", mensagem: "" });
    try {
      const r = await authFetch(`${API}/api/reservas/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(mesaId !== undefined ? { mesa_id: mesaId || null } : {}),
        }),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro || "Nao foi possivel atualizar reserva");
      setReservaStatus({ tipo: "success", mensagem: "Reserva atualizada." });
      recarregarReservas();
    } catch (error) {
      setReservaStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const abrirHistoricoReservaAdmin = async (reserva) => {
    setHistoricoReservaAdmin({
      reserva,
      eventos: [],
      carregando: true,
      erro: "",
    });
    try {
      const r = await authFetch(`${API}/api/reservas/${reserva.id}/eventos`);
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(dados.erro || "Nao foi possivel carregar o historico");
      }
      setHistoricoReservaAdmin({
        reserva,
        eventos: Array.isArray(dados.eventos) ? dados.eventos : [],
        carregando: false,
        erro: "",
      });
    } catch (error) {
      setHistoricoReservaAdmin({
        reserva,
        eventos: [],
        carregando: false,
        erro: error.message,
      });
    }
  };

  const registrarCompartilhamentoReservaAdmin = async (reserva, canal) => {
    try {
      await authFetch(`${API}/api/reservas/${reserva.id}/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal }),
      });
    } catch (error) {
      console.warn("Nao foi possivel registrar compartilhamento:", error);
    }
  };

  const mesasDisponiveisParaReservaAdmin = (reserva) =>
    mesas.filter(
      (mesa) =>
        mesa.status === "livre" || String(mesa.id) === String(reserva.mesa_id),
    );

  const produtosFiltrados = cardapio.produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.descricao || "").toLowerCase().includes(busca.toLowerCase()),
  );

  const salvarUsuario = async () => {
    if (!novoUsuario.nome || !novoUsuario.senha) return;
    try {
      const loginFinal = (novoUsuario.login || novoUsuario.nome)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");
      const r = await authFetch(`${API}/api/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novoUsuario.nome,
          login: loginFinal,
          senha: novoUsuario.senha,
          role: novoUsuario.role,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
                alert(d.erro || "Erro ao criar usuário");
        return;
      }
      fetchUsuarios();
      setNovoUsuario({ nome: "", login: "", role: "garcom", senha: "" });
    } catch (e) {
      console.error("Erro:", e);
    }
  };

  const salvarEdicaoUsuario = async () => {
    if (!editandoUsuario) return;
    try {
      const r = await authFetch(`${API}/api/usuarios/${editandoUsuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: editandoUsuario.nome,
          login: editandoUsuario.login,
          senha: editandoUsuario.senha,
          ativo: editandoUsuario.ativo,
          role: editandoUsuario.role,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.erro || "Erro ao editar usuário");
        return;
      }
      setEditandoUsuario(null);
      fetchUsuarios();
    } catch (e) {
      console.error("Erro:", e);
    }
  };

  const deletarUsuario = async (id) => {
    if (!confirm("Remover usuário?")) return;
    try {
      await authFetch(`${API}/api/usuarios/${id}`, { method: "DELETE" });
      fetchUsuarios();
    } catch (e) {
      console.error("Erro:", e);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <PanelHeader
          title="Administração"
          subtitle="Cardápio, mesas, equipe e relatórios"
          usuario={usuario}
          onLogout={onLogout}
        />

        <div
          className="admin-tabs"
          style={{
            background: T.bg2,
            borderBottom: `1px solid ${T.border}`,
            display: "flex",
          }}
        >
          {[
            ["produtos", "Produtos"],
            ["categorias", "Categorias"],
            ["mesas", "Mesas"],
            ["reservas", "Reservas"],
            ["equipe", "Equipe"],
            ["relatorios", "Relatórios"],
            ["marca", "Marca"],
            ["importacao", "Importação"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              style={{
                flex: 1,
                padding: "12px 4px",
                background: "transparent",
                border: "none",
                borderBottom:
                  aba === id
                    ? `2px solid ${T.accent}`
                    : "2px solid transparent",
                color: aba === id ? T.accent : T.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "Inter,sans-serif",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="admin-content">
          {aba === "produtos" && (
            <div className="fade-up">
              <Card style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontFamily: "'Manrope',sans-serif",
                    fontSize: 17,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  Novo Produto
                </div>
                <select
                  value={novoP.categoria_id}
                  onChange={(e) =>
                    setNovoP((p) => ({ ...p, categoria_id: e.target.value }))
                  }
                  style={{ marginBottom: 8 }}
                >
                  <option value="">Selecione a categoria</option>
                  {cardapio.categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Nome do produto *"
                  value={novoP.nome}
                  onChange={(e) =>
                    setNovoP((p) => ({ ...p, nome: e.target.value }))
                  }
                  style={{ marginBottom: 8 }}
                />
                <textarea
                  placeholder="Descrição"
                  value={novoP.descricao}
                  onChange={(e) =>
                    setNovoP((p) => ({ ...p, descricao: e.target.value }))
                  }
                  style={{ marginBottom: 8, resize: "vertical", minHeight: 60 }}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <input
                    placeholder="Preço (R$) *"
                    type="number"
                    step="0.01"
                    value={novoP.preco}
                    onChange={(e) =>
                      setNovoP((p) => ({ ...p, preco: e.target.value }))
                    }
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <ImageUploadField
                    label="Imagem do produto"
                    value={novoP.imagem}
                    onChange={(imagem) =>
                      setNovoP((p) => ({ ...p, imagem }))
                    }
                    uploadPath="/api/uploads/imagem"
                    uploadFields={{ tipo: "produto" }}
                    headers={authHeaders}
                    previewAlt="Previa do produto"
                  />
                </div>
                <Btn
                  onClick={salvarProduto}
                  disabled={!novoP.nome || !novoP.preco}
                >
                  Adicionar Produto
                </Btn>
              </Card>
              <input
                placeholder="Buscar produtos..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              {cardapio.categorias.map((cat) => {
                const prods = produtosFiltrados.filter(
                  (p) => p.categoria_id === cat.id,
                );
                if (!prods.length) return null;
                return (
                  <div key={cat.id} style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: T.accent,
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        marginBottom: 8,
                      }}
                    >
                      {cat.nome}
                    </div>
                    {prods.map((p) => (
                      <Card
                        key={p.id}
                        style={{
                          marginBottom: 8,
                          opacity: p.disponivel ? 1 : 0.5,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 8,
                              background: T.card2,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 20,
                              overflow: "hidden",
                            }}
                          >
                            {p.imagem ? (
                              <img
                                src={p.imagem}
                                alt={p.nome}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                                onError={(e) =>
                                  (e.target.style.display = "none")
                                }
                              />
                            ) : (
                              p.nome.charAt(0)
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {p.nome}
                            </div>
                            <div
                              style={{
                                color: T.muted,
                                fontSize: 12,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {p.descricao}
                            </div>
                            <div
                              style={{
                                color: T.accent,
                                fontWeight: 700,
                                marginTop: 2,
                              }}
                            >
                              R$ {p.preco.toFixed(2)}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 5,
                              flexShrink: 0,
                              flexWrap: "wrap",
                              justifyContent: "flex-end",
                            }}
                          >
                            <Btn
                              sm
                              variant="ghost"
                              onClick={() => setEditando({ ...p })}
                            >
                              Editar
                            </Btn>
                            <Btn
                              sm
                              variant={p.disponivel ? "danger" : "success"}
                              onClick={() => toggleDisponivel(p)}
                            >
                              {p.disponivel ? "Pausar" : "Ativar"}
                            </Btn>
                            <Btn
                              sm
                              variant="danger"
                              onClick={() => deletarProduto(p.id)}
                            >
                              Excluir
                            </Btn>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {aba === "categorias" && (
            <div className="fade-up">
              <Card style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontFamily: "'Manrope',sans-serif",
                    fontSize: 17,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  Nova Categoria
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    placeholder="Nome da categoria"
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && salvarCategoria()}
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <Btn onClick={salvarCategoria}>Criar</Btn>
                </div>
              </Card>
              {cardapio.categorias.map((c) => (
                <Card
                  key={c.id}
                  style={{
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.nome}</div>
                    <div style={{ color: T.muted, fontSize: 12 }}>
                      {
                        cardapio.produtos.filter((p) => p.categoria_id === c.id)
                          .length
                      }{" "}
                      produto(s)
                    </div>
                  </div>
                  <Btn
                    sm
                    variant="danger"
                    onClick={() => deletarCategoria(c.id)}
                  >
                    Remover
                  </Btn>
                </Card>
              ))}
            </div>
          )}

          {aba === "mesas" && (
            <div className="fade-up">
              <Card style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontFamily: "'Manrope',sans-serif",
                    fontSize: 17,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  Nova Mesa
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    placeholder="Numero ou nome (ex: 13, VIP, Varanda)"
                    value={novaMesa}
                    onChange={(e) => setNovaMesa(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && criarMesa()}
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <Btn onClick={criarMesa}>Criar</Btn>
                </div>
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <div>
                  <Btn
                    variant="danger"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Reiniciar numeração dos pedidos? O próximo pedido será #1.",
                        )
                      )
                        return;
                      await authFetch(`${API}/api/pedidos/reiniciar-numeracao`, {
                        method: "POST",
                      });
                      alert("Numeração reiniciada! Próximo pedido será #1.");
                    }}
                  >
                    Reiniciar Numeracao dos Pedidos
                  </Btn>
                </div>
              </Card>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))",
                  gap: 12,
                }}
              >
                {mesas.map((m) => (
                  <Card
                    key={m.id}
                    style={{
                      textAlign: "center",
                      borderColor: m.status === "ocupada" ? T.accent : T.border,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Manrope',sans-serif",
                        fontSize: 22,
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      {m.numero}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: m.status === "ocupada" ? T.accent : T.green,
                        marginBottom: 10,
                      }}
                    >
                      {m.status === "ocupada" ? "Ocupada" : "Livre"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <Btn sm onClick={() => verQR(m.id)}>
                        {m.status === "ocupada" ? "Renovar QR" : "Iniciar"}
                      </Btn>
                      {m.status === "ocupada" && (
                        <Btn
                          sm
                          variant="ghost"
                          onClick={() => encerrarAtendimento(m)}
                        >
                          Encerrar
                        </Btn>
                      )}
                      {m.status === "livre" && (
                        <Btn
                          sm
                          variant="danger"
                          onClick={() => deletarMesa(m.id)}
                        >
                          Excluir
                        </Btn>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {aba === "reservas" && (
            <div className="fade-up">
              <Card style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "'Manrope',sans-serif",
                        fontSize: 17,
                        fontWeight: 800,
                      }}
                    >
                      Regras de disponibilidade
                    </div>
                    <div style={{ color: T.muted, fontSize: 12 }}>
                      Controle dias, horários, limites por horário e capacidade por salão.
                    </div>
                  </div>
                  <Btn
                    sm
                    type="button"
                    onClick={salvarReservaConfiguracao}
                    disabled={reservaConfigStatus.tipo === "loading"}
                  >
                    <Save size={14} />
                    Salvar regras
                  </Btn>
                </div>

                <div className="admin-form-grid">
                  <select
                    value={reservaConfig.ativo}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        ativo: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={1}>Reservas online ativas</option>
                    <option value={0}>Reservas online pausadas</option>
                  </select>
                  <select
                    value={reservaConfig.permitir_fila}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        permitir_fila: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={1}>Fila de espera ativa</option>
                    <option value={0}>Fila de espera pausada</option>
                  </select>
                  <input
                    type="time"
                    value={reservaConfig.hora_inicio}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        hora_inicio: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="time"
                    value={reservaConfig.hora_fim}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        hora_fim: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="15"
                    max="240"
                    placeholder="Intervalo entre horários (min)"
                    value={reservaConfig.intervalo_minutos}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        intervalo_minutos: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="15"
                    max="360"
                    placeholder="Duração estimada (min)"
                    value={reservaConfig.duracao_minutos}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        duracao_minutos: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    max="10080"
                    placeholder="Antecedência mínima (min)"
                    value={reservaConfig.antecedencia_minutos}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        antecedencia_minutos: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    max="365"
                    placeholder="Agenda aberta por dias"
                    value={reservaConfig.horizonte_dias}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        horizonte_dias: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Limite de reservas por horário (0 = sem limite)"
                    value={reservaConfig.limite_reservas_horario}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        limite_reservas_horario: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Limite de pessoas por horário (0 = sem limite)"
                    value={reservaConfig.limite_pessoas_horario}
                    onChange={(e) =>
                      setReservaConfig((atual) => ({
                        ...atual,
                        limite_pessoas_horario: e.target.value,
                      }))
                    }
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ color: T.muted, fontSize: 11, fontWeight: 800, marginBottom: 7 }}>
                    DIAS COM RESERVA
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {DIAS_SEMANA_RESERVA.map(([dia, label]) => {
                      const ativoDia = reservaConfig.dias_semana.map(Number).includes(dia);
                      return (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => alterarDiaReservaConfig(dia)}
                          style={{
                            minWidth: 46,
                            height: 34,
                            borderRadius: 8,
                            border: `1px solid ${ativoDia ? T.accent : T.border}`,
                            background: ativoDia ? T.accentGlow : T.card2,
                            color: ativoDia ? T.accent : T.muted,
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  role="status"
                  style={{
                    minHeight: 32,
                    paddingTop: 10,
                    color:
                      reservaConfigStatus.tipo === "error"
                        ? T.red
                        : reservaConfigStatus.tipo === "success"
                          ? T.green
                          : T.muted,
                    fontSize: 12,
                    fontWeight: reservaConfigStatus.tipo === "success" ? 700 : 500,
                  }}
                >
                  {reservaConfigStatus.mensagem}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  {reservaSaloes.map((salao) => (
                    <Card
                      key={salao.id}
                      style={{
                        background: T.card2,
                        opacity: Number(salao.ativo) === 1 ? 1 : 0.62,
                      }}
                    >
                      <input
                        value={salao.nome}
                        onChange={(e) =>
                          atualizarSalaoReservaLocal(salao.id, "nome", e.target.value)
                        }
                        style={{ marginBottom: 8 }}
                      />
                      <input
                        type="number"
                        min="1"
                        value={salao.capacidade_pessoas}
                        onChange={(e) =>
                          atualizarSalaoReservaLocal(
                            salao.id,
                            "capacidade_pessoas",
                            e.target.value,
                          )
                        }
                        style={{ marginBottom: 8 }}
                      />
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        <Btn
                          sm
                          variant={Number(salao.ativo) === 1 ? "success" : "ghost"}
                          type="button"
                          onClick={() =>
                            atualizarSalaoReservaLocal(
                              salao.id,
                              "ativo",
                              Number(salao.ativo) === 1 ? 0 : 1,
                            )
                          }
                        >
                          {Number(salao.ativo) === 1 ? "Ativo" : "Inativo"}
                        </Btn>
                        <Btn
                          sm
                          variant="ghost"
                          type="button"
                          onClick={() => salvarSalaoReserva(salao)}
                        >
                          Salvar
                        </Btn>
                        <Btn
                          sm
                          variant="danger"
                          type="button"
                          onClick={() => desativarSalaoReserva(salao)}
                        >
                          Desativar
                        </Btn>
                      </div>
                    </Card>
                  ))}
                </div>

                <div
                  className="admin-form-grid"
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${T.border}`,
                  }}
                >
                  <input
                    placeholder="Novo salão/área"
                    value={novoSalaoReserva.nome}
                    onChange={(e) =>
                      setNovoSalaoReserva((atual) => ({
                        ...atual,
                        nome: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Capacidade"
                    value={novoSalaoReserva.capacidade_pessoas}
                    onChange={(e) =>
                      setNovoSalaoReserva((atual) => ({
                        ...atual,
                        capacidade_pessoas: e.target.value,
                      }))
                    }
                  />
                  <Btn
                    type="button"
                    onClick={adicionarSalaoReserva}
                    disabled={!novoSalaoReserva.nome.trim()}
                  >
                    Adicionar salão
                  </Btn>
                </div>
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "'Manrope',sans-serif",
                        fontSize: 17,
                        fontWeight: 800,
                      }}
                    >
                      Nova Reserva
                    </div>
                    <div style={{ color: T.muted, fontSize: 12 }}>
                      Cadastro interno para telefone, balcão ou WhatsApp.
                    </div>
                  </div>
                  <a
                    href={rotaRestaurante(usuario.restaurante_slug, "reservas")}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: T.accent,
                      fontSize: 12,
                      fontWeight: 800,
                      textDecoration: "none",
                    }}
                  >
                    Link publico
                  </a>
                </div>

                <div className="admin-form-grid">
                  <input
                    className="is-full"
                    placeholder="Nome do cliente *"
                    value={novaReserva.nome_cliente}
                    onChange={(e) =>
                      setNovaReserva((r) => ({ ...r, nome_cliente: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Telefone *"
                    value={novaReserva.telefone}
                    onChange={(e) =>
                      setNovaReserva((r) => ({ ...r, telefone: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Email"
                    type="email"
                    value={novaReserva.email}
                    onChange={(e) =>
                      setNovaReserva((r) => ({ ...r, email: e.target.value }))
                    }
                  />
                  <select
                    value={novaReserva.tipo}
                    onChange={(e) => alterarTipoNovaReserva(e.target.value)}
                  >
                    <option value="reserva">Reserva programada</option>
                    <option value="fila">Fila de espera agora</option>
                  </select>
                  <input
                    type="date"
                    min={dataLocalISO()}
                    value={novaReserva.data_reserva}
                    onChange={(e) =>
                      setNovaReserva((r) => ({ ...r, data_reserva: e.target.value }))
                    }
                    disabled={novaReserva.tipo === "fila"}
                  />
                  <input
                    type="time"
                    value={novaReserva.horario}
                    onChange={(e) =>
                      setNovaReserva((r) => ({ ...r, horario: e.target.value }))
                    }
                    disabled={novaReserva.tipo === "fila"}
                  />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={novaReserva.quantidade_pessoas}
                    onChange={(e) =>
                      setNovaReserva((r) => ({
                        ...r,
                        quantidade_pessoas: e.target.value,
                      }))
                    }
                  />
                  <select
                    value={novaReserva.mesa_id}
                    onChange={(e) =>
                      setNovaReserva((r) => ({ ...r, mesa_id: e.target.value }))
                    }
                  >
                    <option value="">Sem mesa definida</option>
                    {mesas.map((mesa) => (
                      <option key={mesa.id} value={mesa.id}>
                        Mesa {mesa.numero}
                      </option>
                    ))}
                  </select>
                  <select
                    value={novaReserva.salao_id}
                    onChange={(e) =>
                      setNovaReserva((r) => ({ ...r, salao_id: e.target.value }))
                    }
                  >
                    <option value="">Sem salão definido</option>
                    {reservaSaloes
                      .filter((salao) => Number(salao.ativo) === 1)
                      .map((salao) => (
                        <option key={salao.id} value={salao.id}>
                          {salao.nome} · {salao.capacidade_pessoas} pessoas
                        </option>
                      ))}
                  </select>
                  <textarea
                    className="is-full"
                    placeholder="Observacao"
                    value={novaReserva.observacao}
                    onChange={(e) =>
                      setNovaReserva((r) => ({ ...r, observacao: e.target.value }))
                    }
                    style={{ minHeight: 76, resize: "vertical" }}
                  />
                </div>
                <div
                  role="status"
                  style={{
                    minHeight: 34,
                    paddingTop: 10,
                    color:
                      reservaStatus.tipo === "error"
                        ? T.red
                        : reservaStatus.tipo === "success"
                          ? T.green
                          : T.muted,
                    fontSize: 12,
                    fontWeight: reservaStatus.tipo === "success" ? 700 : 500,
                  }}
                >
                  {reservaStatus.mensagem}
                </div>
                <Btn
                  onClick={salvarReservaAdmin}
                  disabled={
                    reservaStatus.tipo === "loading" ||
                    !novaReserva.nome_cliente.trim() ||
                    !novaReserva.telefone.trim()
                  }
                >
                  {reservaStatus.tipo === "loading"
                    ? "Salvando"
                    : novaReserva.tipo === "fila"
                      ? "Criar Fila"
                      : "Criar Reserva"}
                </Btn>
              </Card>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {[
                  ["pendente", "Pendentes", T.accent],
                  ["confirmada", "Confirmadas", T.green],
                  ["fila", "Na fila", T.amber],
                  ["chamada", "Chamados", T.blue],
                  ["concluida", "Concluidas", T.blue],
                  ["cancelada", "Canceladas", T.red],
                ].map(([status, label, cor]) => (
                  <Card key={status} style={{ background: T.card2 }}>
                    <div style={{ color: T.muted, fontSize: 12, marginBottom: 4 }}>
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Manrope',sans-serif",
                        fontSize: 28,
                        fontWeight: 800,
                        color: cor,
                      }}
                    >
                      {reservas.filter((reserva) => reserva.status === status).length}
                    </div>
                  </Card>
                ))}
              </div>

              {reservas.length === 0 ? (
                <Card>
                  <div style={{ color: T.muted, fontSize: 13 }}>
                    Nenhuma reserva cadastrada ainda.
                  </div>
                </Card>
              ) : (
                reservas.map((reserva) => {
                  const mesasDaReserva = mesasDisponiveisParaReservaAdmin(reserva);
                  return (
                  <Card key={reserva.id} style={{ marginBottom: 8 }}>
                    <div className="admin-reserva-row">
                      <div className="admin-reserva-copy">
                        <div style={{ fontWeight: 800 }}>{reserva.nome_cliente}</div>
                        <div className="admin-reserva-meta">
                          {reserva.telefone}
                          {reserva.email ? ` · ${reserva.email}` : ""}
                        </div>
                        {reserva.observacao && (
                          <div className="admin-reserva-meta">{reserva.observacao}</div>
                        )}
                      </div>
                      <div>
                        <Badge status={reserva.status} />
                        <div className="admin-reserva-meta">
                          {formatarDataReserva(reserva.data_reserva)} as {reserva.horario}
                        </div>
                        <div className="admin-reserva-meta">
                          {reserva.quantidade_pessoas} pessoa(s)
                          {reserva.mesa_numero ? ` · Mesa ${reserva.mesa_numero}` : ""}
                          {reserva.salao_nome ? ` · ${reserva.salao_nome}` : ""}
                        </div>
                        <div className="admin-reserva-meta">
                          {reserva.tipo === "fila" ? "Fila de espera" : "Reserva programada"}
                          {reserva.status === "fila" && reserva.posicao_fila
                            ? ` · Posicao ${reserva.posicao_fila}`
                            : ""}
                          {reserva.codigo_acompanhamento
                            ? ` · Cod. ${reserva.codigo_acompanhamento}`
                            : ""}
                        </div>
                      </div>
                      <div>
                        <select
                          value={reserva.mesa_id || ""}
                          disabled={["concluida", "cancelada"].includes(reserva.status)}
                          onChange={(e) =>
                            alterarStatusReserva(reserva.id, reserva.status, e.target.value)
                          }
                          style={{
                            minWidth: 150,
                            height: 36,
                            border: `1px solid ${T.border2}`,
                            borderRadius: 8,
                            background: T.card2,
                            color: T.text,
                            fontSize: 13,
                            padding: "0 10px",
                          }}
                        >
                          <option value="">Sem mesa</option>
                          {mesasDaReserva.map((mesa) => (
                            <option key={mesa.id} value={mesa.id}>
                              Mesa {mesa.numero}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="admin-reserva-actions">
                        {reserva.status === "pendente" && (
                          <Btn
                            sm
                            variant="success"
                            onClick={() => alterarStatusReserva(reserva.id, "confirmada")}
                          >
                            Confirmar
                          </Btn>
                        )}
                        {["pendente", "confirmada"].includes(reserva.status) && (
                          <Btn
                            sm
                            variant="amber"
                            onClick={() => alterarStatusReserva(reserva.id, "fila")}
                          >
                            Fila
                          </Btn>
                        )}
                        {reserva.status === "fila" && (
                          <Btn
                            sm
                            variant="info"
                            onClick={() => alterarStatusReserva(reserva.id, "chamada")}
                          >
                            Chamar
                          </Btn>
                        )}
                        {reserva.status === "chamada" && (
                          <Btn
                            sm
                            variant="ghost"
                            onClick={() => alterarStatusReserva(reserva.id, "fila")}
                          >
                            Voltar fila
                          </Btn>
                        )}
                        {["confirmada", "fila", "chamada"].includes(reserva.status) && (
                          <Btn
                            sm
                            variant="success"
                            disabled={!reserva.mesa_id}
                            onClick={() => alterarStatusReserva(reserva.id, "concluida")}
                          >
                            Acomodar
                          </Btn>
                        )}
                        {["pendente", "confirmada", "fila", "chamada"].includes(reserva.status) && (
                          <Btn
                            sm
                            variant="danger"
                            onClick={() => alterarStatusReserva(reserva.id, "cancelada")}
                          >
                            Cancelar
                          </Btn>
                        )}
                        {reserva.status === "cancelada" && (
                          <Btn
                            sm
                            variant="ghost"
                            onClick={() => alterarStatusReserva(reserva.id, "pendente")}
                          >
                            Reabrir
                          </Btn>
                        )}
                        <Btn
                          sm
                          variant="ghost"
                          type="button"
                          onClick={() => abrirHistoricoReservaAdmin(reserva)}
                        >
                          <History size={14} />
                          Historico
                        </Btn>
                        <AcoesCompartilhamentoReserva
                          reserva={reserva}
                          restauranteSlug={usuario.restaurante_slug}
                          nomeRestaurante={marca.nome}
                          onFeedback={(mensagem) =>
                            setReservaStatus({ tipo: "success", mensagem })
                          }
                          onShare={(canal) =>
                            registrarCompartilhamentoReservaAdmin(reserva, canal)
                          }
                        />
                      </div>
                    </div>
                  </Card>
                  );
                })
              )}
            </div>
          )}

          {historicoReservaAdmin && (
            <HistoricoReservaModal
              reserva={historicoReservaAdmin.reserva}
              eventos={historicoReservaAdmin.eventos}
              carregando={historicoReservaAdmin.carregando}
              erro={historicoReservaAdmin.erro}
              onClose={() => setHistoricoReservaAdmin(null)}
            />
          )}

          {aba === "marca" && (
            <div className="fade-up">
              <Card>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    marginBottom: 18,
                    color: T.heading,
                    fontFamily: "'Manrope',sans-serif",
                    fontSize: 17,
                    fontWeight: 800,
                  }}
                >
                  <Palette size={19} color={T.accent} /> Identidade do restaurante
                </div>
                <WhiteLabelFields
                  value={marcaConfig}
                  onChange={setMarcaConfig}
                  uploadPath="/api/uploads/imagem"
                  uploadFields={{ tipo: "logo" }}
                  uploadHeaders={authHeaders}
                />
                <div
                  role="status"
                  style={{
                    minHeight: 36,
                    paddingTop: 10,
                    color:
                      marcaStatus.tipo === "error"
                        ? T.red
                        : marcaStatus.tipo === "success"
                          ? T.green
                          : T.muted,
                    fontSize: 12,
                    fontWeight: marcaStatus.tipo === "success" ? 700 : 500,
                  }}
                >
                  {marcaStatus.mensagem}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn
                    variant="ghost"
                    onClick={() =>
                      setMarcaConfig((atual) => ({
                        ...atual,
                        ...WHITE_LABEL_PADRAO,
                      }))
                    }
                  >
                    Restaurar padrão Autenix
                  </Btn>
                  <Btn onClick={salvarMarca} disabled={marcaStatus.tipo === "loading"}>
                    <Save size={16} />
                    {marcaStatus.tipo === "loading" ? "Salvando" : "Salvar marca"}
                  </Btn>
                </div>
              </Card>
            </div>
          )}

          {aba === "importacao" && (
            <div className="fade-up">
              <ImportacaoDados
                onImported={() => {
                  fetchCardapio();
                  fetchMesas();
                  fetchUsuarios();
                }}
              />
            </div>
          )}
        {aba === "equipe" && (
          <div className="fade-up">
            <Card style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: "'Manrope',sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                Novo Usuário
              </div>
              <input
                placeholder="Nome completo"
                value={novoUsuario.nome}
                onChange={(e) =>
                  setNovoUsuario((u) => ({ ...u, nome: e.target.value }))
                }
                style={{ marginBottom: 8 }}
              />
              <input
                placeholder="Login para acesso (ex: joao_garcom) *"
                value={novoUsuario.login || ""}
                onChange={(e) =>
                  setNovoUsuario((u) => ({ ...u, login: e.target.value }))
                }
                style={{ marginBottom: 8 }}
              />
              <select
                value={novoUsuario.role}
                onChange={(e) =>
                  setNovoUsuario((u) => ({ ...u, role: e.target.value }))
                }
                style={{ marginBottom: 8 }}
              >
                <option value="garcom">Garçom</option>
                <option value="cozinha">Cozinha</option>
                <option value="financeiro">Financeiro</option>
              </select>
              <input
                placeholder="Senha"
                type="password"
                value={novoUsuario.senha}
                onChange={(e) =>
                  setNovoUsuario((u) => ({ ...u, senha: e.target.value }))
                }
                style={{ marginBottom: 10 }}
              />
              <div
                style={{
                  fontSize: 12,
                  color: T.muted,
                  marginBottom: 10,
                  padding: "8px 10px",
                  background: T.card2,
                  borderRadius: 8,
                }}
              >
                O login sera usado para entrar no painel. Se deixar vazio, sera
                gerado automaticamente do nome.
              </div>
              <Btn
                onClick={salvarUsuario}
                disabled={!novoUsuario.nome || !novoUsuario.senha}
              >
                Criar Usuário
              </Btn>
            </Card>
            {["garcom", "cozinha", "financeiro"].map((role) => {
              const lista = usuarios.filter((u) => u.role === role);
              return (
                <div key={role} style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: T.accent,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 8,
                    }}
                  >
                    {role === "garcom"
                      ? "Garçons"
                      : role === "cozinha"
                        ? "Cozinha"
                        : "Financeiro"}{" "}
                    ({lista.length})
                  </div>
                  {lista.length === 0 ? (
                    <div
                      style={{ color: T.muted, fontSize: 13, padding: "8px 0" }}
                    >
                      Nenhum usuário
                    </div>
                  ) : (
                    lista.map((u) => (
                      <Card
                        key={u.id}
                        style={{ marginBottom: 8, opacity: u.ativo ? 1 : 0.5 }}
                      >
                        <div className="admin-user-row">
                          <div className="admin-user-copy">
                            <div style={{ fontWeight: 600 }}>{u.nome}</div>
                            <div
                              style={{
                                fontSize: 12,
                                color: u.ativo ? T.green : T.red,
                              }}
                            >
                              {u.ativo ? "Ativo" : "Inativo"}
                            </div>
                          </div>
                          <div className="admin-user-actions">
                            <Btn
                              sm
                              variant="ghost"
                              onClick={() =>
                                setEditandoUsuario({ ...u, senha: "" })
                              }
                            >
                              Editar
                            </Btn>
                            <Btn
                              sm
                              variant="danger"
                              onClick={() => deletarUsuario(u.id)}
                            >
                              Remover
                            </Btn>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              );
            })}
            {editandoUsuario && (
              <Modal onClose={() => setEditandoUsuario(null)}>
                <div
                  style={{
                    fontFamily: "'Manrope',sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    marginBottom: 14,
                  }}
                >
                  Editar Usuário
                </div>
                <input
                  placeholder="Nome"
                  value={editandoUsuario.nome}
                  onChange={(e) =>
                    setEditandoUsuario((u) => ({ ...u, nome: e.target.value }))
                  }
                  style={{ marginBottom: 8 }}
                />
                <input
                  placeholder="Nova senha (vazio = manter)"
                  type="password"
                  value={editandoUsuario.senha || ""}
                  onChange={(e) =>
                    setEditandoUsuario((u) => ({ ...u, senha: e.target.value }))
                  }
                  style={{ marginBottom: 8 }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!editandoUsuario.ativo}
                    onChange={(e) =>
                      setEditandoUsuario((u) => ({
                        ...u,
                        ativo: e.target.checked ? 1 : 0,
                      }))
                    }
                    style={{ width: "auto" }}
                  />
                  <span style={{ fontSize: 14 }}>Ativo</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn
                    variant="ghost"
                    onClick={() => setEditandoUsuario(null)}
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </Btn>
                  <Btn onClick={salvarEdicaoUsuario} style={{ flex: 1 }}>
                    Salvar
                  </Btn>
                </div>
              </Modal>
            )}
          </div>
        )}

        {aba === "relatorios" && (
          <div className="fade-up">
            <Card style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: "'Manrope',sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                Período
              </div>
              <div className="admin-report-periods">
                {[
                  ["hoje", "Hoje"],
                  ["semana", "7 dias"],
                  ["mes", "30 dias"],
                  ["ano", "Ano"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    aria-pressed={periodoRel === val}
                    onClick={() => {
                      setPeriodoRel(val);
                      setDataInicioRel("");
                      setDataFimRel("");
                      fetchRelatorio(val);
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 7,
                      border: `1px solid ${periodoRel === val ? T.accent : T.border}`,
                      background:
                        periodoRel === val ? T.accentGlow : "transparent",
                      color: periodoRel === val ? T.accent : T.text2,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "Inter,sans-serif",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Filtro por data + PDF */}
              <div className="admin-report-filters">
                <label className="admin-report-date">
                  <span>De</span>
                  <input
                    type="date"
                    value={dataInicioRel}
                    onChange={(e) => setDataInicioRel(e.target.value)}
                    style={{ padding: "7px 10px", fontSize: 13 }}
                  />
                </label>
                <label className="admin-report-date">
                  <span>Até</span>
                  <input
                    type="date"
                    value={dataFimRel}
                    onChange={(e) => setDataFimRel(e.target.value)}
                    style={{ padding: "7px 10px", fontSize: 13 }}
                  />
                </label>
                <div className="admin-report-actions">
                  <Btn
                    sm
                    onClick={() => {
                      if (dataInicioRel) {
                        setPeriodoRel("custom");
                        fetchRelatorio("custom", dataInicioRel, dataFimRel);
                      }
                    }}
                    disabled={!dataInicioRel}
                  >
                    Filtrar
                  </Btn>
                  {relatorio.dados.length > 0 && (
                    <Btn
                      sm
                      variant="success"
                      onClick={() =>
                        gerarPDF({
                          historico: relatorio.dados,
                          totalPeriodo: relatorio.totalGeral,
                          periodo: periodoRel,
                          dataInicio: dataInicioRel,
                          dataFim: dataFimRel,
                          nomeApp: marca.nome,
                        })
                      }
                    >
                      Exportar PDF
                    </Btn>
                  )}
                </div>
              </div>
            </Card>

            {relatorio.carregando ? (
              <div
                style={{
                  color: T.muted,
                  padding: "32px 0",
                  textAlign: "center",
                }}
              >
                Carregando...
              </div>
            ) : (
              <>
                <Card style={{ marginBottom: 16, background: T.card2 }}>
                  <div
                    style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}
                  >
                    Total do Período
                  </div>
                  <div
                    style={{
                      fontFamily: "'Manrope',sans-serif",
                      fontSize: 32,
                      fontWeight: 700,
                      color: T.accent,
                    }}
                  >
                    R$ {relatorio.totalGeral.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                    {relatorio.dados.length} mesa(s) atendida(s)
                  </div>
                </Card>

                {relatorio.dados.length === 0 ? (
                  <div
                    style={{ color: T.muted, fontSize: 13, padding: "20px 0" }}
                  >
                    Nenhum dado no período.
                  </div>
                ) : (
                  relatorio.dados.map((r, i) => (
                    <Card key={i} style={{ marginBottom: 8 }}>
                      <div className="admin-report-row">
                        <div className="admin-report-copy">
                          <div style={{ fontWeight: 600 }}>
                            Mesa {r.mesa_numero}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: T.muted,
                              marginTop: 2,
                            }}
                          >
                            {r.nome_cliente && `${r.nome_cliente} · `}
                            {r.fechado_em} · {r.total_itens} item(s)
                          </div>
                        </div>
                        <div
                          className="admin-report-value"
                          style={{
                            fontWeight: 800,
                            fontSize: 17,
                            color: T.accent,
                          }}
                        >
                          R$ {(r.total || 0).toFixed(2)}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </>
            )}
          </div>
        )}

        </div>

        {/* Modal editar produto */}
        {editando && (
          <Modal onClose={() => setEditando(null)}>
            <div
              style={{
                fontFamily: "'Manrope',sans-serif",
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              Editar Produto
            </div>
            <select
              value={editando.categoria_id || ""}
              onChange={(e) =>
                setEditando((p) => ({ ...p, categoria_id: e.target.value }))
              }
              style={{ marginBottom: 8 }}
            >
              <option value="">Sem categoria</option>
              {cardapio.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <input
              placeholder="Nome"
              value={editando.nome}
              onChange={(e) =>
                setEditando((p) => ({ ...p, nome: e.target.value }))
              }
              style={{ marginBottom: 8 }}
            />
            <textarea
              placeholder="Descrição"
              value={editando.descricao || ""}
              onChange={(e) =>
                setEditando((p) => ({ ...p, descricao: e.target.value }))
              }
              style={{ marginBottom: 8, resize: "vertical", minHeight: 60 }}
            />
            <input
              placeholder="Preço (R$)"
              type="number"
              step="0.01"
              value={editando.preco}
              onChange={(e) =>
                setEditando((p) => ({ ...p, preco: e.target.value }))
              }
              style={{ marginBottom: 8 }}
            />
            <div style={{ marginBottom: 12 }}>
              <ImageUploadField
                label="Imagem do produto"
                value={editando.imagem || ""}
                onChange={(imagem) =>
                  setEditando((p) => ({ ...p, imagem }))
                }
                uploadPath="/api/uploads/imagem"
                uploadFields={{ tipo: "produto" }}
                headers={authHeaders}
                previewAlt="Previa do produto"
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn
                variant="ghost"
                onClick={() => setEditando(null)}
                style={{ flex: 1 }}
              >
                Cancelar
              </Btn>
              <Btn onClick={salvarEdicao} style={{ flex: 1 }}>
                Salvar
              </Btn>
            </div>
          </Modal>
        )}

        {/* Modal QR */}
        {qrModal && (
          <Modal onClose={() => setQrModal(null)}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "'Manrope',sans-serif",
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                QR Code seguro
              </div>
              <div
                style={{
                  color: T.text2,
                  fontSize: 12,
                  lineHeight: 1.45,
                  marginBottom: 12,
                }}
              >
                Gere um novo QR para cada atendimento da mesa.
              </div>
              <img
                src={qrModal.qr}
                alt="QR"
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                }}
              />
              <div
                style={{
                  color: T.muted,
                  fontSize: 11,
                  marginTop: 10,
                  wordBreak: "break-all",
                }}
              >
                {qrModal.url}
              </div>
              {qrModal.expira_em && (
                <div
                  style={{
                    color: T.text2,
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  Expira em {new Date(qrModal.expira_em).toLocaleString("pt-BR")}
                </div>
              )}
              <Btn
                variant="ghost"
                onClick={() => setQrModal(null)}
                style={{ marginTop: 14 }}
              >
                Fechar
              </Btn>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
function analisarRota(path, usuario) {
  const partes = path.split("/").filter(Boolean);
  const escopada = partes[0] === "r" && Boolean(partes[1]);
  const slug = escopada
    ? normalizarSlugRestaurante(decodeURIComponent(partes[1]))
    : normalizarSlugRestaurante(usuario?.restaurante_slug || "autenix");
  const area = escopada ? partes[2] || "landing" : partes[0] || "landing";
  const mesaId = area === "mesa"
    ? (escopada ? partes[3] : partes[1])
    : area === "cliente"
      ? "1"
      : null;
  const reservaCodigo = area === "reservas" &&
    (escopada ? partes[3] : partes[1]) === "acompanhar"
    ? (escopada ? partes[4] : partes[2])
    : null;

  return { area, escopada, mesaId, reservaCodigo, slug };
}

function AppContent() {
  const marca = useBranding();
  const [usuarioLogado, setUsuarioLogado] = useState(() => {
    const salvo = sessionStorage.getItem("usuarioLogado");
    return salvo ? JSON.parse(salvo) : undefined;
  });
  const rota = analisarRota(window.location.pathname, usuarioLogado);
  const sessaoMesa = rota.mesaId
    ? new URLSearchParams(window.location.search).get("sessao") || ""
    : "";
  const sessaoDaRota = Boolean(
    usuarioLogado &&
    normalizarSlugRestaurante(usuarioLogado.restaurante_slug) === rota.slug,
  );

  useEffect(() => {
    if (usuarioLogado) {
      sessionStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));
    } else {
      sessionStorage.removeItem("usuarioLogado");
    }
  }, [usuarioLogado]);

  useEffect(() => {
    if (rota.area !== "landing") {
      document.title = `Painel Principal - ${marca.nome}`;
    }
    sessionStorage.removeItem("autAdmin");
  }, [marca.nome, rota.area]);

  const login = useCallback((usuario) => {
    if (socket) socket.disconnect();
    socket = null;
    socketIdentity = null;
    sessionStorage.setItem("usuarioLogado", JSON.stringify(usuario));
    setUsuarioLogado(usuario);
  }, []);

  const logout = useCallback(() => {
    if (socket) socket.disconnect();
    socket = null;
    socketIdentity = null;
    sessionStorage.removeItem("usuarioLogado");
    setUsuarioLogado(undefined);
  }, []);

  if (rota.area === "plataforma") {
    return <PlatformPortal />;
  }

  if (rota.area === "reservas") {
    if (rota.reservaCodigo) {
      return (
        <TelaAcompanhamentoReserva
          restauranteSlug={rota.slug}
          codigo={rota.reservaCodigo}
        />
      );
    }
    return <TelaReservasPublicas restauranteSlug={rota.slug} />;
  }

  if (rota.mesaId) {
    return (
      <PainelCliente
        mesa_id={rota.mesaId}
        restauranteSlug={rota.slug}
        sessaoMesa={sessaoMesa}
      />
    );
  }

  if (rota.area === "central") {
    if (!sessaoDaRota) {
      return (
        <TelaLogin
          titulo="Central de Operação"
          onLogin={login}
          restauranteSlug={rota.slug}
        />
      );
    }
    return <CentralOperacao usuario={usuarioLogado} onLogout={logout} />;
  }

  if (rota.area === "cozinha") {
    if (
      !sessaoDaRota ||
      (usuarioLogado.role !== "cozinha" && usuarioLogado.role !== "admin")
    ) {
      return (
        <TelaLogin
          titulo="Cozinha"
          role="cozinha"
          onLogin={login}
          restauranteSlug={rota.slug}
        />
      );
    }
    return <PainelCozinha usuario={usuarioLogado} onLogout={logout} />;
  }

  if (rota.area === "garcom") {
    if (
      !sessaoDaRota ||
      (usuarioLogado.role !== "garcom" && usuarioLogado.role !== "admin")
    ) {
      return (
        <TelaLogin
          titulo="Garçom"
          role="garcom"
          onLogin={login}
          restauranteSlug={rota.slug}
        />
      );
    }
    return <PainelGarcom usuario={usuarioLogado} onLogout={logout} />;
  }

  if (rota.area === "financeiro") {
    if (
      !sessaoDaRota ||
      (usuarioLogado.role !== "financeiro" && usuarioLogado.role !== "admin")
    ) {
      return (
        <TelaLogin
          titulo="Financeiro"
          role="financeiro"
          onLogin={login}
          restauranteSlug={rota.slug}
        />
      );
    }
    return <PainelFinanceiro usuario={usuarioLogado} onLogout={logout} />;
  }

  if (rota.area === "admin") {
    if (!sessaoDaRota || usuarioLogado.role !== "admin") {
      return (
        <TelaLogin
          titulo="Administração"
          role="admin"
          onLogin={login}
          restauranteSlug={rota.slug}
        />
      );
    }
    return <PainelAdmin usuario={usuarioLogado} onLogout={logout} />;
  }

  return (
    <LandingPage
      usuario={rota.escopada && !sessaoDaRota ? null : usuarioLogado}
      onLogin={login}
      restauranteSlug={rota.escopada ? rota.slug : undefined}
    />
  );
}

export default function App() {
  const partes = window.location.pathname.split("/").filter(Boolean);
  const escopada = partes[0] === "r" && Boolean(partes[1]);
  const areasRestaurante = new Set([
    "admin",
    "central",
    "cliente",
    "cozinha",
    "financeiro",
    "garcom",
    "mesa",
    "reservas",
  ]);
  const slug = escopada
    ? normalizarSlugRestaurante(decodeURIComponent(partes[1]))
    : "autenix";
  const marcaAtiva = escopada || areasRestaurante.has(partes[0]);

  return (
    <BrandingProvider slug={slug} ativo={marcaAtiva}>
      <AppContent />
    </BrandingProvider>
  );
}

// ─── PAINEL FINANCEIRO ────────────────────────────────────────────────────────
function gerarPDF({
  historico,
  totalPeriodo,
  periodo,
  dataInicio,
  dataFim,
  nomeApp,
}) {
  const linhasItens = historico
    .map(
      (h) =>
        `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${h.mesa_numero}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${h.nome_cliente || "-"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${h.garcom_nome || "-"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${({credito:"Cred",debito:"Deb",dinheiro:"Dinheiro",pix:"PIX"})[h.forma_pagamento] || "-"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${h.total_itens}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${h.fechado_em || "-"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#f2742d">R$ ${(h.total || 0).toFixed(2)}</td>
    </tr>`,
    )
    .join("");

  const labelPeriodo =
    { hoje: "Hoje", semana: "7 dias", mes: "30 dias", ano: "Ano todo" }[
      periodo
    ] || periodo;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Relatório ${nomeApp}</title>
  <style>
    body{font-family:Georgia,serif;margin:40px;color:#222}
    h1{font-size:24px;margin-bottom:4px}
    .sub{color:#888;font-size:13px;margin-bottom:28px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#f5f0eb;padding:8px;text-align:left;font-size:13px;border-bottom:2px solid #ddd}
    .total-row{background:#fff8f5;font-weight:700}
    .footer{margin-top:32px;font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
    @media print{.no-print{display:none}}
  </style></head><body>
  <h1>${nomeApp} - Relatório Financeiro</h1>
  <div class="sub">
    Período: <strong>${labelPeriodo}</strong>
    ${dataInicio ? ` | De: <strong>${dataInicio}</strong>` : ""}
    ${dataFim ? ` até: <strong>${dataFim}</strong>` : ""}
    | Gerado em: <strong>${new Date().toLocaleString("pt-BR")}</strong>
  </div>
  <table>
    <thead><tr>
      <th>Mesa</th><th>Cliente</th><th>Garçom</th><th>Pagamento</th><th>Itens</th><th>Horário</th><th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>${linhasItens}</tbody>
    <tfoot><tr class="total-row">
      <td colspan="5" style="padding:10px 8px;border-top:2px solid #c8714a">TOTAL GERAL</td>
      <td style="padding:10px 8px;border-top:2px solid #c8714a;text-align:right;color:#c8714a;font-size:16px">R$ ${totalPeriodo.toFixed(2)}</td>
    </tr></tfoot>
  </table>
  <div class="footer">${nomeApp} - Sistema de Gestão de Restaurante - ${historico.length} atendimento(s) no período</div>
  <script>window.onload=()=>{window.print()}</script>
  </body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}

function PainelFinanceiro({ usuario, onLogout }) {
  const marca = useBranding();
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [totalPeriodo, setTotalPeriodo] = useState(0);
  const [periodo, setPeriodo] = useState("hoje");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [comandaModal, setComandaModal] = useState(null);
  const [comandaHistModal, setComandaHistModal] = useState(null);
  const css = gerarCSS(T);

  useEffect(() => {
    document.title = `Financeiro - ${marca.nome}`;
  }, [marca.nome]);

  const fetchMesas = useCallback(async () => {
    const r = await authFetch(`${API}/api/mesas`);
    setMesas(await r.json());
  }, []);
  const fetchPedidos = useCallback(async () => {
    const r = await authFetch(`${API}/api/pedidos`);
    setPedidos(await r.json());
  }, []);

  const fetchHistorico = useCallback(async (p, di, df) => {
    setCarregando(true);
    let url = `${API}/api/relatorio?periodo=${p || "hoje"}`;
    if (di) url += `&dataInicio=${di}`;
    if (df) url += `&dataFim=${df}`;
    const r = await authFetch(url);
    const d = await r.json();
    setHistorico(d.rows || []);
    setTotalPeriodo(d.totalGeral || 0);
    setCarregando(false);
  }, []);

  useEffect(() => {
    const carregamentoInicial = window.setTimeout(() => {
      fetchMesas();
      fetchPedidos();
      fetchHistorico("hoje");
    }, 0);
    return () => window.clearTimeout(carregamentoInicial);
  }, [fetchMesas, fetchPedidos, fetchHistorico]);

  useEffect(() => {
    const s = getSocket();
    const atualizarMesa = () => {
      fetchMesas();
      fetchHistorico(periodo, dataInicio, dataFim);
    };
    s.on("mesa_atualizada", atualizarMesa);
    s.on("novo_pedido", fetchPedidos);
    s.on("pedido_atualizado", fetchPedidos);
    return () => {
      s.off("mesa_atualizada", atualizarMesa);
      s.off("novo_pedido", fetchPedidos);
      s.off("pedido_atualizado", fetchPedidos);
    };
  }, [dataFim, dataInicio, fetchHistorico, fetchMesas, fetchPedidos, periodo]);

  useOperationalSync(() => {
    fetchMesas();
    fetchPedidos();
    fetchHistorico(periodo, dataInicio, dataFim);
  }, SYNC_INTERVALS.financeiro, true);

  const mudarPeriodo = (p) => {
    setPeriodo(p);
    setDataInicio("");
    setDataFim("");
    fetchHistorico(p);
  };

  const pedidosDaMesa = (mid) =>
    pedidos.filter((p) => p.mesa_id === mid && p.status !== "finalizado");
  const itensDaMesa = (mid) =>
    pedidosDaMesa(mid).flatMap(
      (p) => p.itens?.filter((i) => i.status !== "cancelado") || [],
    );
  const totalMesa = (mid) =>
    itensDaMesa(mid).reduce((s, i) => s + i.preco * i.quantidade, 0);
  const mesasOcupadas = mesas.filter((m) => m.status === "ocupada");

  const exportarPDF = () =>
    gerarPDF({
      historico,
      totalPeriodo,
      periodo,
      dataInicio,
      dataFim,
      nomeApp: marca.nome,
    });

  {
    comandaHistModal && (
      <Modal onClose={() => setComandaHistModal(null)}>
        <div
          style={{
            fontFamily: "'Manrope',sans-serif",
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          Mesa {comandaHistModal.mesa_numero}
        </div>
        {comandaHistModal.nome_cliente && (
          <div style={{ color: T.text2, fontSize: 13, marginBottom: 16 }}>
            {comandaHistModal.nome_cliente}
          </div>
        )}
        {(comandaHistModal.itens || []).map((i, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              padding: "6px 0",
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <span>
              {i.quantidade}x {i.nome}
            </span>
            <span style={{ color: T.accent, fontWeight: 600 }}>
              R$ {(i.preco * i.quantidade).toFixed(2)}
            </span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "12px 0 4px",
            borderTop: `2px solid ${T.border2}`,
            marginTop: 8,
          }}
        >
          <span style={{ fontWeight: 700 }}>Total</span>
          <span style={{ fontWeight: 800, fontSize: 20, color: T.accent }}>
            R$ {(comandaHistModal.total || 0).toFixed(2)}
          </span>
        </div>
        <Btn
          variant="ghost"
          full
          onClick={() => setComandaHistModal(null)}
          style={{ marginTop: 14 }}
        >
          Fechar
        </Btn>
      </Modal>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <PanelHeader
          title="Financeiro"
          subtitle="Comandas, pagamentos e histórico"
          usuario={usuario}
          onLogout={onLogout}
        />

        <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
          {/* Filtros de período */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              {[
                ["hoje", "Hoje"],
                ["semana", "7 dias"],
                ["mes", "30 dias"],
                ["ano", "Ano"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => mudarPeriodo(val)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 99,
                    cursor: "pointer",
                    fontFamily: "Inter,sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    border: `1px solid ${periodo === val && !dataInicio ? T.accent : T.border}`,
                    background:
                      periodo === val && !dataInicio
                        ? T.accentGlow
                        : "transparent",
                    color: periodo === val && !dataInicio ? T.accent : T.text2,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Filtro por data personalizada */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label
                  style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}
                >
                  De:
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  style={{ width: 150, padding: "7px 10px", fontSize: 13 }}
                />
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label
                  style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}
                >
                  Até:
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  style={{ width: 150, padding: "7px 10px", fontSize: 13 }}
                />
              </div>
              <Btn
                sm
                onClick={() => {
                  if (dataInicio) {
                    setPeriodo("custom");
                    fetchHistorico("custom", dataInicio, dataFim);
                  }
                }}
                disabled={!dataInicio}
              >
                Filtrar
              </Btn>
              <Btn
                sm
                variant="success"
                onClick={exportarPDF}
                disabled={historico.length === 0}
              >
                Exportar PDF
              </Btn>
            </div>
          </div>

          {/* Cards resumo */}
          <div
            className="fin-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Card>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>
                Total do Período
              </div>
              <div
                style={{
                  fontFamily: "'Manrope',sans-serif",
                  fontSize: 26,
                  fontWeight: 700,
                  color: T.accent,
                }}
              >
                {carregando ? "..." : `R$ ${totalPeriodo.toFixed(2)}`}
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>
                Atendimentos
              </div>
              <div
                style={{
                  fontFamily: "'Manrope',sans-serif",
                  fontSize: 26,
                  fontWeight: 700,
                  color: T.blue,
                }}
              >
                {historico.length}
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>
                Mesas Abertas
              </div>
              <div
                style={{
                  fontFamily: "'Manrope',sans-serif",
                  fontSize: 26,
                  fontWeight: 700,
                  color: T.green,
                }}
              >
                {mesasOcupadas.length}
              </div>
            </Card>
          </div>

          {/* Mesas abertas */}
          {mesasOcupadas.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.accent,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 12,
                }}
              >
                Mesas Abertas
              </div>
              <div
                className="fin-mesas-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
                  gap: 10,
                }}
              >
                {mesasOcupadas.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setComandaModal(m)}
                    style={{
                      cursor: "pointer",
                      background: T.card,
                      border: `1px solid ${T.accent}`,
                      borderRadius: 8,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Manrope',sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      Mesa {m.numero}
                    </div>
                    <div
                      style={{
                        color: T.muted,
                        fontSize: 12,
                        margin: "3px 0 8px",
                      }}
                    >
                      {itensDaMesa(m.id).length} item(s) ·{" "}
                      {pedidosDaMesa(m.id).length} pedido(s)
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 12, color: T.text2 }}>
                        Total
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 16,
                          color: T.accent,
                        }}
                      >
                        R$ {totalMesa(m.id).toFixed(2)}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: T.accent,
                        textAlign: "center",
                      }}
                    >
                      Ver comanda
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.muted,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Histórico
              </div>
              {historico.length > 0 && (
                <Btn sm variant="ghost" onClick={exportarPDF}>
                  Exportar PDF
                </Btn>
              )}
            </div>
            {carregando ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "20px 0" }}>
                Carregando...
              </div>
            ) : historico.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "20px 0" }}>
                Nenhum registro no período.
              </div>
            ) : (
              historico.map((h, i) => (
                <Card
                  key={i}
                  style={{ marginBottom: 8, cursor: "pointer" }}
                  onClick={() => setComandaModal(h)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        Mesa {h.mesa_numero}
                      </div>
                      {h.garcom_nome && (
                        <span style={{ color: T.blue }}>
                          {" "}
                          · Garçom: {h.garcom_nome}
                        </span>
                      )}
                      <div
                        style={{ fontSize: 12, color: T.muted, marginTop: 2 }}
                      >
                        {h.nome_cliente && `${h.nome_cliente} · `}
                        {h.fechado_em} · {h.total_itens} item(s)
                        {h.garcom_nome && (
                          <span style={{ color: T.blue }}>
                            {" "}
                            · Garçom: {h.garcom_nome}
                          </span>
                        )}
                      {h.forma_pagamento && (
                        <div style={{ fontSize: 12, color: T.green, marginTop: 2, fontWeight: 600 }}>
                          {({credito:"Cartão Crédito",debito:"Cartão Débito",dinheiro:"Dinheiro",pix:"PIX"})[h.forma_pagamento] || h.forma_pagamento}
                        </div>
                      )}
                      </div>
                    </div>
                    <div
                      style={{ fontWeight: 800, fontSize: 17, color: T.accent }}
                    >
                      R$ {(h.total || 0).toFixed(2)}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Modal comanda */}
        {comandaModal && (
          <Modal onClose={() => setComandaModal(null)}>
            <div
              style={{
                fontFamily: "'Manrope',sans-serif",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Mesa {comandaModal.numero}
            </div>
            {(() => {
              const ps = pedidosDaMesa(comandaModal.id);
              const nomeC = ps.find((p) => p.nome_cliente)?.nome_cliente;
              return nomeC ? (
                <div style={{ color: T.text2, fontSize: 14, marginBottom: 16 }}>
                  {nomeC}
                </div>
              ) : (
                <div style={{ marginBottom: 16 }} />
              );
            })()}
            {pedidosDaMesa(comandaModal.id).map((p) => (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>
                  Pedido #{p.numero_dia || p.id}
                </div>
                {p.itens
                  ?.filter((i) => i.status !== "cancelado")
                  .map((i) => (
                    <div
                      key={i.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 14,
                        padding: "6px 0",
                        borderTop: `1px solid ${T.border}`,
                      }}
                    >
                      <span>
                        {i.quantidade}x {i.nome}
                      </span>
                      <span style={{ color: T.accent, fontWeight: 600 }}>
                        R$ {(i.preco * i.quantidade).toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "14px 0 4px",
                borderTop: `2px solid ${T.border2}`,
                marginTop: 8,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 22, color: T.accent }}>
                R$ {totalMesa(comandaModal.id).toFixed(2)}
              </span>
            </div>
            <Btn
              variant="ghost"
              full
              onClick={() => setComandaModal(null)}
              style={{ marginTop: 16 }}
            >
              Fechar
            </Btn>
          </Modal>
        )}
      </div>
    </>
  );
}
