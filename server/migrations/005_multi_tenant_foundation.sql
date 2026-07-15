CREATE TABLE IF NOT EXISTS public.restaurantes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  ativo INTEGER NOT NULL DEFAULT 1,
  logo_url TEXT,
  cor_primaria TEXT,
  cor_secundaria TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restaurantes_slug_formato_check
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS restaurante_id INTEGER;
ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS restaurante_id INTEGER;
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS restaurante_id INTEGER;
ALTER TABLE public.mesas
  ADD COLUMN IF NOT EXISTS restaurante_id INTEGER;
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS restaurante_id INTEGER;
ALTER TABLE public.itens_pedido
  ADD COLUMN IF NOT EXISTS restaurante_id INTEGER;
ALTER TABLE public.chamadas
  ADD COLUMN IF NOT EXISTS restaurante_id INTEGER;
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS restaurante_id INTEGER;

DO $backfill$
DECLARE
  restaurante_padrao_id INTEGER;
BEGIN
  INSERT INTO public.restaurantes (nome, slug, ativo)
  VALUES ('Restaurante Autenix', 'autenix', 1)
  ON CONFLICT (slug) DO UPDATE
    SET nome = EXCLUDED.nome,
        ativo = EXCLUDED.ativo
  RETURNING id INTO restaurante_padrao_id;

  UPDATE public.usuarios
  SET restaurante_id = restaurante_padrao_id
  WHERE restaurante_id IS NULL;

  UPDATE public.categorias
  SET restaurante_id = restaurante_padrao_id
  WHERE restaurante_id IS NULL;

  UPDATE public.produtos AS produto
  SET restaurante_id = COALESCE(categoria.restaurante_id, restaurante_padrao_id)
  FROM public.categorias AS categoria
  WHERE produto.restaurante_id IS NULL
    AND categoria.id = produto.categoria_id;

  UPDATE public.produtos
  SET restaurante_id = restaurante_padrao_id
  WHERE restaurante_id IS NULL;

  UPDATE public.mesas
  SET restaurante_id = restaurante_padrao_id
  WHERE restaurante_id IS NULL;

  UPDATE public.pedidos AS pedido
  SET restaurante_id = COALESCE(mesa.restaurante_id, restaurante_padrao_id)
  FROM public.mesas AS mesa
  WHERE pedido.restaurante_id IS NULL
    AND mesa.id = pedido.mesa_id;

  UPDATE public.pedidos
  SET restaurante_id = restaurante_padrao_id
  WHERE restaurante_id IS NULL;

  UPDATE public.itens_pedido AS item
  SET restaurante_id = COALESCE(pedido.restaurante_id, restaurante_padrao_id)
  FROM public.pedidos AS pedido
  WHERE item.restaurante_id IS NULL
    AND pedido.id = item.pedido_id;

  UPDATE public.itens_pedido
  SET restaurante_id = restaurante_padrao_id
  WHERE restaurante_id IS NULL;

  UPDATE public.chamadas AS chamada
  SET restaurante_id = COALESCE(mesa.restaurante_id, restaurante_padrao_id)
  FROM public.mesas AS mesa
  WHERE chamada.restaurante_id IS NULL
    AND mesa.id = chamada.mesa_id;

  UPDATE public.chamadas
  SET restaurante_id = restaurante_padrao_id
  WHERE restaurante_id IS NULL;

  UPDATE public.configuracoes
  SET restaurante_id = restaurante_padrao_id
  WHERE restaurante_id IS NULL;
END
$backfill$;

ALTER TABLE public.mesas
  DROP CONSTRAINT IF EXISTS mesas_numero_key;
ALTER TABLE public.mesas
  DROP CONSTRAINT IF EXISTS mesas_restaurante_numero_key;
ALTER TABLE public.mesas
  ADD CONSTRAINT mesas_restaurante_numero_key
  UNIQUE (restaurante_id, numero);

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_restaurante_login_key;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_restaurante_login_key
  UNIQUE (restaurante_id, login);

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_id_restaurante_key;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_id_restaurante_key UNIQUE (id, restaurante_id);
ALTER TABLE public.categorias
  DROP CONSTRAINT IF EXISTS categorias_id_restaurante_key;
ALTER TABLE public.categorias
  ADD CONSTRAINT categorias_id_restaurante_key UNIQUE (id, restaurante_id);
ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_id_restaurante_key;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_id_restaurante_key UNIQUE (id, restaurante_id);
ALTER TABLE public.mesas
  DROP CONSTRAINT IF EXISTS mesas_id_restaurante_key;
ALTER TABLE public.mesas
  ADD CONSTRAINT mesas_id_restaurante_key UNIQUE (id, restaurante_id);
ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_id_restaurante_key;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_id_restaurante_key UNIQUE (id, restaurante_id);

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_restaurante_id_fkey;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_restaurante_id_fkey
  FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE RESTRICT;
ALTER TABLE public.categorias
  DROP CONSTRAINT IF EXISTS categorias_restaurante_id_fkey;
ALTER TABLE public.categorias
  ADD CONSTRAINT categorias_restaurante_id_fkey
  FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE RESTRICT;
ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_restaurante_id_fkey;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_restaurante_id_fkey
  FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE RESTRICT;
ALTER TABLE public.mesas
  DROP CONSTRAINT IF EXISTS mesas_restaurante_id_fkey;
ALTER TABLE public.mesas
  ADD CONSTRAINT mesas_restaurante_id_fkey
  FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE RESTRICT;
ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_restaurante_id_fkey;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_restaurante_id_fkey
  FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE RESTRICT;
ALTER TABLE public.itens_pedido
  DROP CONSTRAINT IF EXISTS itens_pedido_restaurante_id_fkey;
ALTER TABLE public.itens_pedido
  ADD CONSTRAINT itens_pedido_restaurante_id_fkey
  FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE RESTRICT;
ALTER TABLE public.chamadas
  DROP CONSTRAINT IF EXISTS chamadas_restaurante_id_fkey;
ALTER TABLE public.chamadas
  ADD CONSTRAINT chamadas_restaurante_id_fkey
  FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE RESTRICT;
ALTER TABLE public.configuracoes
  DROP CONSTRAINT IF EXISTS configuracoes_restaurante_id_fkey;
ALTER TABLE public.configuracoes
  ADD CONSTRAINT configuracoes_restaurante_id_fkey
  FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE RESTRICT;

ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_categoria_restaurante_fkey;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_categoria_restaurante_fkey
  FOREIGN KEY (categoria_id, restaurante_id)
  REFERENCES public.categorias(id, restaurante_id) ON DELETE RESTRICT;
ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_mesa_restaurante_fkey;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_mesa_restaurante_fkey
  FOREIGN KEY (mesa_id, restaurante_id)
  REFERENCES public.mesas(id, restaurante_id) ON DELETE RESTRICT;
ALTER TABLE public.itens_pedido
  DROP CONSTRAINT IF EXISTS itens_pedido_pedido_restaurante_fkey;
ALTER TABLE public.itens_pedido
  ADD CONSTRAINT itens_pedido_pedido_restaurante_fkey
  FOREIGN KEY (pedido_id, restaurante_id)
  REFERENCES public.pedidos(id, restaurante_id) ON DELETE RESTRICT;
ALTER TABLE public.itens_pedido
  DROP CONSTRAINT IF EXISTS itens_pedido_produto_restaurante_fkey;
ALTER TABLE public.itens_pedido
  ADD CONSTRAINT itens_pedido_produto_restaurante_fkey
  FOREIGN KEY (produto_id, restaurante_id)
  REFERENCES public.produtos(id, restaurante_id) ON DELETE RESTRICT;
ALTER TABLE public.chamadas
  DROP CONSTRAINT IF EXISTS chamadas_mesa_restaurante_fkey;
ALTER TABLE public.chamadas
  ADD CONSTRAINT chamadas_mesa_restaurante_fkey
  FOREIGN KEY (mesa_id, restaurante_id)
  REFERENCES public.mesas(id, restaurante_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_usuarios_restaurante_role_ativo
  ON public.usuarios (restaurante_id, role, ativo);
CREATE INDEX IF NOT EXISTS idx_categorias_restaurante_ativo_ordem
  ON public.categorias (restaurante_id, ativo, ordem);
CREATE INDEX IF NOT EXISTS idx_produtos_restaurante_categoria_disponivel
  ON public.produtos (restaurante_id, categoria_id, disponivel);
CREATE INDEX IF NOT EXISTS idx_mesas_restaurante_status
  ON public.mesas (restaurante_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_restaurante_status_criado
  ON public.pedidos (restaurante_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_restaurante_pedido
  ON public.itens_pedido (restaurante_id, pedido_id);
CREATE INDEX IF NOT EXISTS idx_chamadas_restaurante_atendida_criado
  ON public.chamadas (restaurante_id, atendida, criado_em DESC);

ALTER TABLE public.restaurantes ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.restaurantes
FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.restaurantes_id_seq
FROM PUBLIC, anon, authenticated;

-- The public menu is served by the tenant-aware backend API.
REVOKE ALL PRIVILEGES ON TABLE public.categorias, public.produtos
FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS categorias_public_read_active ON public.categorias;
DROP POLICY IF EXISTS produtos_public_read_active ON public.produtos;

GRANT ALL PRIVILEGES ON TABLE public.restaurantes TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.restaurantes_id_seq TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.restaurantes TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.restaurantes_id_seq TO autenix_backend;

DROP POLICY IF EXISTS restaurantes_backend_crud ON public.restaurantes;
CREATE POLICY restaurantes_backend_crud
  ON public.restaurantes FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);
