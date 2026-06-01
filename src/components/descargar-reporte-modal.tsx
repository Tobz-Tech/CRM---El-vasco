"use client";

import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, Filter } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nombreEstado, nombreTipoOperacion } from "@/lib/utils";

interface ClienteOpcion {
  id: string;
  nombre: string;
  apellido: string | null;
}

interface FiltrosActuales {
  desde?: string;
  hasta?: string;
  cliente?: string;
  tipo?: string;
  estado?: string;
  asignacion?: string;
  q?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clientes: ClienteOpcion[];
  filtrosActuales: FiltrosActuales;
}

export function DescargarReporteModal({ open, onClose, clientes, filtrosActuales }: Props) {
  const [desde, setDesde] = useState(filtrosActuales.desde ?? "");
  const [hasta, setHasta] = useState(filtrosActuales.hasta ?? "");
  const [cliente, setCliente] = useState<string>(filtrosActuales.cliente ?? "todos");
  const [formato, setFormato] = useState<"xlsx" | "csv">("xlsx");
  const [detallado, setDetallado] = useState(false);

  // Re-sincronizamos los campos cada vez que el modal se abre, así toma
  // los filtros más actuales de la pantalla.
  useEffect(() => {
    if (open) {
      setDesde(filtrosActuales.desde ?? "");
      setHasta(filtrosActuales.hasta ?? "");
      setCliente(filtrosActuales.cliente ?? "todos");
    }
  }, [open, filtrosActuales.desde, filtrosActuales.hasta, filtrosActuales.cliente]);

  // Resumen de filtros "ocultos" para que el usuario sepa qué se va a aplicar.
  const filtrosExtra: string[] = [];
  if (filtrosActuales.tipo && filtrosActuales.tipo !== "todos") {
    filtrosExtra.push(`Tipo: ${nombreTipoOperacion(filtrosActuales.tipo)}`);
  }
  if (filtrosActuales.estado && filtrosActuales.estado !== "todos") {
    filtrosExtra.push(`Estado: ${nombreEstado(filtrosActuales.estado)}`);
  }
  if (filtrosActuales.asignacion === "sin_asignar") filtrosExtra.push("Solo sin asignar");
  if (filtrosActuales.asignacion === "asignados") filtrosExtra.push("Solo asignados");
  if (filtrosActuales.q) filtrosExtra.push(`Búsqueda: "${filtrosActuales.q}"`);

  function descargar() {
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    if (cliente && cliente !== "todos") p.set("cliente", cliente);
    // Los filtros "ocultos" solo aplican al modo detallado.
    if (detallado) {
      if (filtrosActuales.tipo && filtrosActuales.tipo !== "todos") p.set("tipo", filtrosActuales.tipo);
      if (filtrosActuales.estado && filtrosActuales.estado !== "todos") p.set("estado", filtrosActuales.estado);
      if (filtrosActuales.asignacion && filtrosActuales.asignacion !== "todos") p.set("asignacion", filtrosActuales.asignacion);
      if (filtrosActuales.q) p.set("q", filtrosActuales.q);
    }
    p.set("formato", formato);
    p.set("detallado", detallado ? "true" : "false");
    window.location.href = `/api/reportes/movimientos?${p.toString()}`;
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Descargar reporte
          </DialogTitle>
          <DialogDescription>
            Los filtros de la pantalla se aplican al reporte. Podés ajustar fechas y cliente acá si querés.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="r-desde">Desde</Label>
            <Input id="r-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="r-hasta">Hasta</Label>
            <Input id="r-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Cliente</Label>
          <Select value={cliente} onValueChange={setCliente}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre} {c.apellido ?? ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Formato</Label>
          <Select value={formato} onValueChange={(v) => setFormato(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">Excel (.xlsx) — abre en Excel y Google Sheets</SelectItem>
              <SelectItem value="csv">CSV (.csv) — más liviano, también abre en ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-slate-50 p-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={detallado}
              onChange={(e) => setDetallado(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block font-medium text-sm">Detalle por transferencia</span>
              <span className="block text-xs text-muted-foreground">
                {detallado
                  ? "Una fila por cada movimiento (fecha, monto, pagador, etc.). Respeta los filtros activos en la pantalla."
                  : "Una fila por cliente con su estado de cuenta (pagado, consumido, saldo)."}
              </span>
            </span>
          </label>
        </div>

        {filtrosExtra.length > 0 && detallado && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <div className="flex items-center gap-1 font-medium mb-1">
              <Filter className="h-3.5 w-3.5" /> Otros filtros activos en la pantalla (también se aplican)
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {filtrosExtra.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}
        {filtrosExtra.length > 0 && !detallado && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="font-medium mb-1">Atención</div>
            En modo resumen los filtros de tipo, estado, asignación y búsqueda <strong>no se aplican</strong> — solo se aplican las fechas y el cliente. Si querés esos otros filtros, tildá &ldquo;Detalle por transferencia&rdquo;.
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={descargar}>
            <Download className="h-4 w-4" /> Descargar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
