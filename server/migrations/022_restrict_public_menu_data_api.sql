-- Menu data is served by the tenant-aware backend, never directly by PostgREST.
REVOKE SELECT ON TABLE
  public.categorias,
  public.produtos
FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS categorias_public_read_active ON public.categorias;
DROP POLICY IF EXISTS produtos_public_read_active ON public.produtos;
