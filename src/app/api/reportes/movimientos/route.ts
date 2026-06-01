import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  COLUMNAS_REPORTE_MOVIMIENTOS,
  generarCsvReporte,
  generarExcelReporte,
  generarCsvResumen,
  generarExcelResumen,
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
 *   - detallado   (true | false, default false)
 *                 - false → resumen por cliente con estado de cuenta
 *                 - true  → una fila por movimiento (modo viejo)
 *
 * Devuelve el archivo descargable.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
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
  const detallado = searchParams.get("detallado") === "true";

  if (formato !== "xlsx" && formato !== "csv") {
    return NextResponse.json(
      { ok: false, error: "Formato inválido (xlsx o csv)" },
      { status: 400 }
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);

  // =========================================================================
  // MODO RESUMEN (una fila por cliente)
  // =========================================================================
  if (!detallado) {
    // Traemos el estado de cuenta de cada cliente desde la vista.
    let query = supabase
      .from("clientes_con_totales")
      .select(
        "id, nombre, apellido, nombre_local, cuit_cuil, total_recibido_historico, total_consumido, saldo, cantidad_movimientos, cantidad_pedidos, ultimo_pago_fecha"
      )
      .order("nombre", { ascending: true });

    if (clienteId) query = query.eq("id", clienteId);

    const { data, error } = await query.limit(50000);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filas = (data ?? []).map((c: any) => {
      const saldo = Number(c.saldo ?? 0);
      const estadoCuenta = saldo > 0 ? "Debe" : saldo < 0 ? "A favor" : "Al día";
      return {
        cliente: [c.nombre, c.apellido].filter(Boolean).join(" "),
        local: c.nombre_local ?? "",
        cuit: c.cuit_cuil ?? "",
        pagado: Number(c.total_recibido_historico ?? 0),
        consumido: Number(c.total_consumido ?? 0),
        saldo: saldo,
        estado_cuenta: estadoCuenta,
        cant_pagos: c.cantidad_movimientos ?? 0,
        cant_pedidos: c.cantidad_pedidos ?? 0,
        ultimo_pago: c.ultimo_pago_fecha ? formatearFecha(c.ultimo_pago_fecha) : "",
      };
    });

    const filename = `estado-de-cuenta-${stamp}.${formato}`;

    if (formato === "csv") {
      const csv = generarCsvResumen(filas);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const buf = await generarExcelResumen(filas);
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.byteLength),
      },
    });
  }

  // =========================================================================
  // MODO DETALLADO (una fila por movimiento)
  // =========================================================================
  let query = supabase
    .from("movimientos")
    .select(
      `id, mp_payment_id, monto, neto_recibido, fecha_creacion, estado, tipo_operacion,
       descripcion, direccion, comision_mp,
       pagador_email, pagador_doc_numero, pagador_nombre, pagador_apellido,
       asignado_automaticamente,
       cliente:clientes(nombre, apellido, nombre_local, cuit_cuil)`
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    cliente_local: m.cliente?.nombre_local ?? "",
    cliente_cuit: m.cliente?.cuit_cuil ?? "",
    asignado_auto: m.asignado_automaticamente ? "Sí" : "No",
  }));

  const filename = `cobranzas-detallado-${stamp}.${formato}`;

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

  const buf = await generarExcelReporte(filas);
  void COLUMNAS_REPORTE_MOVIMIENTOS;
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buf.byteLength),
    },
  });
}
