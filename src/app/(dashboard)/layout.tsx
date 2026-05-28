import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

/**
 * Layout del dashboard. Wrappa todas las páginas privadas.
 * - Verifica que el usuario esté logueado (doble check del middleware).
 * - Trae la cantidad de cobros sin asignar para mostrarla en el sidebar.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Contar cobros entrantes sin asignar (solo aprobados).
  const { count } = await supabase
    .from("movimientos")
    .select("id", { count: "exact", head: true })
    .is("cliente_id", null)
    .eq("direccion", "entrada")
    .eq("estado", "approved");

  return (
    <div className="md:flex min-h-screen bg-slate-50">
      <Sidebar cobrosSinAsignar={count ?? 0} emailUsuario={user.email ?? ""} />
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
