"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Filter, X, ChevronLeft, ChevronRight, ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ClienteSelector, type ClienteOpcion } from "@/components/cliente-selector";
import { PedidoNuevoModal } from "@/components/pedido-nuevo-modal";
import { BorrarPedidoBoton } from "@/components/borrar-pedido-boton";
import { formatearMoneda, formatearFecha, formatearCuit } from "@/lib/utils";
import type { Producto } from "@/types/database";

interface PedidoFila {
  id: string;
  fecha: string;
  nota: string | null;
  total: number;
  cliente: { id: string; nombre: string; apellido: string | null; cuit_cuil: string | null } | null;
  pedido_items: { id: string; descripcion: string; cantidad: number }[];
}

interface Props {
  pedidos: PedidoFila[];
  total: number;
  pagina: number;
  porPagina: number;
  filtros: { desde?: string; hasta?: string; cliente?: string; q?: string };
  clientes: ClienteOpcion[];
  productos: Producto[];
  error: string | null;
}

export function PedidosContent({
  pedidos, total, pagina, porPagina, filtros, clientes, productos, error,
}: Props) {
  const router = useRouter();
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(
    !!(filtros.desde || filtros.hasta || filtros.cliente || filtros.q)
  );
  const [desde, setDesde] = useState(filtros.desde ?? "");
  const [hasta, setHasta] = useState(filtros.hasta ?? "");
  const [clienteId, setClienteId] = useState<string | null>(filtros.cliente ?? null);
  const [q, setQ] = useState(filtros.q ?? "");

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const filtrosActivos = !!(filtros.desde || filtros.hasta || filtros.cliente || filtros.q);

  function aplicarFiltros(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    if (clienteId) p.set("cliente", clienteId);
    if (q) p.set("q", q);
    router.push(`/pedidos?${p.toString()}`);
  }

  function limpiar() {
    setDesde(""); setHasta(""); setClienteId(null); setQ("");
    router.push("/pedidos");
  }

  function irAPagina(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v) params.set(k, v);
    params.set("pagina", String(p));
    router.push(`/pedidos?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Pedidos"
        subtitulo={
          <>
            {total} pedido{total === 1 ? "" : "s"}
            {filtrosActivos && <span className="ml-2 text-amber-700">· filtros aplicados</span>}
          </>
        }
        acciones={
          <>
            <Button
              variant="outline"
              onClick={() => setFiltrosAbiertos((v) => !v)}
            >
              <Filter className="h-4 w-4" /> {filtrosAbiertos ? "Ocultar filtros" : "Filtros"}
              {filtrosActivos && <Badge variant="alerta" className="ml-1">!</Badge>}
            </Button>
            <PedidoNuevoModal
              clientes={clientes}
              productos={productos}
              trigger={
                <Button size="lg" type="button">
                  <Plus className="h-4 w-4" /> Nuevo pedido
                </Button>
              }
            />
          </>
        }
      />

      {filtrosAbiertos && (
        <Card className="p-4">
          <form onSubmit={aplicarFiltros} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="md:col-span-4">
              <label className="text-xs font-medium text-muted-foreground">Cliente</label>
              <ClienteSelector
                clientes={clientes}
                value={clienteId}
                onChange={setClienteId}
                placeholder="Todos"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Buscar nota</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="md:col-span-12 flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={limpiar}>
                <X className="h-4 w-4" /> Limpiar
              </Button>
              <Button type="submit">
                <Filter className="h-4 w-4" /> Aplicar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      )}

      <Card>
        {pedidos.length === 0 ? (
          <EmptyState
            icono={<ShoppingCart className="h-6 w-6" />}
            titulo={filtrosActivos ? "Sin resultados con esos filtros" : "Todavía no hay pedidos"}
            descripcion={
              filtrosActivos
                ? "Probá quitar algún filtro o cambiar el rango de fechas."
                : "Creá el primer pedido para empezar a cargar consumos de los clientes."
            }
            accion={
              filtrosActivos ? (
                <Button onClick={limpiar} variant="outline"><X className="h-4 w-4" /> Limpiar filtros</Button>
              ) : (
                <PedidoNuevoModal
                  clientes={clientes}
                  productos={productos}
                  trigger={<Button><Plus className="h-4 w-4" /> Nuevo pedido</Button>}
                />
              )
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{formatearFecha(p.fecha)}</TableCell>
                    <TableCell>
                      {p.cliente ? (
                        <Link href={`/clientes/${p.cliente.id}`} className="font-medium text-primary hover:underline">
                          {p.cliente.nombre} {p.cliente.apellido ?? ""}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {p.cliente?.cuit_cuil && (
                        <div className="text-xs text-muted-foreground">CUIT {formatearCuit(p.cliente.cuit_cuil)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[280px]">
                      {p.pedido_items.length === 0 ? (
                        <span className="text-muted-foreground">Sin items</span>
                      ) : (
                        <span title={p.pedido_items.map((it) => `${it.descripcion} × ${Number(it.cantidad)}`).join(", ")}>
                          {p.pedido_items.length} item{p.pedido_items.length === 1 ? "" : "s"}: {p.pedido_items.slice(0, 2).map((it) => `${it.descripcion} ×${Number(it.cantidad)}`).join(", ")}
                          {p.pedido_items.length > 2 && <span className="text-muted-foreground"> +{p.pedido_items.length - 2}</span>}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground italic max-w-[200px] truncate">
                      {p.nota ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatearMoneda(p.total)}</TableCell>
                    <TableCell className="text-right">
                      <BorrarPedidoBoton pedidoId={p.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between p-3 border-t">
              <p className="text-sm text-muted-foreground">
                {(pagina - 1) * porPagina + 1}-{Math.min(pagina * porPagina, total)} de {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => irAPagina(pagina - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => irAPagina(pagina + 1)}>
                  Siguiente <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
