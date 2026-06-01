import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { leerClientesDesdeExcel, leerClientesDesdeCsv } from "@/lib/excel";
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
 *
 * El handler está envuelto en try/catch global y SIEMPRE devuelve JSON, así
 * el cliente nunca recibe un body vacío.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // exceljs requiere Node runtime, no Edge.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
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

    // Validar que el archivo no sea gigante.
    if (archivo.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "El archivo es muy grande (máx 10MB)." },
        { status: 400 }
      );
    }
    if (archivo.size === 0) {
      return NextResponse.json(
        { ok: false, error: "El archivo está vacío." },
        { status: 400 }
      );
    }

    // Detectar si es CSV o XLSX para usar el parser correcto.
    const nombreArchivo = archivo.name.toLowerCase();
    const tipoMime = archivo.type ?? "";
    const esCsv = nombreArchivo.endsWith(".csv") || tipoMime.includes("csv");

    let filas: Awaited<ReturnType<typeof leerClientesDesdeExcel>>["filas"];
    let errores: Awaited<ReturnType<typeof leerClientesDesdeExcel>>["errores"];

    try {
      if (esCsv) {
        const texto = await archivo.text();
        const r = leerClientesDesdeCsv(texto);
        filas = r.filas;
        errores = r.errores;
      } else {
        const arrayBuf = await archivo.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const r = await leerClientesDesdeExcel(buf);
        filas = r.filas;
        errores = r.errores;
      }
    } catch (e) {
      console.error("[importar] error leyendo archivo:", e);
      return NextResponse.json(
        {
          ok: false,
          error: `No pude leer el archivo: ${(e as Error).message}. ` +
                 "Asegurate de subir un archivo .xlsx o .csv hecho a partir de la plantilla.",
        },
        { status: 400 }
      );
    }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ya ?? []).forEach((r: any) => {
        if (r.cuit_cuil) existentes.add(r.cuit_cuil as string);
      });
    }

    // También evitar duplicados DENTRO del archivo (si el mismo CUIT aparece dos veces).
    const cuitsVistos = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        nombre_local: f.nombre_local,
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
        console.error("[importar] error insertando clientes:", error);
        return NextResponse.json(
          { ok: false, error: `Error guardando en la base: ${error.message}` },
          { status: 500 }
        );
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
  } catch (err) {
    console.error("[importar] error fatal:", err);
    return NextResponse.json(
      {
        ok: false,
        error: `Error inesperado: ${(err as Error).message ?? String(err)}`,
      },
      { status: 500 }
    );
  }
}
