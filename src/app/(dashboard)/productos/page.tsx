import { createClient } from "@/lib/supabase/server";
import { ProductosContent } from "./productos-content";

export const dynamic = "force-dynamic";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactivos?: string }>;
}) {
  const { q, inactivos } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("productos").select("*").order("nombre", { ascending: true });
  if (!inactivos) query = query.eq("activo", true);
  if (q && q.trim()) query = query.ilike("nombre", `%${q.trim()}%`);

  const { data: productos } = await query.limit(1000);

  return (
    <ProductosContent
      productos={(productos ?? []) as any}
      q={q ?? ""}
      mostrarInactivos={!!inactivos}
    />
  );
}
