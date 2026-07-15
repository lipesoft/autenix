import { createElement, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Beef,
  CakeSlice,
  ChartNoAxesCombined,
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
  ShieldCheck,
  Sparkles,
  Table2,
  UsersRound,
  Utensils,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { rotaDoPerfil } from "../../services/auth.js";
import LoginModal from "./LoginModal.jsx";
import "./LandingPage.css";

const NAV_LINKS = [
  { label: "Benefícios", href: "#beneficios" },
  { label: "Áreas do sistema", href: "#areas" },
  { label: "Cardápio", href: "#cardapio" },
  { label: "Como funciona", href: "#fluxo" },
];

const BENEFICIOS = [
  {
    icon: Radio,
    title: "Pedidos em tempo real",
    text: "Salão e cozinha acompanham cada pedido no mesmo instante, do envio à entrega.",
    tone: "orange",
  },
  {
    icon: QrCode,
    title: "Cardápio por QR Code",
    text: "Cada mesa abre uma experiência digital simples para consultar itens e fazer pedidos.",
    tone: "blue",
  },
  {
    icon: Table2,
    title: "Controle de mesas",
    text: "Visualize ocupação, comandas, chamadas e fechamento sem perder o contexto do atendimento.",
    tone: "green",
  },
  {
    icon: ChefHat,
    title: "Painel da cozinha",
    text: "Organize a fila de produção por status e mantenha o ritmo mesmo nos horários de pico.",
    tone: "navy",
  },
  {
    icon: CircleDollarSign,
    title: "Financeiro conectado",
    text: "Fechamentos, formas de pagamento, histórico e resultados ficam no mesmo fluxo.",
    tone: "green",
  },
  {
    icon: UsersRound,
    title: "Equipe por perfil",
    text: "Administração, garçom, cozinha e financeiro acessam somente o que precisam.",
    tone: "blue",
  },
  {
    icon: ShieldCheck,
    title: "Seguro e pronto para crescer",
    text: "Login protegido, permissões por função e uma base preparada para novos restaurantes.",
    tone: "orange",
  },
];

const AREAS = [
  {
    id: "administracao",
    label: "Administração",
    icon: LayoutDashboard,
    eyebrow: "Visão central",
    title: "Decisões e configurações em um só painel.",
    text: "Gerencie produtos, categorias, mesas, equipe e relatórios sem interromper a operação.",
    highlights: ["Cardápio e disponibilidade", "Mesas e QR Codes", "Usuários e permissões"],
    metric: "7 áreas",
    metricLabel: "integradas",
    queue: ["Cardápio atualizado", "12 mesas ativas", "Equipe sincronizada"],
  },
  {
    id: "garcom",
    label: "Garçom",
    icon: ClipboardList,
    eyebrow: "Atendimento",
    title: "O salão responde mais rápido.",
    text: "Chamadas, pedidos, mesas e contas aparecem em uma interface direta para o atendimento.",
    highlights: ["Mapa de mesas", "Chamadas em destaque", "Fechamento de conta"],
    metric: "Agora",
    metricLabel: "pedidos e alertas",
    queue: ["Mesa 04 pediu atendimento", "Mesa 08 aguardando conta", "Pedido 127 pronto"],
  },
  {
    id: "cozinha",
    label: "Cozinha",
    icon: ChefHat,
    eyebrow: "Produção",
    title: "Uma fila clara para cada etapa do preparo.",
    text: "A cozinha recebe os pedidos em tempo real e acompanha cada item até ficar pronto.",
    highlights: ["Recebidos", "Em preparo", "Prontos para entrega"],
    metric: "3 etapas",
    metricLabel: "do pedido ao prato",
    queue: ["Pedido 128 recebido", "Pedido 126 em preparo", "Pedido 124 pronto"],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: WalletCards,
    eyebrow: "Controle",
    title: "Fechamento e histórico sem planilhas soltas.",
    text: "Acompanhe comandas abertas, pagamentos e resultados do período com rastreabilidade.",
    highlights: ["Resumo do dia", "Formas de pagamento", "Histórico de comandas"],
    metric: "1 caixa",
    metricLabel: "com visão completa",
    queue: ["Conta da mesa 08 fechada", "Pagamento via PIX", "Resumo diário disponível"],
  },
  {
    id: "cliente",
    label: "Cliente",
    icon: QrCode,
    eyebrow: "Experiência digital",
    title: "O cardápio certo chega direto à mesa.",
    text: "O cliente escaneia o QR Code, conhece os itens e acompanha seus pedidos no celular.",
    highlights: ["Acesso sem aplicativo", "Categorias organizadas", "Pedido vinculado à mesa"],
    metric: "QR",
    metricLabel: "uma experiência simples",
    queue: ["Mesa 06 conectada", "2 itens adicionados", "Pedido enviado à cozinha"],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: ChartNoAxesCombined,
    eyebrow: "Resultados",
    title: "Dados da operação viram visão de negócio.",
    text: "Consulte vendas por período, volume de atendimentos e histórico para decidir melhor.",
    highlights: ["Vendas por período", "Histórico detalhado", "Exportação para análise"],
    metric: "100%",
    metricLabel: "do fluxo registrado",
    queue: ["Vendas consolidadas", "Período comparado", "Relatório pronto"],
  },
];

const PRODUTOS = [
  {
    nome: "Batata Suprema",
    descricao: "Batatas crocantes, queijo cremoso, bacon e cebolinha fresca.",
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

function Icone({ icon, ...props }) {
  return createElement(icon, props);
}

function Header({ usuario, onAccess }) {
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
        <a className="lp-brand" href="#inicio" aria-label="Autenix - início">
          <img src="/logoAutenix.png" alt="Autenix" />
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

function Hero({ usuario, onAccess }) {
  return (
    <section className="lp-hero" id="inicio">
      <div className="lp-hero-image" aria-hidden="true" />
      <div className="lp-hero-shade" aria-hidden="true" />
      <div className="lp-container lp-hero-inner">
        <div className="lp-hero-copy">
          <span className="lp-live-label">
            <span /> Operação conectada em tempo real
          </span>
          <h1>Autenix</h1>
          <p className="lp-hero-statement">Seu restaurante no ritmo certo.</p>
          <p className="lp-hero-description">
            Pedidos, mesas, cozinha, equipe e financeiro em um único fluxo,
            para o atendimento acontecer com mais clareza do início ao fim.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-button lp-button-primary" type="button" onClick={onAccess}>
              {usuario ? "Abrir meu painel" : "Acessar restaurante"}
              <ArrowRight size={19} />
            </button>
            <a className="lp-button lp-button-light" href="#beneficios">
              Conhecer o sistema
            </a>
          </div>
          <div className="lp-hero-proof">
            <span><Check size={16} /> Acesso por perfil</span>
            <span><Check size={16} /> Cardápio via QR Code</span>
            <span><Check size={16} /> Fluxo em tempo real</span>
          </div>
        </div>
      </div>
      <div className="lp-operation-strip">
        <div className="lp-container">
          <span><Radio size={17} /> Pedidos ao vivo</span>
          <span><ChefHat size={17} /> Cozinha sincronizada</span>
          <span><Table2 size={17} /> Mesas organizadas</span>
          <span><BarChart3 size={17} /> Resultados visíveis</span>
        </div>
      </div>
    </section>
  );
}

function Beneficios() {
  return (
    <section className="lp-section lp-benefits" id="beneficios">
      <div className="lp-container">
        <div className="lp-section-heading lp-heading-split">
          <div>
            <span className="lp-eyebrow">Gestão que acompanha o serviço</span>
            <h2>Menos ruído. Mais restaurante.</h2>
          </div>
          <p>
            O Autenix conecta cada etapa da operação para a equipe enxergar o
            que precisa, agir mais rápido e manter o cliente bem atendido.
          </p>
        </div>

        <div className="lp-benefit-grid">
          {BENEFICIOS.map(({ icon, title, text, tone }, index) => (
            <article
              className={`lp-benefit-card tone-${tone} ${index === 6 ? "is-wide" : ""}`}
              key={title}
            >
              <span className="lp-benefit-icon">
                <Icone icon={icon} size={23} strokeWidth={1.8} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AreasDoSistema() {
  const [areaAtiva, setAreaAtiva] = useState(AREAS[0].id);
  const area = AREAS.find((item) => item.id === areaAtiva) || AREAS[0];

  return (
    <section className="lp-section lp-areas" id="areas">
      <div className="lp-container">
        <div className="lp-section-heading lp-heading-centered">
          <span className="lp-eyebrow">Um sistema, várias rotinas</span>
          <h2>Cada área trabalha com foco. A gestão enxerga o todo.</h2>
          <p>
            Navegue pelos perfis e veja como o Autenix organiza o fluxo de cada
            ponto do restaurante.
          </p>
        </div>

        <div className="lp-area-tabs" role="tablist" aria-label="Áreas do Autenix">
          {AREAS.map(({ id, label, icon }) => (
            <button
              key={id}
              className={areaAtiva === id ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={areaAtiva === id}
              onClick={() => setAreaAtiva(id)}
            >
              <Icone icon={icon} size={18} /> {label}
            </button>
          ))}
        </div>

        <div className="lp-area-stage" role="tabpanel" key={area.id}>
          <div className="lp-area-copy">
            <span>{area.eyebrow}</span>
            <h3>{area.title}</h3>
            <p>{area.text}</p>
            <ul>
              {area.highlights.map((highlight) => (
                <li key={highlight}><Check size={17} /> {highlight}</li>
              ))}
            </ul>
          </div>

          <div className="lp-product-preview" aria-label={`Prévia da área ${area.label}`}>
            <div className="lp-preview-topbar">
              <div>
                <img src="/logoGuia.png" alt="" />
                <span>{area.label}</span>
              </div>
              <span className="lp-preview-live"><i /> ao vivo</span>
            </div>
            <div className="lp-preview-body">
              <aside>
                <span className="is-active"><LayoutDashboard size={16} /></span>
                <span><ClipboardList size={16} /></span>
                <span><BarChart3 size={16} /></span>
              </aside>
              <div className="lp-preview-content">
                <div className="lp-preview-summary">
                  <span>{area.metricLabel}</span>
                  <strong>{area.metric}</strong>
                </div>
                <div className="lp-preview-queue">
                  <div className="lp-preview-queue-header">
                    <span>Fluxo recente</span>
                    <Clock3 size={15} />
                  </div>
                  {area.queue.map((item, index) => (
                    <div className="lp-preview-row" key={item}>
                      <span className={`lp-preview-status status-${index + 1}`} />
                      <p>{item}</p>
                      <small>{index === 0 ? "agora" : `${index + 1} min`}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
            <span className="lp-eyebrow">Experiência do cliente</span>
            <h2>Um cardápio que abre o apetite e simplifica o pedido.</h2>
          </div>
          <p>
            Uma vitrine demonstrativa de como produtos, categorias e preços
            podem ganhar clareza no celular do cliente.
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

        <div className="lp-menu-grid">
          {produtosVisiveis.map(({ nome, descricao, preco, categoria: cat, icon, tone }) => (
            <article className="lp-menu-card" key={nome}>
              <div className={`lp-menu-visual tone-${tone}`}>
                <Icone icon={icon} size={48} strokeWidth={1.25} aria-hidden="true" />
                <span>{cat}</span>
              </div>
              <div className="lp-menu-card-body">
                <div>
                  <h3>{nome}</h3>
                  <p>{descricao}</p>
                </div>
                <div className="lp-menu-card-footer">
                  <strong>{preco}</strong>
                  <span><Sparkles size={15} /> Disponível</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="lp-menu-note">
          Cardápio demonstrativo. Os itens reais são cadastrados pela administração do restaurante.
        </p>
      </div>
    </section>
  );
}

function Fluxo() {
  const etapas = [
    { numero: "01", icon: QrCode, title: "Cliente escolhe", text: "O QR Code abre o cardápio vinculado à mesa." },
    { numero: "02", icon: Zap, title: "Pedido circula", text: "Salão e cozinha recebem a informação em tempo real." },
    { numero: "03", icon: ChefHat, title: "Equipe executa", text: "Cada perfil acompanha sua parte do atendimento." },
    { numero: "04", icon: ReceiptText, title: "Gestão fecha", text: "Conta, histórico e resultados concluem o fluxo." },
  ];

  return (
    <section className="lp-section lp-flow" id="fluxo">
      <div className="lp-container">
        <div className="lp-section-heading lp-heading-centered">
          <span className="lp-eyebrow">Do QR Code ao caixa</span>
          <h2>O fluxo completo, sem perder o fio da operação.</h2>
        </div>
        <div className="lp-flow-grid">
          {etapas.map(({ numero, icon, title, text }) => (
            <article key={numero}>
              <span className="lp-flow-number">{numero}</span>
              <Icone icon={icon} size={24} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ usuario, onAccess }) {
  return (
    <section className="lp-final-cta">
      <div className="lp-container lp-final-cta-inner">
        <div>
          <span className="lp-eyebrow">Seu restaurante, conectado</span>
          <h2>Entre no Autenix e continue a operação.</h2>
          <p>
            Acesse com seu perfil e abra diretamente a área preparada para o seu trabalho.
          </p>
        </div>
        <button className="lp-button lp-button-primary" type="button" onClick={onAccess}>
          {usuario ? "Abrir meu painel" : "Acessar restaurante"}
          <ArrowRight size={19} />
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-inner">
        <a className="lp-brand" href="#inicio" aria-label="Autenix - voltar ao início">
          <img src="/logoAutenix.png" alt="Autenix" />
        </a>
        <p>Gestão conectada para restaurantes que querem servir melhor.</p>
        <div>
          <a href="#beneficios">Benefícios</a>
          <a href="#areas">Sistema</a>
          <a href="#cardapio">Cardápio</a>
        </div>
      </div>
      <div className="lp-container lp-footer-bottom">
        <span>© {new Date().getFullYear()} Autenix.</span>
        <span>Operação, equipe e resultados no mesmo fluxo.</span>
      </div>
    </footer>
  );
}

export default function LandingPage({ usuario, onLogin, restauranteSlug }) {
  const [loginAberto, setLoginAberto] = useState(false);

  useEffect(() => {
    document.title = "Autenix | Gestão completa para restaurantes";
  }, []);

  const acessar = () => {
    if (usuario) {
      window.location.assign(
        rotaDoPerfil(usuario.role, usuario.restaurante_slug || restauranteSlug),
      );
      return;
    }
    setLoginAberto(true);
  };

  return (
    <div className="lp-page">
      <Header usuario={usuario} onAccess={acessar} />
      <main>
        <Hero usuario={usuario} onAccess={acessar} />
        <Beneficios />
        <AreasDoSistema />
        <CardapioVitrine />
        <Fluxo />
        <FinalCta usuario={usuario} onAccess={acessar} />
      </main>
      <Footer />
      <LoginModal
        aberto={loginAberto}
        onClose={() => setLoginAberto(false)}
        onLogin={onLogin}
        restauranteSlug={restauranteSlug}
      />
    </div>
  );
}
