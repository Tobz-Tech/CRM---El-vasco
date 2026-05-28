"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encriptar } from "@/lib/encryption";

/**
 * Server actions para la pantalla de Configuración.
 */

export async function actualizarTokenMP(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const tokenLimpio = token.trim();
  if (!tokenLimpio) {
    return { ok: false as const, error: "El token no puede estar vacío." };
  }

  // Validar el token contra la API de MP antes de guardarlo.
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${tokenLimpio}` },
    });
    if (!r.ok) {
      return { ok: false as const, error: `Token rechazado por Mercado Pago (HTTP ${r.status}). Revisalo.` };
    }
    const me = (await r.json()) as { id?: number };

    const encrypted = encriptar(tokenLimpio);
    const { error } = await supabase
      .from("config")
      .update({
        mp_access_token_encrypted: encrypted,
        mp_collector_id: me.id ? String(me.id) : null,
      })
      .eq("singleton", true);

    if (error) return { ok: false as const, error: error.message };

    revalidatePath("/configuracion");
    return { ok: true as const, collectorId: me.id };
  } catch (err) {
    return { ok: false as const, error: `No se pudo validar el token: ${(err as Error).message}` };
  }
}

export async function actualizarFrecuenciaSync(minutos: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 60) {
    return { ok: false as const, error: "La frecuencia debe ser entre 1 y 60 minutos." };
  }

  const { error } = await supabase
    .from("config")
    .update({ frecuencia_sync_min: minutos })
    .eq("singleton", true);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/configuracion");
  return { ok: true as const };
}
