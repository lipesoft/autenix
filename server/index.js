const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Database = require("better-sqlite3");
const cors = require("cors");
const QRCode = require("qrcode");
const path = require("path");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// ─── BANCO DE DADOS ────────────────────────────────────────────────────────
const db = new Database("restaurante.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    ordem INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL NOT NULL,
    imagem TEXT,
    disponivel INTEGER DEFAULT 1,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
  );

  CREATE TABLE IF NOT EXISTS mesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'livre'
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pendente',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mesa_id) REFERENCES mesas(id)
  );

  CREATE TABLE IF NOT EXISTS itens_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    observacao TEXT,
    status TEXT DEFAULT 'pendente',
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  );

  CREATE TABLE IF NOT EXISTS chamadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa_id INTEGER NOT NULL,
    motivo TEXT DEFAULT 'garcom',
    nome_cliente TEXT,
    atendida INTEGER DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed dados de exemplo se vazio
const totalCat = db.prepare("SELECT COUNT(*) as c FROM categorias").get();
if (totalCat.c === 0) {
  const insC = db.prepare("INSERT INTO categorias (nome, ordem) VALUES (?, ?)");
  insC.run("Entradas", 1);
  insC.run("Pratos Principais", 2);
  insC.run("Bebidas", 3);
  insC.run("Sobremesas", 4);

  const insP = db.prepare(
    "INSERT INTO produtos (categoria_id, nome, descricao, preco) VALUES (?, ?, ?, ?)",
  );
  insP.run(1, "Pão de Alho", "Pão artesanal com alho e manteiga", 18.9);
  insP.run(1, "Bruschetta", "Tomate, manjericão e azeite", 22.0);
  insP.run(2, "Frango Grelhado", "Com legumes e arroz", 45.9);
  insP.run(2, "Picanha 300g", "Acompanha farofa e vinagrete", 89.9);
  insP.run(2, "Massa Carbonara", "Espaguete, bacon e molho cremoso", 52.0);
  insP.run(3, "Coca-Cola Lata", "350ml gelada", 8.0);
  insP.run(3, "Suco de Laranja", "Natural 500ml", 14.0);
  insP.run(3, "Água Mineral", "500ml", 5.0);
  insP.run(4, "Pudim", "Pudim de leite condensado", 18.0);
  insP.run(4, "Brownie", "Com sorvete de creme", 24.0);

  const insM = db.prepare("INSERT INTO mesas (numero) VALUES (?)");
  for (let i = 1; i <= 12; i++) insM.run(String(i));
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

// ─── ROTAS API ─────────────────────────────────────────────────────────────

// Cardápio
app.get("/api/cardapio", (req, res) => {
  const categorias = db
    .prepare("SELECT * FROM categorias ORDER BY ordem")
    .all();
  const produtos = db
    .prepare("SELECT * FROM produtos WHERE disponivel = 1")
    .all();
  res.json({ categorias, produtos });
});

// Mesas
app.get("/api/mesas", (req, res) => {
  const mesas = db
    .prepare("SELECT * FROM mesas ORDER BY CAST(numero AS INTEGER)")
    .all();
  res.json(mesas);
});

app.get("/api/mesas/:id", (req, res) => {
  const mesa = db
    .prepare("SELECT * FROM mesas WHERE id = ?")
    .get(req.params.id);
  if (!mesa) return res.status(404).json({ erro: "Mesa não encontrada" });
  res.json(mesa);
});

// Fazer pedido (cliente)
app.post("/api/pedidos", (req, res) => {
  const { mesa_id, itens } = req.body;
  if (!mesa_id || !itens?.length)
    return res.status(400).json({ erro: "Dados inválidos" });

  const mesa = db.prepare("SELECT * FROM mesas WHERE id = ?").get(mesa_id);
  if (!mesa) return res.status(404).json({ erro: "Mesa não encontrada" });

  const pedido = db
    .prepare("INSERT INTO pedidos (mesa_id, status) VALUES (?, ?)")
    .run(mesa_id, "pendente");
  const pedido_id = pedido.lastInsertRowid;

  const insItem = db.prepare(
    "INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, observacao) VALUES (?, ?, ?, ?)",
  );
  for (const item of itens) {
    insItem.run(
      pedido_id,
      item.produto_id,
      item.quantidade,
      item.observacao || "",
    );
  }

  // Atualiza mesa para ocupada
  db.prepare("UPDATE mesas SET status = 'ocupada' WHERE id = ?").run(mesa_id);

  const pedidoCompleto = getPedidoCompleto(pedido_id);
  io.emit("novo_pedido", pedidoCompleto);
  io.emit(
    "mesa_atualizada",
    db.prepare("SELECT * FROM mesas WHERE id = ?").get(mesa_id),
  );

  res.json({ sucesso: true, pedido_id });
});

// Listar pedidos (cozinha/admin)
app.get("/api/pedidos", (req, res) => {
  const { mesa_id, status } = req.query;
  let sql = `SELECT p.*, m.numero as mesa_numero FROM pedidos p JOIN mesas m ON p.mesa_id = m.id WHERE 1=1`;
  const params = [];
  if (mesa_id) {
    sql += " AND p.mesa_id = ?";
    params.push(mesa_id);
  }
  if (status) {
    sql += " AND p.status = ?";
    params.push(status);
  }
  sql += " ORDER BY p.criado_em DESC";

  const pedidos = db.prepare(sql).all(...params);
  const resultado = pedidos.map((p) => ({
    ...p,
    itens: db
      .prepare(
        `
      SELECT ip.*, pr.nome, pr.preco FROM itens_pedido ip
      JOIN produtos pr ON ip.produto_id = pr.id
      WHERE ip.pedido_id = ?
    `,
      )
      .all(p.id),
  }));

  res.json(resultado);
});

// Atualizar status de item
app.patch("/api/itens/:id/status", (req, res) => {
  const { status } = req.body;
  db.prepare("UPDATE itens_pedido SET status = ? WHERE id = ?").run(
    status,
    req.params.id,
  );
  const item = db
    .prepare("SELECT * FROM itens_pedido WHERE id = ?")
    .get(req.params.id);
  const pedido = getPedidoCompleto(item.pedido_id);
  io.emit("pedido_atualizado", pedido);
  res.json({ sucesso: true });
});

// Cancelar item (só se pendente)
app.patch("/api/itens/:id/cancelar", (req, res) => {
  const item = db
    .prepare("SELECT * FROM itens_pedido WHERE id = ?")
    .get(req.params.id);
  if (!item) return res.status(404).json({ erro: "Item nao encontrado" });
  if (item.status !== "pendente")
    return res.status(400).json({ erro: "Item ja em preparo" });
  db.prepare("UPDATE itens_pedido SET status = 'cancelado' WHERE id = ?").run(
    req.params.id,
  );
  const pedido = getPedidoCompleto(item.pedido_id);
  io.emit("pedido_atualizado", pedido);
  res.json({ sucesso: true });
});

// Atualizar status do pedido
app.patch("/api/pedidos/:id/status", (req, res) => {
  const { status } = req.body;
  db.prepare("UPDATE pedidos SET status = ? WHERE id = ?").run(
    status,
    req.params.id,
  );
  const pedido = getPedidoCompleto(Number(req.params.id));
  io.emit("pedido_atualizado", pedido);
  res.json({ sucesso: true });
});

// Fechar mesa
app.post("/api/mesas/:id/fechar", (req, res) => {
  db.prepare("UPDATE mesas SET status = 'livre' WHERE id = ?").run(
    req.params.id,
  );
  db.prepare(
    "UPDATE pedidos SET status = 'finalizado' WHERE mesa_id = ? AND status != 'finalizado'",
  ).run(req.params.id);
  const mesa = db
    .prepare("SELECT * FROM mesas WHERE id = ?")
    .get(req.params.id);
  io.emit("mesa_atualizada", mesa);
  res.json({ sucesso: true });
});

// Chamar garçom
app.post("/api/chamadas", (req, res) => {
  const { mesa_id, motivo, nome_cliente } = req.body;
  const chamada = db
    .prepare(
      "INSERT INTO chamadas (mesa_id, motivo, nome_cliente) VALUES (?, ?, ?)",
    )
    .run(mesa_id, motivo || "garcom", nome_cliente || null);
  const mesa = db.prepare("SELECT * FROM mesas WHERE id = ?").get(mesa_id);
  io.emit("chamada_garcom", {
    id: chamada.lastInsertRowid,
    mesa_id,
    mesa_numero: mesa.numero,
    motivo: motivo || "garcom",
    nome_cliente,
  });
  res.json({ sucesso: true });
});

// Atender chamada
app.patch("/api/chamadas/:id/atender", (req, res) => {
  db.prepare("UPDATE chamadas SET atendida = 1 WHERE id = ?").run(
    req.params.id,
  );
  io.emit("chamada_atendida", { id: Number(req.params.id) });
  res.json({ sucesso: true });
});

// Chamadas pendentes
app.get("/api/chamadas", (req, res) => {
  const chamadas = db
    .prepare(
      `
    SELECT ch.*, m.numero as mesa_numero FROM chamadas ch
    JOIN mesas m ON ch.mesa_id = m.id
    WHERE ch.atendida = 0 ORDER BY ch.criado_em DESC
  `,
    )
    .all();
  res.json(chamadas);
});

// QR Code por mesa
app.get("/api/qrcode/:mesa_id", async (req, res) => {
  const ip = getLocalIP();
  const port = process.env.PORT || 3001;
  const url = `http://${ip}:${port}/mesa/${req.params.mesa_id}`;
  const qr = await QRCode.toDataURL(url);
  res.json({ url, qr });
});

// Categorias (admin)
app.post("/api/categorias", (req, res) => {
  const { nome } = req.body;
  const r = db
    .prepare("INSERT INTO categorias (nome, ordem) VALUES (?, ?)")
    .run(nome, 99);
  io.emit("cardapio_atualizado");
  res.json({ id: r.lastInsertRowid });
});

app.delete("/api/categorias/:id", (req, res) => {
  db.prepare("DELETE FROM categorias WHERE id = ?").run(req.params.id);
  io.emit("cardapio_atualizado");
  res.json({ sucesso: true });
});

// Produtos (admin)
app.post("/api/produtos", (req, res) => {
  const { categoria_id, nome, descricao, preco } = req.body;
  const r = db
    .prepare(
      "INSERT INTO produtos (categoria_id, nome, descricao, preco) VALUES (?, ?, ?, ?)",
    )
    .run(categoria_id, nome, descricao, preco);
  io.emit("cardapio_atualizado");
  res.json({ id: r.lastInsertRowid });
});

app.patch("/api/produtos/:id", (req, res) => {
  const { nome, descricao, preco, disponivel } = req.body;
  db.prepare(
    "UPDATE produtos SET nome=?, descricao=?, preco=?, disponivel=? WHERE id=?",
  ).run(nome, descricao, preco, disponivel ? 1 : 0, req.params.id);
  io.emit("cardapio_atualizado");
  res.json({ sucesso: true });
});

app.delete("/api/produtos/:id", (req, res) => {
  db.prepare("DELETE FROM produtos WHERE id = ?").run(req.params.id);
  io.emit("cardapio_atualizado");
  res.json({ sucesso: true });
});

// Historico do dia (mesas fechadas hoje)
app.get("/api/historico", (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `
    SELECT
      p.mesa_id,
      m.numero as mesa_numero,
      MAX(p.nome_cliente) as nome_cliente,
      COUNT(DISTINCT ip.id) as total_itens,
      SUM(CASE WHEN ip.status != 'cancelado' THEN ip.quantidade * pr.preco ELSE 0 END) as total,
      strftime('%H:%M', MAX(p.criado_em)) as fechado_em
    FROM pedidos p
    JOIN mesas m ON p.mesa_id = m.id
    JOIN itens_pedido ip ON ip.pedido_id = p.id
    JOIN produtos pr ON pr.id = ip.produto_id
    WHERE p.status = 'finalizado'
      AND date(p.criado_em) = ?
    GROUP BY p.mesa_id, date(p.criado_em)
    ORDER BY MAX(p.criado_em) DESC
  `,
    )
    .all(hoje);
  res.json(rows);
});

// ─── HELPER PEDIDO COMPLETO ────────────────────────────────────────────────
function getPedidoCompleto(pedido_id) {
  const pedido = db
    .prepare(
      "SELECT p.*, m.numero as mesa_numero FROM pedidos p JOIN mesas m ON p.mesa_id = m.id WHERE p.id = ?",
    )
    .get(pedido_id);
  if (!pedido) return null;
  pedido.itens = db
    .prepare(
      `
    SELECT ip.*, pr.nome, pr.preco FROM itens_pedido ip
    JOIN produtos pr ON ip.produto_id = pr.id WHERE ip.pedido_id = ?
  `,
    )
    .all(pedido_id);
  return pedido;
}

// ─── SOCKET.IO ─────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.on("connect", () => {
    console.log("Conectado!", socket.id);
  });

  // Garçom emite quando fecha mesa — propaga para clientes da mesa
  socket.on("pedido_ficou_pronto", (data) => {
    io.emit("pedido_pronto", data);
  });

  socket.on("mesa_fechada_event", (mesa_id) => {
    io.emit("mesa_fechada", mesa_id);
  });

  socket.on("disconnect", () =>
    console.log("Cliente desconectado:", socket.id),
  );
});

// ─── START ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIP();
  console.log(`\n🍽️  Servidor rodando!`);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Rede:     http://${ip}:${PORT}`);
  console.log(`   QR Code:  http://${ip}:${PORT}/api/qrcode/1\n`);
});
// ─── ROTAS EXTRAS (adicionadas na rodada 2) ───────────────────────────────

// Criar nova mesa
app.post("/api/mesas", (req, res) => {
  const { numero } = req.body;
  if (!numero) return res.status(400).json({ erro: "Número obrigatório" });
  try {
    const r = db
      .prepare("INSERT INTO mesas (numero) VALUES (?)")
      .run(String(numero));
    const mesa = db
      .prepare("SELECT * FROM mesas WHERE id = ?")
      .get(r.lastInsertRowid);
    io.emit("mesa_atualizada", mesa);
    res.json(mesa);
  } catch (e) {
    res.status(400).json({ erro: "Mesa já existe" });
  }
});

// Deletar mesa (só livres)
app.delete("/api/mesas/:id", (req, res) => {
  const mesa = db
    .prepare("SELECT * FROM mesas WHERE id = ?")
    .get(req.params.id);
  if (!mesa) return res.status(404).json({ erro: "Mesa não encontrada" });
  if (mesa.status === "ocupada")
    return res.status(400).json({ erro: "Mesa ocupada" });
  db.prepare("DELETE FROM mesas WHERE id = ?").run(req.params.id);
  res.json({ sucesso: true });
});
