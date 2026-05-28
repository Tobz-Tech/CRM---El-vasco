"use server";

import { revalidatePath } from "next/cache";
import { sincronizarMP } from "@/lib/mp-sync";

/**
 * Server action para forzar una sincronización desde el botón "Sincronizar ahora".
 */
export async function sincronizarAhora() {
  try {
    const resultado = await sincronizarMP({ disparadoPor: "manual" });
    revalidatePath("/cobranzas");
    revalidatePath("/configuracion");
    return { ok: true as const, ...resultado };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
