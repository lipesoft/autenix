ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'essencial',
  ADD COLUMN IF NOT EXISTS limite_mesas INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ;

ALTER TABLE public.restaurantes
  DROP CONSTRAINT IF EXISTS restaurantes_plano_check,
  DROP CONSTRAINT IF EXISTS restaurantes_limite_mesas_check;

ALTER TABLE public.restaurantes
  ADD CONSTRAINT restaurantes_plano_check
    CHECK (plano IN ('essencial', 'profissional', 'enterprise')),
  ADD CONSTRAINT restaurantes_limite_mesas_check
    CHECK (limite_mesas BETWEEN 1 AND 500);

CREATE TABLE IF NOT EXISTS public.platform_usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'platform_admin',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acesso_em TIMESTAMPTZ,
  CONSTRAINT platform_usuarios_role_check CHECK (role = 'platform_admin'),
  CONSTRAINT platform_usuarios_nome_tamanho_check
    CHECK (char_length(btrim(nome)) BETWEEN 2 AND 100),
  CONSTRAINT platform_usuarios_login_formato_check
    CHECK (login ~ '^[a-z0-9._-]{3,64}$')
);

ALTER TABLE public.platform_usuarios ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.platform_usuarios
FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.platform_usuarios_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.platform_usuarios TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.platform_usuarios_id_seq TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_usuarios TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.platform_usuarios_id_seq TO autenix_backend;

DROP POLICY IF EXISTS platform_usuarios_backend_crud ON public.platform_usuarios;
CREATE POLICY platform_usuarios_backend_crud
  ON public.platform_usuarios FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_restaurantes_ativo_plano
  ON public.restaurantes (ativo, plano)
  WHERE excluido_em IS NULL;

