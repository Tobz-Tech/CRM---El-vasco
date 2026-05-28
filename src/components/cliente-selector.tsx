"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatearCuit, normalizarCuit } from "@/lib/utils";

export interface ClienteOpcion {
  id: string;
  nombre: string;
  apellido: string | null;
  cuit_cuil: string | null;
}

interface Props {
  clientes: ClienteOpcion[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ClienteSelector({
  clientes,
  value,
  onChange,
  placeholder = "Elegí un cliente",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const seleccionado = clientes.find((c) => c.id === value) ?? null;

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clientes.slice(0, 50);
    const numTerm = normalizarCuit(term);
    return clientes
      .filter((c) => {
        const full = `${c.nombre ?? ""} ${c.apellido ?? ""}`.toLowerCase();
        if (full.includes(term)) return true;
        if (numTerm && c.cuit_cuil && normalizarCuit(c.cuit_cuil).includes(numTerm)) return true;
        return false;
      })
      .slice(0, 50);
  }, [q, clientes]);

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
            <User className="h-4 w-4 text-muted-foreground" />
            {seleccionado ? (
              <>
                {seleccionado.nombre} {seleccionado.apellido ?? ""}
                {seleccionado.cuit_cuil && (
                  <span className="text-xs text-muted-foreground ml-1">
                    · {formatearCuit(seleccionado.cuit_cuil)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar nombre o CUIT..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            className="h-9"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtrados.length === 0 && (
            <li className="px-3 py-4 text-sm text-center text-muted-foreground">
              Sin resultados.
            </li>
          )}
          {filtrados.map((c) => {
            const activo = c.id === value;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm",
                    activo && "bg-accent"
                  )}
                >
                  <Check className={cn("h-4 w-4", activo ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">
                    {c.nombre} {c.apellido ?? ""}
                  </span>
                  {c.cuit_cuil && (
                    <span className="text-xs text-muted-foreground">{formatearCuit(c.cuit_cuil)}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
