"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, RefreshCw, Search, Filter, ChevronLeft, ChevronRight, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sincronizarAhora } from "@/lib/actions/sync";
import {
  formatearMoneda, formatearFecha, tiempoRelativo, nombreTipoOperacion,
  nombreEstado, colorEstado, formatearCuit,
} from "@/lib/utils";
import { AsignarClienteModal } from "@/components/asignar-cliente-modal";
import { DescargarReporteModal } from "@/components/descargar-reporte-modal";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Wallet } from "lucide-react";

interface MovRow {
  id: string;
  mp_payment_id: number;
  monto: number;
  neto_recibido: number | null;
  fecha_creacion: string;
  estado: string | null;
  tipo_operacion: string | null;
  descripcion: string | null;
  direccion: "entrada" | "salida";
  pagador_email: string | null;
  pagador_doc_numero: string | null;
  pagador_nombre: string | null;
  pagador_apellido: string | null;
  cliente_id: string | null;
  asignado_automaticamente: boolean;
  cliente: { id: string; nombre: string; apellido: string | null; cuit_cuil: string | null } | null;
}

interface ClienteOpcion {
  id: string;
  nombre: string;
  apellido: string | null;
  cuit_cuil: string | null;
}

interface Props {
  movimientos: MovRow[];
  total: number;
  pagina: number;
  porPagina: number;
  filtros: Record<string, string | undefined>;
  clientes: ClienteOpcion[];
  ultimaSync: string | null;
  error: string | null;
}

export function CobranzasContent({
  movimientos, total, pagina, porPagina, filtros, clientes, ultimaSync, error,
}: Props) {
  const router = useRouter();
  const [isSyncing, startSync] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [movASignar, setMovASignar] = useState<MovRow | null>(null);
  const [reporteAbierto, setReporteAbierto] = useState(false);

  const [q, setQ] = useState(filtros.q ?? "");
  const [desde, setDesde] = useState(filtros.desde ?? "");
  const [hasta, setHasta] = useState(filtros.hasta ?? "");
  const [tipo, setTipo] = useState(filtros.tipo ?? "todos");
  const [estado, setEstado] = useState(filtros.estado ?? "todos");
  const [asign, setAsign] = useState(filtros.asignacion ?? "todos");

  const filtrosActivos = !!(filtros.q || filtros.desde || filtros.hasta ||
    (filtros.tipo && filtros.tipo !== "todos") ||
    (filtros.estado && filtros.estado !== "todos") ||
    (filtros.asignacion && filtros.asignacion !== "todos"));
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(filtrosActivos);

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  function aplicarFiltros(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    if (tipo && tipo !== "todos") p.set("tipo", tipo);
    if (estado && estado !== "todos") p.set("estado", estado);
    if (asign && asign !== "todos") p.set("asignacion", asign);
    router.push(`/cobranzas?${p.toString()}`);
  }

  // Aplica los filtros pero pisando algunos (útil para los pills rápidos)
  function aplicarFiltrosCon(override: Partial<{ asignacion?: string }>) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    if (tipo && tipo !== "todos") p.set("tipo", tipo);
    if (estado && estado !== "todos") p.set("estado", estado);
    const a = "asignacion" in override ? override.asignacion : asign;
    if (a && a !== "todos") p.set("asignacion", a);
    router.push(`/cobranzas?${p.toString()}`);
  }

  function limpiarFiltros() {
    setQ(""); setDesde(""); setHasta("");
    setTipo("todos"); setEstado("todos"); setAsign("todos");
    router.push("/cobranzas");
  }

  function irAPagina(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v) params.set(k, v);
    params.set("pagina", String(p));
    router.push(`/cobranzas?${params.toString()}`);
  }

  function onSync() {
    setSyncMsg(null);
    startSync(async () => {
      const r = await sincronizarAhora();
      if (r.ok) {
        setSyncMsg(
          `OK: ${r.movimientos_nuevos} nuevos, ${r.movimientos_actualizados} actualizados, ${r.asignados_auto} asignados automáticamente.`
        );
        router.refresh();
      } else {
        setSyncMsg(`Error: ${r.error}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Cobranzas"
        subtitulo={
          <>
            Última sincronización: <strong>{ultimaSync ? formatearFecha(ultimaSync) : "nunca"}</strong>
            {ultimaSync && <span className="text-muted-foreground/80"> · {tiempoRelativo(ultimaSync)}</span>}
          </>
        }
        acciones={
          <>
            <Button onClick={() => setReporteAbierto(true)} variant="outline" size="lg">
              <Download className="h-4 w-4" /> Descargar reporte
            </Button>
            <Button onClick={onSync} disabled={isSyncing} size="lg">
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          </>
        }
      />

      {syncMsg && (
        <div className={`rounded-md px-3 py-2 text-sm border ${syncMsg.startsWith("Error") ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"}`}>
          {syncMsg}
        </div>
      )}

      {/* Quick filter pills + botón Filtros avanzados */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1.5">
          <QuickPill activo={asign === "todos"} onClick={() => { setAsign("todos"); aplicarFiltrosCon({ asignacion: undefined }); }}>Todos</QuickPill>
          <QuickPill activo={asign === "sin_asignar"} variant="alerta" onClick={() => { setAsign("sin_asignar"); aplicarFiltrosCon({ asignacion: "sin_asignar" }); }}>Sin asignar</QuickPill>
          <QuickPill activo={asign === "asignados"} onClick={() => { setAsign("asignados"); aplicarFiltrosCon({ asignacion: "asignados" }); }}>Asignados</QuickPill>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFiltrosAbiertos((v) => !v)}>
          <Filter className="h-4 w-4" /> {filtrosAbiertos ? "Ocultar filtros" : "Filtros avanzados"}
          {filtrosActivos && <Badge variant="alerta" className="ml-1">!</Badge>}
        </Button>
      </div>

      {/* Filtros avanzados (colapsable) */}
      {filtrosAbiertos && (
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={aplicarFiltros} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <label className="text-xs font-medium text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Monto, email, CUIT, descripción..."
                  className="pl-8"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="money_transfer">Transferencias</SelectItem>
                  <SelectItem value="regular_payment">QR/Tarjeta</SelectItem>
                  <SelectItem value="recurring_payment">Recurrentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="approved">Aprobados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="rejected">Rechazados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-muted-foreground">Asignación</label>
              <Select value={asign} onValueChange={setAsign}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sin_asignar">Sin asignar (entrantes)</SelectItem>
                  <SelectItem value="asignados">Asignados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-9 flex items-end gap-2">
              <Button type="submit"><Filter className="h-4 w-4" /> Aplicar</Button>
              <Button type="button" variant="outline" onClick={limpiarFiltros}><X className="h-4 w-4" /> Limpiar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      )}

      {/* Tabla */}
      <Card>
        {movimientos.length === 0 ? (
          <EmptyState
            icono={<Wallet className="h-6 w-6" />}
            titulo="No hay cobranzas con esos filtros"
            descripcion="Probá ampliar el rango de fechas, vaciar la búsqueda o sincronizar para traer nuevos movimientos."
            accion={
              <div className="flex gap-2">
                <Button variant="outline" onClick={limpiarFiltros}><X className="h-4 w-4" /> Limpiar filtros</Button>
                <Button onClick={onSync} disabled={isSyncing}>
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sincronizar
                </Button>
              </div>
            }
          />
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Neto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Pagador</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimientos.map((m) => {
              const esEntradaSinAsignar = m.direccion === "entrada" && !m.cliente_id && m.estado === "approved";
              const color = colorEstado(m.estado);
              return (
                <TableRow key={m.id} className={esEntradaSinAsignar ? "bg-orange-50/60 hover:bg-orange-50" : undefined}>
                  <TableCell className="whitespace-nowrap">
                    <div className="font-medium">{formatearFecha(m.fecha_creacion)}</div>
                    <div className="text-xs text-muted-foreground">#{m.mp_payment_id}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="gris">{nombreTipoOperacion(m.tipo_operacion)}</Badge>
                    {m.direccion === "salida" && <Badge variant="outline" className="ml-1">Saliente</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatearMoneda(m.monto)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {m.neto_recibido != null ? formatearMoneda(m.neto_recibido) : "—"}
                  </TableCell>
                  <TableCell><Badge variant={color}>{nombreEstado(m.estado)}</Badge></TableCell>
                  <TableCell className="text-sm max-w-[220px]">
                    <div className="font-medium truncate">
                      {[m.pagador_nombre, m.pagador_apellido].filter(Boolean).join(" ") || m.pagador_email || "—"}
                    </div>
                    {m.pagador_doc_numero && (
                      <div className="text-xs text-muted-foreground">CUIT {formatearCuit(m.pagador_doc_numero)}</div>
                    )}
                    {m.pagador_email && (m.pagador_nombre || m.pagador_apellido) && (
                      <div className="text-xs text-muted-foreground truncate">{m.pagador_email}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.cliente ? (
                      <Link href={`/clientes/${m.cliente.id}`} className="text-primary hover:underline text-sm">
                        {m.cliente.nombre} {m.cliente.apellido ?? ""}
                        {m.asignado_automaticamente && <Badge variant="secondary" className="ml-2">auto</Badge>}
                      </Link>
                    ) : m.direccion === "entrada" ? (
                      <Badge variant="alerta">Sin asignar</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.direccion === "entrada" && (
                      <Button variant="outline" size="sm" onClick={() => setMovASignar(m)}>
                        {m.cliente_id ? "Reasignar" : "Asignar"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </Card>

      {/* Paginación */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "0" : `${(pagina - 1) * porPagina + 1}-${Math.min(pagina * porPagina, total)}`} de {total}
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

      {movASignar && (
        <AsignarClienteModal
          movimiento={movASignar}
          clientes={clientes}
          onClose={() => { setMovASignar(null); router.refresh(); }}
        />
      )}

      <DescargarReporteModal
        open={reporteAbierto}
        onClose={() => setReporteAbierto(false)}
        clientes={clientes}
        filtrosActuales={filtros}
      />
    </div>
  );
}

function QuickPill({
  children, activo, onClick, variant,
}: {
  children: React.ReactNode;
  activo: boolean;
  onClick: () => void;
  variant?: "alerta";
}) {
  const base = "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer";
  const onActivo = "bg-primary text-primary-foreground border-primary";
  const alertaInactivo = "border-orange-300 text-orange-800 bg-orange-50 hover:bg-orange-100";
  const inactivo = "border-slate-200 text-slate-700 bg-white hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${activo ? onActivo : variant === "alerta" ? alertaInactivo : inactivo}`}
    >
      {children}
    </button>
  );
}
