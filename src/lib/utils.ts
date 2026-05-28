import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Helper para combinar clases de Tailwind sin conflictos.
 * Es el utility estándar que usa shadcn/ui.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como pesos argentinos.
 *   formatearMoneda(12345.67) => "$ 12.345,67"
 */
export function formatearMoneda(monto: number | string | null | undefined): string {
  if (monto === null || monto === undefined || monto === "") return "$ 0,00";
  const n = typeof monto === "string" ? Number(monto) : monto;
  if (Number.isNaN(n)) return "$ 0,00";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Formatea una fecha ISO a un string en español.
 *   formatearFecha("2026-05-28T10:30:00Z") => "28/05/2026 10:30"
 */
export function formatearFecha(iso: string | null | undefined, opts?: { soloFecha?: boolean }): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  if (opts?.soloFecha) {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(d);
  }
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

/**
 * Devuelve "hace 5 min", "hace 2 hs", "hace 3 días", etc.
 */
export function tiempoRelativo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const ahora = Date.now();
  const diff = ahora - d.getTime();
  const seg = Math.floor(diff / 1000);
  if (seg < 60) return "hace unos segundos";
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.floor(hs / 24);
  if (dias < 30) return `hace ${dias} d`;
  return formatearFecha(iso, { soloFecha: true });
}

/**
 * Helper para nombrar amigablemente los tipos de operación de MP.
 */
export function nombreTipoOperacion(tipo: string | null | undefined): string {
  switch (tipo) {
    case "money_transfer":
      return "Transferencia";
    case "regular_payment":
      return "Cobro QR/Tarjeta";
    case "recurring_payment":
      return "Pago recurrente";
    case "partition_transfer":
      return "Movimiento interno";
    default:
      return tipo ?? "—";
  }
}

/**
 * Helper para nombrar amigablemente los estados de MP.
 */
export function nombreEstado(estado: string | null | undefined): string {
  switch (estado) {
    case "approved":
      return "Aprobado";
    case "pending":
      return "Pendiente";
    case "in_process":
      return "En proceso";
    case "rejected":
      return "Rechazado";
    case "cancelled":
      return "Cancelado";
    case "refunded":
      return "Devuelto";
    case "charged_back":
      return "Contracargo";
    default:
      return estado ?? "—";
  }
}

/**
 * Color del badge para cada estado.
 */
export function colorEstado(estado: string | null | undefined): "verde" | "amarillo" | "rojo" | "gris" {
  switch (estado) {
    case "approved":
      return "verde";
    case "pending":
    case "in_process":
      return "amarillo";
    case "rejected":
    case "cancelled":
    case "charged_back":
      return "rojo";
    default:
      return "gris";
  }
}

/**
 * Limpia y normaliza un CUIT/CUIL: solo dígitos.
 */
export function normalizarCuit(cuit: string | null | undefined): string {
  if (!cuit) return "";
  return cuit.replace(/\D/g, "");
}

/**
 * Formatea un CUIT con guiones: 20-12345678-9
 */
export function formatearCuit(cuit: string | null | undefined): string {
  const n = normalizarCuit(cuit);
  if (n.length !== 11) return cuit ?? "";
  return `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`;
}
