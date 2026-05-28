import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { leerClientesDesdeExcel } from "@/lib/excel";
import { normalizarCuit } from "@/lib/utils";

/**
 * POST /api/clientes/importar
 *
 * Body: multipart/form-data con un campo "archivo" que es el .xlsx con los clientes.
 *
 * Reglas:
 *   - Solo "nombre" es obligatorio.
 *   - "cuit_cuil" se normaliza (sin guiones).
 *   - Si ya existe un cliente con ese cuit_cuil → se omite (no se duplica).
 *   - Devuelve un resumen.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const archivo = formData.get("archivo");
  if (!archivo || !(archivo instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No se recibió ningún archivo." },
      { status: 400 }
    );
  }

  const arrayBuf = await archivo.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  const { filas, errores } = await leerClientesDesdeExcel(buf);

  if (filas.length === 0) {
    return NextResponse.json({
      ok: true,
      total_filas: 0,
      creados: 0,
      omitidos_por_duplicado: 0,
      errores,
    });
  }

  // Normalizar CUITs.
  for (const f of filas) {
    if (f.cuit_cuil) f.cuit_cuil = normalizarCuit(f.cuit_cuil) || null;
  }

  // Pre-cargar CUITs ya existentes para detectar duplicados.
  const cuitsNuevos = filas.map((f) => f.cuit_cuil).filter((x): x is string => !!x);
  const existentes = new Set<string>();
  if (cuitsNuevos.length > 0) {
    const { data: ya } = await supabase
      .from("clientes")
      .select("cuit_cuil")
      .in("cuit_cuil", cuitsNuevos);
    (ya ?? []).forEach((r: any) => {
      if (r.cuit_cuil) existentes.add(r.cuit_cuil as string);
    });
  }

  // También evitar duplicados DENTRO del archivo (si el mismo CUIT aparece dos veces).
  const cuitsVistos = new Set<string>();
  const filasParaInsertar: any[] = [];
  let omitidos = 0;
  const erroresExtra: { fila: number; mensaje: string }[] = [];

  for (const f of filas) {
    if (f.cuit_cuil) {
      if (existentes.has(f.cuit_cuil)) { omitidos += 1; continue; }
      if (cuitsVistos.has(f.cuit_cuil)) { omitidos += 1; continue; }
      cuitsVistos.add(f.cuit_cuil);
    }

    // Validar email (si vino).
    if (f.email) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email);
      if (!emailOk) {
        erroresExtra.push({ fila: f.fila, mensaje: `Email inválido: "${f.email}"` });
        continue;
      }
    }

    filasParaInsertar.push({
      nombre: f.nombre,
      apellido: f.apellido,
      cuit_cuil: f.cuit_cuil,
      email: f.email,
      telefono: f.telefono,
      direccion: f.direccion,
      localidad: f.localidad,
      provincia: f.provincia,
      notas: f.notas,
      created_by: user.id,
    });
  }

  let creados = 0;
  if (filasParaInsertar.length > 0) {
    const { data: ins, error } = await supabase
      .from("clientes")
      .insert(filasParaInsertar)
      .select("id");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    creados = (ins ?? []).length;
  }

  return NextResponse.json({
    ok: true,
    total_filas: filas.length,
    creados,
    omitidos_por_duplicado: omitidos,
    errores: [...errores, ...erroresExtra],
  });
}
