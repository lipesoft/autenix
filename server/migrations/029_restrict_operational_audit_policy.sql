DROP POLICY IF EXISTS auditoria_operacional_backend_read_insert
ON public.auditoria_operacional;

DROP POLICY IF EXISTS auditoria_operacional_backend_select
ON public.auditoria_operacional;

DROP POLICY IF EXISTS auditoria_operacional_backend_insert
ON public.auditoria_operacional;

CREATE POLICY auditoria_operacional_backend_select
  ON public.auditoria_operacional FOR SELECT TO autenix_backend
  USING (
    restaurante_id = NULLIF(
      (SELECT current_setting('app.restaurante_id', true)), ''
    )::INTEGER
  );

CREATE POLICY auditoria_operacional_backend_insert
  ON public.auditoria_operacional FOR INSERT TO autenix_backend
  WITH CHECK (
    restaurante_id = NULLIF(
      (SELECT current_setting('app.restaurante_id', true)), ''
    )::INTEGER
  );
