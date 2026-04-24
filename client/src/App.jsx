import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CONFIG = {
  //nomeApp: "MenuExpress",
  logoUrl: "/2.png",
  logoCliente: null,
  corPrimaria: null,
  corSecundaria: null,
  senhaAdmin: "admin123",
  senhaGarcom: "garcom123",
  senhaFinanceiro: "financeiro123",
};

let socket = null;
function getSocket() {
  if (!socket) socket = io(API);
  return socket;
}

// ─── SISTEMA DE TEMAS ────────────────────────────────────────────────────────
// Psicologia das cores para restaurantes:
// Terracota/âmbar: estimula apetite, transmite aconchego
// Verde-salva: sofisticação, frescor, confiança
// Marfim (claro): clareza, limpeza, leveza

const PALETA = {
  accent: CONFIG.corPrimaria || "#c8714a",
  accent2: CONFIG.corSecundaria || "#a85535",
  green: "#4caf82",
  red: "#e05c5c",
  blue: "#5b9bd5",
  amber: "#d4a017",
};

const TEMAS = {
  escuro: {
    bg: "#141210",
    bg2: "#1a1714",
    card: "#211e1b",
    card2: "#2a2623",
    border: "#332e2a",
    border2: "#3d3733",
    text: "#f0ece6",
    text2: "#b8afa6",
    muted: "#7a706a",
    accentGlow: "rgba(200,113,74,0.14)",
    shadow: "rgba(0,0,0,0.5)",
    inputBg: "#2a2623",
  },
  claro: {
    bg: "#faf8f5",
    bg2: "#ffffff",
    card: "#ffffff",
    card2: "#f5f2ee",
    border: "#e8e2dc",
    border2: "#ddd6ce",
    text: "#1a1512",
    text2: "#6b5e55",
    muted: "#a8998f",
    accentGlow: "rgba(200,113,74,0.10)",
    shadow: "rgba(0,0,0,0.12)",
    inputBg: "#f5f2ee",
  },
};

const _temaInicial =
  (typeof localStorage !== "undefined" &&
    localStorage.getItem("menuexpress_tema")) ||
  "escuro";
let _temaAtual = _temaInicial;
let _temaListeners = [];

function getTema() {
  return { ...TEMAS[_temaAtual], ...PALETA };
}

function alternarTema() {
  _temaAtual = _temaAtual === "escuro" ? "claro" : "escuro";
  if (typeof localStorage !== "undefined")
    localStorage.setItem("menuexpress_tema", _temaAtual);
  _temaListeners.forEach((fn) => fn(_temaAtual));
  // Força atualização do CSS global
  document.body.setAttribute("data-tema", _temaAtual);
}

function useTema() {
  const [tema, setTema] = useState(_temaAtual);
  useEffect(() => {
    const handler = (t) => {
      setTema(t);
    };
    _temaListeners.push(handler);
    return () => {
      _temaListeners = _temaListeners.filter((l) => l !== handler);
    };
  }, []);
  return tema;
}

let T = getTema();

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
  } catch (e) {}
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
            color: "#0d0f0e",
            borderRadius: 14,
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
              color: "#0d0f0e",
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
function gerarCSS(t) {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-text-size-adjust: 100%; }
  body { background: ${t.bg}; color: ${t.text}; font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.5; min-height: 100vh; overflow-x: hidden; transition: background .3s, color .3s; }
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
  input, select, textarea {
    background: ${t.inputBg}; border: 1px solid ${t.border2};
    border-radius: 10px; color: ${t.text}; font-family: 'Inter',sans-serif;
    font-size: 14px; padding: 10px 14px; width: 100%; outline: none; transition: border-color .2s, background .3s;
  }
  input:focus, select:focus, textarea:focus { border-color: ${t.accent}; }
  input::placeholder, textarea::placeholder { color: ${t.muted}; }
  select option { background: ${t.card2}; color: ${t.text}; }
  a { color: inherit; }
`;
}
const css = gerarCSS(T);

// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────
function Btn({
  children,
  onClick,
  variant = "primary",
  sm,
  disabled,
  style,
  full,
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 10,
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
      background: `linear-gradient(135deg,${T.accent},${T.accent2})`,
      color: "#0d0f0e",
    },
    ghost: {
      background: "transparent",
      color: T.text2,
      border: `1px solid ${T.border2}`,
    },
    danger: {
      background: "rgba(248,113,113,.1)",
      color: T.red,
      border: "1px solid rgba(248,113,113,.25)",
    },
    success: {
      background: "rgba(74,222,128,.1)",
      color: T.green,
      border: "1px solid rgba(74,222,128,.25)",
    },
    info: {
      background: "rgba(96,165,250,.1)",
      color: T.blue,
      border: "1px solid rgba(96,165,250,.25)",
    },
    amber: {
      background: "rgba(251,191,36,.1)",
      color: T.amber,
      border: "1px solid rgba(251,191,36,.25)",
    },
  };
  return (
    <button
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
  useTema();
  T = getTema();
  return (
    <div
      className={className}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
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
  };
  return <span className={`badge badge-${status}`}>{l[status] || status}</span>;
}

function Modal({ children, onClose }) {
  useTema();
  T = getTema();
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
          borderRadius: 18,
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

// ─── BOTAO TEMA ──────────────────────────────────────────────────────────────
function BotaoTema() {
  const tema = useTema();
  // Atualiza T globalmente quando tema muda
  T = getTema();
  return (
    <button
      onClick={alternarTema}
      title={
        tema === "escuro" ? "Mudar para tema claro" : "Mudar para tema escuro"
      }
      style={{
        background: "transparent",
        border: `1px solid ${T.border2}`,
        borderRadius: 8,
        padding: "5px 10px",
        cursor: "pointer",
        color: T.text2,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "Inter,sans-serif",
        transition: "all .2s",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {tema === "escuro" ? "Tema Claro" : "Tema Escuro"}
    </button>
  );
}

function Logo({ size = "md" }) {
  const logo = CONFIG.logoCliente || CONFIG.logoUrl;
  const fs = size === "lg" ? 26 : size === "sm" ? 14 : 18;
  if (logo)
    return (
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        <img
          src={logo}
          alt="Logo"
          style={{ height: size === "lg" ? 110 : 30, objectFit: "contain" }}
        />
        {CONFIG.logoCliente && CONFIG.logoUrl && (
          <span style={{ color: T.muted, fontSize: 10 }}>
            powered by {CONFIG.nomeApp}
          </span>
        )}
      </div>
    );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontFamily: "'Playfair Display',serif",
          fontWeight: 700,
          fontSize: fs,
          letterSpacing: "-0.3px",
          background: `linear-gradient(135deg,${T.accent},${T.accent2})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {CONFIG.nomeApp}
      </span>
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
function TelaLogin({ titulo, subtitulo, onLogin, senhaCorreta }) {
  const tema = useTema();
  T = getTema();
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
      <Logo size="lg" />
      <div
        style={{
          marginTop: 40,
          width: "100%",
          maxWidth: 360,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: 32,
        }}
      >
        <div
          style={{
            fontFamily: "'Playfair Display',serif",
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
            marginTop: subtitulo ? 0 : 18,
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

// ─── BOAS-VINDAS MESA ─────────────────────────────────────────────────────────
function TelaBoasVindas({ mesa_id, onContinuar }) {
  const tema = useTema();
  T = getTema();
  const css = gerarCSS(T);
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
        <Logo size="lg" />
        <div
          style={{
            marginTop: 28,
            fontFamily: "'Playfair Display',serif",
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          Bem-vindo à<br />
          <span style={{ color: T.accent }}>Mesa {mesa_id}</span>
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

// ─── PAINEL CLIENTE ───────────────────────────────────────────────────────────
function PainelCliente({ mesa_id }) {
  const [nomeCliente, setNomeCliente] = useState(null);
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

  const tema = useTema();
  T = getTema();
  const css = gerarCSS(T);
  useEffect(() => {
    document.title = `Mesa ${mesa_id} - ${CONFIG.nomeApp}`;
  }, [mesa_id]);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const fetchCardapio = useCallback(async () => {
    const r = await fetch(`${API}/api/cardapio`);
    setCardapio(await r.json());
  }, []);
  const fetchPedidos = useCallback(async () => {
    const r = await fetch(`${API}/api/pedidos?mesa_id=${mesa_id}`);
    const d = await r.json();
    setPedidos(d.filter((p) => p.status !== "finalizado"));
  }, [mesa_id]);

  useEffect(() => {
    fetchCardapio();
    fetchPedidos();
    const s = getSocket();
    s.on("cardapio_atualizado", fetchCardapio);
    s.on("pedido_atualizado", fetchPedidos);
    // Item 3: ao fechar mesa, reseta tudo para tela de boas-vindas
    s.on("mesa_fechada", (id) => {
      if (String(id) === String(mesa_id)) {
        setPedidos([]);
        setCarrinho([]);
        setNomeCliente(null);
      }
    });
    return () => {
      s.off("cardapio_atualizado");
      s.off("pedido_atualizado");
      s.off("mesa_fechada");
    };
  }, [fetchCardapio, fetchPedidos, mesa_id]);

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
    await fetch(`${API}/api/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mesa_id, itens, nome_cliente: nomeCliente }),
    });
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
    if (item.status !== "pendente") return;
    await fetch(`${API}/api/itens/${item.id}/cancelar`, { method: "PATCH" });
    setCancelandoItem(null);
    fetchPedidos();
    showToast("Item cancelado.");
  };

  const produtos =
    catAtiva === null
      ? cardapio.produtos
      : cardapio.produtos.filter((p) => p.categoria_id === catAtiva);

  if (!nomeCliente)
    return (
      <>
        <style>{css}</style>
        <TelaBoasVindas mesa_id={mesa_id} onContinuar={setNomeCliente} />
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
                {nomeCliente} · Mesa {mesa_id}
              </div>
              <BotaoTema />
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {[
              ["cardapio", "Cardapio"],
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
              borderRadius: 12,
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
          {/* CARDAPIO */}
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
                  const ei = cardapio.categorias.findIndex(
                    (c) => c.id === p.categoria_id,
                  );
                  return (
                    <div
                      key={p.id}
                      className="fade-up"
                      style={{
                        animationDelay: `${i * 0.03}s`,
                        background: T.card,
                        border: `1px solid ${q > 0 ? T.accent : T.border}`,
                        borderRadius: 14,
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
                      borderRadius: 14,
                      padding: 16,
                      width: "100%",
                    }}
                  >
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
                          fontFamily: "'Playfair Display',serif",
                          fontWeight: 700,
                        }}
                      >
                        Pedido #{p.id}
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
                                onClick={() => setCancelandoItem(item)}
                                style={{
                                  fontSize: 11,
                                  color: T.red,
                                  background: "rgba(248,113,113,.1)",
                                  border: "1px solid rgba(248,113,113,.25)",
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                  cursor: "pointer",
                                  fontFamily: "Inter,sans-serif",
                                }}
                              >
                                Cancelar
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
                borderRadius: 14,
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
              Qualquer duvida, chame o garcom
            </div>
          </div>
        </div>

        {/* Modal carrinho / confirmar pedido */}
        {carrinhoModal && (
          <Modal onClose={() => setCarrinhoModal(false)}>
            <div
              style={{
                fontFamily: "'Playfair Display',serif",
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

// ─── PAINEL GARCOM ────────────────────────────────────────────────────────────
function PainelGarcom() {
  const [chamadas, setChamadas] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [contaModal, setContaModal] = useState(null);
  const [pedidosModal, setPedidosModal] = useState(null);
  const bellRef = useRef(null);
  const { notifs, push, dismiss } = useNotifs();

  const tema = useTema();
  T = getTema();
  const css = gerarCSS(T);
  useEffect(() => {
    document.title = `Garcom - ${CONFIG.nomeApp}`;
  }, []);

  const fetchChamadas = useCallback(async () => {
    const r = await fetch(`${API}/api/chamadas`);
    setChamadas(await r.json());
  }, []);
  const fetchMesas = useCallback(async () => {
    const r = await fetch(`${API}/api/mesas`);
    setMesas(await r.json());
  }, []);
  const fetchPedidos = useCallback(async () => {
    const r = await fetch(`${API}/api/pedidos`);
    setPedidos(await r.json());
  }, []);

  useEffect(() => {
    fetchChamadas();
    fetchMesas();
    fetchPedidos();
    const s = getSocket();

    // Item 1 e 5: cliente chama garcom com nome e mesa
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
          `${cliente} da Mesa ${data.mesa_numero} solicitando garcom`,
          "Dirija-se a mesa",
          "chamada",
        );
      }
      bellRef.current?.classList.add("ring");
      setTimeout(() => bellRef.current?.classList.remove("ring"), 700);
    });

    // Pedido pronto na cozinha
    s.on("pedido_pronto", (data) => {
      fetchPedidos();
      push(
        `Pedido pronto — Mesa ${data.mesa_numero}`,
        "Buscar na cozinha",
        "pronto",
      );
    });

    s.on("chamada_atendida", fetchChamadas);
    s.on("mesa_atualizada", fetchMesas);
    s.on("novo_pedido", fetchPedidos);
    s.on("pedido_atualizado", fetchPedidos);
    return () => {
      s.off("chamada_garcom");
      s.off("pedido_pronto");
      s.off("chamada_atendida");
      s.off("mesa_atualizada");
      s.off("novo_pedido");
      s.off("pedido_atualizado");
    };
  }, [fetchChamadas, fetchMesas, fetchPedidos, push]);

  const atenderChamada = async (id) => {
    await fetch(`${API}/api/chamadas/${id}/atender`, { method: "PATCH" });
    fetchChamadas();
  };

  const fecharMesa = async (mesa_id) => {
    await fetch(`${API}/api/mesas/${mesa_id}/fechar`, { method: "POST" });
    getSocket().emit("mesa_fechada_event", mesa_id);
    setContaModal(null);
    fetchMesas();
    fetchPedidos();
  };

  const confirmarRetirada = async (pedido_id) => {
    await fetch(`${API}/api/pedidos/${pedido_id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "entregue" }),
    });
    fetchPedidos();
  };

  const pedidosDaMesa = (mid) =>
    pedidos.filter(
      (p) =>
        p.mesa_id === mid &&
        p.status !== "finalizado" &&
        p.status !== "entregue",
    );
  const totalMesa = (mid) =>
    pedidosDaMesa(mid).reduce(
      (s, p) =>
        s +
        (p.itens
          ?.filter((i) => i.status !== "cancelado")
          .reduce((ss, i) => ss + i.preco * i.quantidade, 0) || 0),
      0,
    );
  const pedidosProntos = pedidos.filter(
    (p) =>
      p.itens?.length &&
      p.itens
        .filter((i) => i.status !== "cancelado")
        .every((i) => i.status === "pronto") &&
      p.status !== "entregue" &&
      p.status !== "finalizado",
  );

  return (
    <>
      <style>{css}</style>
      <NotifBanner notifs={notifs} onDismiss={dismiss} />
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <div
          style={{
            background: T.bg2,
            borderBottom: `1px solid ${T.border}`,
            padding: "13px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Logo />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            <span
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Garcom
            </span>
            <BotaoTema />
          </div>
        </div>

        <div style={{ padding: 14 }}>
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
                            : `${cliente} da Mesa ${c.mesa_numero} solicitando garcom`}
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
                        Mesa {p.mesa_numero} — Pedido #{p.id}
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
                    fontFamily: "'Playfair Display',serif",
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
                      variant="danger"
                      onClick={() => setContaModal(m)}
                    >
                      Fechar Mesa
                    </Btn>
                  </>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Modal ver pedidos da mesa */}
        {pedidosModal && (
          <Modal onClose={() => setPedidosModal(null)}>
            <div
              style={{
                fontFamily: "'Playfair Display',serif",
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
                      Pedido #{p.id}
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
                R$ {totalMesa(pedidosModal.id).toFixed(2)}
              </span>
            </div>
            <Btn variant="ghost" full onClick={() => setPedidosModal(null)}>
              Fechar
            </Btn>
          </Modal>
        )}

        {/* Modal fechar conta */}
        {contaModal && (
          <Modal onClose={() => setContaModal(null)}>
            <div
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              Fechar Mesa {contaModal.numero}
            </div>
            {pedidosDaMesa(contaModal.id).map((p) => (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>
                  Pedido #{p.id}
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
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 0",
                borderTop: `1px solid ${T.border2}`,
                marginBottom: 16,
              }}
            >
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: T.accent }}>
                R$ {totalMesa(contaModal.id).toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn
                variant="ghost"
                onClick={() => setContaModal(null)}
                style={{ flex: 1 }}
              >
                Cancelar
              </Btn>
              <Btn
                variant="danger"
                onClick={() => fecharMesa(contaModal.id)}
                style={{ flex: 1 }}
              >
                Confirmar Fechamento
              </Btn>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}

// ─── PAINEL COZINHA ───────────────────────────────────────────────────────────
function PainelCozinha() {
  const [pedidos, setPedidos] = useState([]);
  const [chamadas, setChamadas] = useState([]);
  const [dragging, setDragging] = useState(null);

  const tema = useTema();
  T = getTema();
  const css = gerarCSS(T);
  useEffect(() => {
    document.title = `Cozinha - ${CONFIG.nomeApp}`;
  }, []);

  const fetchPedidos = useCallback(async () => {
    const [r1, r2, r3] = await Promise.all([
      fetch(`${API}/api/pedidos?status=pendente`),
      fetch(`${API}/api/pedidos?status=preparo`),
      fetch(`${API}/api/pedidos?status=pronto`),
    ]);
    const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
    setPedidos([...d1, ...d2, ...d3]);
  }, []);
  const fetchChamadas = useCallback(async () => {
    const r = await fetch(`${API}/api/chamadas`);
    setChamadas(await r.json());
  }, []);

  useEffect(() => {
    fetchPedidos();
    fetchChamadas();
    const s = getSocket();
    s.on("novo_pedido", fetchPedidos);
    s.on("pedido_atualizado", fetchPedidos);
    s.on("chamada_garcom", fetchChamadas);
    s.on("chamada_atendida", fetchChamadas);
    return () => {
      s.off("novo_pedido");
      s.off("pedido_atualizado");
      s.off("chamada_garcom");
      s.off("chamada_atendida");
    };
  }, [fetchPedidos, fetchChamadas]);

  // Item 8: moverItem aceita qualquer direção
  const moverItem = async (itemId, novoStatus) => {
    await fetch(`${API}/api/itens/${itemId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    fetchPedidos();
  };

  // Move todos os itens do pedido para um status
  const moverTudo = async (pedido, novoStatus) => {
    const itensAlvo =
      pedido.itens?.filter(
        (i) => i.status !== "cancelado" && i.status !== novoStatus,
      ) || [];
    await Promise.all(
      itensAlvo.map((i) =>
        fetch(`${API}/api/itens/${i.id}/status`, {
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
    await fetch(`${API}/api/chamadas/${id}/atender`, { method: "PATCH" });
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
        {/* Header */}
        <div
          style={{
            background: T.bg2,
            borderBottom: `1px solid ${T.border}`,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo />
            <span style={{ color: T.muted, fontSize: 14, marginLeft: 4 }}>
              Cozinha
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {pedidos.length > 0 && (
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
            )}
            <BotaoTema />
          </div>
        </div>

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
                  borderRadius: 10,
                  padding: "5px 10px",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  Mesa {c.mesa_numero}
                </span>
                <span style={{ color: T.muted, fontSize: 12 }}>
                  {c.motivo?.startsWith("conta") ? "Conta" : "Garcom"}
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
                      borderRadius: 12,
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
                        borderRadius: 12,
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
                              fontFamily: "'Playfair Display',serif",
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
function PainelAdmin() {
  const [aba, setAba] = useState("produtos");
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

  const tema = useTema();
  T = getTema();
  const css = gerarCSS(T);
  useEffect(() => {
    document.title = `Admin - ${CONFIG.nomeApp}`;
  }, []);

  const fetchCardapio = useCallback(async () => {
    const r = await fetch(`${API}/api/cardapio`);
    setCardapio(await r.json());
  }, []);
  const fetchMesas = useCallback(async () => {
    const r = await fetch(`${API}/api/mesas`);
    setMesas(await r.json());
  }, []);
  const fetchUsuarios = useCallback(async () => {
    const r = await fetch(`${API}/api/usuarios`);
    setUsuarios(await r.json());
  }, []);
  const fetchRelatorio = useCallback(async (periodo) => {
    setRelatorio((prev) => ({ ...prev, carregando: true }));
    const r = await fetch(`${API}/api/relatorio?periodo=${periodo}`);
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
    const s = getSocket();
    s.on("cardapio_atualizado", fetchCardapio);
    return () => s.off("cardapio_atualizado");
  }, [fetchCardapio, fetchMesas]);

  const salvarProduto = async () => {
    if (!novoP.nome || !novoP.preco) return;
    await fetch(`${API}/api/produtos`, {
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
    await fetch(`${API}/api/produtos/${editando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editando),
    });
    setEditando(null);
    fetchCardapio();
  };
  const deletarProduto = async (id) => {
    if (!confirm("Deletar produto?")) return;
    await fetch(`${API}/api/produtos/${id}`, { method: "DELETE" });
    fetchCardapio();
  };
  const toggleDisponivel = async (p) => {
    await fetch(`${API}/api/produtos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, disponivel: p.disponivel ? 0 : 1 }),
    });
    fetchCardapio();
  };
  const salvarCategoria = async () => {
    if (!novaCategoria.trim()) return;
    await fetch(`${API}/api/categorias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novaCategoria.trim() }),
    });
    setNovaCategoria("");
    fetchCardapio();
  };
  const deletarCategoria = async (id) => {
    if (!confirm("Deletar categoria?")) return;
    await fetch(`${API}/api/categorias/${id}`, { method: "DELETE" });
    fetchCardapio();
  };
  const criarMesa = async () => {
    if (!novaMesa.trim()) return;
    await fetch(`${API}/api/mesas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero: novaMesa.trim() }),
    });
    setNovaMesa("");
    fetchMesas();
  };
  const deletarMesa = async (id) => {
    if (!confirm("Deletar mesa?")) return;
    await fetch(`${API}/api/mesas/${id}`, { method: "DELETE" });
    fetchMesas();
  };
  const verQR = async (mesa_id) => {
    const r = await fetch(`${API}/api/qrcode/${mesa_id}`);
    setQrModal(await r.json());
  };

  const produtosFiltrados = cardapio.produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.descricao || "").toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <div
          style={{
            background: T.bg2,
            borderBottom: `1px solid ${T.border}`,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Logo />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "'Playfair Display',serif",
                fontWeight: 700,
                fontSize: 15,
                color: T.accent,
              }}
            >
              Administracao
            </span>
            <BotaoTema />
          </div>
        </div>

        <div
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
            ["equipe", "Equipe"],
            ["relatorios", "Relatorios"],
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

        <div style={{ padding: 14, maxWidth: 860, margin: "0 auto" }}>
          {aba === "produtos" && (
            <div className="fade-up">
              <Card style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontFamily: "'Playfair Display',serif",
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
                  placeholder="Descricao"
                  value={novoP.descricao}
                  onChange={(e) =>
                    setNovoP((p) => ({ ...p, descricao: e.target.value }))
                  }
                  style={{ marginBottom: 8, resize: "vertical", minHeight: 60 }}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <input
                    placeholder="Preco (R$) *"
                    type="number"
                    step="0.01"
                    value={novoP.preco}
                    onChange={(e) =>
                      setNovoP((p) => ({ ...p, preco: e.target.value }))
                    }
                  />
                  <input
                    placeholder="URL da foto (opcional)"
                    value={novoP.imagem}
                    onChange={(e) =>
                      setNovoP((p) => ({ ...p, imagem: e.target.value }))
                    }
                  />
                </div>
                {novoP.imagem && (
                  <img
                    src={novoP.imagem}
                    alt="preview"
                    style={{
                      width: "100%",
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 8,
                      marginBottom: 10,
                    }}
                    onError={(e) => (e.target.style.display = "none")}
                  />
                )}
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
              {cardapio.categorias.map((cat, ci) => {
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
                              borderRadius: 10,
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
                    fontFamily: "'Playfair Display',serif",
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
                    fontFamily: "'Playfair Display',serif",
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
                        fontFamily: "'Playfair Display',serif",
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
                        QR Code
                      </Btn>
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
        </div>

        {aba === "equipe" && (
          <div className="fade-up">
            <Card style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 17,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                Novo Usuario
              </div>
              <input
                placeholder="Nome completo"
                value={novoUsuario.nome}
                onChange={(e) =>
                  setNovoUsuario((u) => ({ ...u, nome: e.target.value }))
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
                <option value="garcom">Garcom</option>
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
              <Btn
                onClick={salvarUsuario}
                disabled={!novoUsuario.nome || !novoUsuario.senha}
              >
                Criar Usuario
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
                      ? "Garcons"
                      : role === "cozinha"
                        ? "Cozinha"
                        : "Financeiro"}{" "}
                    ({lista.length})
                  </div>
                  {lista.length === 0 ? (
                    <div
                      style={{ color: T.muted, fontSize: 13, padding: "8px 0" }}
                    >
                      Nenhum usuario
                    </div>
                  ) : (
                    lista.map((u) => (
                      <Card
                        key={u.id}
                        style={{ marginBottom: 8, opacity: u.ativo ? 1 : 0.5 }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
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
                          <div style={{ display: "flex", gap: 6 }}>
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
                    fontFamily: "'Playfair Display',serif",
                    fontSize: 18,
                    fontWeight: 700,
                    marginBottom: 14,
                  }}
                >
                  Editar Usuario
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
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 17,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                Periodo
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["hoje", "Hoje"],
                  ["semana", "7 dias"],
                  ["mes", "30 dias"],
                  ["ano", "Ano"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => {
                      setPeriodoRel(val);
                      fetchRelatorio(val);
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 99,
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
                    Total do Periodo
                  </div>
                  <div
                    style={{
                      fontFamily: "'Playfair Display',serif",
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
                    Nenhum dado no periodo.
                  </div>
                ) : (
                  relatorio.dados.map((r, i) => (
                    <Card key={i} style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
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

        {/* Modal editar produto */}
        {editando && (
          <Modal onClose={() => setEditando(null)}>
            <div
              style={{
                fontFamily: "'Playfair Display',serif",
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
              placeholder="Descricao"
              value={editando.descricao || ""}
              onChange={(e) =>
                setEditando((p) => ({ ...p, descricao: e.target.value }))
              }
              style={{ marginBottom: 8, resize: "vertical", minHeight: 60 }}
            />
            <input
              placeholder="Preco (R$)"
              type="number"
              step="0.01"
              value={editando.preco}
              onChange={(e) =>
                setEditando((p) => ({ ...p, preco: e.target.value }))
              }
              style={{ marginBottom: 8 }}
            />
            <input
              placeholder="URL da foto"
              value={editando.imagem || ""}
              onChange={(e) =>
                setEditando((p) => ({ ...p, imagem: e.target.value }))
              }
              style={{ marginBottom: 10 }}
            />
            {editando.imagem && (
              <img
                src={editando.imagem}
                alt="preview"
                style={{
                  width: "100%",
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 10,
                  marginBottom: 12,
                }}
                onError={(e) => (e.target.style.display = "none")}
              />
            )}
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
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                QR Code
              </div>
              <img
                src={qrModal.qr}
                alt="QR"
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 12,
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
export default function App() {
  const tema = useTema();
  T = getTema();
  const css = gerarCSS(T);
  const path = window.location.pathname;
  const [autAdmin, setAutAdmin] = useState(false);
  const [autGarcom, setAutGarcom] = useState(false);
  const [autFinanceiro, setAutFinanceiro] = useState(false);
  useEffect(() => {
    document.title = CONFIG.nomeApp;
  }, []);

  const mesa_id = path.startsWith("/mesa/") ? path.split("/")[2] : null;
  if (mesa_id) return <PainelCliente mesa_id={mesa_id} />;
  if (path === "/cozinha") return <PainelCozinha />;

  if (path === "/garcom") {
    if (!autGarcom)
      return (
        <>
          <style>{css}</style>
          <TelaLogin
            titulo="Garcom"
            subtitulo="Acesso restrito"
            senhaCorreta={CONFIG.senhaGarcom}
            onLogin={() => setAutGarcom(true)}
          />
        </>
      );
    return <PainelGarcom />;
  }
  if (path === "/financeiro") {
    if (!autFinanceiro)
      return (
        <>
          <style>{css}</style>
          <TelaLogin
            titulo="Financeiro"
            subtitulo="Acesso restrito"
            senhaCorreta={CONFIG.senhaFinanceiro}
            onLogin={() => setAutFinanceiro(true)}
          />
        </>
      );
    return <PainelFinanceiro />;
  }
  if (path === "/admin") {
    if (!autAdmin)
      return (
        <>
          <style>{css}</style>
          <TelaLogin
            titulo="Administracao"
            subtitulo="Acesso restrito"
            senhaCorreta={CONFIG.senhaAdmin}
            onLogin={() => setAutAdmin(true)}
          />
        </>
      );
    return <PainelAdmin />;
  }

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
          padding: 24,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 300,
            background: `radial-gradient(ellipse at 50% 0%,${T.accentGlow} 0%,transparent 70%)`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 400,
            textAlign: "center",
          }}
        >
          <Logo size="lg" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginTop: 8,
              marginBottom: 36,
            }}
          >
            <div style={{ color: T.muted, fontSize: 13 }}>
              Sistema de cardapio digital
            </div>
            <BotaoTema />
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              {
                href: "/mesa/1",
                label: "Mesa 1",
                desc: "Ver como o cliente ve",
              },
              {
                href: "/garcom",
                label: "Garcom",
                desc: "Chamadas e fechamento de mesa",
              },
              {
                href: "/cozinha",
                label: "Cozinha",
                desc: "Pedidos em tempo real",
              },
              { href: "/admin", label: "Admin", desc: "Produtos e categorias" },
              {
                href: "/financeiro",
                label: "Financeiro",
                desc: "Resumo financeiro e comandas",
              },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{ textDecoration: "none" }}
              >
                <Card
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {item.label}
                    </div>
                    <div style={{ color: T.muted, fontSize: 12 }}>
                      {item.desc}
                    </div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── PAINEL FINANCEIRO ────────────────────────────────────────────────────────
function PainelFinanceiro() {
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [comandaModal, setComandaModal] = useState(null);
  const tema = useTema();
  T = getTema();
  const css = gerarCSS(T);

  useEffect(() => {
    document.title = `Financeiro - ${CONFIG.nomeApp}`;
  }, []);

  const fetchMesas = useCallback(async () => {
    const r = await fetch(`${API}/api/mesas`);
    setMesas(await r.json());
  }, []);
  const fetchPedidos = useCallback(async () => {
    const r = await fetch(`${API}/api/pedidos`);
    setPedidos(await r.json());
  }, []);
  const fetchHistorico = useCallback(async () => {
    const r = await fetch(`${API}/api/historico`);
    setHistorico(await r.json());
  }, []);

  useEffect(() => {
    fetchMesas();
    fetchPedidos();
    fetchHistorico();
    const s = getSocket();
    s.on("mesa_atualizada", () => {
      fetchMesas();
      fetchHistorico();
    });
    s.on("novo_pedido", fetchPedidos);
    s.on("pedido_atualizado", fetchPedidos);
    return () => {
      s.off("mesa_atualizada");
      s.off("novo_pedido");
      s.off("pedido_atualizado");
    };
  }, [fetchMesas, fetchPedidos, fetchHistorico]);

  const pedidosDaMesa = (mid) =>
    pedidos.filter((p) => p.mesa_id === mid && p.status !== "finalizado");
  const itensDaMesa = (mid) =>
    pedidosDaMesa(mid).flatMap(
      (p) => p.itens?.filter((i) => i.status !== "cancelado") || [],
    );
  const totalMesa = (mid) =>
    itensDaMesa(mid).reduce((s, i) => s + i.preco * i.quantidade, 0);

  const totalDia = historico.reduce((s, h) => s + (h.total || 0), 0);
  const mesasOcupadas = mesas.filter((m) => m.status === "ocupada");

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: T.bg }}>
        {/* Header */}
        <div
          style={{
            background: T.bg2,
            borderBottom: `1px solid ${T.border}`,
            padding: "13px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Logo />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "'Playfair Display',serif",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              Financeiro
            </span>
            <BotaoTema />
          </div>
        </div>

        <div style={{ padding: 16, maxWidth: 860, margin: "0 auto" }}>
          {/* Resumo do dia */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Card>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>
                Total do Dia
              </div>
              <div
                style={{
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 28,
                  fontWeight: 700,
                  color: T.accent,
                }}
              >
                R$ {totalDia.toFixed(2)}
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>
                Mesas Abertas
              </div>
              <div
                style={{
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 28,
                  fontWeight: 700,
                  color: T.green,
                }}
              >
                {mesasOcupadas.length}
              </div>
            </Card>
          </div>

          {/* Mesas abertas — comandas */}
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
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
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
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Playfair Display',serif",
                        fontSize: 20,
                        fontWeight: 700,
                      }}
                    >
                      Mesa {m.numero}
                    </div>
                    <div
                      style={{
                        color: T.muted,
                        fontSize: 12,
                        margin: "4px 0 10px",
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
                          fontSize: 18,
                          color: T.accent,
                        }}
                      >
                        R$ {totalMesa(m.id).toFixed(2)}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: T.accent,
                        textAlign: "center",
                      }}
                    >
                      Clique para ver comanda
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historico do dia */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              Historico do Dia
            </div>
            {historico.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "20px 0" }}>
                Nenhuma mesa fechada hoje.
              </div>
            ) : (
              historico.map((h, i) => (
                <Card key={i} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        Mesa {h.mesa_numero}
                      </div>
                      <div
                        style={{ fontSize: 12, color: T.muted, marginTop: 2 }}
                      >
                        {h.nome_cliente && `${h.nome_cliente} · `}
                        {h.fechado_em}
                      </div>
                      <div style={{ fontSize: 12, color: T.muted }}>
                        {h.total_itens} item(s)
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
                fontFamily: "'Playfair Display',serif",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Mesa {comandaModal.numero}
            </div>
            {/* Nome do cliente (primeiro pedido com nome) */}
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

            {/* Itens agrupados */}
            {pedidosDaMesa(comandaModal.id).map((p) => (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>
                  Pedido #{p.id}
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

            {/* Total */}
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
