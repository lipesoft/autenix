DO $backfill$
DECLARE
  restaurante_padrao_id INTEGER;
BEGIN
  SELECT id
  INTO restaurante_padrao_id
  FROM public.restaurantes
  WHERE slug = 'autenix';

  IF restaurante_padrao_id IS NULL THEN
    RAISE EXCEPTION 'Restaurante padrao autenix nao encontrado';
  END IF;

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

ALTER TABLE public.usuarios ALTER COLUMN restaurante_id SET NOT NULL;
ALTER TABLE public.categorias ALTER COLUMN restaurante_id SET NOT NULL;
ALTER TABLE public.produtos ALTER COLUMN restaurante_id SET NOT NULL;
ALTER TABLE public.mesas ALTER COLUMN restaurante_id SET NOT NULL;
ALTER TABLE public.pedidos ALTER COLUMN restaurante_id SET NOT NULL;
ALTER TABLE public.itens_pedido ALTER COLUMN restaurante_id SET NOT NULL;
ALTER TABLE public.chamadas ALTER COLUMN restaurante_id SET NOT NULL;
ALTER TABLE public.configuracoes ALTER COLUMN restaurante_id SET NOT NULL;

ALTER TABLE public.configuracoes
  DROP CONSTRAINT IF EXISTS configuracoes_pkey;
ALTER TABLE public.configuracoes
  ADD CONSTRAINT configuracoes_pkey
  PRIMARY KEY (restaurante_id, chave);

DROP POLICY IF EXISTS usuarios_backend_crud ON public.usuarios;
CREATE POLICY usuarios_backend_crud
  ON public.usuarios FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  );

DROP POLICY IF EXISTS categorias_backend_crud ON public.categorias;
CREATE POLICY categorias_backend_crud
  ON public.categorias FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  );

DROP POLICY IF EXISTS produtos_backend_crud ON public.produtos;
CREATE POLICY produtos_backend_crud
  ON public.produtos FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  );

DROP POLICY IF EXISTS mesas_backend_crud ON public.mesas;
CREATE POLICY mesas_backend_crud
  ON public.mesas FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  );

DROP POLICY IF EXISTS pedidos_backend_crud ON public.pedidos;
CREATE POLICY pedidos_backend_crud
  ON public.pedidos FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  );

DROP POLICY IF EXISTS itens_pedido_backend_crud ON public.itens_pedido;
CREATE POLICY itens_pedido_backend_crud
  ON public.itens_pedido FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  );

DROP POLICY IF EXISTS chamadas_backend_crud ON public.chamadas;
CREATE POLICY chamadas_backend_crud
  ON public.chamadas FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  );

DROP POLICY IF EXISTS configuracoes_backend_crud ON public.configuracoes;
CREATE POLICY configuracoes_backend_crud
  ON public.configuracoes FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(current_setting('app.restaurante_id', true), '')::INTEGER
  );
