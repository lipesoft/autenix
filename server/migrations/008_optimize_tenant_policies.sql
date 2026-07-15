DROP POLICY IF EXISTS usuarios_backend_crud ON public.usuarios;
CREATE POLICY usuarios_backend_crud
  ON public.usuarios FOR ALL TO autenix_backend
  USING (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  )
  WITH CHECK (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  );

DROP POLICY IF EXISTS categorias_backend_crud ON public.categorias;
CREATE POLICY categorias_backend_crud
  ON public.categorias FOR ALL TO autenix_backend
  USING (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  )
  WITH CHECK (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  );

DROP POLICY IF EXISTS produtos_backend_crud ON public.produtos;
CREATE POLICY produtos_backend_crud
  ON public.produtos FOR ALL TO autenix_backend
  USING (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  )
  WITH CHECK (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  );

DROP POLICY IF EXISTS mesas_backend_crud ON public.mesas;
CREATE POLICY mesas_backend_crud
  ON public.mesas FOR ALL TO autenix_backend
  USING (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  )
  WITH CHECK (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  );

DROP POLICY IF EXISTS pedidos_backend_crud ON public.pedidos;
CREATE POLICY pedidos_backend_crud
  ON public.pedidos FOR ALL TO autenix_backend
  USING (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  )
  WITH CHECK (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  );

DROP POLICY IF EXISTS itens_pedido_backend_crud ON public.itens_pedido;
CREATE POLICY itens_pedido_backend_crud
  ON public.itens_pedido FOR ALL TO autenix_backend
  USING (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  )
  WITH CHECK (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  );

DROP POLICY IF EXISTS chamadas_backend_crud ON public.chamadas;
CREATE POLICY chamadas_backend_crud
  ON public.chamadas FOR ALL TO autenix_backend
  USING (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  )
  WITH CHECK (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  );

DROP POLICY IF EXISTS configuracoes_backend_crud ON public.configuracoes;
CREATE POLICY configuracoes_backend_crud
  ON public.configuracoes FOR ALL TO autenix_backend
  USING (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  )
  WITH CHECK (
    restaurante_id = (
      SELECT NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
    )
  );
