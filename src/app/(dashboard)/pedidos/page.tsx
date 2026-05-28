import { createClient } from "@/lib/supabase/server";
import { PedidosContent } from "./pedidos-content";

export const dynamic = "force-dynamic";

interface SearchParams {
  pagina?: string;
  desde?: string;
  hasta?: string;
  cliente?: string;
  q?: string;
  [key: string]: string | undefined;
}

const POR_PAGINA = 25;

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, parseInt(params.pagina ?? "1", 10) || 1);
  const offset = (pagina - 1) * POR_PAGINA;

  const supabase = await createClient();

  let query = supabase
    .from("pedidos")
    .select(
      `id, fecha, nota, total,
       cliente:clientes(id, nombre, apellido, cuit_cuil),
       pedido_items(id, descripcion, cantidad)`,
      { count: "exact" }
    )
    .order("fecha", { ascending: false })
    .range(offset, offset + POR_PAGINA - 1);

  if (params.desde) query = query.gte("fecha", new Date(params.desde).toISOString());
  if (params.hasta) {
    const h = new Date(params.hasta);
    h.setHours(23, 59, 59, 999);
    query = query.lte("fecha", h.toISOString());
  }
  if (params.cliente) query = query.eq("cliente_id", params.cliente);
  if (params.q && params.q.trim()) {
    query = query.ilike("nota", `%${params.q.trim()}%`);
  }

  const { data: pedidos, count, error } = await query;

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nombre, apellido, cuit_cuil")
    .order("nombre")
    .limit(2000);

  const { data: productos } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  return (
    <PedidosContent
      pedidos={(pedidos ?? []) as any}
      total={count ?? 0}
      pagina={pagina}
      porPagina={POR_PAGINA}
      filtros={params}
      clientes={(clientes ?? []) as any}
      productos={(productos ?? []) as any}
      error={error?.message ?? null}
    />
  );
}
