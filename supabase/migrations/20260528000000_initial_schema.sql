-- =============================================================================
-- Migración inicial - MP Cobranzas
-- =============================================================================
-- Esta migración crea las tablas necesarias para la app:
--   - clientes:    el CRM de tu papá
--   - movimientos: los pagos/transferencias traídos de Mercado Pago
--   - config:      configuración global (token de MP, último sync, frecuencia)
--   - sync_logs:   bitácora de cada sincronización para depurar
--
-- También configura:
--   - Row Level Security (RLS): solo usuarios logueados pueden leer/escribir
--   - Triggers de updated_at
--   - Índices para que las búsquedas y filtros vuelen
-- =============================================================================

-- Extensiones que necesitamos.
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- TABLA: clientes
-- =============================================================================
create table if not exists public.clientes (
  id            uuid primary key default uuid_generate_v4(),
  nombre        text not null,
  apellido      text,
  cuit_cuil     text unique,
  email         text,
  telefono      text,
  direccion     text,
  localidad     text,
  provincia     text,
  mp_payer_id   text,
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

create index if not exists idx_clientes_cuit_cuil    on public.clientes (cuit_cuil);
create index if not exists idx_clientes_email        on public.clientes (email);
create index if not exists idx_clientes_mp_payer_id  on public.clientes (mp_payer_id);
create index if not exists idx_clientes_nombre_busq  on public.clientes using gin (to_tsvector('spanish', coalesce(nombre,'') || ' ' || coalesce(apellido,'')));

comment on table public.clientes is 'Clientes del negocio. Cada uno puede tener cero o más movimientos asignados.';

-- =============================================================================
-- TABLA: movimientos
-- =============================================================================
create table if not exists public.movimientos (
  id                         uuid primary key default uuid_generate_v4(),
  mp_payment_id              bigint unique not null,
  monto                      numeric(14, 2) not null,
  neto_recibido              numeric(14, 2),
  moneda                     text not null default 'ARS',
  fecha_creacion             timestamptz not null,
  fecha_aprobacion           timestamptz,
  estado                     text,
  estado_detalle             text,
  tipo_operacion             text,
  tipo_pago                  text,
  metodo_pago                text,
  descripcion                text,
  referencia_externa         text,
  direccion                  text not null check (direccion in ('entrada','salida')),
  comision_mp                numeric(14, 2) not null default 0,
  pagador_email              text,
  pagador_mp_id              text,
  pagador_doc_tipo           text,
  pagador_doc_numero         text,
  pagador_nombre             text,
  pagador_apellido           text,
  pagador_telefono           text,
  ip_pagador                 text,
  provincia                  text,
  canal                      text,
  subcanal                   text,
  cliente_id                 uuid references public.clientes(id) on delete set null,
  asignado_automaticamente   boolean not null default false,
  raw_data                   jsonb,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists idx_movimientos_fecha_creacion   on public.movimientos (fecha_creacion desc);
create index if not exists idx_movimientos_tipo_operacion   on public.movimientos (tipo_operacion);
create index if not exists idx_movimientos_direccion        on public.movimientos (direccion);
create index if not exists idx_movimientos_cliente_id       on public.movimientos (cliente_id);
create index if not exists idx_movimientos_pagador_doc      on public.movimientos (pagador_doc_numero);
create index if not exists idx_movimientos_pagador_mp_id    on public.movimientos (pagador_mp_id);
create index if not exists idx_movimientos_no_asignados     on public.movimientos (created_at desc) where cliente_id is null and direccion = 'entrada';
create index if not exists idx_movimientos_estado           on public.movimientos (estado);

comment on table public.movimientos is 'Pagos y transferencias sincronizadas desde Mercado Pago. Unicidad por mp_payment_id evita duplicados.';

-- =============================================================================
-- TABLA: config
-- =============================================================================
-- Solo tendrá UNA fila. Usamos un check para asegurar eso.
create table if not exists public.config (
  id                         uuid primary key default uuid_generate_v4(),
  singleton                  boolean not null default true,
  mp_access_token_encrypted  text,
  mp_collector_id            text,
  frecuencia_sync_min        integer not null default 5,
  ultima_sincronizacion      timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint config_singleton_unique unique (singleton),
  constraint config_singleton_true check (singleton = true)
);

-- Insertar la única fila si no existe.
insert into public.config (singleton, frecuencia_sync_min)
values (true, 5)
on conflict do nothing;

comment on table public.config is 'Configuración global. Una sola fila. Guarda token de MP encriptado y metadata de sync.';

-- =============================================================================
-- TABLA: sync_logs
-- =============================================================================
create table if not exists public.sync_logs (
  id                       uuid primary key default uuid_generate_v4(),
  iniciado_en              timestamptz not null default now(),
  finalizado_en            timestamptz,
  estado                   text not null default 'corriendo' check (estado in ('corriendo','exito','error')),
  movimientos_nuevos       integer not null default 0,
  movimientos_actualizados integer not null default 0,
  asignados_auto           integer not null default 0,
  error_mensaje            text,
  rango_desde              timestamptz,
  rango_hasta              timestamptz,
  disparado_por            text not null default 'cron' check (disparado_por in ('cron','manual'))
);

create index if not exists idx_sync_logs_iniciado_en on public.sync_logs (iniciado_en desc);

comment on table public.sync_logs is 'Bitácora de cada corrida de sincronización con MP.';

-- =============================================================================
-- Trigger: actualizar updated_at en cada UPDATE
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clientes_set_updated_at on public.clientes;
create trigger clientes_set_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

drop trigger if exists movimientos_set_updated_at on public.movimientos;
create trigger movimientos_set_updated_at
  before update on public.movimientos
  for each row execute function public.set_updated_at();

drop trigger if exists config_set_updated_at on public.config;
create trigger config_set_updated_at
  before update on public.config
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Activamos RLS en todas las tablas. Solo usuarios autenticados pueden leer/escribir.
-- Como somos solo tu papá y vos (creados a mano en Supabase Auth), con esto alcanza.

alter table public.clientes    enable row level security;
alter table public.movimientos enable row level security;
alter table public.config      enable row level security;
alter table public.sync_logs   enable row level security;

-- CLIENTES: cualquier usuario autenticado puede CRUD.
drop policy if exists "clientes_all_authenticated" on public.clientes;
create policy "clientes_all_authenticated" on public.clientes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- MOVIMIENTOS: cualquier usuario autenticado puede leer y actualizar (asignar cliente).
-- Insert solo desde el backend (service role) - los movimientos los crea el sync.
drop policy if exists "movimientos_select_authenticated" on public.movimientos;
create policy "movimientos_select_authenticated" on public.movimientos
  for select using (auth.role() = 'authenticated');

drop policy if exists "movimientos_update_authenticated" on public.movimientos;
create policy "movimientos_update_authenticated" on public.movimientos
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- CONFIG: lectura/update authenticated.
drop policy if exists "config_all_authenticated" on public.config;
create policy "config_all_authenticated" on public.config
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- SYNC_LOGS: lectura authenticated. Inserts solo desde service role.
drop policy if exists "sync_logs_select_authenticated" on public.sync_logs;
create policy "sync_logs_select_authenticated" on public.sync_logs
  for select using (auth.role() = 'authenticated');

-- =============================================================================
-- Función helper: totales de un cliente
-- =============================================================================
create or replace function public.cliente_totales(p_cliente_id uuid)
returns table (
  total_recibido_historico numeric,
  total_recibido_hoy       numeric,
  total_recibido_semana    numeric,
  total_recibido_mes       numeric,
  ultimo_pago_fecha        timestamptz,
  ultimo_pago_monto        numeric,
  cantidad_movimientos     integer
)
language sql
stable
as $$
  select
    coalesce(sum(m.monto) filter (where m.direccion = 'entrada' and m.estado = 'approved'), 0)                                                                                  as total_recibido_historico,
    coalesce(sum(m.monto) filter (where m.direccion = 'entrada' and m.estado = 'approved' and m.fecha_creacion >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')), 0)            as total_recibido_hoy,
    coalesce(sum(m.monto) filter (where m.direccion = 'entrada' and m.estado = 'approved' and m.fecha_creacion >= date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')), 0)           as total_recibido_semana,
    coalesce(sum(m.monto) filter (where m.direccion = 'entrada' and m.estado = 'approved' and m.fecha_creacion >= date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')), 0)          as total_recibido_mes,
    max(m.fecha_creacion) filter (where m.direccion = 'entrada' and m.estado = 'approved')                                                                                     as ultimo_pago_fecha,
    (array_agg(m.monto order by m.fecha_creacion desc) filter (where m.direccion = 'entrada' and m.estado = 'approved'))[1]                                                    as ultimo_pago_monto,
    count(*)::int filter (where m.direccion = 'entrada' and m.estado = 'approved')                                                                                             as cantidad_movimientos
  from public.movimientos m
  where m.cliente_id = p_cliente_id;
$$;

-- =============================================================================
-- Vista: lista de clientes con sus totales
-- =============================================================================
-- IMPORTANTE: security_invoker = true para que la vista respete las RLS
-- del usuario que la consulta (y no las del creador de la vista).
create or replace view public.clientes_con_totales
with (security_invoker = true) as
  select
    c.*,
    coalesce(t.total_recibido_historico, 0)  as total_recibido_historico,
    t.ultimo_pago_fecha,
    t.ultimo_pago_monto,
    coalesce(t.cantidad_movimientos, 0)      as cantidad_movimientos
  from public.clientes c
  left join lateral public.cliente_totales(c.id) t on true;

-- Permisos: dejamos que los usuarios autenticados lean la vista.
grant select on public.clientes_con_totales to authenticated;

-- =============================================================================
-- FIN
-- =============================================================================
