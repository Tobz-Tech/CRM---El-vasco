import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  COLUMNAS_REPORTE_MOVIMIENTOS,
  generarCsvReporte,
  generarExcelReporte,
  type FormatoExport,
} from "@/lib/excel";
import {
  formatearFecha,
  nombreEstado,
  nombreTipoOperacion,
} from "@/lib/utils";

/**
 * GET /api/reportes/movimientos
 *
 * Query params:
 *   - desde       (ISO date, opcional)
 *   - hasta       (ISO date, opcional)
 *   - cliente     (uuid, opcional)
 *   - tipo        (money_transfer | regular_payment | recurring_payment, opcional)
 *   - estado      (approved | pending | rejected | etc, opcional)
 *   - asignacion  (todos | sin_asignar | asignados, opcional)
 *   - q           (texto libre: monto, email, CUIT, descripción)
 *   - formato     (xlsx | csv, default xlsx)
 *
 * Devuelve el archivo descargable. Los filtros son los mismos que los de la
 * pantalla de Cobranzas, así que la descarga respeta lo que ves en pantalla.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const clienteId = searchParams.get("cliente");
  const tipo = searchParams.get("tipo");
  const estado = searchParams.get("estado");
  const asignacion = searchParams.get("asignacion");
  const qTexto = searchParams.get("q");
  const formato = (searchParams.get("formato") ?? "xlsx") as FormatoExport;

  if (formato !== "xlsx" && formato !== "csv") {
    return NextResponse.json(
      { ok: false, error: "Formato inválido (xlsx o csv)" },
      { status: 400 }
    );
  }

  // Query a la base de datos. Aplica los mismos filtros que la pantalla.
  let query = supabase
    .from("movimientos")
    .select(
      `id, mp_payment_id, monto, neto_recibido, fecha_creacion, estado, tipo_operacion,
       descripcion, direccion, comision_mp,
       pagador_email, pagador_doc_numero, pagador_nombre, pagador_apellido,
       asignado_automaticamente,
       cliente:clientes(nombre, apellido, cuit_cuil)`
    )
    .order("fecha_creacion", { ascending: false })
    .limit(50000);

  if (desde) query = query.gte("fecha_creacion", new Date(desde).toISOString());
  if (hasta) {
    const h = new Date(hasta);
    h.setHours(23, 59, 59, 999);
    query = query.lte("fecha_creacion", h.toISOString());
  }
  if (clienteId) query = query.eq("cliente_id", clienteId);
  if (tipo && tipo !== "todos") query = query.eq("tipo_operacion", tipo);
  if (estado && estado !== "todos") query = query.eq("estado", estado);
  if (asignacion === "sin_asignar") query = query.is("cliente_id", null).eq("direccion", "entrada");
  if (asignacion === "asignados") query = query.not("cliente_id", "is", null);
  if (qTexto) {
    const term = qTexto.trim();
    if (term) {
      const filtros: string[] = [];
      const num = Number(term);
      if (!Number.isNaN(num)) filtros.push(`monto.eq.${num}`);
      filtros.push(`pagador_email.ilike.%${term}%`);
      filtros.push(`pagador_doc_numero.ilike.%${term}%`);
      filtros.push(`descripcion.ilike.%${term}%`);
      query = query.or(filtros.join(","));
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Mapear filas al formato del reporte.
  const filas = (data ?? []).map((m: any) => ({
    fecha: formatearFecha(m.fecha_creacion),
    mp_payment_id: m.mp_payment_id,
    tipo: nombreTipoOperacion(m.tipo_operacion),
    direccion: m.direccion === "entrada" ? "Entrada" : "Salida",
    monto: Number(m.monto ?? 0),
    neto: m.neto_recibido != null ? Number(m.neto_recibido) : null,
    comision: Number(m.comision_mp ?? 0),
    estado: nombreEstado(m.estado),
    descripcion: m.descripcion ?? "",
    pagador_nombre: [m.pagador_nombre, m.pagador_apellido].filter(Boolean).join(" "),
    pagador_email: m.pagador_email ?? "",
    pagador_cuit: m.pagador_doc_numero ?? "",
    cliente_nombre: m.cliente
      ? [m.cliente.nombre, m.cliente.apellido].filter(Boolean).join(" ")
      : "",
    cliente_cuit: m.cliente?.cuit_cuil ?? "",
    asignado_auto: m.asignado_automaticamente ? "Sí" : "No",
  }));

  // Nombre del archivo.
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `cobranzas-${stamp}.${formato}`;

  if (formato === "csv") {
    const csv = generarCsvReporte(filas);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // XLSX
  const buf = await generarExcelReporte(filas);
  // Aclaración: no marcamos las columnas para tipescript pero las usamos.
  void COLUMNAS_REPORTE_MOVIMIENTOS;
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buf.byteLength),
    },
  });
}
