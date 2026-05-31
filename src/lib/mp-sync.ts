/**
 * Lógica de sincronización con Mercado Pago.
 *
 * Pasos:
 *   1) Leer config (token, collector_id, ultima_sincronizacion).
 *   2) Llamar a /v1/payments/search desde (ultima_sincronizacion - 10min) hasta ahora,
 *      paginando hasta tener todos.
 *   3) Filtrar:
 *        - tipo_operacion = 'partition_transfer'  → descartar
 *        - collector_id != cuenta del negocio     → descartar
 *   4) Mapear cada pago al schema de la tabla `movimientos`.
 *   5) Upsert por mp_payment_id.
 *   6) Para los entrantes con CUIT, intentar matchear con un cliente y autoasignar.
 *   7) Actualizar config.ultima_sincronizacion y dejar entry en sync_logs.
 *
 * Esta función es agnóstica del trigger: la usa tanto la API route /api/sync como
 * el server action sincronizarAhora().
 */

import { buscarPagosTodasLasPaginas, obtenerMiCuenta, type MPPaymentRaw } from "@/lib/mercadopago";
import { desencriptar } from "@/lib/encryption";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizarCuit } from "@/lib/utils";
import type { Database } from "@/types/database";

export interface ResultadoSync {
  movimientos_nuevos: number;
  movimientos_actualizados: number;
  asignados_auto: number;
  rango_desde: string;
  rango_hasta: string;
}

interface OpcionesSync {
  disparadoPor: "cron" | "manual";
}

const OVERLAP_MIN = 10;        // Solapamos 10 min con la última sincronización para no perder nada.
const PRIMERA_CORRIDA_DIAS = 60; // En la primera sincronización, traemos los últimos 60 días.

export async function sincronizarMP(opts: OpcionesSync): Promise<ResultadoSync> {
  // Marker de versión para confirmar qué código está corriendo en producción.
  // Si vemos "VERSION_MARKER_v3" en error_mensaje, el código nuevo está vivo.
  const VERSION_MARKER = "VERSION_MARKER_v3";
  console.log(`[sincronizarMP] ${VERSION_MARKER} - Iniciando sync ${opts.disparadoPor}`);

  const admin = createAdminClient();

  // 1) Crear entry en sync_logs (estado 'corriendo'). Inicializamos error_mensaje
  // con el marker para que sepamos sí o sí qué versión corrió.
  const { data: logRow, error: logErr } = await admin
    .from("sync_logs")
    .insert({
      estado: "corriendo",
      disparado_por: opts.disparadoPor,
      error_mensaje: VERSION_MARKER,
    })
    .select("id")
    .single();
  if (logErr) throw new Error(`No pude crear sync_log: ${logErr.message}`);
  const logId = logRow!.id;

  const finalizarLog = async (
    estado: "exito" | "error",
    extra: Partial<Database["public"]["Tables"]["sync_logs"]["Update"]>
  ) => {
    // Construimos el objeto de update explícitamente para evitar que algún
    // bundler / type cast filtre campos en silencio.
    const updateObj: Record<string, unknown> = {
      estado,
      finalizado_en: new Date().toISOString(),
    };
    for (const k of Object.keys(extra)) {
      updateObj[k] = (extra as Record<string, unknown>)[k];
    }
    // Cast a any para evitar que el tipo Partial filtre el error_mensaje.
    await admin
      .from("sync_logs")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updateObj as any)
      .eq("id", logId);
  };

  try {
    // 2) Leer config.
    const { data: cfg, error: cfgErr } = await admin
      .from("config")
      .select("*")
      .eq("singleton", true)
      .single();
    if (cfgErr) throw new Error(`No pude leer config: ${cfgErr.message}`);

    // 3) Resolver access token. Prioridad: DB > env.
    let accessToken: string | null = null;
    if (cfg?.mp_access_token_encrypted) {
      try {
        accessToken = desencriptar(cfg.mp_access_token_encrypted);
      } catch (e) {
        throw new Error(`No pude desencriptar el token guardado: ${(e as Error).message}`);
      }
    }
    if (!accessToken) accessToken = process.env.MP_ACCESS_TOKEN ?? null;
    if (!accessToken) {
      throw new Error(
        "No hay access token de MP configurado. Configuralo en /configuracion o seteá MP_ACCESS_TOKEN."
      );
    }

    // 4) Resolver collector_id. Prioridad: DB > env > autodetectar.
    let collectorId: string | null =
      cfg?.mp_collector_id || process.env.MP_COLLECTOR_ID || null;
    if (!collectorId) {
      const me = await obtenerMiCuenta(accessToken);
      collectorId = String(me.id);
      await admin.from("config").update({ mp_collector_id: collectorId }).eq("singleton", true);
    }

    // 5) Calcular rango de fechas.
    const ahora = new Date();
    let desde: Date;
    if (cfg?.ultima_sincronizacion) {
      desde = new Date(new Date(cfg.ultima_sincronizacion).getTime() - OVERLAP_MIN * 60 * 1000);
    } else {
      desde = new Date(ahora.getTime() - PRIMERA_CORRIDA_DIAS * 24 * 60 * 60 * 1000);
    }

    // 6) Llamar a MP.
    const pagos = await buscarPagosTodasLasPaginas({
      accessToken,
      beginDate: desde,
      endDate: ahora,
    });

    // 7) Filtrar.
    const filtrados = pagos.filter((p) => {
      if (p.operation_type === "partition_transfer") return false;
      if (collectorId && p.collector_id && String(p.collector_id) !== collectorId) return false;
      return true;
    });

    // NOTA: ya NO hacemos early return cuando filtrados.length === 0.
    // Aunque MP no traiga movimientos nuevos, igual queremos correr el matcheo
    // retroactivo (asignar a cliente movimientos viejos que matchean por CUIT
    // con clientes nuevos). Por eso seguimos hasta el final de la función.

    // 8) Saber cuáles ya existen para diferenciar nuevos vs actualizados.
    const ids = filtrados.map((p) => p.id);
    let setExistentes = new Set<number>();
    if (ids.length > 0) {
      const { data: existentes } = await admin
        .from("movimientos")
        .select("mp_payment_id")
        .in("mp_payment_id", ids);
      setExistentes = new Set((existentes ?? []).map((m) => m.mp_payment_id));
    }

    // 9) Pre-cargar clientes con CUIT para matcheo automático.
    // Traemos TODOS los clientes con CUIT y normalizamos en JS para evitar
    // mismatches por formato (con/sin guiones).
    const cuitsAMatchear = new Set<string>();
    for (const p of filtrados) {
      const cuit = normalizarCuit(p.payer?.identification?.number ?? "");
      if (cuit) cuitsAMatchear.add(cuit);
    }
    const mapaClientesPorCuit = new Map<string, string>();
    if (cuitsAMatchear.size > 0) {
      const { data: clientesMatch } = await admin
        .from("clientes")
        .select("id, cuit_cuil")
        .not("cuit_cuil", "is", null);
      for (const c of clientesMatch ?? []) {
        if (!c.cuit_cuil) continue;
        const norm = normalizarCuit(c.cuit_cuil);
        if (norm && cuitsAMatchear.has(norm)) {
          mapaClientesPorCuit.set(norm, c.id);
        }
      }
    }

    // 10) Armar filas.
    let asignadosAuto = 0;
    const filas = filtrados.map((p) => {
      const direccion: "entrada" | "salida" =
        collectorId && p.collector_id && String(p.collector_id) === collectorId ? "entrada" : "salida";

      const cuit = normalizarCuit(p.payer?.identification?.number ?? "");
      let clienteId: string | null = null;
      let autoAsignado = false;
      if (direccion === "entrada" && cuit && mapaClientesPorCuit.has(cuit) && !setExistentes.has(p.id)) {
        clienteId = mapaClientesPorCuit.get(cuit) ?? null;
        autoAsignado = !!clienteId;
        if (autoAsignado) asignadosAuto += 1;
      }

      const feeTotal = (p.fee_details ?? []).reduce(
        (acc, f) => acc + (typeof f.amount === "number" ? f.amount : 0),
        0
      );

      return {
        mp_payment_id: p.id,
        monto: p.transaction_amount ?? 0,
        neto_recibido: p.transaction_details?.net_received_amount ?? null,
        moneda: p.currency_id ?? "ARS",
        fecha_creacion: p.date_created ?? new Date().toISOString(),
        fecha_aprobacion: p.date_approved ?? null,
        estado: p.status ?? null,
        estado_detalle: p.status_detail ?? null,
        tipo_operacion: p.operation_type ?? null,
        tipo_pago: p.payment_type_id ?? null,
        metodo_pago: p.payment_method_id ?? null,
        descripcion: p.description ?? null,
        referencia_externa: p.external_reference ?? null,
        direccion,
        comision_mp: feeTotal,
        pagador_email: p.payer?.email ?? null,
        pagador_mp_id: p.payer?.id ? String(p.payer.id) : null,
        pagador_doc_tipo: p.payer?.identification?.type ?? null,
        pagador_doc_numero: cuit || null,
        pagador_nombre: p.payer?.first_name ?? null,
        pagador_apellido: p.payer?.last_name ?? null,
        pagador_telefono: armarTelefono(p.payer?.phone),
        ip_pagador: p.additional_info?.ip_address ?? null,
        provincia: p.point_of_interaction?.location?.state_id ?? null,
        canal: null,
        subcanal: null,
        cliente_id: clienteId,
        asignado_automaticamente: autoAsignado,
        raw_data: p as unknown,
      };
    });

    // 11) Upsert por mp_payment_id.
    //
    // IMPORTANTE: usamos `ignoreDuplicates: false` para que actualice las filas existentes.
    // Pero NO queremos pisar cliente_id si el usuario ya asignó manualmente: el sync solo
    // setea cliente_id para movimientos NUEVOS. Para los que ya existen, hacemos un update
    // que excluye cliente_id y asignado_automaticamente.
    const nuevas = filas.filter((f) => !setExistentes.has(f.mp_payment_id));
    const aActualizar = filas.filter((f) => setExistentes.has(f.mp_payment_id));

    let movimientosNuevos = 0;
    let movimientosActualizados = 0;

    if (nuevas.length > 0) {
      const { error: insErr, count } = await admin
        .from("movimientos")
        .upsert(nuevas, { onConflict: "mp_payment_id", count: "exact" });
      if (insErr) throw new Error(`Insert movimientos: ${insErr.message}`);
      movimientosNuevos = count ?? nuevas.length;
    }

    if (aActualizar.length > 0) {
      // Actualizamos uno por uno para no pisar la asignación manual del usuario.
      for (const f of aActualizar) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { cliente_id: _ci, asignado_automaticamente: _aa, ...resto } = f;
        const { error: updErr } = await admin
          .from("movimientos")
          .update(resto)
          .eq("mp_payment_id", f.mp_payment_id);
        if (updErr) {
          // Log silencioso, no abortamos toda la sync por un error puntual.
          console.error("update movimiento error", f.mp_payment_id, updErr.message);
        } else {
          movimientosActualizados += 1;
        }
      }
    }

    // 11.5) Matcheo retroactivo:
    // Buscar TODOS los movimientos entrantes que están sin asignar y tienen CUIT.
    // Si alguno matchea con un cliente actual (porque el usuario lo creó o le agregó
    // el CUIT después de haber recibido el pago), lo asigna ahora.
    //
    // Estrategia: traemos TODO con queries simples (sin filtros complejos que pueden
    // fallar silenciosamente) y filtramos/normalizamos en JS.
    let asignadosRetroactivos = 0;
    let debugRetro = "";

    // 1) Traer todos los movimientos (solo los campos que necesitamos).
    const { data: todosMovs, error: errMovs } = await admin
      .from("movimientos")
      .select("id, pagador_doc_numero, cliente_id, direccion")
      .limit(50000);

    if (errMovs) {
      debugRetro = `errMovs: ${errMovs.message}`;
    } else {
      // 2) Filtrar en JS: solo entrantes sin asignar con CUIT.
      const movsRetro = (todosMovs ?? [])
        .filter((m) =>
          m.cliente_id === null &&
          m.direccion === "entrada" &&
          m.pagador_doc_numero
        )
        .map((m) => ({
          id: m.id as string,
          cuitNorm: normalizarCuit(m.pagador_doc_numero ?? ""),
        }))
        .filter((x) => x.cuitNorm);

      // 3) Traer todos los clientes (sin filtros que puedan fallar).
      const { data: todosClientes, error: errClientes } = await admin
        .from("clientes")
        .select("id, cuit_cuil");

      if (errClientes) {
        debugRetro = `errClientes: ${errClientes.message}`;
      } else {
        // 4) Mapa de CUIT normalizado -> cliente.id.
        const mapaRetro = new Map<string, string>();
        for (const c of todosClientes ?? []) {
          if (!c.cuit_cuil) continue;
          const norm = normalizarCuit(c.cuit_cuil);
          if (norm) mapaRetro.set(norm, c.id as string);
        }

        debugRetro = `movs_retro=${movsRetro.length}, clientes_con_cuit=${mapaRetro.size}`;

        // 5) Por cada mov, buscar match y actualizar.
        for (const m of movsRetro) {
          const clienteId = mapaRetro.get(m.cuitNorm);
          if (!clienteId) continue;
          // El .is("cliente_id", null) extra evita pisar si alguien lo asignó manualmente entremedio.
          const { error: retroErr } = await admin
            .from("movimientos")
            .update({ cliente_id: clienteId, asignado_automaticamente: true })
            .eq("id", m.id)
            .is("cliente_id", null);
          if (!retroErr) asignadosRetroactivos += 1;
        }

        debugRetro += `, asignados=${asignadosRetroactivos}`;
      }
    }

    // Sumamos los retroactivos al contador de auto, así aparece todo junto en los logs.
    const asignadosAutoTotal = asignadosAuto + asignadosRetroactivos;

    // 12) Actualizar ultima_sincronizacion.
    await admin
      .from("config")
      .update({ ultima_sincronizacion: ahora.toISOString() })
      .eq("singleton", true);

    await finalizarLog("exito", {
      movimientos_nuevos: movimientosNuevos,
      movimientos_actualizados: movimientosActualizados,
      asignados_auto: asignadosAutoTotal,
      rango_desde: desde.toISOString(),
      rango_hasta: ahora.toISOString(),
    });

    // Segunda update EXPLÍCITA solo de error_mensaje con la info de debug.
    // Hacemos esto separado por las dudas que algún cast filtre el campo.
    const debugFinal = `v4 | ${debugRetro || "sin-debug"} | asign_auto_total=${asignadosAutoTotal}`;
    await admin
      .from("sync_logs")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ error_mensaje: debugFinal } as any)
      .eq("id", logId);

    return {
      movimientos_nuevos: movimientosNuevos,
      movimientos_actualizados: movimientosActualizados,
      asignados_auto: asignadosAutoTotal,
      rango_desde: desde.toISOString(),
      rango_hasta: ahora.toISOString(),
    };
  } catch (err) {
    const mensaje = (err as Error).message ?? String(err);
    await finalizarLog("error", { error_mensaje: mensaje });
    throw err;
  }
}

function armarTelefono(phone: MPPaymentRaw["payer"] extends infer P ? (P extends { phone?: infer X } ? X : never) : never): string | null {
  if (!phone) return null;
  const { area_code, number } = phone as { area_code?: string | null; number?: string | null };
  if (!number) return null;
  return area_code ? `${area_code}${number}` : number;
}
// force rebuild 1780248196
// force-rebuild 1780248231
