"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Package, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatearMoneda } from "@/lib/utils";
import type { Producto } from "@/types/database";

/**
 * Valor especial para "Item suelto" (sin catálogo).
 * Quien usa este componente recibe `null` cuando se elige esta opción.
 */
const ITEM_SUELTO = "__suelto__";

interface Props {
  productos: Producto[];
  /** ID del producto seleccionado o `null` si es item suelto, o `""` si no se eligió nada. */
  value: string | null | "";
  /** Llama con producto.id, o `null` si eligió "Item suelto". */
  onChange: (producto: Producto | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProductoSelector({
  productos,
  value,
  onChange,
  placeholder = "Elegir producto",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const seleccionado = value && value !== ITEM_SUELTO ? productos.find((p) => p.id === value) ?? null : null;
  const esItemSuelto = value === null;

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return productos.slice(0, 100);
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(term))
      .slice(0, 100);
  }, [q, productos]);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            {esItemSuelto ? (
              <>
                <Pencil className="h-4 w-4 text-amber-600" />
                <span>Item suelto</span>
              </>
            ) : seleccionado ? (
              <>
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{seleccionado.nombre}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatearMoneda(seleccionado.precio)}
                </span>
              </>
            ) : (
              <>
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{placeholder}</span>
              </>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar producto por nombre..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            className="h-9"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {/* Opción especial: item suelto */}
          <li>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm border-b",
                esItemSuelto && "bg-accent"
              )}
            >
              <Check className={cn("h-4 w-4", esItemSuelto ? "opacity-100" : "opacity-0")} />
              <Pencil className="h-4 w-4 text-amber-600" />
              <span className="flex-1">Item suelto (sin catálogo)</span>
            </button>
          </li>

          {filtrados.length === 0 && (
            <li className="px-3 py-4 text-sm text-center text-muted-foreground">
              Sin resultados.
            </li>
          )}
          {filtrados.map((p) => {
            const activo = p.id === value;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { onChange(p); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm",
                    activo && "bg-accent"
                  )}
                >
                  <Check className={cn("h-4 w-4", activo ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatearMoneda(p.precio)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
