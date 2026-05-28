import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizarCuit } from "@/lib/utils";

/**
 * Endpoint para crear un cliente desde el modal de asignación.
 * Usamos esta API route (en vez del server action) porque el server action hace
 * redirect() al perfil del cliente, y eso no funciona desde un fetch interno.
 */

const Schema = z.object({
  nombre: z.string().trim().min(1),
  apellido: z.string().trim().optional().nullable(),
  cuit_cuil: z.string().trim().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  telefono: z.string().trim().optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  localidad: z.string().trim().optional().nullable(),
  provincia: z.string().trim().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

  const fd = await request.formData();
  const raw: Record<string, any> = {};
  for (const [k, v] of fd.entries()) raw[k] = typeof v === "string" ? v.trim() : null;
  if (raw.cuit_cuil) raw.cuit_cuil = normalizarCuit(raw.cuit_cuil);
  for (const k of Object.keys(raw)) if (raw[k] === "") raw[k] = null;

  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "Ya existe un cliente con ese CUIT/CUIL." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data!.id });
}
