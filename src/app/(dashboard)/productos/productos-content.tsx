"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProductoFormModal } from "@/components/producto-form-modal";
import { borrarProducto } from "@/lib/actions/productos";
import { formatearMoneda } from "@/lib/utils";
import type { Producto } from "@/types/database";

interface Props {
  productos: Producto[];
  q: string;
  mostrarInactivos: boolean;
}

export function ProductosContent({ productos, q, mostrarInactivos }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState(q);
  const [editar, setEditar] = useState<Producto | null>(null);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [pending, startTransition] = useTransition();

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (busqueda) p.set("q", busqueda);
    if (mostrarInactivos) p.set("inactivos", "1");
    router.push(`/productos?${p.toString()}`);
  }

  function toggleInactivos() {
    const p = new URLSearchParams();
    if (busqueda) p.set("q", busqueda);
    if (!mostrarInactivos) p.set("inactivos", "1");
    router.push(`/productos?${p.toString()}`);
  }

  function eliminar(p: Producto) {
    if (!confirm(`¿Borrar el producto "${p.nombre}"?\nLos items de pedidos viejos conservan el nombre y precio que tenían en ese momento.`)) return;
    startTransition(async () => {
      const r = await borrarProducto(p.id);
      if (!r.ok) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Productos"
        subtitulo={
          <>
            {productos.length} producto{productos.length === 1 ? "" : "s"}
            {mostrarInactivos ? " (incluye inactivos)" : " activos"}
          </>
        }
        acciones={
          <Button size="lg" onClick={() => setCrearAbierto(true)}>
            <Plus className="h-4 w-4" /> Nuevo producto
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <form onSubmit={buscar} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto" className="pl-8" />
          </div>
          <Button type="submit" variant="outline">Buscar</Button>
        </form>
        <Button type="button" variant={mostrarInactivos ? "secondary" : "ghost"} size="sm" onClick={toggleInactivos}>
          {mostrarInactivos ? "Ocultando inactivos" : "Ver inactivos"}
        </Button>
      </div>

      <Card>
        {productos.length === 0 ? (
          <EmptyState
            icono={<Package className="h-6 w-6" />}
            titulo={q ? "Sin resultados" : "Todavía no hay productos"}
            descripcion={q ? "Probá con otro nombre." : "Cargá tu primer producto para poder armar pedidos."}
            accion={
              q ? (
                <Button variant="outline" onClick={() => { setBusqueda(""); router.push("/productos"); }}>
                  <X className="h-4 w-4" /> Limpiar búsqueda
                </Button>
              ) : (
                <Button onClick={() => setCrearAbierto(true)}>
                  <Plus className="h-4 w-4" /> Nuevo producto
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Precio actual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-right">{formatearMoneda(p.precio)}</TableCell>
                  <TableCell>
                    {p.activo ? <Badge variant="verde">Activo</Badge> : <Badge variant="gris">Inactivo</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="outline" size="sm" onClick={() => setEditar(p)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => eliminar(p)} disabled={pending} title="Borrar">
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ProductoFormModal
        modo="crear"
        open={crearAbierto}
        onClose={() => { setCrearAbierto(false); router.refresh(); }}
      />
      {editar && (
        <ProductoFormModal
          modo="editar"
          producto={editar}
          open={!!editar}
          onClose={() => { setEditar(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
