/**
 * Tipos TypeScript de la base de datos.
 *
 * Si más adelante regenerás los tipos desde Supabase, podés correr:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.generated.ts
 * Y reemplazar este archivo. Por ahora, los escribimos a mano y son la fuente
 * de verdad para toda la app.
 */

export type Direccion = "entrada" | "salida";
export type EstadoSync = "corriendo" | "exito" | "error";
export type DisparadoPor = "cron" | "manual";

export interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  nombre_local: string | null;
  cuit_cuil: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  mp_payer_id: string | null;
  notas: string | null;
  excluir_de_reportes: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ClienteConTotales extends Cliente {
  total_recibido_historico: number;
  ultimo_pago_fecha: string | null;
  ultimo_pago_monto: number | null;
  cantidad_movimientos: number;
  total_consumido: number;
  cantidad_pedidos: number;
  ultimo_pedido_fecha: string | null;
  saldo: number;
}

export interface ClienteTotales {
  total_recibido_historico: number;
  total_recibido_hoy: number;
  total_recibido_semana: number;
  total_recibido_mes: number;
  ultimo_pago_fecha: string | null;
  ultimo_pago_monto: number | null;
  cantidad_movimientos: number;
  total_consumido: number;
  total_consumido_mes: number;
  cantidad_pedidos: number;
  ultimo_pedido_fecha: string | null;
  saldo: number;
}

export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Pedido {
  id: string;
  cliente_id: string;
  fecha: string;
  nota: string | null;
  total: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at: string;
}

export interface PedidoConItems extends Pedido {
  pedido_items: PedidoItem[];
}

export interface Movimiento {
  id: string;
  mp_payment_id: number;
  monto: number;
  neto_recibido: number | null;
  moneda: string;
  fecha_creacion: string;
  fecha_aprobacion: string | null;
  estado: string | null;
  estado_detalle: string | null;
  tipo_operacion: string | null;
  tipo_pago: string | null;
  metodo_pago: string | null;
  descripcion: string | null;
  referencia_externa: string | null;
  direccion: Direccion;
  comision_mp: number;
  pagador_email: string | null;
  pagador_mp_id: string | null;
  pagador_doc_tipo: string | null;
  pagador_doc_numero: string | null;
  pagador_nombre: string | null;
  pagador_apellido: string | null;
  pagador_telefono: string | null;
  ip_pagador: string | null;
  provincia: string | null;
  canal: string | null;
  subcanal: string | null;
  cliente_id: string | null;
  asignado_automaticamente: boolean;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface MovimientoConCliente extends Movimiento {
  cliente: Pick<Cliente, "id" | "nombre" | "apellido" | "cuit_cuil"> | null;
}

export interface Config {
  id: string;
  singleton: boolean;
  mp_access_token_encrypted: string | null;
  mp_collector_id: string | null;
  frecuencia_sync_min: number;
  ultima_sincronizacion: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  iniciado_en: string;
  finalizado_en: string | null;
  estado: EstadoSync;
  movimientos_nuevos: number;
  movimientos_actualizados: number;
  asignados_auto: number;
  error_mensaje: string | null;
  rango_desde: string | null;
  rango_hasta: string | null;
  disparado_por: DisparadoPor;
}

// =============================================================================
// Tipo "Database" - usado por @supabase/supabase-js para inferir tipos.
// =============================================================================
export interface Database {
  public: {
    Tables: {
      clientes: {
        Row: Cliente;
        Insert: Omit<Cliente, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Cliente, "id" | "created_at" | "updated_at">>;
      };
      movimientos: {
        Row: Movimiento;
        Insert: Omit<Movimiento, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Movimiento, "id" | "created_at" | "updated_at">>;
      };
      config: {
        Row: Config;
        Insert: Omit<Config, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Config, "id" | "created_at" | "updated_at">>;
      };
      sync_logs: {
        Row: SyncLog;
        Insert: Omit<SyncLog, "id" | "iniciado_en"> & {
          id?: string;
          iniciado_en?: string;
        };
        Update: Partial<Omit<SyncLog, "id" | "iniciado_en">>;
      };
      productos: {
        Row: Producto;
        Insert: Omit<Producto, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Producto, "id" | "created_at" | "updated_at">>;
      };
      pedidos: {
        Row: Pedido;
        Insert: Omit<Pedido, "id" | "created_at" | "updated_at" | "total"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          total?: number;
        };
        Update: Partial<Omit<Pedido, "id" | "created_at" | "updated_at">>;
      };
      pedido_items: {
        Row: PedidoItem;
        Insert: Omit<PedidoItem, "id" | "created_at" | "subtotal"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<PedidoItem, "id" | "created_at" | "subtotal">>;
      };
    };
    Views: {
      clientes_con_totales: {
        Row: ClienteConTotales;
      };
    };
    Functions: {
      cliente_totales: {
        Args: { p_cliente_id: string };
        Returns: ClienteTotales;
      };
    };
  };
}
