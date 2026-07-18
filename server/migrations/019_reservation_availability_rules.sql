CREATE TABLE IF NOT EXISTS public.reservas_configuracoes (
  restaurante_id INTEGER PRIMARY KEY,
  ativo INTEGER NOT NULL DEFAULT 1,
  dias_semana JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
  hora_inicio TIME NOT NULL DEFAULT '18:00',
  hora_fim TIME NOT NULL DEFAULT '23:00',
  intervalo_minutos INTEGER NOT NULL DEFAULT 30,
  duracao_minutos INTEGER NOT NULL DEFAULT 90,
  antecedencia_minutos INTEGER NOT NULL DEFAULT 60,
  horizonte_dias INTEGER NOT NULL DEFAULT 30,
  limite_reservas_horario INTEGER NOT NULL DEFAULT 0,
  limite_pessoas_horario INTEGER NOT NULL DEFAULT 0,
  permitir_fila INTEGER NOT NULL DEFAULT 1,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.reservas_saloes (
  id SERIAL PRIMARY KEY,
  restaurante_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  capacidade_pessoas INTEGER NOT NULL DEFAULT 40,
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS salao_id INTEGER;

INSERT INTO public.reservas_configuracoes (restaurante_id)
SELECT r.id
FROM public.restaurantes r
ON CONFLICT (restaurante_id) DO NOTHING;

INSERT INTO public.reservas_saloes (restaurante_id, nome, capacidade_pessoas, ativo, ordem)
SELECT
  r.id,
  'Salão principal',
  GREATEST(COUNT(m.id)::integer * 4, 20),
  1,
  1
FROM public.restaurantes r
LEFT JOIN public.mesas m ON m.restaurante_id = r.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.reservas_saloes s WHERE s.restaurante_id = r.id
)
GROUP BY r.id;

UPDATE public.reservas r
SET salao_id = s.id
FROM public.reservas_saloes s
WHERE s.restaurante_id = r.restaurante_id
  AND s.ordem = (
    SELECT MIN(s2.ordem)
    FROM public.reservas_saloes s2
    WHERE s2.restaurante_id = r.restaurante_id
  )
  AND r.salao_id IS NULL;

ALTER TABLE public.reservas_configuracoes
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_restaurante_id_fkey,
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_ativo_check,
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_permitir_fila_check,
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_dias_semana_check,
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_intervalo_check,
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_duracao_check,
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_antecedencia_check,
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_horizonte_check,
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_limites_check,
  DROP CONSTRAINT IF EXISTS reservas_configuracoes_horario_check;

ALTER TABLE public.reservas_configuracoes
  ADD CONSTRAINT reservas_configuracoes_restaurante_id_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT reservas_configuracoes_ativo_check
    CHECK (ativo IN (0, 1)),
  ADD CONSTRAINT reservas_configuracoes_permitir_fila_check
    CHECK (permitir_fila IN (0, 1)),
  ADD CONSTRAINT reservas_configuracoes_dias_semana_check
    CHECK (jsonb_typeof(dias_semana) = 'array' AND jsonb_array_length(dias_semana) BETWEEN 1 AND 7),
  ADD CONSTRAINT reservas_configuracoes_intervalo_check
    CHECK (intervalo_minutos BETWEEN 15 AND 240),
  ADD CONSTRAINT reservas_configuracoes_duracao_check
    CHECK (duracao_minutos BETWEEN 15 AND 360),
  ADD CONSTRAINT reservas_configuracoes_antecedencia_check
    CHECK (antecedencia_minutos BETWEEN 0 AND 10080),
  ADD CONSTRAINT reservas_configuracoes_horizonte_check
    CHECK (horizonte_dias BETWEEN 1 AND 365),
  ADD CONSTRAINT reservas_configuracoes_limites_check
    CHECK (limite_reservas_horario >= 0 AND limite_pessoas_horario >= 0),
  ADD CONSTRAINT reservas_configuracoes_horario_check
    CHECK (hora_fim > hora_inicio);

ALTER TABLE public.reservas_saloes
  DROP CONSTRAINT IF EXISTS reservas_saloes_restaurante_id_fkey,
  DROP CONSTRAINT IF EXISTS reservas_saloes_id_restaurante_key,
  DROP CONSTRAINT IF EXISTS reservas_saloes_restaurante_nome_key,
  DROP CONSTRAINT IF EXISTS reservas_saloes_nome_tamanho_check,
  DROP CONSTRAINT IF EXISTS reservas_saloes_capacidade_check,
  DROP CONSTRAINT IF EXISTS reservas_saloes_ativo_check,
  DROP CONSTRAINT IF EXISTS reservas_saloes_ordem_check;

ALTER TABLE public.reservas_saloes
  ADD CONSTRAINT reservas_saloes_restaurante_id_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT reservas_saloes_id_restaurante_key UNIQUE (id, restaurante_id),
  ADD CONSTRAINT reservas_saloes_restaurante_nome_key UNIQUE (restaurante_id, nome),
  ADD CONSTRAINT reservas_saloes_nome_tamanho_check
    CHECK (char_length(nome) BETWEEN 2 AND 80),
  ADD CONSTRAINT reservas_saloes_capacidade_check
    CHECK (capacidade_pessoas BETWEEN 1 AND 5000),
  ADD CONSTRAINT reservas_saloes_ativo_check
    CHECK (ativo IN (0, 1)),
  ADD CONSTRAINT reservas_saloes_ordem_check
    CHECK (ordem BETWEEN 0 AND 9999);

ALTER TABLE public.reservas
  DROP CONSTRAINT IF EXISTS reservas_salao_restaurante_fkey;

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_salao_restaurante_fkey
    FOREIGN KEY (salao_id, restaurante_id)
    REFERENCES public.reservas_saloes(id, restaurante_id) ON DELETE SET NULL (salao_id);

CREATE INDEX IF NOT EXISTS idx_reservas_saloes_restaurante_ativo_ordem
  ON public.reservas_saloes (restaurante_id, ativo, ordem);

CREATE INDEX IF NOT EXISTS idx_reservas_restaurante_salao_data_horario
  ON public.reservas (restaurante_id, salao_id, data_reserva, horario)
  WHERE salao_id IS NOT NULL;

ALTER TABLE public.reservas_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_saloes ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.reservas_configuracoes, public.reservas_saloes
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.reservas_saloes_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.reservas_configuracoes, public.reservas_saloes TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.reservas_saloes_id_seq TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservas_configuracoes, public.reservas_saloes TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.reservas_saloes_id_seq TO autenix_backend;

DROP POLICY IF EXISTS reservas_configuracoes_backend_crud ON public.reservas_configuracoes;
CREATE POLICY reservas_configuracoes_backend_crud
  ON public.reservas_configuracoes FOR ALL TO autenix_backend
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

DROP POLICY IF EXISTS reservas_saloes_backend_crud ON public.reservas_saloes;
CREATE POLICY reservas_saloes_backend_crud
  ON public.reservas_saloes FOR ALL TO autenix_backend
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
