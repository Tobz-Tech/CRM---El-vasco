-- =============================================================================
-- Migración: Productos, Pedidos y Estado de cuenta
-- =============================================================================
-- Agrega:
--   - tabla productos (catálogo)
--   - tabla pedidos (cabecera)
--   - tabla pedido_items (detalle, con producto_id nullable para items sueltos)
--   - trigger que recalcula pedidos.total a partir de los items
--   - actualiza cliente_totales y clientes_con_totales para incluir consumido y saldo
-- =============================================================================

-- =============================================================================
-- TABLA: productos
-- =============================================================================
create table if not exists public.productos (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  precio      numeric(14, 2) not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists idx_productos_activo  on public.productos (activo);
create index if not exists idx_productos_nombre  on public.productos using gin (to_tsvector('spanish', nombre));

drop trigger if exists productos_set_updated_at on public.productos;
create trigger productos_set_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

alter table public.productos enable row level security;
drop policy if exists "productos_all_authenticated" on public.productos;
create policy "productos_all_authenticated" on public.productos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

comment on table public.productos is 'Catálogo de productos con sus precios actuales.';

-- =============================================================================
-- TABLA: pedidos
-- =============================================================================
create table if not exists public.pedidos (
  id          uuid primary key default uuid_generate_v4(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  fecha       timestamptz not null default now(),
  nota        text,
  total       numeric(14, 2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists idx_pedidos_cliente_id on public.pedidos (cliente_id);
create index if not exists idx_pedidos_fecha      on public.pedidos (fecha desc);

drop trigger if exists pedidos_set_updated_at on public.pedidos;
create trigger pedidos_set_updated_at
  before update on public.pedidos
  for each row execute function public.set_updated_at();

alter table public.pedidos enable row level security;
drop policy if exists "pedidos_all_authenticated" on public.pedidos;
create policy "pedidos_all_authenticated" on public.pedidos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

comment on table public.pedidos is 'Cabecera de pedido. Total se recalcula via trigger cuando cambian los items.';

-- =============================================================================
-- TABLA: pedido_items
-- =============================================================================
create table if not exists public.pedido_items (
  id              uuid primary key default uuid_generate_v4(),
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  producto_id     uuid references public.productos(id) on delete set null,
  descripcion     text not null,
  cantidad        numeric(14, 3) not null default 1,
  precio_unitario numeric(14, 2) not null default 0,
  subtotal        numeric(14, 2) generated always as (cantidad * precio_unitario) stored,
  created_at      timestamptz not null default now()
);

create index if not exists idx_pedido_items_pedido_id   on public.pedido_items (pedido_id);
create index if not exists idx_pedido_items_producto_id on public.pedido_items (producto_id);

alter table public.pedido_items enable row level security;
drop policy if exists "pedido_items_all_authenticated" on public.pedido_items;
create policy "pedido_items_all_authenticated" on public.pedido_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

comment on table public.pedido_items is 'Detalle del pedido. producto_id puede ser null para items sueltos (descripción libre).';

-- =============================================================================
-- TRIGGER: recalcular total del pedido cuando cambian sus items
-- =============================================================================
create or replace function public.recalcular_total_pedido()
returns trigger
language plpgsql
as $$
declare
  v_pedido_id uuid;
begin
  if tg_op = 'DELETE' then
    v_pedido_id := old.pedido_id;
  else
    v_pedido_id := new.pedido_id;
  end if;

  update public.pedidos
    set total = coalesce((select sum(subtotal) from public.pedido_items where pedido_id = v_pedido_id), 0)
    where id = v_pedido_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists pedido_items_recalc_total on public.pedido_items;
create trigger pedido_items_recalc_total
  after insert or update or delete on public.pedido_items
  for each row execute function public.recalcular_total_pedido();

-- =============================================================================
-- Actualizar cliente_totales para incluir consumido + saldo
-- =============================================================================
-- Postgres no permite cambiar el return type de una función existente con
-- create or replace, así que primero dropeamos la vista (que la usa) y la función.
drop view if exists public.clientes_con_totales;
drop function if exists public.cliente_totales(uuid);

create or replace function public.cliente_totales(p_cliente_id uuid)
returns table (
  total_recibido_historico numeric,
  total_recibido_hoy       numeric,
  total_recibido_semana    numeric,
  total_recibido_mes       numeric,
  ultimo_pago_fecha        timestamptz,
  ultimo_pago_monto        numeric,
  cantidad_movimientos     integer,
  total_consumido          numeric,
  total_consumido_mes      numeric,
  cantidad_pedidos         integer,
  ultimo_pedido_fecha      timestamptz,
  saldo                    numeric
)
language sql
stable
as $$
  with pagos as (
    select
      coalesce(sum(m.monto) filter (where m.direccion = 'entrada' and m.estado = 'approved'), 0)                                                                                                          as total_recibido_historico,
      coalesce(sum(m.monto) filter (where m.direccion = 'entrada' and m.estado = 'approved' and m.fecha_creacion >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')), 0)            as total_recibido_hoy,
      coalesce(sum(m.monto) filter (where m.direccion = 'entrada' and m.estado = 'approved' and m.fecha_creacion >= date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')), 0)           as total_recibido_semana,
      coalesce(sum(m.monto) filter (where m.direccion = 'entrada' and m.estado = 'approved' and m.fecha_creacion >= date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')), 0)          as total_recibido_mes,
      max(m.fecha_creacion) filter (where m.direccion = 'entrada' and m.estado = 'approved')                                                                                                             as ultimo_pago_fecha,
      (array_agg(m.monto order by m.fecha_creacion desc) filter (where m.direccion = 'entrada' and m.estado = 'approved'))[1]                                                                            as ultimo_pago_monto,
      (count(*) filter (where m.direccion = 'entrada' and m.estado = 'approved'))::int                                                                                                                   as cantidad_movimientos
    from public.movimientos m
    where m.cliente_id = p_cliente_id
  ),
  consumido as (
    select
      coalesce(sum(p.total), 0)                                                                                                                                                                          as total_consumido,
      coalesce(sum(p.total) filter (where p.fecha >= date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')), 0)                                                                       as total_consumido_mes,
      count(*)::int                                                                                                                                                                                      as cantidad_pedidos,
      max(p.fecha)                                                                                                                                                                                       as ultimo_pedido_fecha
    from public.pedidos p
    where p.cliente_id = p_cliente_id
  )
  select
    pa.total_recibido_historico,
    pa.total_recibido_hoy,
    pa.total_recibido_semana,
    pa.total_recibido_mes,
    pa.ultimo_pago_fecha,
    pa.ultimo_pago_monto,
    pa.cantidad_movimientos,
    co.total_consumido,
    co.total_consumido_mes,
    co.cantidad_pedidos,
    co.ultimo_pedido_fecha,
    (co.total_consumido - pa.total_recibido_historico) as saldo
  from pagos pa cross join consumido co;
$$;

-- Recrear la vista para que use los nuevos campos.
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
