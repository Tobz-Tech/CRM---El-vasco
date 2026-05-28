"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearProducto, actualizarProducto } from "@/lib/actions/productos";
import type { Producto } from "@/types/database";

interface Props {
  modo: "crear" | "editar";
  producto?: Producto;
  open: boolean;
  onClose: () => void;
}

export function ProductoFormModal({ modo, producto, open, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = modo === "crear"
        ? await crearProducto(formData)
        : await actualizarProducto(producto!.id, formData);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modo === "crear" ? "Nuevo producto" : "Editar producto"}</DialogTitle>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={producto?.nombre ?? ""}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="precio">Precio</Label>
            <Input
              id="precio"
              name="precio"
              type="number"
              step="0.01"
              min={0}
              defaultValue={producto?.precio ?? ""}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="activo"
              name="activo"
              type="checkbox"
              defaultChecked={producto?.activo ?? true}
              value="on"
              className="h-4 w-4"
            />
            <Label htmlFor="activo" className="cursor-pointer">Activo (aparece en el listado de selección)</Label>
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 border border-rose-200">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {modo === "crear" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
