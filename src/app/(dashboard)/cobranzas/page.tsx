import { createClient } from "@/lib/supabase/server";
import { CobranzasContent } from "./cobranzas-content";

export const dynamic = "force-dynamic";

interface SearchParams {
  pagina?: string;
  desde?: string;
  hasta?: string;
  tipo?: string;
  estado?: string;
  asignacion?: string; // "todos" | "sin_asignar" | "asignados"
  cliente?: string;
  q?: string;
  [key: string]: string | undefined;
}

const POR_PAGINA = 25;

export default async function CobranzasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, parseInt(params.pagina ?? "1", 10) || 1);
  const offset = (pagina - 1) * POR_PAGINA;

  const supabase = await createClient();

  // Query base: movimientos con datos del cliente vinculado.
  let query = supabase
    .from("movimientos")
    .select(
      `id, mp_payment_id, monto, neto_recibido, fecha_creacion, estado, tipo_operacion,
       descripcion, direccion, pagador_email, pagador_doc_numero, pagador_nombre,
       pagador_apellido, cliente_id, asignado_automaticamente,
       cliente:clientes(id, nombre, apellido, cuit_cuil)`,
      { count: "exact" }
    )
    .order("fecha_creacion", { ascending: false })
    .range(offset, offset + POR_PAGINA - 1);

  if (params.desde) query = query.gte("fecha_creacion", new Date(params.desde).toISOString());
  if (params.hasta) {
    const h = new Date(params.hasta);
    h.setHours(23, 59, 59, 999);
    query = query.lte("fecha_creacion", h.toISOString());
  }
  if (params.tipo && params.tipo !== "todos") query = query.eq("tipo_operacion", params.tipo);
  if (params.estado && params.estado !== "todos") query = query.eq("estado", params.estado);
  if (params.asignacion === "sin_asignar") query = query.is("cliente_id", null).eq("direccion", "entrada");
  if (params.asignacion === "asignados") query = query.not("cliente_id", "is", null);
  if (params.cliente) query = query.eq("cliente_id", params.cliente);
  if (params.q) {
    const q = params.q.trim();
    const filtros: string[] = [];
    const num = Number(q);
    if (!Number.isNaN(num)) filtros.push(`monto.eq.${num}`);
    filtros.push(`pagador_email.ilike.%${q}%`);
    filtros.push(`pagador_doc_numero.ilike.%${q}%`);
    filtros.push(`descripcion.ilike.%${q}%`);
    query = query.or(filtros.join(","));
  }

  const { data: movimientos, count, error } = await query;

  // Lista corta de clientes para el modal de asignación.
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nombre, apellido, cuit_cuil")
    .order("nombre")
    .limit(500);

  // Última sincronización.
  const { data: cfgData } = await supabase
    .from("config")
    .select("ultima_sincronizacion")
    .eq("singleton", true)
    .single();
  const cfg = cfgData as { ultima_sincronizacion: string | null } | null;

  return (
    <CobranzasContent
      movimientos={(movimientos ?? []) as any}
      total={count ?? 0}
      pagina={pagina}
      porPagina={POR_PAGINA}
      filtros={params}
      clientes={(clientes ?? []) as any}
      ultimaSync={cfg?.ultima_sincronizacion ?? null}
      error={error?.message ?? null}
    />
  );
}
