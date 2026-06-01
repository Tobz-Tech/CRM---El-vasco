/**
 * Helpers para generar y leer archivos Excel/CSV.
 *
 * Usa exceljs server-side. No importarlo desde un Client Component.
 */

import ExcelJS from "exceljs";

// =============================================================================
// Tipos
// =============================================================================

export type FormatoExport = "xlsx" | "csv";

export interface ColumnaReporte {
  header: string;
  key: string;
  width?: number;
}

// =============================================================================
// REPORTE DE MOVIMIENTOS (write)
// =============================================================================

export const COLUMNAS_REPORTE_MOVIMIENTOS: ColumnaReporte[] = [
  { header: "Fecha", key: "fecha", width: 20 },
  { header: "ID Mercado Pago", key: "mp_payment_id", width: 18 },
  { header: "Tipo", key: "tipo", width: 18 },
  { header: "Dirección", key: "direccion", width: 12 },
  { header: "Monto", key: "monto", width: 14 },
  { header: "Neto recibido", key: "neto", width: 14 },
  { header: "Comisión MP", key: "comision", width: 12 },
  { header: "Estado", key: "estado", width: 14 },
  { header: "Descripción", key: "descripcion", width: 30 },
  { header: "Pagador (nombre)", key: "pagador_nombre", width: 25 },
  { header: "Pagador (email)", key: "pagador_email", width: 28 },
  { header: "Pagador (CUIT)", key: "pagador_cuit", width: 16 },
  { header: "Cliente asignado", key: "cliente_nombre", width: 28 },
  { header: "Local del cliente", key: "cliente_local", width: 24 },
  { header: "CUIT cliente", key: "cliente_cuit", width: 16 },
  { header: "Asignado auto", key: "asignado_auto", width: 14 },
];

export async function generarExcelReporte(
  filas: Record<string, any>[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MP Cobranzas";
  wb.created = new Date();

  const ws = wb.addWorksheet("Movimientos");
  ws.columns = COLUMNAS_REPORTE_MOVIMIENTOS;

  // Estilo del header.
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  // Cargar filas.
  ws.addRows(filas);

  // Formato moneda en las columnas de plata.
  const colsMoneda = ["monto", "neto", "comision"];
  for (const k of colsMoneda) {
    const col = ws.getColumn(k);
    col.numFmt = '"$" #,##0.00';
  }

  // Freeze del header.
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export function generarCsvReporte(filas: Record<string, any>[]): string {
  const cols = COLUMNAS_REPORTE_MOVIMIENTOS;
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = cols.map((c) => escape(c.header)).join(",");
  const body = filas.map((f) => cols.map((c) => escape(f[c.key])).join(",")).join("\n");
  // BOM al principio para que Excel detecte UTF-8 y muestre tildes/ñ bien.
  return `﻿${header}\n${body}`;
}

// =============================================================================
// TEMPLATE DE CLIENTES (write)
// =============================================================================

// =============================================================================
// REPORTE RESUMEN POR CLIENTE (estado de cuenta)
// =============================================================================

export const COLUMNAS_RESUMEN_CLIENTES: ColumnaReporte[] = [
  { header: "Cliente", key: "cliente", width: 30 },
  { header: "Local / negocio", key: "local", width: 25 },
  { header: "CUIT/CUIL", key: "cuit", width: 16 },
  { header: "Total pagado", key: "pagado", width: 16 },
  { header: "Total consumido", key: "consumido", width: 16 },
  { header: "Saldo", key: "saldo", width: 16 },
  { header: "Estado", key: "estado_cuenta", width: 14 },
  { header: "Cant. pagos", key: "cant_pagos", width: 12 },
  { header: "Cant. pedidos", key: "cant_pedidos", width: 12 },
  { header: "Último pago", key: "ultimo_pago", width: 20 },
];

export async function generarExcelResumen(
  filas: Record<string, unknown>[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MP Cobranzas";
  wb.created = new Date();

  const ws = wb.addWorksheet("Estado de cuenta");
  ws.columns = COLUMNAS_RESUMEN_CLIENTES;

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  ws.addRows(filas);

  const colsMoneda = ["pagado", "consumido", "saldo"];
  for (const k of colsMoneda) {
    ws.getColumn(k).numFmt = '"$" #,##0.00';
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export function generarCsvResumen(filas: Record<string, unknown>[]): string {
  const cols = COLUMNAS_RESUMEN_CLIENTES;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = cols.map((c) => escape(c.header)).join(",");
  const body = filas.map((f) => cols.map((c) => escape(f[c.key])).join(",")).join("\n");
  return `﻿${header}\n${body}`;
}

// =============================================================================
// TEMPLATE DE CLIENTES (write)
// =============================================================================

export const COLUMNAS_TEMPLATE_CLIENTES: ColumnaReporte[] = [
  { header: "nombre", key: "nombre", width: 22 },
  { header: "apellido", key: "apellido", width: 22 },
  { header: "nombre_local", key: "nombre_local", width: 28 },
  { header: "cuit_cuil", key: "cuit_cuil", width: 18 },
  { header: "email", key: "email", width: 28 },
  { header: "telefono", key: "telefono", width: 18 },
  { header: "direccion", key: "direccion", width: 30 },
  { header: "localidad", key: "localidad", width: 22 },
  { header: "provincia", key: "provincia", width: 22 },
  { header: "notas", key: "notas", width: 40 },
];

export async function generarTemplateClientes(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MP Cobranzas";
  const ws = wb.addWorksheet("Clientes");
  ws.columns = COLUMNAS_TEMPLATE_CLIENTES;

  // Header en bold + color.
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  // Fila de ejemplo en gris claro, para que se entienda qué va en cada lado.
  ws.addRow({
    nombre: "Juan",
    apellido: "Pérez",
    nombre_local: "Kiosco Don Pepe",
    cuit_cuil: "20123456789",
    email: "juan@ejemplo.com",
    telefono: "1122334455",
    direccion: "Av. Siempreviva 742",
    localidad: "CABA",
    provincia: "Buenos Aires",
    notas: "Cliente histórico, paga los lunes",
  });
  ws.getRow(2).font = { italic: true, color: { argb: "FF94A3B8" } };

  // Una hoja con instrucciones.
  const ws2 = wb.addWorksheet("Instrucciones");
  ws2.getColumn(1).width = 100;
  const lineas = [
    "INSTRUCCIONES PARA IMPORTAR CLIENTES",
    "",
    "1. Borrá la fila de ejemplo de la hoja 'Clientes'.",
    "2. Completá una fila por cliente.",
    "3. El único campo obligatorio es 'nombre'. El resto pueden quedar vacíos.",
    "4. 'cuit_cuil' tiene que ser único: si ya existe un cliente con ese CUIT, esa fila se omite (no se crea duplicado).",
    "5. El CUIT puede ir con o sin guiones (20-12345678-9 o 20123456789), lo normalizamos solos.",
    "6. Al guardar el archivo, subilo desde la pantalla de Clientes → botón 'Importar Excel'.",
    "",
    "Después de importar te vamos a mostrar:",
    "  - Cuántos clientes nuevos se crearon",
    "  - Cuántos se omitieron porque ya existían",
    "  - Si hubo errores en alguna fila",
  ];
  lineas.forEach((l) => ws2.addRow([l]));
  ws2.getRow(1).font = { bold: true, size: 14 };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

// =============================================================================
// IMPORT DE CLIENTES (read)
// =============================================================================

export interface FilaClienteImportada {
  fila: number;
  nombre: string;
  apellido: string | null;
  nombre_local: string | null;
  cuit_cuil: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  notas: string | null;
}

/**
 * Parser de CSV simple que maneja:
 *   - Campos con coma adentro (entrecomillados: "Hola, mundo")
 *   - Comillas escapadas ("dijo ""hola""")
 *   - Fines de línea \n y \r\n
 *   - BOM al principio
 */
function parsearCsv(texto: string): string[][] {
  // Sacar BOM si existe
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);

  const filas: string[][] = [];
  let filaActual: string[] = [];
  let campoActual = "";
  let dentroDeComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const next = texto[i + 1];

    if (dentroDeComillas) {
      if (c === '"' && next === '"') {
        campoActual += '"';
        i++; // saltar la segunda comilla
      } else if (c === '"') {
        dentroDeComillas = false;
      } else {
        campoActual += c;
      }
    } else {
      if (c === '"') {
        dentroDeComillas = true;
      } else if (c === ",") {
        filaActual.push(campoActual);
        campoActual = "";
      } else if (c === "\n") {
        filaActual.push(campoActual);
        filas.push(filaActual);
        filaActual = [];
        campoActual = "";
      } else if (c === "\r") {
        // ignorar
      } else {
        campoActual += c;
      }
    }
  }

  // Última fila si no terminó con newline
  if (campoActual.length > 0 || filaActual.length > 0) {
    filaActual.push(campoActual);
    filas.push(filaActual);
  }

  return filas;
}

/**
 * Lee clientes desde un CSV (mismo formato que la plantilla Excel).
 */
export function leerClientesDesdeCsv(texto: string): {
  filas: FilaClienteImportada[];
  errores: { fila: number; mensaje: string }[];
} {
  const matriz = parsearCsv(texto);
  if (matriz.length === 0) {
    return { filas: [], errores: [{ fila: 0, mensaje: "El archivo está vacío." }] };
  }

  // Header en la primera fila
  const header = matriz[0].map((h) => (h ?? "").trim().toLowerCase());
  const colIndex: Record<string, number> = {};
  header.forEach((h, i) => { if (h) colIndex[h] = i; });

  if (!("nombre" in colIndex)) {
    return {
      filas: [],
      errores: [{
        fila: 1,
        mensaje: 'No encontré la columna "nombre" en el encabezado. Asegurate de usar la plantilla.',
      }],
    };
  }

  const get = (row: string[], key: string): string | null => {
    const idx = colIndex[key];
    if (idx === undefined) return null;
    const v = row[idx];
    if (v === undefined || v === null) return null;
    const trimmed = String(v).trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const filas: FilaClienteImportada[] = [];
  const errores: { fila: number; mensaje: string }[] = [];

  for (let i = 1; i < matriz.length; i++) {
    const row = matriz[i];
    // Si la fila es totalmente vacía (todos los campos son strings vacíos), saltarla
    if (row.every((c) => !c || c.trim() === "")) continue;

    const nombre = get(row, "nombre");
    if (!nombre) {
      if (
        get(row, "apellido") ||
        get(row, "cuit_cuil") ||
        get(row, "email") ||
        get(row, "telefono")
      ) {
        errores.push({ fila: i + 1, mensaje: 'Falta "nombre" en esta fila.' });
      }
      continue;
    }

    filas.push({
      fila: i + 1,
      nombre,
      apellido: get(row, "apellido"),
      nombre_local: get(row, "nombre_local"),
      cuit_cuil: get(row, "cuit_cuil"),
      email: get(row, "email"),
      telefono: get(row, "telefono"),
      direccion: get(row, "direccion"),
      localidad: get(row, "localidad"),
      provincia: get(row, "provincia"),
      notas: get(row, "notas"),
    });
  }

  return { filas, errores };
}

export async function leerClientesDesdeExcel(buffer: Buffer): Promise<{
  filas: FilaClienteImportada[];
  errores: { fila: number; mensaje: string }[];
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  // Tomamos la primera hoja, sin importar el nombre.
  const ws = wb.worksheets[0];
  if (!ws) {
    return { filas: [], errores: [{ fila: 0, mensaje: "El archivo no tiene hojas." }] };
  }

  // Mapear nombre de columna a índice. Asumimos que la fila 1 es el header.
  const headerRow = ws.getRow(1);
  const colIndex: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const v = String(cell.value ?? "").trim().toLowerCase();
    if (v) colIndex[v] = col;
  });

  if (!("nombre" in colIndex)) {
    return {
      filas: [],
      errores: [
        {
          fila: 1,
          mensaje:
            'No encontré la columna "nombre" en el encabezado. Asegurate de usar la plantilla descargada.',
        },
      ],
    };
  }

  const get = (row: ExcelJS.Row, key: string): string | null => {
    const idx = colIndex[key];
    if (!idx) return null;
    const v = row.getCell(idx).value;
    if (v === null || v === undefined || v === "") return null;
    // Si es un número (ej. CUIT cargado como número), convertir a string.
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return v.trim() || null;
    // Hyperlinks, dates, etc — toString.
    return String(v).trim() || null;
  };

  const filas: FilaClienteImportada[] = [];
  const errores: { fila: number; mensaje: string }[] = [];

  // Iterar desde la fila 2 (saltando el header).
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    // Si la fila está vacía, la saltamos.
    if (!row.hasValues) continue;

    const nombre = get(row, "nombre");
    if (!nombre) {
      // Si tiene algún dato pero no nombre, lo marcamos como error.
      if (
        get(row, "apellido") ||
        get(row, "cuit_cuil") ||
        get(row, "email") ||
        get(row, "telefono")
      ) {
        errores.push({ fila: i, mensaje: 'Falta "nombre" en esta fila.' });
      }
      continue;
    }

    filas.push({
      fila: i,
      nombre,
      apellido: get(row, "apellido"),
      nombre_local: get(row, "nombre_local"),
      cuit_cuil: get(row, "cuit_cuil"),
      email: get(row, "email"),
      telefono: get(row, "telefono"),
      direccion: get(row, "direccion"),
      localidad: get(row, "localidad"),
      provincia: get(row, "provincia"),
      notas: get(row, "notas"),
    });
  }

  return { filas, errores };
}
