CREATE TABLE IF NOT EXISTS public.importacoes (
  id BIGSERIAL PRIMARY KEY,
  restaurante_id INTEGER NOT NULL,
  usuario_id INTEGER,
  usuario_nome TEXT,
  usuario_login TEXT,
  tipo TEXT NOT NULL,
  formato TEXT NOT NULL DEFAULT 'csv',
  arquivo_nome TEXT NOT NULL,
  atualizar_existentes BOOLEAN NOT NULL DEFAULT FALSE,
  mapeamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  criados INTEGER NOT NULL DEFAULT 0,
  atualizados INTEGER NOT NULL DEFAULT 0,
  ignorados INTEGER NOT NULL DEFAULT 0,
  invalidos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'concluida',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revertido_em TIMESTAMPTZ,
  revertido_por_usuario_id INTEGER,
  revertido_por_nome TEXT
);

ALTER TABLE public.importacoes
  DROP CONSTRAINT IF EXISTS importacoes_id_restaurante_key,
  DROP CONSTRAINT IF EXISTS importacoes_restaurante_id_fkey,
  DROP CONSTRAINT IF EXISTS importacoes_usuario_fkey,
  DROP CONSTRAINT IF EXISTS importacoes_revertido_por_usuario_fkey,
  DROP CONSTRAINT IF EXISTS importacoes_tipo_check,
  DROP CONSTRAINT IF EXISTS importacoes_formato_check,
  DROP CONSTRAINT IF EXISTS importacoes_status_check,
  DROP CONSTRAINT IF EXISTS importacoes_arquivo_nome_tamanho_check,
  DROP CONSTRAINT IF EXISTS importacoes_usuario_nome_tamanho_check,
  DROP CONSTRAINT IF EXISTS importacoes_usuario_login_tamanho_check,
  DROP CONSTRAINT IF EXISTS importacoes_revertido_por_nome_tamanho_check,
  DROP CONSTRAINT IF EXISTS importacoes_contadores_check,
  DROP CONSTRAINT IF EXISTS importacoes_mapeamento_check;

ALTER TABLE public.importacoes
  ADD CONSTRAINT importacoes_id_restaurante_key UNIQUE (id, restaurante_id),
  ADD CONSTRAINT importacoes_restaurante_id_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT importacoes_usuario_fkey
    FOREIGN KEY (usuario_id, restaurante_id)
    REFERENCES public.usuarios(id, restaurante_id) ON DELETE SET NULL (usuario_id),
  ADD CONSTRAINT importacoes_revertido_por_usuario_fkey
    FOREIGN KEY (revertido_por_usuario_id, restaurante_id)
    REFERENCES public.usuarios(id, restaurante_id)
    ON DELETE SET NULL (revertido_por_usuario_id),
  ADD CONSTRAINT importacoes_tipo_check
    CHECK (tipo IN ('categorias', 'produtos', 'mesas', 'usuarios')),
  ADD CONSTRAINT importacoes_formato_check
    CHECK (formato IN ('csv', 'xlsx')),
  ADD CONSTRAINT importacoes_status_check
    CHECK (status IN ('concluida', 'revertida')),
  ADD CONSTRAINT importacoes_arquivo_nome_tamanho_check
    CHECK (char_length(arquivo_nome) BETWEEN 1 AND 255),
  ADD CONSTRAINT importacoes_usuario_nome_tamanho_check
    CHECK (usuario_nome IS NULL OR char_length(usuario_nome) <= 120),
  ADD CONSTRAINT importacoes_usuario_login_tamanho_check
    CHECK (usuario_login IS NULL OR char_length(usuario_login) <= 120),
  ADD CONSTRAINT importacoes_revertido_por_nome_tamanho_check
    CHECK (revertido_por_nome IS NULL OR char_length(revertido_por_nome) <= 120),
  ADD CONSTRAINT importacoes_contadores_check
    CHECK (
      total_linhas >= 0
      AND criados >= 0
      AND atualizados >= 0
      AND ignorados >= 0
      AND invalidos >= 0
    ),
  ADD CONSTRAINT importacoes_mapeamento_check
    CHECK (jsonb_typeof(mapeamento) = 'object');

CREATE TABLE IF NOT EXISTS public.importacao_itens (
  id BIGSERIAL PRIMARY KEY,
  importacao_id BIGINT NOT NULL,
  restaurante_id INTEGER NOT NULL,
  ordem INTEGER NOT NULL,
  entidade TEXT NOT NULL,
  registro_id INTEGER NOT NULL,
  acao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.importacao_itens
  DROP CONSTRAINT IF EXISTS importacao_itens_importacao_fkey,
  DROP CONSTRAINT IF EXISTS importacao_itens_restaurante_id_fkey,
  DROP CONSTRAINT IF EXISTS importacao_itens_importacao_ordem_key,
  DROP CONSTRAINT IF EXISTS importacao_itens_entidade_check,
  DROP CONSTRAINT IF EXISTS importacao_itens_acao_check,
  DROP CONSTRAINT IF EXISTS importacao_itens_registro_id_check,
  DROP CONSTRAINT IF EXISTS importacao_itens_dados_anteriores_check,
  DROP CONSTRAINT IF EXISTS importacao_itens_dados_novos_check;

ALTER TABLE public.importacao_itens
  ADD CONSTRAINT importacao_itens_importacao_fkey
    FOREIGN KEY (importacao_id, restaurante_id)
    REFERENCES public.importacoes(id, restaurante_id) ON DELETE CASCADE,
  ADD CONSTRAINT importacao_itens_restaurante_id_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT importacao_itens_importacao_ordem_key
    UNIQUE (importacao_id, ordem),
  ADD CONSTRAINT importacao_itens_entidade_check
    CHECK (entidade IN ('categorias', 'produtos', 'mesas', 'usuarios')),
  ADD CONSTRAINT importacao_itens_acao_check
    CHECK (acao IN ('criar', 'atualizar')),
  ADD CONSTRAINT importacao_itens_registro_id_check
    CHECK (registro_id > 0),
  ADD CONSTRAINT importacao_itens_dados_anteriores_check
    CHECK (dados_anteriores IS NULL OR jsonb_typeof(dados_anteriores) = 'object'),
  ADD CONSTRAINT importacao_itens_dados_novos_check
    CHECK (jsonb_typeof(dados_novos) = 'object');

CREATE INDEX IF NOT EXISTS idx_importacoes_restaurante_criado
  ON public.importacoes (restaurante_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_importacoes_usuario_restaurante_fk
  ON public.importacoes (usuario_id, restaurante_id)
  WHERE usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_importacoes_revertido_usuario_restaurante_fk
  ON public.importacoes (revertido_por_usuario_id, restaurante_id)
  WHERE revertido_por_usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_importacao_itens_importacao_restaurante_fk
  ON public.importacao_itens (importacao_id, restaurante_id);

CREATE INDEX IF NOT EXISTS idx_importacao_itens_restaurante_registro
  ON public.importacao_itens (restaurante_id, entidade, registro_id);

ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacao_itens ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.importacoes, public.importacao_itens
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE
  public.importacoes_id_seq,
  public.importacao_itens_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.importacoes, public.importacao_itens
TO service_role;

GRANT ALL PRIVILEGES ON SEQUENCE
  public.importacoes_id_seq,
  public.importacao_itens_id_seq
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.importacoes, public.importacao_itens
TO autenix_backend;

GRANT USAGE, SELECT, UPDATE ON SEQUENCE
  public.importacoes_id_seq,
  public.importacao_itens_id_seq
TO autenix_backend;

DROP POLICY IF EXISTS importacoes_backend_crud ON public.importacoes;
CREATE POLICY importacoes_backend_crud
  ON public.importacoes FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(
      (SELECT current_setting('app.restaurante_id', true)), ''
    )::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(
      (SELECT current_setting('app.restaurante_id', true)), ''
    )::INTEGER
  );

DROP POLICY IF EXISTS importacao_itens_backend_crud ON public.importacao_itens;
CREATE POLICY importacao_itens_backend_crud
  ON public.importacao_itens FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(
      (SELECT current_setting('app.restaurante_id', true)), ''
    )::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(
      (SELECT current_setting('app.restaurante_id', true)), ''
    )::INTEGER
  );
