"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizarCuit } from "@/lib/utils";

/**
 * Server actions para CRUD de clientes.
 * Todas devuelven { ok: true } o { ok: false, error: string }.
 * Las que crean/redirigen tiran redirect() al final (es la convención de Next).
 */

const ClienteSchema = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre"),
  apellido: z.string().trim().optional().nullable(),
  nombre_local: z.string().trim().optional().nullable(),
  cuit_cuil: z.string().trim().optional().nullable(),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")).nullable(),
  telefono: z.string().trim().optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  localidad: z.string().trim().optional().nullable(),
  provincia: z.string().trim().optional().nullable(),
  mp_payer_id: z.string().trim().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
});

function parsearFormData(formData: FormData) {
  const obj: Record<string, any> = {};
  for (const [k, v] of formData.entries()) {
    obj[k] = typeof v === "string" ? v : null;
  }
  // Normalizar CUIT (sacarle guiones).
  if (obj.cuit_cuil) obj.cuit_cuil = normalizarCuit(obj.cuit_cuil);
  // Pasar strings vacíos a null para que la unique de CUIT no choque.
  for (const k of Object.keys(obj)) {
    if (obj[k] === "") obj[k] = null;
  }
  return obj;
}

export async function crearCliente(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const parsed = ClienteSchema.safeParse(parsearFormData(formData));
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false as const, error: "Ya existe un cliente con ese CUIT/CUIL." };
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/clientes");
  revalidatePath("/cobranzas");
  redirect(`/clientes/${data.id}`);
}

export async function actualizarCliente(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const parsed = ClienteSchema.safeParse(parsearFormData(formData));
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { error } = await supabase.from("clientes").update(parsed.data).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false as const, error: "Ya existe otro cliente con ese CUIT/CUIL." };
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return { ok: true as const };
}

export async function borrarCliente(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/clientes");
  revalidatePath("/cobranzas");
  redirect("/clientes");
}
