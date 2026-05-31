-- =============================================================================
-- Migración: agregar nombre_local a clientes
-- =============================================================================

alter table public.clientes
  add column if not exists nombre_local text;

create index if not exists idx_clientes_nombre_local
  on public.clientes (nombre_local);

-- Recreamos la vista para que también exponga el nuevo campo.
drop view if exists public.clientes_con_totales;
create or replace view public.clientes_con_totales
with (security_invoker = true) as
  select
    c.*,
    coalesce(t.total_recibido_historico, 0)  as total_recibido_historico,
    t.ultimo_pago_fecha,
    t.ultimo_pago_monto,
    coalesce(t.cantidad_movimientos, 0)      as cantidad_movimientos,
    coalesce(t.total_consumido, 0)           as total_consumido,
    coalesce(t.cantidad_pedidos, 0)          as cantidad_pedidos,
    t.ultimo_pedido_fecha,
    coalesce(t.saldo, 0)                     as saldo
  from public.clientes c
  left join lateral public.cliente_totales(c.id) t on true;

grant select on public.clientes_con_totales to authenticated;
