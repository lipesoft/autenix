DO $role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'autenix_backend'
  ) THEN
    CREATE ROLE autenix_backend
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$role$;

ALTER ROLE autenix_backend SET search_path = public;
ALTER ROLE autenix_backend SET statement_timeout = '30s';
ALTER ROLE autenix_backend SET lock_timeout = '5s';

GRANT CONNECT ON DATABASE postgres TO autenix_backend;
GRANT USAGE ON SCHEMA public TO autenix_backend;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.usuarios,
  public.categorias,
  public.produtos,
  public.mesas,
  public.pedidos,
  public.itens_pedido,
  public.chamadas,
  public.configuracoes
TO autenix_backend;

GRANT USAGE, SELECT, UPDATE ON SEQUENCE
  public.usuarios_id_seq,
  public.categorias_id_seq,
  public.produtos_id_seq,
  public.mesas_id_seq,
  public.pedidos_id_seq,
  public.itens_pedido_id_seq,
  public.chamadas_id_seq
TO autenix_backend;

DROP POLICY IF EXISTS usuarios_backend_crud ON public.usuarios;
CREATE POLICY usuarios_backend_crud
  ON public.usuarios FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS categorias_backend_crud ON public.categorias;
CREATE POLICY categorias_backend_crud
  ON public.categorias FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS produtos_backend_crud ON public.produtos;
CREATE POLICY produtos_backend_crud
  ON public.produtos FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS mesas_backend_crud ON public.mesas;
CREATE POLICY mesas_backend_crud
  ON public.mesas FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pedidos_backend_crud ON public.pedidos;
CREATE POLICY pedidos_backend_crud
  ON public.pedidos FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS itens_pedido_backend_crud ON public.itens_pedido;
CREATE POLICY itens_pedido_backend_crud
  ON public.itens_pedido FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS chamadas_backend_crud ON public.chamadas;
CREATE POLICY chamadas_backend_crud
  ON public.chamadas FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS configuracoes_backend_crud ON public.configuracoes;
CREATE POLICY configuracoes_backend_crud
  ON public.configuracoes FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO autenix_backend;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO autenix_backend;
