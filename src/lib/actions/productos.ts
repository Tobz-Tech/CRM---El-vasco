"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ProductoSchema = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre"),
  precio: z.number().min(0, "El precio no puede ser negativo"),
  activo: z.boolean(),
});

function parsearProducto(formData: FormData) {
  const precioRaw = String(formData.get("precio") ?? "").replace(",", ".");
  return {
    nombre: String(formData.get("nombre") ?? "").trim(),
    precio: Number(precioRaw || 0),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  };
}

export async function crearProducto(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const parsed = ProductoSchema.safeParse(parsearProducto(formData));
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { error } = await supabase
    .from("productos")
    .insert({ ...parsed.data, created_by: user.id });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/productos");
  return { ok: true as const };
}

export async function actualizarProducto(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const parsed = ProductoSchema.safeParse(parsearProducto(formData));
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { error } = await supabase.from("productos").update(parsed.data).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/productos");
  return { ok: true as const };
}

export async function borrarProducto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/productos");
  return { ok: true as const };
}
