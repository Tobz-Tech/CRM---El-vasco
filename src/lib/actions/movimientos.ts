"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Server actions para movimientos.
 * Solo permitimos asignar/desasignar cliente. La inserción la hace el sync.
 */

export async function asignarMovimientoACliente(movimientoId: string, clienteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const { error } = await supabase
    .from("movimientos")
    .update({ cliente_id: clienteId, asignado_automaticamente: false })
    .eq("id", movimientoId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/cobranzas");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true as const };
}

export async function desasignarMovimiento(movimientoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  // Traer el cliente actual antes de borrar la referencia, para revalidar su perfil.
  const { data: mov } = await supabase
    .from("movimientos")
    .select("cliente_id")
    .eq("id", movimientoId)
    .single();

  const { error } = await supabase
    .from("movimientos")
    .update({ cliente_id: null, asignado_automaticamente: false })
    .eq("id", movimientoId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/cobranzas");
  if (mov?.cliente_id) revalidatePath(`/clientes/${mov.cliente_id}`);
  return { ok: true as const };
}
