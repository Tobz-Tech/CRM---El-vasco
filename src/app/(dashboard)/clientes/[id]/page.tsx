import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShoppingCart, ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClienteForm } from "@/components/cliente-form";
import { DesasignarBoton } from "@/components/desasignar-boton";
import { PedidoNuevoModal } from "@/components/pedido-nuevo-modal";
import { BorrarPedidoBoton } from "@/components/borrar-pedido-boton";
import type { Cliente } from "@/types/database";
import {
  formatearMoneda, formatearFecha, nombreEstado, colorEstado, nombreTipoOperacion,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

interface MovimientoFila {
  id: string;
  mp_payment_id: number;
  monto: number;
  neto_recibido: number | null;
  fecha_creacion: string;
  estado: string | null;
  tipo_operacion: string | null;
  descripcion: string | null;
  asignado_automaticamente: boolean;
}

interface PedidoFila {
  id: string;
  fecha: string;
  nota: string | null;
  total: number;
  pedido_items: {
    id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
}

type TimelineEntry =
  | { tipo: "pago"; fecha: string; monto: number; data: MovimientoFila }
  | { tipo: "pedido"; fecha: string; monto: number; data: PedidoFila };

export default async function PerfilClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Cliente
  const { data: clienteData, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !clienteData) notFound();
  const cliente = clienteData as Cliente;

  // Movimientos asignados
  const { data: movs } = await supabase
    .from("movimientos")
    .select("id, mp_payment_id, monto, neto_recibido, fecha_creacion, estado, tipo_operacion, descripcion, asignado_automaticamente, direccion")
    .eq("cliente_id", id)
    .order("fecha_creacion", { ascending: false })
    .limit(500);

  // Pedidos con items
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, fecha, nota, total, pedido_items(id, descripcion, cantidad, precio_unitario, subtotal)")
    .eq("cliente_id", id)
    .order("fecha", { ascending: false })
    .limit(500);

  // Productos activos para el modal
  const { data: productos } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  // Totales del cliente.
  // Casteamos a `any` porque supabase-js no infiere bien los Args cuando la
  // función SQL usa `returns table (...)`. El runtime funciona perfecto.
  const { data: totalesRaw } = await (supabase.rpc as any)("cliente_totales", { p_cliente_id: id });
  const totales = Array.isArray(totalesRaw) ? totalesRaw[0] : totalesRaw;

  // Armar timeline cronológica con saldo corriente.
  const pagosEntrada = (movs ?? []).filter((m: any) => m.estado === "approved" && m.direccion === "entrada");
  const entradas: TimelineEntry[] = [
    ...pagosEntrada.map((m: any): TimelineEntry => ({
      tipo: "pago",
      fecha: m.fecha_creacion,
      monto: Number(m.monto),
      data: m as MovimientoFila,
    })),
    ...(pedidos ?? []).map((p: any): TimelineEntry => ({
      tipo: "pedido",
      fecha: p.fecha,
      monto: Number(p.total),
      data: p as PedidoFila,
    })),
  ];
  // Orden ascendente para calcular saldo corriente.
  entradas.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  let saldoCorr = 0;
  const conSaldo = entradas.map((e) => {
    if (e.tipo === "pedido") saldoCorr += e.monto;
    else saldoCorr -= e.monto;
    return { ...e, saldoEnEseMomento: saldoCorr };
  });
  // Para mostrar, queremos desc.
  const timeline = [...conSaldo].reverse();

  const saldo = Number(totales?.saldo ?? 0);
  const debe = saldo > 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/clientes"><ChevronLeft className="h-4 w-4" /> Volver a clientes</Link>
        </Button>
        <PedidoNuevoModal
          clienteId={id}
          productos={(productos ?? []) as any}
          trigger={
            <Button size="lg" type="button">
              <Plus className="h-4 w-4" /> Nuevo pedido
            </Button>
          }
        />
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{cliente.nombre} {cliente.apellido ?? ""}</h1>
        {cliente.cuit_cuil && <p className="text-sm text-muted-foreground">CUIT/CUIL: {cliente.cuit_cuil}</p>}
      </div>

      {/* Estado de cuenta */}
      <Card className={debe ? "border-rose-300" : saldo < 0 ? "border-emerald-300" : ""}>
        <CardHeader>
          <CardTitle className="text-base">Estado de cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <BloqueTotal
              titulo="Total pagado"
              valor={Number(totales?.total_recibido_historico ?? 0)}
              icono={<ArrowDownLeft className="h-4 w-4 text-emerald-700" />}
              color="text-emerald-700"
            />
            <BloqueTotal
              titulo="Total consumido"
              valor={Number(totales?.total_consumido ?? 0)}
              icono={<ArrowUpRight className="h-4 w-4 text-orange-700" />}
              color="text-orange-700"
            />
            <div className={`rounded-lg p-4 border-2 ${debe ? "bg-rose-50 border-rose-300" : saldo < 0 ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-300"}`}>
              <div className="text-xs text-muted-foreground">Saldo</div>
              <div className={`text-2xl font-bold ${debe ? "text-rose-700" : saldo < 0 ? "text-emerald-700" : "text-slate-700"}`}>
                {formatearMoneda(Math.abs(saldo))}
              </div>
              <div className="text-xs mt-1">
                {debe ? <span className="text-rose-700 font-medium">Debe</span> :
                 saldo < 0 ? <span className="text-emerald-700 font-medium">A favor</span> :
                 <span className="text-slate-700">Al día</span>}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Mini label="Pagado hoy"     val={Number(totales?.total_recibido_hoy ?? 0)} />
            <Mini label="Pagado semana"  val={Number(totales?.total_recibido_semana ?? 0)} />
            <Mini label="Pagado mes"     val={Number(totales?.total_recibido_mes ?? 0)} />
            <Mini label="Consumido mes"  val={Number(totales?.total_consumido_mes ?? 0)} />
          </div>
        </CardContent>
      </Card>

      {/* Datos editables */}
      <Card>
        <CardHeader><CardTitle>Datos del cliente</CardTitle></CardHeader>
        <CardContent>
          <ClienteForm modo="editar" cliente={cliente} />
        </CardContent>
      </Card>

      {/* Línea de tiempo combinada */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos del cliente ({timeline.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pedidos (lo que consumió) y pagos (lo que pagó por MP). El saldo corriente al lado es el saldo después de ese movimiento.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeline.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Todavía no hay movimientos.
                  </TableCell>
                </TableRow>
              )}
              {timeline.map((e) => {
                if (e.tipo === "pedido") {
                  return (
                    <TableRow key={`p-${e.data.id}`}>
                      <TableCell className="whitespace-nowrap">{formatearFecha(e.fecha)}</TableCell>
                      <TableCell>
                        <Badge variant="amarillo"><ShoppingCart className="h-3 w-3 mr-1" /> Pedido</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.data.pedido_items.length === 0 ? (
                          <em className="text-muted-foreground">Sin items</em>
                        ) : (
                          <ul className="space-y-0.5">
                            {e.data.pedido_items.map((it) => (
                              <li key={it.id}>
                                {it.descripcion} × {Number(it.cantidad)} = {formatearMoneda(it.subtotal)}
                              </li>
                            ))}
                          </ul>
                        )}
                        {e.data.nota && <div className="text-xs text-muted-foreground mt-1 italic">{e.data.nota}</div>}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-orange-700">
                        +{formatearMoneda(e.monto)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${(e as any).saldoEnEseMomento > 0 ? "text-rose-700" : (e as any).saldoEnEseMomento < 0 ? "text-emerald-700" : ""}`}>
                        {(e as any).saldoEnEseMomento > 0 ? "" : ""}{formatearMoneda(Math.abs((e as any).saldoEnEseMomento))}
                      </TableCell>
                      <TableCell className="text-right">
                        <BorrarPedidoBoton pedidoId={e.data.id} />
                      </TableCell>
                    </TableRow>
                  );
                }
                // pago
                return (
                  <TableRow key={`m-${e.data.id}`}>
                    <TableCell className="whitespace-nowrap">{formatearFecha(e.fecha)}</TableCell>
                    <TableCell>
                      <Badge variant="verde"><ArrowDownLeft className="h-3 w-3 mr-1" /> Pago</Badge>
                      {e.data.asignado_automaticamente && <Badge variant="secondary" className="ml-1">auto</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {nombreTipoOperacion(e.data.tipo_operacion)} · #{e.data.mp_payment_id}
                      <Badge variant={colorEstado(e.data.estado)} className="ml-2">{nombreEstado(e.data.estado)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700">
                      −{formatearMoneda(e.monto)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${(e as any).saldoEnEseMomento > 0 ? "text-rose-700" : (e as any).saldoEnEseMomento < 0 ? "text-emerald-700" : ""}`}>
                      {formatearMoneda(Math.abs((e as any).saldoEnEseMomento))}
                    </TableCell>
                    <TableCell className="text-right">
                      <DesasignarBoton movimientoId={e.data.id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BloqueTotal({
  titulo, valor, icono, color,
}: { titulo: string; valor: number; icono: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg p-4 border bg-white">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icono} {titulo}</div>
      <div className={`text-2xl font-bold ${color}`}>{formatearMoneda(valor)}</div>
    </div>
  );
}

function Mini({ label, val }: { label: string; val: number }) {
  return (
    <div className="border rounded-md p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-semibold">{formatearMoneda(val)}</div>
    </div>
  );
}
