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

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'garcom';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo INTEGER DEFAULT 1;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_dia INTEGER;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS garcom_id INTEGER;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS garcom_nome TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS obs_pagamento TEXT;
ALTER TABLE chamadas ADD COLUMN IF NOT EXISTS motivo TEXT DEFAULT 'garcom';
ALTER TABLE chamadas ADD COLUMN IF NOT EXISTS nome_cliente TEXT;

UPDATE usuarios
SET login = lower(regexp_replace(nome, '[[:space:]]+', '_', 'g'))
WHERE login IS NULL OR login = '';

CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_id ON pedidos(mesa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido_id ON itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_chamadas_atendida ON chamadas(atendida);
