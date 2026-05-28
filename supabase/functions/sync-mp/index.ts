// Edge Function de Supabase: sincroniza pagos de MP cada vez que se invoca.
//
// Se puede triggerear de dos formas:
//   1) Cron de Supabase (pg_cron) que llama esta función cada N minutos.
//      Ver supabase/functions/sync-mp/README.md (debajo) para el SQL del cron.
//   2) HTTP POST manual:
//      curl -X POST <URL_FUNCION> -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
//
// Variables de entorno que tiene que tener seteadas en Supabase:
//   - SUPABASE_URL                  (ya viene)
//   - SUPABASE_SERVICE_ROLE_KEY     (ya viene)
//   - MP_ACCESS_TOKEN               (opcional si está guardado en config)
//   - ENCRYPTION_KEY                (la misma que en la app Next.js, para desencriptar el token)

// @ts-ignore Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const BASE_URL = "https://api.mercadopago.com";
const OVERLAP_MIN = 10;
const PRIMERA_CORRIDA_DIAS = 60;

// =============================================================================
// Helpers
// =============================================================================

function normalizarCuit(cuit: string | null | undefined): string {
  if (!cuit) return "";
  return cuit.replace(/\D/g, "");
}

async function obtenerKey(): Promise<CryptoKey> {
  // @ts-ignore Deno global
  const raw = Deno.env.get("ENCRYPTION_KEY");
  if (!raw) throw new Error("Falta ENCRYPTION_KEY");
  const enc = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function desencriptar(payload: string): Promise<string> {
  const key = await obtenerKey();
  const [ivB64, tagB64, ctB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Payload encriptado inválido");
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const tag = Uint8Array.from(atob(tagB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct);
  combined.set(tag, ct.length);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  return new TextDecoder().decode(plain);
}

async function buscarPagosTodasLasPaginas(
  token: string,
  beginDate: Date,
  endDate: Date
): Promise<any[]> {
  const limit = 50;
  let offset = 0;
  const todos: any[] = [];
  for (let i = 0; i < 50; i++) {
    const url = new URL("/v1/payments/search", BASE_URL);
    url.searchParams.set("sort", "date_created");
    url.searchParams.set("criteria", "asc");
    url.searchParams.set("range", "date_created");
    url.searchParams.set("begin_date", beginDate.toISOString());
    url.searchParams.set("end_date", endDate.toISOString());
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`MP ${res.status}: ${await res.text()}`);
    const body = await res.json();
    todos.push(...(body.results ?? []));
    if (!body.results?.length || todos.length >= body.paging?.total) break;
    offset += limit;
  }
  return todos;
}

// =============================================================================
// Handler
// =============================================================================

// @ts-ignore Deno serve
Deno.serve(async (req: Request) => {
  // @ts-ignore Deno env
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Crear log
  const { data: logRow } = await supabase
    .from("sync_logs")
    .insert({ estado: "corriendo", disparado_por: "cron" })
    .select("id")
    .single();
  const logId = logRow?.id;

  async function finalizarLog(estado: "exito" | "error", extra: Record<string, unknown> = {}) {
    if (!logId) return;
    await supabase
      .from("sync_logs")
      .update({ estado, finalizado_en: new Date().toISOString(), ...extra })
      .eq("id", logId);
  }

  try {
    const { data: cfg } = await supabase.from("config").select("*").eq("singleton", true).single();

    // Token: DB > env
    let token: string | null = null;
    if (cfg?.mp_access_token_encrypted) {
      token = await desencriptar(cfg.mp_access_token_encrypted);
    }
    // @ts-ignore
    if (!token) token = Deno.env.get("MP_ACCESS_TOKEN") ?? null;
    if (!token) throw new Error("Falta access token de MP");

    // Collector ID
    // @ts-ignore
    let collectorId = cfg?.mp_collector_id || Deno.env.get("MP_COLLECTOR_ID") || null;
    if (!collectorId) {
      const r = await fetch(`${BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const me = await r.json();
        collectorId = String(me.id);
        await supabase.from("config").update({ mp_collector_id: collectorId }).eq("singleton", true);
      }
    }

    // Rango
    const ahora = new Date();
    let desde: Date;
    if (cfg?.ultima_sincronizacion) {
      desde = new Date(new Date(cfg.ultima_sincronizacion).getTime() - OVERLAP_MIN * 60 * 1000);
    } else {
      desde = new Date(ahora.getTime() - PRIMERA_CORRIDA_DIAS * 24 * 60 * 60 * 1000);
    }

    const pagos = await buscarPagosTodasLasPaginas(token, desde, ahora);
    const filtrados = pagos.filter((p: any) => {
      if (p.operation_type === "partition_transfer") return false;
      if (collectorId && p.collector_id && String(p.collector_id) !== collectorId) return false;
      return true;
    });

    // Existentes
    const ids = filtrados.map((p: any) => p.id);
    const setExistentes = new Set<number>();
    if (ids.length > 0) {
      const { data: exist } = await supabase
        .from("movimientos")
        .select("mp_payment_id")
        .in("mp_payment_id", ids);
      (exist ?? []).forEach((r: any) => setExistentes.add(r.mp_payment_id));
    }

    // Matcheo automático por CUIT
    const cuits = new Set<string>();
    for (const p of filtrados) {
      const c = normalizarCuit(p.payer?.identification?.number);
      if (c) cuits.add(c);
    }
    const mapaClientes = new Map<string, string>();
    if (cuits.size > 0) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("id, cuit_cuil")
        .in("cuit_cuil", Array.from(cuits));
      (cli ?? []).forEach((r: any) => {
        if (r.cuit_cuil) mapaClientes.set(r.cuit_cuil, r.id);
      });
    }

    let asignadosAuto = 0;
    const filas = filtrados.map((p: any) => {
      const direccion = collectorId && String(p.collector_id) === collectorId ? "entrada" : "salida";
      const cuit = normalizarCuit(p.payer?.identification?.number);
      let cliente_id: string | null = null;
      let autoAsign = false;
      if (direccion === "entrada" && cuit && mapaClientes.has(cuit) && !setExistentes.has(p.id)) {
        cliente_id = mapaClientes.get(cuit) ?? null;
        autoAsign = !!cliente_id;
        if (autoAsign) asignadosAuto += 1;
      }
      const feeTotal = (p.fee_details ?? []).reduce((a: number, f: any) => a + (typeof f.amount === "number" ? f.amount : 0), 0);
      const phone = p.payer?.phone;
      const tel = phone?.number ? `${phone.area_code ?? ""}${phone.number}` : null;
      return {
        mp_payment_id: p.id,
        monto: p.transaction_amount ?? 0,
        neto_recibido: p.transaction_details?.net_received_amount ?? null,
        moneda: p.currency_id ?? "ARS",
        fecha_creacion: p.date_created,
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
        pagador_telefono: tel,
        ip_pagador: p.additional_info?.ip_address ?? null,
        provincia: p.point_of_interaction?.location?.state_id ?? null,
        canal: null,
        subcanal: null,
        cliente_id,
        asignado_automaticamente: autoAsign,
        raw_data: p,
      };
    });

    const nuevas = filas.filter((f: any) => !setExistentes.has(f.mp_payment_id));
    const aActualizar = filas.filter((f: any) => setExistentes.has(f.mp_payment_id));

    let movimientosNuevos = 0;
    let movimientosActualizados = 0;

    if (nuevas.length > 0) {
      const { error, count } = await supabase
        .from("movimientos")
        .upsert(nuevas, { onConflict: "mp_payment_id", count: "exact" });
      if (error) throw new Error(`Insert: ${error.message}`);
      movimientosNuevos = count ?? nuevas.length;
    }

    for (const f of aActualizar) {
      const { cliente_id: _, asignado_automaticamente: __, ...resto } = f;
      const { error } = await supabase.from("movimientos").update(resto).eq("mp_payment_id", f.mp_payment_id);
      if (!error) movimientosActualizados += 1;
    }

    // Matcheo retroactivo: movimientos entrantes sin asignar con CUIT que
    // ahora matchean con un cliente.
    let asignadosRetroactivos = 0;
    const { data: sinAsignar } = await supabase
      .from("movimientos")
      .select("id, pagador_doc_numero")
      .is("cliente_id", null)
      .eq("direccion", "entrada")
      .not("pagador_doc_numero", "is", null)
      .limit(10000);

    if (sinAsignar && sinAsignar.length > 0) {
      const cuitsRetro = Array.from(
        new Set((sinAsignar as any[]).map((m) => m.pagador_doc_numero).filter(Boolean))
      );
      if (cuitsRetro.length > 0) {
        const { data: clientesRetro } = await supabase
          .from("clientes")
          .select("id, cuit_cuil")
          .in("cuit_cuil", cuitsRetro);
        const mapaRetro = new Map<string, string>();
        (clientesRetro ?? []).forEach((c: any) => {
          if (c.cuit_cuil) mapaRetro.set(c.cuit_cuil, c.id);
        });
        for (const m of (sinAsignar as any[])) {
          if (!m.pagador_doc_numero) continue;
          const clienteId = mapaRetro.get(m.pagador_doc_numero);
          if (!clienteId) continue;
          const { error: retroErr } = await supabase
            .from("movimientos")
            .update({ cliente_id: clienteId, asignado_automaticamente: true })
            .eq("id", m.id)
            .is("cliente_id", null);
          if (!retroErr) asignadosRetroactivos += 1;
        }
      }
    }

    asignadosAuto += asignadosRetroactivos;

    await supabase
      .from("config")
      .update({ ultima_sincronizacion: ahora.toISOString() })
      .eq("singleton", true);

    await finalizarLog("exito", {
      movimientos_nuevos: movimientosNuevos,
      movimientos_actualizados: movimientosActualizados,
      asignados_auto: asignadosAuto,
      rango_desde: desde.toISOString(),
      rango_hasta: ahora.toISOString(),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        movimientos_nuevos: movimientosNuevos,
        movimientos_actualizados: movimientosActualizados,
        asignados_auto: asignadosAuto,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    await finalizarLog("error", { error_mensaje: msg });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
