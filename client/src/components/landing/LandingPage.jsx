import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Beef,
  CakeSlice,
  CalendarCheck,
  Check,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Coffee,
  CookingPot,
  CupSoda,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Package,
  Pizza,
  QrCode,
  Radio,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  UsersRound,
  Utensils,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { rotaDoPerfil, rotaRestaurante } from "../../services/auth.js";
import { useBranding } from "../branding/branding-context.js";
import {
  DEFAULT_COOKIE_PREFERENCES,
  PRIVACY_POLICY_VERSION,
  recordLegalConsent,
  TERMS_VERSION,
} from "../legal/privacy-consent.js";
import LoginModal from "./LoginModal.jsx";
import "./LandingPage.css";

const NAV_LINKS = [
  { label: "Produto", href: "#produto" },
  { label: "Fluxo", href: "#fluxo" },
  { label: "Operação", href: "#operacao" },
  { label: "Cardápio", href: "#cardapio" },
  { label: "Planos", href: "#planos" },
  { label: "Demonstração", href: "#contato" },
];

const MODULOS = [
  {
    id: "admin",
    label: "Administração",
    icon: LayoutDashboard,
    accent: "#f2742d",
    eyebrow: "Controle central",
    title: "Veja cada mesa, pedido e reserva sem perder tempo procurando.",
    text: "O painel concentra cadastros, equipe, QR Codes e indicadores para a gestão decidir com contexto.",
    metric: "18",
    metricLabel: "mesas monitoradas",
    rows: ["Cardápio atualizado", "QR Code da mesa 08 ativo", "Novo garçom criado"],
    stats: [
      ["Pedidos ativos", "14"],
      ["Mesas ocupadas", "9"],
      ["Ticket médio", "R$ 82"],
    ],
  },
  {
    id: "cozinha",
    label: "Cozinha",
    icon: ChefHat,
    accent: "#327ca4",
    eyebrow: "Produção sem ruído",
    title: "A cozinha sabe o que preparar. O garçom sabe o que entregar.",
    text: "Itens entram por status, avançam no preparo e avisam o salão quando ficam prontos.",
    metric: "06",
    metricLabel: "itens em preparo",
    rows: ["Burger Autenix entrou", "Filé Executivo preparando", "Pedido #128 pronto"],
    stats: [
      ["Recebidos", "8"],
      ["Preparando", "6"],
      ["Prontos", "3"],
    ],
  },
  {
    id: "garcom",
    label: "Garçom",
    icon: ClipboardList,
    accent: "#218c72",
    eyebrow: "Salão em movimento",
    title: "Menos mensagem solta. Mais atendimento acontecendo.",
    text: "O garçom acompanha mesas, chamadas, histórico e fechamento no mesmo lugar.",
    metric: "03",
    metricLabel: "chamadas abertas",
    rows: ["Mesa 03 pediu atendimento", "Mesa 07 aguardando conta", "Mesa 12 recebeu pedido"],
    stats: [
      ["Chamadas", "3"],
      ["Entregas", "11"],
      ["Contas", "2"],
    ],
  },
  {
    id: "cliente",
    label: "Cardápio",
    icon: QrCode,
    accent: "#9b6a23",
    eyebrow: "Pedido direto da mesa",
    title: "O cliente pede no celular e o pedido já nasce no fluxo certo.",
    text: "Cada QR Code abre uma sessão segura da mesa, com cardápio, status e acompanhamento.",
    metric: "QR",
    metricLabel: "sessão segura",
    rows: ["Mesa 05 conectada", "2 itens adicionados", "Pedido enviado à cozinha"],
    stats: [
      ["Categorias", "5"],
      ["Produtos", "42"],
      ["Tempo médio", "1m20s"],
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: WalletCards,
    accent: "#174b4a",
    eyebrow: "Conta fechada sem retrabalho",
    title: "O cliente paga. A mesa fecha. O relatório já sabe.",
    text: "Formas de pagamento, histórico de comandas e total do período ficam conectados ao atendimento.",
    metric: "R$ 2,8k",
    metricLabel: "faturamento do dia",
    rows: ["Mesa 08 fechada em PIX", "Relatório do dia atualizado", "Histórico pronto para consulta"],
    stats: [
      ["PIX", "46%"],
      ["Cartão", "39%"],
      ["Dinheiro", "15%"],
    ],
  },
  {
    id: "reservas",
    label: "Reservas",
    icon: CalendarCheck,
    accent: "#8f4d68",
    eyebrow: "Demanda antes da chegada",
    title: "Reserva, fila e chamada entram no mesmo ritmo do salão.",
    text: "A equipe acompanha confirmações, espera, chamada do cliente e acomodação em mesa.",
    metric: "05",
    metricLabel: "reservas na fila",
    rows: ["Família Lima aguardando", "Mesa 04 liberada", "Cliente chamado pelo salão"],
    stats: [
      ["Confirmadas", "12"],
      ["Fila", "5"],
      ["Acomodadas", "7"],
    ],
  },
];

const BENEFICIOS = [
  {
    icon: Radio,
    title: "Pedidos em tempo real",
    text: "O pedido sai do celular ou do garçom e aparece para quem precisa agir.",
    metric: "ao vivo",
    tone: "orange",
  },
  {
    icon: QrCode,
    title: "QR Code com sessão da mesa",
    text: "O cliente acessa o cardápio da mesa certa, com token de sessão controlado.",
    metric: "mesa certa",
    tone: "blue",
  },
  {
    icon: Table2,
    title: "Mesas sem perder contexto",
    text: "Status, chamadas, histórico e fechamento ficam ligados ao atendimento.",
    metric: "1 mapa",
    tone: "green",
  },
  {
    icon: ChefHat,
    title: "Fila clara na cozinha",
    text: "Recebido, preparando, pronto e entregue sem depender de recado paralelo.",
    metric: "3 etapas",
    tone: "navy",
  },
  {
    icon: CalendarCheck,
    title: "Reservas e espera",
    text: "A chegada do cliente entra na rotina antes da mesa estar livre.",
    metric: "fila visível",
    tone: "rose",
  },
  {
    icon: ShieldCheck,
    title: "Perfis e isolamento",
    text: "Admin, garçom, cozinha e financeiro acessam somente o que faz sentido.",
    metric: "por perfil",
    tone: "teal",
  },
];

const STACKED_STEPS = [
  {
    icon: QrCode,
    title: "Cliente abre o cardápio",
    text: "A mesa ganha uma sessão segura. O cliente vê categorias, produtos e status sem instalar aplicativo.",
    signal: "Mesa 12 conectada",
  },
  {
    icon: ChefHat,
    title: "Pedido chega na cozinha",
    text: "Os itens entram organizados por status para reduzir esquecimento e conversa paralela.",
    signal: "Pedido #142 recebido",
  },
  {
    icon: ClipboardList,
    title: "Garçom acompanha",
    text: "O salão sabe o que está pronto, quem chamou e qual mesa precisa fechar.",
    signal: "2 pratos prontos",
  },
  {
    icon: WalletCards,
    title: "Mesa é fechada",
    text: "Pagamento, histórico e relatório ficam registrados no mesmo fluxo operacional.",
    signal: "Conta em PIX",
  },
];

const FLOW_STEPS = [
  { icon: QrCode, title: "QR Code", text: "Mesa inicia sessão segura.", status: "ativo" },
  { icon: Utensils, title: "Cardápio", text: "Cliente escolhe por categoria.", status: "visualizado" },
  { icon: ReceiptText, title: "Pedido", text: "Itens são enviados no fluxo.", status: "enviado" },
  { icon: ChefHat, title: "Cozinha", text: "Preparo avança por status.", status: "preparando" },
  { icon: ClipboardList, title: "Garçom", text: "Equipe recebe o alerta.", status: "retirar" },
  { icon: WalletCards, title: "Pagamento", text: "Mesa fecha com forma definida.", status: "fechado" },
  { icon: BarChart3, title: "Relatório", text: "Financeiro atualiza o período.", status: "registrado" },
];

const LIVE_SNAPSHOTS = [
  {
    label: "Abertura do jantar",
    mesasLivres: 14,
    mesasOcupadas: 6,
    preparo: 3,
    prontos: 1,
    reservas: 4,
    faturamento: "R$ 860",
    activity: ["Mesa 02 abriu atendimento", "Reserva de 4 pessoas confirmada"],
  },
  {
    label: "Pico do salão",
    mesasLivres: 5,
    mesasOcupadas: 15,
    preparo: 11,
    prontos: 4,
    reservas: 7,
    faturamento: "R$ 2.480",
    activity: ["Pedido #158 em preparo", "Mesa 09 chamou o garçom"],
  },
  {
    label: "Entrega acelerada",
    mesasLivres: 7,
    mesasOcupadas: 13,
    preparo: 6,
    prontos: 8,
    reservas: 3,
    faturamento: "R$ 3.920",
    activity: ["Pedido #162 pronto", "Mesa 11 solicitou conta"],
  },
  {
    label: "Fechamento do turno",
    mesasLivres: 16,
    mesasOcupadas: 4,
    preparo: 1,
    prontos: 0,
    reservas: 0,
    faturamento: "R$ 5.740",
    activity: ["Mesa 03 fechada em débito", "Relatório do dia atualizado"],
  },
];

const PRODUTOS = [
  {
    nome: "Batata Suprema",
    descricao: "Batatas crocantes, queijo cremoso, bacon e cebolinha.",
    preco: "R$ 26,90",
    categoria: "Entradas",
    icon: CookingPot,
    tone: "gold",
  },
  {
    nome: "Burger Autenix",
    descricao: "Blend artesanal, queijo, cebola caramelizada e molho da casa.",
    preco: "R$ 39,90",
    categoria: "Pratos principais",
    icon: Utensils,
    tone: "orange",
  },
  {
    nome: "Pizza da Casa",
    descricao: "Massa de longa fermentação, mozzarella, tomate e manjericão.",
    preco: "R$ 54,90",
    categoria: "Pratos principais",
    icon: Pizza,
    tone: "red",
  },
  {
    nome: "Filé Executivo",
    descricao: "Filé grelhado, arroz, legumes tostados e molho especial.",
    preco: "R$ 47,90",
    categoria: "Pratos principais",
    icon: Beef,
    tone: "navy",
  },
  {
    nome: "Suco Natural",
    descricao: "Fruta fresca batida na hora, sem conservantes.",
    preco: "R$ 12,90",
    categoria: "Bebidas",
    icon: CupSoda,
    tone: "green",
  },
  {
    nome: "Refrigerante",
    descricao: "Lata 350 ml servida bem gelada.",
    preco: "R$ 8,90",
    categoria: "Bebidas",
    icon: Coffee,
    tone: "blue",
  },
  {
    nome: "Pudim Artesanal",
    descricao: "Receita da casa com calda de caramelo e textura cremosa.",
    preco: "R$ 16,90",
    categoria: "Sobremesas",
    icon: CakeSlice,
    tone: "rose",
  },
  {
    nome: "Combo Família",
    descricao: "Pizza grande, batata suprema, quatro bebidas e sobremesa.",
    preco: "R$ 129,90",
    categoria: "Combos",
    icon: Package,
    tone: "teal",
  },
];

const CATEGORIAS = [
  "Todos",
  "Entradas",
  "Pratos principais",
  "Bebidas",
  "Sobremesas",
  "Combos",
];

const PLANOS_COMERCIAIS = [
  {
    nome: "Essencial",
    necessidade: "Operação pequena",
    subtitulo: "Para digitalizar mesas, cardápio e pedidos sem montar uma estrutura pesada.",
    preco: "R$ 99",
    periodo: "/mês",
    icon: Table2,
    foco: "Salão enxuto",
    uso: { mesas: 20, usuarios: 5, produtos: 120, importacoes: 1, reservas: 30, relatorios: 4 },
    recursos: [
      "Cardápio digital com QR Code",
      "Pedidos e chamadas em tempo real",
      "Controle básico de mesas",
      "Relatórios essenciais",
    ],
  },
  {
    nome: "Profissional",
    necessidade: "Restaurante em ritmo alto",
    subtitulo: "Para integrar salão, cozinha, reservas, financeiro e equipe no mesmo fluxo.",
    preco: "R$ 199",
    periodo: "/mês",
    icon: Sparkles,
    foco: "Equipe conectada",
    destaque: true,
    uso: { mesas: 60, usuarios: 15, produtos: 400, importacoes: 6, reservas: 180, relatorios: 12 },
    recursos: [
      "Garçom, cozinha e financeiro conectados",
      "Reservas, fila de espera e importação inicial",
      "White label com logo e cores",
      "Painel completo de administração",
    ],
  },
  {
    nome: "Enterprise",
    necessidade: "Grupo ou casa grande",
    subtitulo: "Para operações maiores, limites customizados e implantação acompanhada.",
    preco: "Sob consulta",
    periodo: "",
    icon: ShieldCheck,
    foco: "Expansão controlada",
    uso: { mesas: 500, usuarios: 100, produtos: 2000, importacoes: 30, reservas: 900, relatorios: 36 },
    recursos: [
      "Base preparada para multiunidade",
      "Onboarding assistido",
      "Limites por operação",
      "Prioridade para integrações futuras",
    ],
  },
];

function clamp(valor, minimo = 0, maximo = 1) {
  return Math.min(maximo, Math.max(minimo, valor));
}

function Icone({ icon, ...props }) {
  return createElement(icon, props);
}

function usePrefersReducedMotion() {
  const [reduzir, setReduzir] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return undefined;
    const atualizar = () => setReduzir(media.matches);
    atualizar();
    media.addEventListener?.("change", atualizar);
    return () => media.removeEventListener?.("change", atualizar);
  }, []);

  return reduzir;
}

function usePinnedScrollProgress(ref) {
  const reduzirMovimento = usePrefersReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduzirMovimento) return undefined;

    let frame = 0;
    const atualizar = () => {
      frame = 0;
      const elemento = ref.current;
      if (!elemento) return;
      const viewport = window.innerHeight || 1;
      const distancia = Math.max(1, elemento.offsetHeight - viewport);
      const proximo = clamp((window.scrollY - elemento.offsetTop) / distancia);
      setProgress((atual) => (Math.abs(atual - proximo) > 0.015 ? proximo : atual));
    };
    const aoRolar = () => {
      if (!frame) frame = window.requestAnimationFrame(atualizar);
    };

    atualizar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, [reduzirMovimento, ref]);

  return reduzirMovimento ? 0 : progress;
}

function MarcaLogo({ marca }) {
  return marca.logoUrl
    ? <img src={marca.logoUrl} alt={marca.nome} />
    : <span className="lp-brand-text">{marca.nome}</span>;
}

function Header({ usuario, onAccess, marca }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [compacto, setCompacto] = useState(false);

  useEffect(() => {
    const aoRolar = () => setCompacto(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  useEffect(() => {
    const fecharComEsc = (event) => {
      if (event.key === "Escape") setMenuAberto(false);
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, []);

  return (
    <header className={`lp-header ${compacto ? "is-compact" : ""}`}>
      <div className="lp-container lp-header-inner">
        <a className="lp-brand" href="#inicio" aria-label={`${marca.nome} - início`}>
          <MarcaLogo marca={marca} />
        </a>

        <nav className="lp-nav" aria-label="Navegação principal">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="lp-header-actions">
          <button className="lp-header-access" type="button" onClick={onAccess}>
            <LockKeyhole size={16} />
            {usuario ? "Abrir painel" : "Acessar restaurante"}
          </button>
          <button
            className="lp-icon-button lp-menu-toggle"
            type="button"
            onClick={() => setMenuAberto((atual) => !atual)}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuAberto}
          >
            {menuAberto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div className={`lp-mobile-menu ${menuAberto ? "is-open" : ""}`}>
        <nav aria-label="Navegação mobile">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuAberto(false)}>
              {link.label}
              <ArrowRight size={17} />
            </a>
          ))}
          <button
            className="lp-button lp-button-primary"
            type="button"
            onClick={() => {
              setMenuAberto(false);
              onAccess();
            }}
          >
            {usuario ? "Abrir meu painel" : "Acessar restaurante"}
            <ArrowRight size={18} />
          </button>
        </nav>
      </div>
    </header>
  );
}

function ProductMockup({ modulo, dense = false }) {
  return (
    <div className={`lp-product-mockup ${dense ? "is-dense" : ""}`}>
      <div className="lp-mockup-topbar">
        <div className="lp-mockup-brandline">
          <span />
          <strong>{modulo.label}</strong>
        </div>
        <div className="lp-mockup-live"><i /> ao vivo</div>
      </div>
      <div className="lp-mockup-body">
        <aside className="lp-mockup-sidebar" aria-hidden="true">
          {MODULOS.slice(0, 5).map((item) => (
            <span key={item.id} className={item.id === modulo.id ? "is-active" : ""}>
              <Icone icon={item.icon} size={16} />
            </span>
          ))}
        </aside>
        <div className="lp-mockup-content">
          <div className="lp-mockup-headline">
            <span>{modulo.metricLabel}</span>
            <strong>{modulo.metric}</strong>
          </div>
          <div className="lp-mockup-stats">
            {modulo.stats.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="lp-mockup-feed">
            <div className="lp-mockup-feed-title">
              <span>Fluxo recente</span>
              <Clock3 size={14} />
            </div>
            {modulo.rows.map((item, index) => (
              <div className="lp-mockup-row" key={item}>
                <span className={`lp-status-dot dot-${index + 1}`} />
                <p>{item}</p>
                <small>{index === 0 ? "agora" : `${index + 1} min`}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero({ marca, onDemo }) {
  const [moduloAtivo, setModuloAtivo] = useState(0);
  const reduzirMovimento = usePrefersReducedMotion();
  const heroRef = useRef(null);
  const modulo = MODULOS[moduloAtivo];

  useEffect(() => {
    if (reduzirMovimento) return undefined;
    const interval = window.setInterval(() => {
      setModuloAtivo((atual) => (atual + 1) % MODULOS.length);
    }, 3600);
    return () => window.clearInterval(interval);
  }, [reduzirMovimento]);

  const moverHero = useCallback((event) => {
    const podeMover = window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
    if (!podeMover || reduzirMovimento) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    event.currentTarget.style.setProperty("--lp-hero-x", x.toFixed(3));
    event.currentTarget.style.setProperty("--lp-hero-y", y.toFixed(3));
  }, [reduzirMovimento]);

  const resetarHero = useCallback((event) => {
    event.currentTarget.style.setProperty("--lp-hero-x", "0");
    event.currentTarget.style.setProperty("--lp-hero-y", "0");
  }, []);

  return (
    <section
      className="lp-hero"
      id="inicio"
      ref={heroRef}
      onPointerMove={moverHero}
      onPointerLeave={resetarHero}
    >
      <div className="lp-hero-texture" aria-hidden="true" />
      <div className="lp-container lp-hero-grid">
        <div className="lp-hero-copy">
          <span className="lp-live-label">
            <span /> SaaS operacional para restaurantes
          </span>
          <h1>Do pedido ao fechamento da mesa, tudo no mesmo fluxo.</h1>
          <p>
            O {marca.nome} organiza salão, cozinha, reservas, financeiro e
            equipe sem depender de recados soltos durante o pico.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-button lp-button-primary" type="button" onClick={onDemo}>
              Agendar demonstração
              <ArrowRight size={19} />
            </button>
            <a className="lp-button lp-button-outline-dark" href="#fluxo">
              Conhecer o sistema
            </a>
          </div>
          <div className="lp-hero-proof">
            <span><Check size={16} /> QR Code com sessão segura</span>
            <span><Check size={16} /> Perfis por área</span>
            <span><Check size={16} /> Multi-restaurante</span>
          </div>
        </div>

        <div className="lp-hero-visual" style={{ "--module-accent": modulo.accent }}>
          <div className="lp-hero-device" aria-label={`Prévia do módulo ${modulo.label}`}>
            <ProductMockup modulo={modulo} />
          </div>

          <div className="lp-floating-card card-orders">
            <Radio size={17} />
            <div>
              <span>Pedidos ativos</span>
              <strong>{modulo.stats[0][1]}</strong>
            </div>
          </div>
          <div className="lp-floating-card card-ready">
            <ChefHat size={17} />
            <div>
              <span>Fila da cozinha</span>
              <strong>{modulo.rows.length} status</strong>
            </div>
          </div>
          <div className="lp-floating-card card-money">
            <CircleDollarSign size={17} />
            <div>
              <span>Financeiro</span>
              <strong>registrado</strong>
            </div>
          </div>

          <div className="lp-hero-switcher" aria-label="Módulos demonstrados">
            {MODULOS.map((item, index) => (
              <button
                key={item.id}
                className={index === moduloAtivo ? "is-active" : ""}
                type="button"
                onClick={() => setModuloAtivo(index)}
                aria-label={`Mostrar ${item.label}`}
              >
                <span style={{ backgroundColor: item.accent }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StickyModules() {
  const ref = useRef(null);
  const progress = usePinnedScrollProgress(ref);
  const activeIndex = Math.min(
    MODULOS.length - 1,
    Math.floor(clamp(progress * MODULOS.length, 0, MODULOS.length - 0.001)),
  );
  const ativo = MODULOS[activeIndex] || MODULOS[0];

  return (
    <section
      className="lp-section lp-sticky-modules"
      id="produto"
      ref={ref}
      style={{ "--module-accent": ativo.accent }}
    >
      <div className="lp-container lp-sticky-grid">
        <aside className="lp-sticky-copy">
          <span className="lp-eyebrow">Sistema em funcionamento</span>
          <h2>Enquanto a operação anda, cada área recebe só o que precisa.</h2>
          <p>
            Role a página e acompanhe como o Autenix muda de contexto sem mudar
            o fluxo do restaurante.
          </p>
          <div className="lp-module-counter">
            <strong>{String(activeIndex + 1).padStart(2, "0")}</strong>
            <span>/ {String(MODULOS.length).padStart(2, "0")}</span>
          </div>
          <div className="lp-module-rail" aria-label="Módulos apresentados">
            {MODULOS.map((modulo, index) => (
              <span
                key={modulo.id}
                className={index === activeIndex ? "is-active" : ""}
                style={{ "--rail-accent": modulo.accent }}
              >
                <Icone icon={modulo.icon} size={15} />
                {modulo.label}
              </span>
            ))}
          </div>
        </aside>

        <div className="lp-module-stack" aria-label="Módulos do Autenix">
          {MODULOS.map((modulo, index) => (
            <article
              className={`lp-module-card ${index === activeIndex ? "is-active" : ""} ${index < activeIndex ? "is-past" : ""}`}
              key={modulo.id}
              style={{ "--module-accent": modulo.accent }}
            >
              <div className="lp-module-card-icon" style={{ color: modulo.accent }}>
                <Icone icon={modulo.icon} size={24} />
              </div>
              <div className="lp-module-card-copy">
                <span>{modulo.eyebrow}</span>
                <h3>{modulo.title}</h3>
                <p>{modulo.text}</p>
                <div className="lp-module-snapshot" aria-label={`Indicadores de ${modulo.label}`}>
                  {modulo.stats.map(([label, value]) => (
                    <div key={label}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <ProductMockup modulo={modulo} dense />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StackedOperation() {
  return (
    <section className="lp-section lp-stacked" id="fluxo">
      <div className="lp-container lp-stack-heading">
        <span className="lp-eyebrow">Rotina sem quebra</span>
        <h2>O atendimento avança em camadas, não em telas isoladas.</h2>
      </div>
      <div className="lp-container lp-stack-list">
        {STACKED_STEPS.map((step, index) => (
          <article className="lp-stack-card" key={step.title} style={{ "--stack-index": index }}>
            <div className="lp-stack-number">{String(index + 1).padStart(2, "0")}</div>
            <div className="lp-stack-icon">
              <Icone icon={step.icon} size={26} />
            </div>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
            <span className="lp-stack-signal">{step.signal}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function HorizontalFlow() {
  const ref = useRef(null);
  const progress = usePinnedScrollProgress(ref);
  const flowProgress = clamp((progress - 0.05) / 0.9);
  const activeIndex = Math.min(
    FLOW_STEPS.length - 1,
    Math.round(flowProgress * (FLOW_STEPS.length - 1)),
  );
  const shift = -flowProgress * 900;

  return (
    <section
      className="lp-section lp-horizontal-flow"
      ref={ref}
      style={{ "--flow-progress": flowProgress, "--flow-shift": `${shift}px` }}
      aria-label="Fluxo operacional do Autenix"
    >
      <div className="lp-flow-sticky">
        <div className="lp-container lp-section-heading lp-heading-split">
          <div>
            <span className="lp-eyebrow">Do QR Code ao relatório</span>
            <h2>O cliente pede. A equipe recebe. O financeiro registra.</h2>
          </div>
          <p>
            A trilha acompanha o caminho real de uma comanda dentro do restaurante.
          </p>
        </div>
        <div className="lp-flow-viewport">
          <div className="lp-flow-track">
            {FLOW_STEPS.map((step, index) => (
              <article
                key={step.title}
                className={`lp-flow-step ${index === activeIndex ? "is-active" : ""} ${index < activeIndex ? "is-complete" : ""}`}
              >
                <span className="lp-flow-step-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="lp-flow-step-icon">
                  <Icone icon={step.icon} size={24} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <strong>{step.status}</strong>
              </article>
            ))}
          </div>
          <div className="lp-flow-line" aria-hidden="true">
            <span />
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveRestaurant() {
  const ref = useRef(null);
  const progress = usePinnedScrollProgress(ref);
  const liveProgress = clamp((progress - 0.08) / 0.84);
  const index = Math.min(
    LIVE_SNAPSHOTS.length - 1,
    Math.floor(clamp(liveProgress * LIVE_SNAPSHOTS.length, 0, LIVE_SNAPSHOTS.length - 0.001)),
  );
  const snapshot = LIVE_SNAPSHOTS[index] || LIVE_SNAPSHOTS[0];

  const indicadores = [
    ["Mesas livres", snapshot.mesasLivres, Table2],
    ["Mesas ocupadas", snapshot.mesasOcupadas, UsersRound],
    ["Em preparo", snapshot.preparo, ChefHat],
    ["Prontos", snapshot.prontos, Zap],
    ["Reservas aguardando", snapshot.reservas, CalendarCheck],
    ["Faturamento do dia", snapshot.faturamento, BarChart3],
  ];

  return (
    <section
      className="lp-section lp-live-restaurant"
      id="operacao"
      ref={ref}
      style={{ "--live-progress": liveProgress }}
    >
      <div className="lp-container lp-live-grid">
        <div className="lp-section-heading">
          <span className="lp-eyebrow">Restaurante ao vivo</span>
          <h2>Uma visão operacional que muda junto com o salão.</h2>
          <p>
            Dados fictícios realistas mostram como o painel acompanha abertura,
            pico, entrega e fechamento do turno.
          </p>
        </div>
        <div className="lp-live-panel">
          <div className="lp-live-panel-top">
            <div>
              <span>Momento atual</span>
              <strong>{snapshot.label}</strong>
            </div>
            <span className="lp-preview-live"><i /> sincronizado</span>
          </div>
          <div className="lp-live-stage-rail" aria-label="Ritmo da operação">
            {LIVE_SNAPSHOTS.map((item, itemIndex) => (
              <span key={item.label} className={itemIndex === index ? "is-active" : ""}>
                {item.label}
              </span>
            ))}
          </div>
          <div className="lp-live-metrics">
            {indicadores.map(([label, value, icon]) => (
              <div key={label} className="lp-live-metric">
                <Icone icon={icon} size={18} />
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="lp-live-activity">
            {snapshot.activity.map((item) => (
              <div key={item}>
                <span />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BeforeAfter() {
  const ref = useRef(null);
  const progress = usePinnedScrollProgress(ref);
  const compareProgress = clamp((progress - 0.08) / 0.84);

  return (
    <section className="lp-section lp-compare" ref={ref} style={{ "--compare-progress": compareProgress }}>
      <div className="lp-container lp-compare-heading">
        <span className="lp-eyebrow">Antes e depois</span>
        <h2>O ganho aparece quando a operação para de depender de memória.</h2>
      </div>
      <div className="lp-container lp-compare-stage">
        <div className="lp-compare-panel lp-before-panel">
          <span className="lp-compare-label">Sem Autenix</span>
          <h3>Pedido espalhado</h3>
          <ul>
            <li>Comanda no papel e mensagem separada</li>
            <li>Cozinha sem prioridade clara</li>
            <li>Garçom procura status mesa por mesa</li>
            <li>Fechamento exige conferência manual</li>
          </ul>
        </div>
        <div className="lp-compare-panel lp-after-panel">
          <span className="lp-compare-label">Com Autenix</span>
          <h3>Fluxo organizado</h3>
          <ul>
            <li>Pedido nasce vinculado à mesa</li>
            <li>Cozinha avança por status</li>
            <li>Garçom recebe alerta do que está pronto</li>
            <li>Financeiro registra a conta fechada</li>
          </ul>
        </div>
        <div className="lp-compare-divider" aria-hidden="true">
          <span>Autenix</span>
        </div>
      </div>
    </section>
  );
}

function ReactiveResources() {
  const moverCard = useCallback((event) => {
    const podeMover = window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
    if (!podeMover) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    event.currentTarget.style.setProperty("--mx", `${x.toFixed(1)}%`);
    event.currentTarget.style.setProperty("--my", `${y.toFixed(1)}%`);
    event.currentTarget.style.setProperty("--rx", `${((y - 50) / -18).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--ry", `${((x - 50) / 18).toFixed(2)}deg`);
  }, []);

  const sairCard = useCallback((event) => {
    event.currentTarget.style.setProperty("--rx", "0deg");
    event.currentTarget.style.setProperty("--ry", "0deg");
  }, []);

  return (
    <section className="lp-section lp-resources">
      <div className="lp-container">
        <div className="lp-section-heading lp-heading-split">
          <div>
            <span className="lp-eyebrow">O que muda na prática</span>
            <h2>Recursos ligados à rotina real do restaurante.</h2>
          </div>
          <p>
            Nada aqui é vitrine vazia: cada bloco representa uma área que já
            existe no Autenix e reduz uma perda comum do atendimento.
          </p>
        </div>

        <div className="lp-resource-grid">
          {BENEFICIOS.map(({ icon, title, text, metric, tone }, index) => (
            <article
              className={`lp-resource-card tone-${tone} ${index === 0 ? "is-large" : ""} ${index === 5 ? "is-wide" : ""}`}
              key={title}
              onPointerMove={moverCard}
              onPointerLeave={sairCard}
            >
              <div className="lp-resource-top">
                <span><Icone icon={icon} size={22} /></span>
                <strong>{metric}</strong>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CardapioVitrine() {
  const [categoria, setCategoria] = useState("Todos");
  const produtosVisiveis = useMemo(
    () => categoria === "Todos"
      ? PRODUTOS
      : PRODUTOS.filter((produto) => produto.categoria === categoria),
    [categoria],
  );

  return (
    <section className="lp-section lp-menu-showcase" id="cardapio">
      <div className="lp-container">
        <div className="lp-section-heading lp-heading-split">
          <div>
            <span className="lp-eyebrow">Cardápio demonstrativo</span>
            <h2>Produtos, categorias e preços organizados para o cliente pedir sem dúvida.</h2>
          </div>
          <p>
            A vitrine abaixo usa itens fictícios para demonstrar como o cardápio
            aparece de forma clara antes do pedido chegar à cozinha.
          </p>
        </div>

        <div className="lp-category-tabs" role="tablist" aria-label="Categorias do cardápio">
          {CATEGORIAS.map((item) => (
            <button
              key={item}
              className={categoria === item ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={categoria === item}
              onClick={() => setCategoria(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="lp-menu-layout">
          <aside className="lp-phone-menu" aria-label="Prévia mobile do cardápio">
            <div className="lp-phone-notch" />
            <span>Mesa 08</span>
            <h3>Pedido em andamento</h3>
            <div className="lp-phone-order">
              <p>1x Burger Autenix</p>
              <strong>R$ 39,90</strong>
            </div>
            <div className="lp-phone-order">
              <p>1x Suco Natural</p>
              <strong>R$ 12,90</strong>
            </div>
            <button type="button">Enviar pedido</button>
          </aside>

          <div className="lp-menu-grid">
            {produtosVisiveis.map(({ nome, descricao, preco, categoria: cat, icon, tone }) => (
              <article className="lp-menu-card" key={nome}>
                <div className={`lp-menu-visual tone-${tone}`}>
                  <Icone icon={icon} size={42} strokeWidth={1.4} aria-hidden="true" />
                  <span>{cat}</span>
                </div>
                <div className="lp-menu-card-body">
                  <h3>{nome}</h3>
                  <p>{descricao}</p>
                  <div className="lp-menu-card-footer">
                    <strong>{preco}</strong>
                    <span><Check size={15} /> Disponível</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanoUso({ plano, selecionado }) {
  const maximos = { mesas: 500, usuarios: 100, produtos: 2000, importacoes: 30, reservas: 900, relatorios: 36 };
  const labels = {
    mesas: "mesas",
    usuarios: "usuários",
    produtos: "produtos",
    importacoes: "importações",
    reservas: "reservas",
    relatorios: "relatórios",
  };

  return (
    <div className={`lp-plan-usage ${selecionado ? "is-selected" : ""}`}>
      {Object.entries(plano.uso).map(([key, value]) => (
        <div key={key}>
          <span>{labels[key]}</span>
          <strong>{value}</strong>
          <i style={{ "--usage": `${Math.min(100, (value / maximos[key]) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function PlanosLanding({ usuario, onAccess, onPlanSelect }) {
  const [planoAtivo, setPlanoAtivo] = useState("Profissional");

  return (
    <section className="lp-section lp-plans" id="planos">
      <div className="lp-container">
        <div className="lp-section-heading lp-heading-split">
          <div>
            <span className="lp-eyebrow">Planos comerciais</span>
            <h2>O plano muda conforme a pressão da operação.</h2>
          </div>
          <p>
            Selecione um plano para ver os limites ganhando peso na simulação.
            A diferenciação é por necessidade, não por brilho.
          </p>
        </div>

        <div className="lp-plan-grid">
          {PLANOS_COMERCIAIS.map((plano) => {
            const selecionado = planoAtivo === plano.nome;
            return (
              <article
                className={`lp-plan-card ${selecionado ? "is-selected" : ""} ${plano.destaque ? "is-featured" : ""}`}
                key={plano.nome}
                onMouseEnter={() => setPlanoAtivo(plano.nome)}
                onFocus={() => setPlanoAtivo(plano.nome)}
              >
                <div className="lp-plan-top">
                  <span className="lp-plan-icon">
                    <Icone icon={plano.icon} size={23} strokeWidth={1.8} />
                  </span>
                  <button
                    type="button"
                    className="lp-plan-select"
                    onClick={() => setPlanoAtivo(plano.nome)}
                    aria-pressed={selecionado}
                  >
                    {selecionado ? "Selecionado" : "Comparar"}
                  </button>
                </div>
                <div className="lp-plan-title">
                  <span>{plano.necessidade}</span>
                  <h3>{plano.nome}</h3>
                  <p>{plano.subtitulo}</p>
                </div>
                <div className="lp-plan-price">
                  <strong>{plano.preco}</strong>
                  {plano.periodo && <span>{plano.periodo}</span>}
                </div>
                <PlanoUso plano={plano} selecionado={selecionado} />
                <div className="lp-plan-focus">
                  <span>Foco</span>
                  <strong>{plano.foco}</strong>
                </div>
                <ul className="lp-plan-features">
                  {plano.recursos.map((recurso) => (
                    <li key={recurso}>
                      <Check size={16} />
                      <span>{recurso}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`lp-button ${selecionado ? "lp-button-primary" : "lp-button-outline"}`}
                  type="button"
                  onClick={() => (usuario ? onAccess() : onPlanSelect(plano.nome))}
                >
                  {usuario ? "Abrir meu painel" : `Ver ${plano.nome}`}
                  <ArrowRight size={18} />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ContatoComercial({ planoSelecionado, onPlanoChange, marca }) {
  const [form, setForm] = useState({
    nome: "",
    restaurante: "",
    telefone: "",
  });
  const [status, setStatus] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [consentimentoLegal, setConsentimentoLegal] = useState(false);
  const planoAtual = planoSelecionado || "Profissional";

  const atualizar = (campo, valor) => {
    setStatus("");
    if (campo === "plano") {
      onPlanoChange(valor);
      return;
    }
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const enviar = async (event) => {
    event.preventDefault();
    if (!consentimentoLegal) {
      setStatus("Aceite a Politica de Privacidade e os Termos de Uso para continuar.");
      return;
    }
    setEnviando(true);
    setStatus("");
    try {
      await recordLegalConsent({
        contexto: "contato_comercial",
        aceites: { privacidade: true, termos: true },
        categorias: DEFAULT_COOKIE_PREFERENCES,
        metadados: {
          plano: planoAtual,
          politica_versao_exibida: PRIVACY_POLICY_VERSION,
          termos_versao_exibida: TERMS_VERSION,
        },
      });
    } catch (error) {
      setStatus(error.message || "Nao foi possivel registrar o consentimento.");
      setEnviando(false);
      return;
    }
    const assunto = encodeURIComponent(`Demonstração ${marca.nome} - ${planoAtual}`);
    const corpo = encodeURIComponent(
      [
        `Nome: ${form.nome}`,
        `Restaurante: ${form.restaurante}`,
        `Telefone/WhatsApp: ${form.telefone}`,
        `Plano de interesse: ${planoAtual}`,
        "",
        "Quero conhecer o Autenix para meu restaurante.",
      ].join("\n"),
    );
    window.location.href = `mailto:comercial@autenix.com.br?subject=${assunto}&body=${corpo}`;
    setEnviando(false);
    setStatus("Solicitação preparada no seu aplicativo de email.");
  };

  return (
    <section className="lp-section lp-commercial-contact" id="contato">
      <div className="lp-container lp-commercial-inner">
        <div className="lp-commercial-copy">
          <span className="lp-eyebrow">Demonstração guiada</span>
          <h2>Veja o Autenix aplicado ao ritmo do seu restaurante.</h2>
          <p>
            Informe os dados principais para uma conversa objetiva sobre salão,
            cozinha, reservas, financeiro e implantação inicial.
          </p>
          <div className="lp-commercial-points">
            <span><Check size={16} /> Fluxo completo do atendimento</span>
            <span><Check size={16} /> Multi-restaurante e white label</span>
            <span><Check size={16} /> Importação de dados iniciais</span>
          </div>
        </div>

        <form className="lp-commercial-form" onSubmit={enviar}>
          <label htmlFor="lp-contact-name">Seu nome</label>
          <input
            id="lp-contact-name"
            value={form.nome}
            onChange={(event) => atualizar("nome", event.target.value)}
            placeholder="Nome e sobrenome"
            required
          />

          <label htmlFor="lp-contact-restaurant">Restaurante</label>
          <input
            id="lp-contact-restaurant"
            value={form.restaurante}
            onChange={(event) => atualizar("restaurante", event.target.value)}
            placeholder="Nome do restaurante"
            required
          />

          <label htmlFor="lp-contact-phone">Telefone ou WhatsApp</label>
          <input
            id="lp-contact-phone"
            value={form.telefone}
            onChange={(event) => atualizar("telefone", event.target.value)}
            placeholder="(00) 00000-0000"
            required
          />

          <label htmlFor="lp-contact-plan">Plano</label>
          <select
            id="lp-contact-plan"
            value={planoAtual}
            onChange={(event) => atualizar("plano", event.target.value)}
          >
            {PLANOS_COMERCIAIS.map((plano) => (
              <option key={plano.nome} value={plano.nome}>{plano.nome}</option>
            ))}
          </select>

          <label className="lp-consent-check">
            <input
              type="checkbox"
              checked={consentimentoLegal}
              onChange={(event) => setConsentimentoLegal(event.target.checked)}
            />
            <span>
              Li e aceito a <a href="/privacidade" target="_blank" rel="noreferrer">Politica de Privacidade</a> e os{" "}
              <a href="/termos" target="_blank" rel="noreferrer">Termos de Uso</a> para contato comercial.
            </span>
          </label>

          <button
            className="lp-button lp-button-primary"
            type="submit"
            disabled={enviando || !consentimentoLegal}
          >
            {enviando ? "Registrando aceite..." : "Solicitar demonstracao"} <Send size={17} />
          </button>
          <div className="lp-commercial-status" role="status" aria-live="polite">
            {status}
          </div>
        </form>
      </div>
    </section>
  );
}

function FinalCta({ usuario, onAccess, marca, restauranteSlug }) {
  return (
    <section className="lp-final-cta">
      <div className="lp-container lp-final-cta-inner">
        <div>
          <span className="lp-eyebrow">Acesso operacional</span>
          <h2>Entre no {marca.nome} e continue o atendimento.</h2>
          <p>
            Cada perfil abre direto na área preparada para sua rotina no restaurante.
          </p>
        </div>
        <div className="lp-final-actions">
          {restauranteSlug && (
            <a className="lp-button lp-button-on-dark" href={rotaRestaurante(restauranteSlug, "reservas")}>
              Reservar mesa <CalendarCheck size={18} />
            </a>
          )}
          <button className="lp-button lp-button-primary" type="button" onClick={onAccess}>
            {usuario ? "Abrir meu painel" : "Acessar restaurante"}
            <ArrowRight size={19} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer({ marca }) {
  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-inner">
        <a className="lp-brand" href="#inicio" aria-label={`${marca.nome} - voltar ao início`}>
          <MarcaLogo marca={marca} />
        </a>
        <p>Gestão conectada para restaurantes que precisam operar com clareza.</p>
        <div>
          <a href="#produto">Produto</a>
          <a href="#fluxo">Fluxo</a>
          <a href="#operacao">Operação</a>
          <a href="#planos">Planos</a>
          <a href="#contato">Demonstração</a>
          <a href="/privacidade">Privacidade</a>
          <a href="/termos">Termos</a>
          <button
            className="lp-footer-privacy-button"
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("autenix:open-cookie-preferences"))}
          >
            Preferencias de cookies
          </button>
        </div>
      </div>
      <div className="lp-container lp-footer-bottom">
        <span>© {new Date().getFullYear()} {marca.nome}.</span>
        <span>Pedidos, equipe e resultados no mesmo fluxo.</span>
      </div>
    </footer>
  );
}

export default function LandingPage({ usuario, onLogin, restauranteSlug }) {
  const [loginAberto, setLoginAberto] = useState(false);
  const [planoContato, setPlanoContato] = useState("Profissional");
  const marca = useBranding();
  const reduzirMovimento = usePrefersReducedMotion();

  useEffect(() => {
    document.title = `${marca.nome} | Gestão completa para restaurantes`;
  }, [marca.nome]);

  useEffect(() => {
    const seletores = [
      ".lp-hero-copy",
      ".lp-hero-visual",
      ".lp-section-heading",
      ".lp-stack-card",
      ".lp-resource-card",
      ".lp-menu-card",
      ".lp-plan-card",
      ".lp-commercial-copy",
      ".lp-commercial-form",
      ".lp-final-cta-inner",
    ].join(",");
    const elementos = Array.from(document.querySelectorAll(seletores));

    elementos.forEach((elemento, index) => {
      elemento.classList.add("lp-reveal");
      elemento.style.setProperty("--lp-reveal-delay", `${Math.min(index % 5, 4) * 55}ms`);
    });

    if (reduzirMovimento || !("IntersectionObserver" in window)) {
      elementos.forEach((elemento) => elemento.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
    );

    elementos.forEach((elemento) => observer.observe(elemento));
    return () => observer.disconnect();
  }, [reduzirMovimento]);

  const acessar = () => {
    if (usuario) {
      window.location.assign(
        rotaDoPerfil(usuario.role, usuario.restaurante_slug || restauranteSlug),
      );
      return;
    }
    setLoginAberto(true);
  };

  const irParaContato = () => {
    document.getElementById("contato")?.scrollIntoView({
      behavior: reduzirMovimento ? "auto" : "smooth",
      block: "start",
    });
  };

  const selecionarPlano = (plano) => {
    setPlanoContato(plano);
    window.requestAnimationFrame(irParaContato);
  };

  return (
    <div className="lp-page">
      <Header usuario={usuario} onAccess={acessar} marca={marca} />
      <main>
        <Hero marca={marca} onDemo={irParaContato} />
        <StickyModules />
        <StackedOperation />
        <HorizontalFlow />
        <LiveRestaurant />
        <BeforeAfter />
        <ReactiveResources />
        <CardapioVitrine />
        <PlanosLanding usuario={usuario} onAccess={acessar} onPlanSelect={selecionarPlano} />
        <ContatoComercial
          planoSelecionado={planoContato}
          onPlanoChange={setPlanoContato}
          marca={marca}
        />
        <FinalCta
          usuario={usuario}
          onAccess={acessar}
          marca={marca}
          restauranteSlug={restauranteSlug}
        />
      </main>
      <Footer marca={marca} />
      <LoginModal
        aberto={loginAberto}
        onClose={() => setLoginAberto(false)}
        onLogin={onLogin}
        restauranteSlug={restauranteSlug}
        marca={marca}
      />
    </div>
  );
}
