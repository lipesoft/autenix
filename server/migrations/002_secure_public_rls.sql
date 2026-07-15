-- The public menu needs an explicit active flag for category visibility.
ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS ativo INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_categorias_ativo_ordem
  ON public.categorias (ativo, ordem);

CREATE INDEX IF NOT EXISTS idx_produtos_disponivel_categoria
  ON public.produtos (disponivel, categoria_id);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Existing Supabase defaults granted every Data API role full table access.
REVOKE ALL PRIVILEGES ON TABLE
  public.usuarios,
  public.categorias,
  public.produtos,
  public.mesas,
  public.pedidos,
  public.itens_pedido,
  public.chamadas,
  public.configuracoes
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE
  public.usuarios_id_seq,
  public.categorias_id_seq,
  public.produtos_id_seq,
  public.mesas_id_seq,
  public.pedidos_id_seq,
  public.itens_pedido_id_seq,
  public.chamadas_id_seq
FROM PUBLIC, anon, authenticated;

-- Keep privileged server-side access available if a service key is adopted.
GRANT ALL PRIVILEGES ON TABLE
  public.usuarios,
  public.categorias,
  public.produtos,
  public.mesas,
  public.pedidos,
  public.itens_pedido,
  public.chamadas,
  public.configuracoes
TO service_role;

GRANT ALL PRIVILEGES ON SEQUENCE
  public.usuarios_id_seq,
  public.categorias_id_seq,
  public.produtos_id_seq,
  public.mesas_id_seq,
  public.pedidos_id_seq,
  public.itens_pedido_id_seq,
  public.chamadas_id_seq
TO service_role;

-- Public Data API access is read-only and restricted to the active menu.
GRANT SELECT ON TABLE public.categorias, public.produtos TO anon, authenticated;

DROP POLICY IF EXISTS categorias_public_read_active ON public.categorias;
CREATE POLICY categorias_public_read_active
  ON public.categorias
  FOR SELECT
  TO anon, authenticated
  USING (ativo = 1);

DROP POLICY IF EXISTS produtos_public_read_active ON public.produtos;
CREATE POLICY produtos_public_read_active
  ON public.produtos
  FOR SELECT
  TO anon, authenticated
  USING (
    COALESCE(disponivel, 0) = 1
    AND EXISTS (
      SELECT 1
      FROM public.categorias AS categoria
      WHERE categoria.id = produtos.categoria_id
        AND categoria.ativo = 1
    )
  );

-- Until tenant ownership exists, operational data is backend-only.
DROP POLICY IF EXISTS usuarios_backend_only ON public.usuarios;
CREATE POLICY usuarios_backend_only
  ON public.usuarios
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS mesas_backend_only ON public.mesas;
CREATE POLICY mesas_backend_only
  ON public.mesas
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS pedidos_backend_only ON public.pedidos;
CREATE POLICY pedidos_backend_only
  ON public.pedidos
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS itens_pedido_backend_only ON public.itens_pedido;
CREATE POLICY itens_pedido_backend_only
  ON public.itens_pedido
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS chamadas_backend_only ON public.chamadas;
CREATE POLICY chamadas_backend_only
  ON public.chamadas
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS configuracoes_backend_only ON public.configuracoes;
CREATE POLICY configuracoes_backend_only
  ON public.configuracoes
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- New objects created by the backend must opt in to Data API exposure.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
