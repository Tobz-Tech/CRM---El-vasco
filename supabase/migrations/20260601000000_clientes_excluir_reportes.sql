-- Agrega flag para excluir clientes de los reportes (Excel/CSV).
alter table public.clientes
  add column if not exists excluir_de_reportes boolean not null default false;

create index if not exists idx_clientes_excluir_de_reportes
  on public.clientes (excluir_de_reportes);

-- Marcar la familia Maidana como excluida.
update public.clientes
  set excluir_de_reportes = true
  where cuit_cuil in (
    '20407689780',  -- Camilo
    '23450344079',  -- Tobías
    '20203514965'   -- Gustavo
  );

-- Y a Joaquin por nombre (no tenemos CUIT).
update public.clientes
  set excluir_de_reportes = true
  where lower(nombre || ' ' || coalesce(apellido, ''))
    like '%joaquin%maidana%bernardi%';
