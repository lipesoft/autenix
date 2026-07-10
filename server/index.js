require('dotenv').config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const cors = require("cors");
const QRCode = require("qrcode");
const path = require("path");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// ─── BANCO DE DADOS (PostgreSQL) ───────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

// Helper: executa query com log de erro
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// ─── INICIALIZAÇÃO DO BANCO ────────────────────────────────────────────────
async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      login TEXT,
      role TEXT NOT NULL DEFAULT 'garcom',
      senha TEXT NOT NULL,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      ordem INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      categoria_id INTEGER,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL NOT NULL,
      imagem TEXT,
      disponivel INTEGER DEFAULT 1,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    );

    CREATE TABLE IF NOT EXISTS mesas (
      id SERIAL PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'livre',
      forma_pagamento TEXT,
      obs_pagamento TEXT
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      numero_dia INTEGER,
      mesa_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pendente',
      nome_cliente TEXT,
      garcom_id INTEGER,
      garcom_nome TEXT,
      forma_pagamento TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mesa_id) REFERENCES mesas(id)
    );

    CREATE TABLE IF NOT EXISTS itens_pedido (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      observacao TEXT,
      status TEXT DEFAULT 'pendente',
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    );

    CREATE TABLE IF NOT EXISTS chamadas (
      id SERIAL PRIMARY KEY,
      mesa_id INTEGER NOT NULL,
      motivo TEXT DEFAULT 'garcom',
      nome_cliente TEXT,
      atendida INTEGER DEFAULT 0,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );
  `);

  // Seed dados de exemplo se vazio
  const { rows: cats } = await query("SELECT COUNT(*) as c FROM categorias");
  if (parseInt(cats[0].c) === 0) {
    await query("INSERT INTO categorias (nome, ordem) VALUES ($1, $2)", ["Entradas", 1]);
    await query("INSERT INTO categorias (nome, ordem) VALUES ($1, $2)", ["Pratos Principais", 2]);
    await query("INSERT INTO categorias (nome, ordem) VALUES ($1, $2)", ["Bebidas", 3]);
    await query("INSERT INTO categorias (nome, ordem) VALUES ($1, $2)", ["Sobremesas", 4]);

    const { rows: catRows } = await query("SELECT id, nome FROM categorias ORDER BY ordem");
    const catId = (nome) => catRows.find((c) => c.nome === nome)?.id;

    const insP = (cat, nome, desc, preco) =>
      query("INSERT INTO produtos (categoria_id, nome, descricao, preco) VALUES ($1, $2, $3, $4)", [catId(cat), nome, desc, preco]);

    await insP("Entradas", "Pão de Alho", "Pão artesanal com alho e manteiga", 18.9);
    await insP("Entradas", "Bruschetta", "Tomate, manjericão e azeite", 22.0);
    await insP("Pratos Principais", "Frango Grelhado", "Com legumes e arroz", 45.9);
    await insP("Pratos Principais", "Picanha 300g", "Acompanha farofa e vinagrete", 89.9);
    await insP("Pratos Principais", "Massa Carbonara", "Espaguete, bacon e molho cremoso", 52.0);
    await insP("Bebidas", "Coca-Cola Lata", "350ml gelada", 8.0);
    await insP("Bebidas", "Suco de Laranja", "Natural 500ml", 14.0);
    await insP("Bebidas", "Água Mineral", "500ml", 5.0);
    await insP("Sobremesas", "Pudim", "Pudim de leite condensado", 18.0);
    await insP("Sobremesas", "Brownie", "Com sorvete de creme", 24.0);

    for (let i = 1; i <= 12; i++) {
      await query("INSERT INTO mesas (numero) VALUES ($1)", [String(i)]);
    }
  }

  // Garantir login único onde não existe
  await query("UPDATE usuarios SET login = lower(replace(nome,' ','_')) WHERE login IS NULL OR login = ''");

  console.log("✅ Banco de dados inicializado!");
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

async function proximoNumeroDia() {
  const { rows: cfg } = await query("SELECT valor FROM configuracoes WHERE chave = 'ultimo_reinicio'");
  const desde = cfg[0]?.valor || new Date().toISOString().slice(0, 10);
  const { rows: ultimo } = await query(
    "SELECT MAX(numero_dia) as ultimo FROM pedidos WHERE criado_em >= $1",
    [desde]
  );
  return (parseInt(ultimo[0]?.ultimo) || 0) + 1;
}

async function getPedidoCompleto(pedido_id) {
  const { rows } = await query(
    "SELECT p.*, m.numero as mesa_numero FROM pedidos p JOIN mesas m ON p.mesa_id = m.id WHERE p.id = $1",
    [pedido_id]
  );
  const pedido = rows[0];
  if (!pedido) return null;
  const { rows: itens } = await query(
    `SELECT ip.*, pr.nome, pr.preco FROM itens_pedido ip
     JOIN produtos pr ON ip.produto_id = pr.id WHERE ip.pedido_id = $1`,
    [pedido_id]
  );
  pedido.itens = itens;
  return pedido;
}

// ─── ROTAS API ─────────────────────────────────────────────────────────────

// Cardápio
app.get("/api/cardapio", async (req, res) => {
  try {
    const { rows: categorias } = await query("SELECT * FROM categorias ORDER BY ordem");
    const { rows: produtos } = await query("SELECT * FROM produtos WHERE disponivel = 1");
    res.json({ categorias, produtos });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Mesas
app.get("/api/mesas", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM mesas ORDER BY CAST(numero AS INTEGER)");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get("/api/mesas/:id", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM mesas WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: "Mesa não encontrada" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.post("/api/mesas", async (req, res) => {
  const { numero } = req.body;
  if (!numero) return res.status(400).json({ erro: "Número obrigatório" });
  try {
    const { rows } = await query(
      "INSERT INTO mesas (numero) VALUES ($1) RETURNING *",
      [String(numero)]
    );
    io.emit("mesa_atualizada", rows[0]);
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ erro: "Mesa já existe" });
  }
});

app.delete("/api/mesas/:id", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM mesas WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: "Mesa não encontrada" });
    if (rows[0].status === "ocupada") return res.status(400).json({ erro: "Mesa ocupada" });
    await query("DELETE FROM mesas WHERE id = $1", [req.params.id]);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Fazer pedido (cliente)
app.post("/api/pedidos", async (req, res) => {
  const { mesa_id, itens, nome_cliente } = req.body;
  if (!mesa_id || !itens?.length)
    return res.status(400).json({ erro: "Dados inválidos" });

  try {
    const { rows: mesaRows } = await query("SELECT * FROM mesas WHERE id = $1", [mesa_id]);
    if (!mesaRows[0]) return res.status(404).json({ erro: "Mesa não encontrada" });

    const numeroDia = await proximoNumeroDia();
    const { rows: pedRows } = await query(
      "INSERT INTO pedidos (mesa_id, status, nome_cliente, numero_dia) VALUES ($1, $2, $3, $4) RETURNING id",
      [mesa_id, "pendente", nome_cliente || null, numeroDia]
    );
    const pedido_id = pedRows[0].id;

    for (const item of itens) {
      await query(
        "INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, observacao) VALUES ($1, $2, $3, $4)",
        [pedido_id, item.produto_id, item.quantidade, item.observacao || ""]
      );
    }

    await query("UPDATE mesas SET status = 'ocupada' WHERE id = $1", [mesa_id]);

    const pedidoCompleto = await getPedidoCompleto(pedido_id);
    io.emit("novo_pedido", pedidoCompleto);
    const { rows: mesaAtual } = await query("SELECT * FROM mesas WHERE id = $1", [mesa_id]);
    io.emit("mesa_atualizada", mesaAtual[0]);

    res.json({ sucesso: true, pedido_id });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Listar pedidos (cozinha/admin)
app.get("/api/pedidos", async (req, res) => {
  try {
    const { mesa_id, status } = req.query;
    let sql = `SELECT p.*, m.numero as mesa_numero FROM pedidos p JOIN mesas m ON p.mesa_id = m.id WHERE 1=1`;
    const params = [];
    let i = 1;

    if (mesa_id) {
      sql += ` AND p.mesa_id = $${i++}`;
      params.push(mesa_id);
    }
    if (status) {
      sql += ` AND p.status = $${i++}`;
      params.push(status);
    }
    sql += " ORDER BY p.criado_em DESC";

    const { rows: pedidos } = await query(sql, params);
    const resultado = await Promise.all(
      pedidos.map(async (p) => {
        const { rows: itens } = await query(
          `SELECT ip.*, pr.nome, pr.preco FROM itens_pedido ip
           JOIN produtos pr ON ip.produto_id = pr.id WHERE ip.pedido_id = $1`,
          [p.id]
        );
        return { ...p, itens };
      })
    );
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Atualizar status do pedido
app.patch("/api/pedidos/:id/status", async (req, res) => {
  try {
    const { status, garcom_id, garcom_nome } = req.body;
    if (garcom_id) {
      await query(
        "UPDATE pedidos SET status = $1, garcom_id = $2, garcom_nome = $3 WHERE id = $4",
        [status, garcom_id, garcom_nome, req.params.id]
      );
    } else {
      await query("UPDATE pedidos SET status = $1 WHERE id = $2", [status, req.params.id]);
    }
    const pedido = await getPedidoCompleto(Number(req.params.id));
    io.emit("pedido_atualizado", pedido);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Atualizar status do item
app.patch("/api/itens/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ erro: "Status é obrigatório" });

    const { rows } = await query("SELECT * FROM itens_pedido WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: "Item nao encontrado" });

    await query("UPDATE itens_pedido SET status = $1 WHERE id = $2", [status, req.params.id]);

    const pedido = await getPedidoCompleto(rows[0].pedido_id);
    io.emit("pedido_atualizado", pedido);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Cancelar item
app.patch("/api/itens/:id/cancelar", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM itens_pedido WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: "Item nao encontrado" });
    if (rows[0].status !== "pendente") return res.status(400).json({ erro: "Item ja em preparo" });

    await query("UPDATE itens_pedido SET status = 'cancelado' WHERE id = $1", [req.params.id]);
    const pedido = await getPedidoCompleto(rows[0].pedido_id);
    io.emit("pedido_atualizado", pedido);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Fechar mesa
app.post("/api/mesas/:id/fechar", async (req, res) => {
  try {
    const { forma_pagamento, obs_pagamento } = req.body || {};
    if (!forma_pagamento) return res.status(400).json({ erro: "Forma de pagamento obrigatoria" });

    await query(
      "UPDATE mesas SET status = 'livre', forma_pagamento = $1, obs_pagamento = $2 WHERE id = $3",
      [forma_pagamento, obs_pagamento || null, req.params.id]
    );
    await query(
      "UPDATE pedidos SET status = 'finalizado', forma_pagamento = $1 WHERE mesa_id = $2 AND status != 'finalizado'",
      [forma_pagamento, req.params.id]
    );

    const { rows } = await query("SELECT * FROM mesas WHERE id = $1", [req.params.id]);
    io.emit("mesa_atualizada", rows[0]);
    io.emit("mesa_fechada", req.params.id);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Chamar garçom
app.post("/api/chamadas", async (req, res) => {
  try {
    const { mesa_id, motivo, nome_cliente } = req.body;
    const { rows } = await query(
      "INSERT INTO chamadas (mesa_id, motivo, nome_cliente) VALUES ($1, $2, $3) RETURNING id",
      [mesa_id, motivo || "garcom", nome_cliente || null]
    );
    const { rows: mesaRows } = await query("SELECT * FROM mesas WHERE id = $1", [mesa_id]);
    io.emit("chamada_garcom", {
      id: rows[0].id,
      mesa_id,
      mesa_numero: mesaRows[0].numero,
      motivo: motivo || "garcom",
      nome_cliente,
    });
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Atender chamada
app.patch("/api/chamadas/:id/atender", async (req, res) => {
  try {
    await query("UPDATE chamadas SET atendida = 1 WHERE id = $1", [req.params.id]);
    io.emit("chamada_atendida", { id: Number(req.params.id) });
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Chamadas pendentes
app.get("/api/chamadas", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ch.*, m.numero as mesa_numero FROM chamadas ch
       JOIN mesas m ON ch.mesa_id = m.id
       WHERE ch.atendida = 0 ORDER BY ch.criado_em DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// QR Code por mesa
app.get("/api/qrcode/:mesa_id", async (req, res) => {
  try {
    const ip = getLocalIP();
    const url = `http://${ip}:3000/mesa/${req.params.mesa_id}`;
    const qr = await QRCode.toDataURL(url);
    res.json({ url, qr });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Categorias (admin)
app.post("/api/categorias", async (req, res) => {
  try {
    const { nome } = req.body;
    const { rows } = await query(
      "INSERT INTO categorias (nome, ordem) VALUES ($1, $2) RETURNING id",
      [nome, 99]
    );
    io.emit("cardapio_atualizado");
    res.json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.delete("/api/categorias/:id", async (req, res) => {
  try {
    await query("DELETE FROM categorias WHERE id = $1", [req.params.id]);
    io.emit("cardapio_atualizado");
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Produtos (admin)
app.post("/api/produtos", async (req, res) => {
  try {
    const { categoria_id, nome, descricao, preco } = req.body;
    const { rows } = await query(
      "INSERT INTO produtos (categoria_id, nome, descricao, preco) VALUES ($1, $2, $3, $4) RETURNING id",
      [categoria_id, nome, descricao, preco]
    );
    io.emit("cardapio_atualizado");
    res.json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.patch("/api/produtos/:id", async (req, res) => {
  try {
    const { nome, descricao, preco, disponivel } = req.body;
    await query(
      "UPDATE produtos SET nome=$1, descricao=$2, preco=$3, disponivel=$4 WHERE id=$5",
      [nome, descricao, preco, disponivel ? 1 : 0, req.params.id]
    );
    io.emit("cardapio_atualizado");
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.delete("/api/produtos/:id", async (req, res) => {
  try {
    await query("DELETE FROM produtos WHERE id = $1", [req.params.id]);
    io.emit("cardapio_atualizado");
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Histórico do dia
app.get("/api/historico", async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `SELECT
        p.id, p.numero_dia, p.mesa_id,
        m.numero as mesa_numero,
        p.garcom_nome, p.nome_cliente, p.forma_pagamento,
        to_char(p.criado_em AT TIME ZONE 'America/Bahia', 'HH24:MI') as fechado_em,
        SUM(CASE WHEN ip.status != 'cancelado' THEN ip.quantidade * pr.preco ELSE 0 END) as total,
        COUNT(DISTINCT CASE WHEN ip.status != 'cancelado' THEN ip.id END) as total_itens
       FROM pedidos p
       JOIN mesas m ON p.mesa_id = m.id
       JOIN itens_pedido ip ON ip.pedido_id = p.id
       JOIN produtos pr ON pr.id = ip.produto_id
       WHERE p.status = 'finalizado'
         AND (p.criado_em AT TIME ZONE 'America/Bahia')::date = $1
       GROUP BY p.id, m.numero
       ORDER BY p.criado_em DESC`,
      [hoje]
    );

    const resultado = await Promise.all(
      rows.map(async (r) => {
        const { rows: itens } = await query(
          `SELECT ip.*, pr.nome, pr.preco FROM itens_pedido ip
           JOIN produtos pr ON pr.id = ip.produto_id
           WHERE ip.pedido_id = $1 AND ip.status != 'cancelado'`,
          [r.id]
        );
        return { ...r, itens };
      })
    );
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Reiniciar numeração
app.post("/api/pedidos/reiniciar-numeracao", async (req, res) => {
  try {
    await query(
      "INSERT INTO configuracoes (chave, valor) VALUES ('ultimo_reinicio', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1",
      [new Date().toISOString()]
    );
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Relatório por período
app.get("/api/relatorio", async (req, res) => {
  try {
    const { periodo, dataInicio: di, dataFim: df } = req.query;
    const agora = new Date();
    const hoje = agora.toISOString().slice(0, 10);
    let dataInicio, dataFim;

    if (di) {
      dataInicio = di;
      dataFim = df || hoje;
    } else if (periodo === "semana") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 7);
      dataInicio = d.toISOString().slice(0, 10);
      dataFim = hoje;
    } else if (periodo === "mes") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 30);
      dataInicio = d.toISOString().slice(0, 10);
      dataFim = hoje;
    } else if (periodo === "ano") {
      dataInicio = `${agora.getFullYear()}-01-01`;
      dataFim = hoje;
    } else {
      dataInicio = hoje;
      dataFim = hoje;
    }

    const { rows } = await query(
      `SELECT
        p.mesa_id,
        m.numero as mesa_numero,
        MAX(p.nome_cliente) as nome_cliente,
        MAX(p.garcom_nome) as garcom_nome,
        MAX(p.forma_pagamento) as forma_pagamento,
        COUNT(DISTINCT ip.id) as total_itens,
        SUM(CASE WHEN ip.status != 'cancelado' THEN ip.quantidade * pr.preco ELSE 0 END) as total,
        to_char(MAX(p.criado_em) AT TIME ZONE 'America/Bahia', 'DD/MM HH24:MI') as fechado_em
       FROM pedidos p
       JOIN mesas m ON p.mesa_id = m.id
       JOIN itens_pedido ip ON ip.pedido_id = p.id
       JOIN produtos pr ON pr.id = ip.produto_id
       WHERE p.status = 'finalizado'
         AND (p.criado_em AT TIME ZONE 'America/Bahia')::date >= $1
         AND (p.criado_em AT TIME ZONE 'America/Bahia')::date <= $2
       GROUP BY p.id, m.numero
       ORDER BY MAX(p.criado_em) DESC`,
      [dataInicio, dataFim]
    );

    const totalGeral = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    res.json({ rows, totalGeral, periodo, dataInicio, dataFim });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Financeiro hoje
app.get("/api/financeiro/hoje", async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `SELECT
        p.mesa_id,
        m.numero as mesa_numero,
        MAX(p.nome_cliente) as nome_cliente,
        COUNT(DISTINCT ip.id) as total_itens,
        SUM(CASE WHEN ip.status != 'cancelado' THEN ip.quantidade * pr.preco ELSE 0 END) as total,
        to_char(MAX(p.criado_em) AT TIME ZONE 'America/Bahia', 'HH24:MI') as fechado_em
       FROM pedidos p
       JOIN mesas m ON p.mesa_id = m.id
       JOIN itens_pedido ip ON ip.pedido_id = p.id
       JOIN produtos pr ON pr.id = ip.produto_id
       WHERE p.status = 'finalizado'
         AND (p.criado_em AT TIME ZONE 'America/Bahia')::date = $1
       GROUP BY p.mesa_id, m.numero
       ORDER BY MAX(p.criado_em) DESC`,
      [hoje]
    );
    const totalDia = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    res.json({ rows, totalDia, data: hoje });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ─── USUARIOS ──────────────────────────────────────────────────────────────

app.post("/api/auth/login", async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) return res.status(400).json({ erro: "Dados incompletos" });
  try {
    const { rows } = await query(
      "SELECT * FROM usuarios WHERE (login = $1 OR nome = $1) AND ativo = 1",
      [login]
    );
    const u = rows[0];
    if (!u || u.senha !== senha)
      return res.status(401).json({ erro: "Login ou senha incorretos" });
    res.json({ id: u.id, nome: u.nome, role: u.role, login: u.login });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get("/api/usuarios", async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, nome, login, role, ativo FROM usuarios ORDER BY role, nome"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.post("/api/usuarios", async (req, res) => {
  const { nome, login, senha, role } = req.body;
  if (!nome || !senha || !role) return res.status(400).json({ erro: "Dados incompletos" });
  if (!["garcom", "cozinha", "financeiro", "admin"].includes(role))
    return res.status(400).json({ erro: "Role invalido" });

  const loginFinal = (login || nome).toLowerCase().replace(/\s+/g, "_");
  try {
    const { rows: existing } = await query(
      "SELECT id FROM usuarios WHERE login = $1",
      [loginFinal]
    );
    if (existing[0]) return res.status(400).json({ erro: "Login ja existe, escolha outro" });

    const { rows } = await query(
      "INSERT INTO usuarios (nome, login, senha, role) VALUES ($1, $2, $3, $4) RETURNING id",
      [nome, loginFinal, senha, role]
    );
    res.json({ id: rows[0].id, login: loginFinal });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.patch("/api/usuarios/:id", async (req, res) => {
  try {
    const { nome, login, senha, ativo, role } = req.body;
    const { rows } = await query("SELECT * FROM usuarios WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: "Usuario nao encontrado" });
    const u = rows[0];
    const novoLogin = login || u.login || u.nome?.toLowerCase().replace(/\s+/g, "_");
    await query(
      "UPDATE usuarios SET nome=$1, login=$2, senha=$3, ativo=$4, role=$5 WHERE id=$6",
      [
        nome ?? u.nome,
        novoLogin,
        senha && senha.length > 0 ? senha : u.senha,
        ativo ?? u.ativo,
        role ?? u.role,
        req.params.id,
      ]
    );
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.delete("/api/usuarios/:id", async (req, res) => {
  try {
    await query("DELETE FROM usuarios WHERE id = $1", [req.params.id]);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ─── SOCKET.IO ─────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.on("pedido_ficou_pronto", (data) => {
    io.emit("pedido_pronto", data);
  });

  socket.on("mesa_fechada_event", (mesa_id) => {
    io.emit("mesa_fechada", mesa_id);
  });

  socket.on("disconnect", () => console.log("Cliente desconectado:", socket.id));
});

// ─── START ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

initDB()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      const ip = getLocalIP();
      console.log(`\n🍽️  Servidor rodando!`);
      console.log(`   Local:    http://localhost:${PORT}`);
      console.log(`   Rede:     http://${ip}:${PORT}`);
      console.log(`   QR Code:  http://${ip}:${PORT}/api/qrcode/1\n`);
    });
  })
  .catch((err) => {
    console.error("❌ Erro ao conectar no banco:", err.message);
    process.exit(1);
  });
