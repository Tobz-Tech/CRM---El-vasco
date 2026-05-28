/**
 * Cliente delgado para la API de Mercado Pago.
 *
 * Endpoint principal: GET /v1/payments/search
 *   - Filtra por rango de fecha de creación.
 *   - Soporta paginación con limit/offset (máximo 50 por página).
 *
 * Documentación: https://www.mercadopago.com.ar/developers/es/reference/payments/_payments_search/get
 */

const BASE_URL = "https://api.mercadopago.com";

export interface MPPaymentRaw {
  id: number;
  status?: string | null;
  status_detail?: string | null;
  operation_type?: string | null;
  payment_type_id?: string | null;
  payment_method_id?: string | null;
  date_created?: string | null;
  date_approved?: string | null;
  transaction_amount?: number | null;
  currency_id?: string | null;
  description?: string | null;
  external_reference?: string | null;
  collector_id?: number | null;
  payer?: {
    id?: string | number | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    identification?: { type?: string | null; number?: string | null } | null;
    phone?: { area_code?: string | null; number?: string | null } | null;
  } | null;
  transaction_details?: {
    net_received_amount?: number | null;
  } | null;
  fee_details?: Array<{ type?: string; amount?: number }> | null;
  charges_details?: Array<unknown> | null;
  additional_info?: { ip_address?: string | null } | null;
  point_of_interaction?: {
    location?: { state_id?: string | null } | null;
  } | null;
  // El resto lo guardamos en raw_data por las dudas.
  [k: string]: unknown;
}

export interface BuscarPagosOpts {
  accessToken: string;
  beginDate: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface BuscarPagosResp {
  paging: { total: number; limit: number; offset: number };
  results: MPPaymentRaw[];
}

export async function buscarPagos(opts: BuscarPagosOpts): Promise<BuscarPagosResp> {
  const url = new URL("/v1/payments/search", BASE_URL);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "asc");
  url.searchParams.set("range", "date_created");
  url.searchParams.set("begin_date", opts.beginDate.toISOString());
  url.searchParams.set("end_date", (opts.endDate ?? new Date()).toISOString());
  url.searchParams.set("limit", String(opts.limit ?? 50));
  url.searchParams.set("offset", String(opts.offset ?? 0));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      Accept: "application/json",
    },
    // No cachear en Next.js.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MP API ${res.status}: ${body.slice(0, 300)}`);
  }

  return (await res.json()) as BuscarPagosResp;
}

export async function buscarPagosTodasLasPaginas(opts: BuscarPagosOpts): Promise<MPPaymentRaw[]> {
  const limit = opts.limit ?? 50;
  let offset = opts.offset ?? 0;
  const todos: MPPaymentRaw[] = [];

  // Loop seguro: cortamos a 50 páginas (2500 pagos) por ciclo para no quedarnos colgados.
  for (let i = 0; i < 50; i++) {
    const page = await buscarPagos({ ...opts, limit, offset });
    todos.push(...page.results);
    if (!page.results.length || todos.length >= page.paging.total) break;
    offset += limit;
  }

  return todos;
}

/**
 * Devuelve los datos básicos de la cuenta dueña del access token.
 * Útil para detectar el collector_id automáticamente.
 */
export async function obtenerMiCuenta(accessToken: string): Promise<{ id: number; email?: string }> {
  const res = await fetch(`${BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`MP /users/me ${res.status}`);
  return (await res.json()) as { id: number; email?: string };
}
