"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, ShoppingCart } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClienteSelector, type ClienteOpcion } from "@/components/cliente-selector";
import { ProductoSelector } from "@/components/producto-selector";
import { crearPedido } from "@/lib/actions/pedidos";
import { formatearMoneda } from "@/lib/utils";
import type { Producto } from "@/types/database";

interface ItemEnEdicion {
  key: string;
  producto_id: string | null;
  descripcion: string;
  /** Strings para que el input pueda quedar vacío al borrar. Se convierten a número al calcular y guardar. */
  cantidad: string;
  precio_unitario: string;
}

interface Props {
  // Si viene fijado, no se muestra selector. Sino, mostramos el selector arriba.
  clienteId?: string;
  clientes?: ClienteOpcion[];
  productos: Producto[];
  trigger: React.ReactNode;
  // Si querés que después de guardar el pedido se navegue al perfil del cliente.
  redirigirAlCliente?: boolean;
}

export function PedidoNuevoModal({
  clienteId: clienteFijado,
  clientes = [],
  productos,
  trigger,
  redirigirAlCliente = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string | null>(clienteFijado ?? null);
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState("");
  const [items, setItems] = useState<ItemEnEdicion[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function emptyItem(): ItemEnEdicion {
    return {
      key: Math.random().toString(36).slice(2),
      producto_id: null,
      descripcion: "",
      cantidad: "1",
      precio_unitario: "",
    };
  }

  function reset() {
    setClienteIdSeleccionado(clienteFijado ?? null);
    setFecha(new Date().toISOString().slice(0, 10));
    setNota("");
    setItems([emptyItem()]);
    setError(null);
  }

  function actualizar(key: string, patch: Partial<ItemEnEdicion>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function elegirProducto(key: string, p: Producto | null) {
    if (p === null) {
      // Item suelto: limpiamos producto_id, dejamos al usuario tipear descripción.
      actualizar(key, { producto_id: null, descripcion: "" });
      return;
    }
    actualizar(key, {
      producto_id: p.id,
      descripcion: p.nombre,
      precio_unitario: String(p.precio),
    });
  }

  function agregarItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function quitarItem(key: string) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it.key !== key)));
  }

  const total = useMemo(() =>
    items.reduce((acc, it) => {
      const c = Number(it.cantidad);
      const p = Number(it.precio_unitario);
      return acc + (Number.isFinite(c) ? c : 0) * (Number.isFinite(p) ? p : 0);
    }, 0),
  [items]);

  function guardar() {
    setError(null);

    if (!clienteIdSeleccionado) {
      setError("Tenés que elegir un cliente.");
      return;
    }

    const limpias = items
      .map((it) => ({
        producto_id: it.producto_id,
        descripcion: (it.descripcion ?? "").trim(),
        cantidad: Number(it.cantidad) || 0,
        precio_unitario: Number(it.precio_unitario) || 0,
      }))
      // Descartamos items completamente vacíos
      .filter((it) => it.descripcion || it.cantidad > 0 || it.precio_unitario > 0);

    if (limpias.length === 0) {
      setError("Tenés que agregar al menos un item con descripción.");
      return;
    }
    for (const it of limpias) {
      if (!it.descripcion) { setError("Algún item no tiene descripción."); return; }
      if (it.cantidad <= 0) { setError("La cantidad de cada item debe ser mayor a 0."); return; }
      if (it.precio_unitario < 0) { setError("El precio no puede ser negativo."); return; }
    }

    startTransition(async () => {
      const r = await crearPedido({
        cliente_id: clienteIdSeleccionado,
        fecha,
        nota: nota.trim() || null,
        items: limpias,
      });
      if (!r.ok) { setError(r.error); return; }
      if (redirigirAlCliente) {
        router.push(`/clientes/${clienteIdSeleccionado}`);
      } else {
        router.refresh();
      }
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <div onClick={() => setOpen(true)} className="contents">{trigger}</div>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Nuevo pedido
          </DialogTitle>
          <DialogDescription>
            Agregá uno o más items. Podés elegir del catálogo o cargar uno suelto con descripción libre.
          </DialogDescription>
        </DialogHeader>

        {/* Cliente — solo si NO viene fijado */}
        {!clienteFijado && (
          <div>
            <Label>Cliente *</Label>
            <ClienteSelector
              clientes={clientes}
              value={clienteIdSeleccionado}
              onChange={setClienteIdSeleccionado}
              placeholder="Elegí el cliente del pedido"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ped-fecha">Fecha</Label>
            <Input id="ped-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ped-nota">Nota (opcional)</Label>
            <Input id="ped-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej: dejado en garage" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <div className="col-span-4">Producto / descripción</div>
            <div className="col-span-2">Cantidad</div>
            <div className="col-span-3">Precio unitario</div>
            <div className="col-span-2 text-right">Subtotal</div>
            <div className="col-span-1"></div>
          </div>

          {items.map((it) => {
            const subtotal = (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0);
            return (
              <div key={it.key} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4 space-y-1">
                  <ProductoSelector
                    productos={productos}
                    value={it.producto_id ?? (it.descripcion ? null : "")}
                    onChange={(p) => elegirProducto(it.key, p)}
                  />
                  {it.producto_id === null && (
                    <Input
                      placeholder="Descripción del item suelto"
                      value={it.descripcion}
                      onChange={(e) => actualizar(it.key, { descripcion: e.target.value })}
                    />
                  )}
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="1"
                    inputMode="decimal"
                    min={0}
                    value={it.cantidad}
                    onChange={(e) => actualizar(it.key, { cantidad: e.target.value })}
                    title="Las flechas suben/bajan de 1 en 1. Si necesitás decimales (ej. 3.525), tipealos."
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0,00"
                    value={it.precio_unitario}
                    onChange={(e) => actualizar(it.key, { precio_unitario: e.target.value })}
                  />
                </div>
                <div className="col-span-2 text-right pt-2 font-medium">
                  {formatearMoneda(subtotal)}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => quitarItem(it.key)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              </div>
            );
          })}

          <Button type="button" variant="outline" size="sm" onClick={agregarItem}>
            <Plus className="h-4 w-4" /> Agregar item
          </Button>
        </div>

        <div className="flex items-center justify-end border-t pt-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total del pedido</div>
            <div className="text-2xl font-bold">{formatearMoneda(total)}</div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 border border-rose-200">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
          <Button onClick={guardar} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
