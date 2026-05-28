"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { asignarMovimientoACliente, desasignarMovimiento } from "@/lib/actions/movimientos";
import { formatearMoneda, formatearFecha, formatearCuit, normalizarCuit } from "@/lib/utils";

interface MovInfo {
  id: string;
  monto: number;
  fecha_creacion: string;
  pagador_email: string | null;
  pagador_doc_numero: string | null;
  pagador_nombre: string | null;
  pagador_apellido: string | null;
  cliente_id: string | null;
}

interface ClienteOpcion {
  id: string;
  nombre: string;
  apellido: string | null;
  cuit_cuil: string | null;
}

interface Props {
  movimiento: MovInfo;
  clientes: ClienteOpcion[];
  onClose: () => void;
}

export function AsignarClienteModal({ movimiento, clientes, onClose }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [modo, setModo] = useState<"buscar" | "nuevo">("buscar");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Sugerencia automática: si el movimiento trae CUIT, ver si hay un cliente con ese CUIT.
  const sugerido = useMemo(() => {
    const cuit = normalizarCuit(movimiento.pagador_doc_numero);
    if (!cuit) return null;
    return clientes.find((c) => normalizarCuit(c.cuit_cuil) === cuit) ?? null;
  }, [clientes, movimiento.pagador_doc_numero]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clientes.slice(0, 50);
    const numTerm = normalizarCuit(term);
    return clientes
      .filter((c) => {
        const full = `${c.nombre ?? ""} ${c.apellido ?? ""}`.toLowerCase();
        return (
          full.includes(term) ||
          (c.cuit_cuil ? c.cuit_cuil.includes(numTerm) : false)
        );
      })
      .slice(0, 50);
  }, [q, clientes]);

  function asignar(clienteId: string) {
    setError(null);
    startTransition(async () => {
      const r = await asignarMovimientoACliente(movimiento.id, clienteId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function desasignar() {
    setError(null);
    startTransition(async () => {
      const r = await desasignarMovimiento(movimiento.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  async function onCrearCliente(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // Crear el cliente vía endpoint API porque crearCliente() hace redirect.
      const r = await fetch("/api/clientes", {
        method: "POST",
        body: formData,
      });
      const json = (await r.json()) as { ok: boolean; id?: string; error?: string };
      if (!json.ok || !json.id) {
        setError(json.error ?? "No se pudo crear el cliente.");
        return;
      }
      // Asignar el movimiento al cliente recién creado.
      const r2 = await asignarMovimientoACliente(movimiento.id, json.id);
      if (!r2.ok) {
        setError(r2.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar movimiento a un cliente</DialogTitle>
          <DialogDescription>
            <span className="block mt-1">
              <strong>{formatearMoneda(movimiento.monto)}</strong> · {formatearFecha(movimiento.fecha_creacion)}
            </span>
            {(movimiento.pagador_nombre || movimiento.pagador_email || movimiento.pagador_doc_numero) && (
              <span className="block text-xs text-muted-foreground mt-1">
                Pagador: {[movimiento.pagador_nombre, movimiento.pagador_apellido].filter(Boolean).join(" ") || movimiento.pagador_email || "—"}
                {movimiento.pagador_doc_numero && ` · CUIT ${formatearCuit(movimiento.pagador_doc_numero)}`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {sugerido && modo === "buscar" && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3">
            <div className="text-xs font-medium text-emerald-900 mb-1">Sugerencia (mismo CUIT)</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{sugerido.nombre} {sugerido.apellido ?? ""}</div>
                <div className="text-xs text-muted-foreground">CUIT {formatearCuit(sugerido.cuit_cuil ?? "")}</div>
              </div>
              <Button size="sm" onClick={() => asignar(sugerido.id)} disabled={pending}>
                Asignar a {sugerido.nombre}
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant={modo === "buscar" ? "default" : "outline"}
            size="sm"
            onClick={() => setModo("buscar")}
          >
            <Search className="h-4 w-4" /> Buscar cliente
          </Button>
          <Button
            type="button"
            variant={modo === "nuevo" ? "default" : "outline"}
            size="sm"
            onClick={() => setModo("nuevo")}
          >
            <UserPlus className="h-4 w-4" /> Crear cliente nuevo
          </Button>
        </div>

        {modo === "buscar" ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            <Input
              placeholder="Nombre, apellido o CUIT"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <ul className="divide-y rounded-md border">
              {filtrados.length === 0 && (
                <li className="p-3 text-sm text-muted-foreground text-center">
                  Sin resultados. Probá crear un cliente nuevo.
                </li>
              )}
              {filtrados.map((c) => (
                <li key={c.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium">
                      {c.nombre} {c.apellido ?? ""}
                      {sugerido?.id === c.id && <Badge variant="verde" className="ml-2">match</Badge>}
                    </div>
                    {c.cuit_cuil && <div className="text-xs text-muted-foreground">CUIT {formatearCuit(c.cuit_cuil)}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => asignar(c.id)} disabled={pending}>
                    Asignar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <FormularioNuevoCliente
            valoresIniciales={{
              nombre: movimiento.pagador_nombre ?? "",
              apellido: movimiento.pagador_apellido ?? "",
              cuit_cuil: movimiento.pagador_doc_numero ?? "",
              email: movimiento.pagador_email ?? "",
            }}
            onSubmit={onCrearCliente}
            pending={pending}
          />
        )}

        {error && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 border border-rose-200">
            {error}
          </div>
        )}

        <DialogFooter className="!justify-between">
          {movimiento.cliente_id && (
            <Button variant="destructive" size="sm" onClick={desasignar} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Desasignar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormularioNuevoCliente({
  valoresIniciales,
  onSubmit,
  pending,
}: {
  valoresIniciales: { nombre: string; apellido: string; cuit_cuil: string; email: string };
  onSubmit: (formData: FormData) => Promise<void> | void;
  pending: boolean;
}) {
  return (
    <form
      action={onSubmit}
      className="grid grid-cols-1 md:grid-cols-2 gap-3"
    >
      <div className="col-span-1">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input id="nombre" name="nombre" defaultValue={valoresIniciales.nombre} required />
      </div>
      <div className="col-span-1">
        <Label htmlFor="apellido">Apellido</Label>
        <Input id="apellido" name="apellido" defaultValue={valoresIniciales.apellido} />
      </div>
      <div className="col-span-1">
        <Label htmlFor="cuit_cuil">CUIT/CUIL</Label>
        <Input id="cuit_cuil" name="cuit_cuil" defaultValue={valoresIniciales.cuit_cuil} />
      </div>
      <div className="col-span-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={valoresIniciales.email} />
      </div>
      <div className="col-span-1">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input id="telefono" name="telefono" />
      </div>
      <div className="col-span-1">
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" name="direccion" />
      </div>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear y asignar
        </Button>
      </div>
    </form>
  );
}
