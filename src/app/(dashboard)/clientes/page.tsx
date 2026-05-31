import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Upload, Users } from "lucide-react";
import { formatearMoneda, formatearFecha, formatearCuit, tiempoRelativo, cn } from "@/lib/utils";
import { ImportarClientesModal } from "@/components/importar-clientes-modal";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import type { ClienteConTotales } from "@/types/database";

export const dynamic = "force-dynamic";

interface SP {
  q?: string;
  estado?: "todos" | "deudores" | "al_dia" | "a_favor";
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { q, estado } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clientes_con_totales")
    .select("*")
    .order("nombre", { ascending: true });

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `nombre.ilike.%${term}%,apellido.ilike.%${term}%,nombre_local.ilike.%${term}%,cuit_cuil.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  // Filtros por saldo
  if (estado === "deudores")   query = query.gt("saldo", 0);
  if (estado === "al_dia")     query = query.eq("saldo", 0);
  if (estado === "a_favor")    query = query.lt("saldo", 0);

  const { data: clientesData, error } = await query.limit(2000);
  // supabase-js infiere mal el row type para views con .or() filter encadenado,
  // así que casteamos al tipo correcto.
  const clientes = (clientesData ?? []) as ClienteConTotales[];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Clientes"
        subtitulo={`${clientes.length} cliente${clientes.length === 1 ? "" : "s"}`}
        acciones={
          <>
            <ImportarClientesModal
              trigger={
                <Button variant="outline" size="lg" type="button">
                  <Upload className="h-4 w-4" /> Importar Excel
                </Button>
              }
            />
            <Button asChild size="lg">
              <Link href="/clientes/nuevo"><Plus className="h-4 w-4" /> Nuevo cliente</Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <FiltroPills q={q ?? ""} estado={estado} />

        <form className="flex gap-2 max-w-md w-full md:w-auto">
          <input type="hidden" name="estado" value={estado ?? ""} />
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input name="q" defaultValue={q ?? ""} placeholder="Buscar nombre, CUIT o email" className="pl-8" />
          </div>
          <Button type="submit" variant="outline">Buscar</Button>
        </form>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error.message}
        </div>
      )}

      <Card>
        {clientes.length === 0 ? (
          <EmptyState
            icono={<Users className="h-6 w-6" />}
            titulo={q || estado ? "Sin resultados" : "Todavía no hay clientes cargados"}
            descripcion={q || estado ? "Probá quitar filtros o usar otra búsqueda." : "Cargá el primer cliente o subí un Excel."}
            accion={
              q || estado ? (
                <Button asChild variant="outline"><Link href="/clientes">Limpiar filtros</Link></Button>
              ) : (
                <Button asChild><Link href="/clientes/nuevo"><Plus className="h-4 w-4" /> Nuevo cliente</Link></Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>CUIT/CUIL</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Consumido</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Último pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((c) => {
                const saldo = Number(c.saldo ?? 0);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/clientes/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.nombre} {c.apellido ?? ""}
                      </Link>
                      {c.nombre_local && (
                        <div className="text-xs font-medium text-slate-600">🏪 {c.nombre_local}</div>
                      )}
                      {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{c.cuit_cuil ? formatearCuit(c.cuit_cuil) : "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700">
                      {formatearMoneda(c.total_recibido_historico)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-orange-700">
                      {formatearMoneda(c.total_consumido ?? 0)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {saldo > 0 ? (
                        <Badge variant="rojo">Debe {formatearMoneda(saldo)}</Badge>
                      ) : saldo < 0 ? (
                        <Badge variant="verde">A favor {formatearMoneda(Math.abs(saldo))}</Badge>
                      ) : (
                        <Badge variant="gris">Al día</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.ultimo_pago_fecha ? (
                        <div>
                          <div>{formatearFecha(c.ultimo_pago_fecha, { soloFecha: true })}</div>
                          <div className="text-xs text-muted-foreground">
                            {tiempoRelativo(c.ultimo_pago_fecha)} · {formatearMoneda(c.ultimo_pago_monto)}
                          </div>
                        </div>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function FiltroPills({ q, estado }: { q: string; estado?: string }) {
  const items: { value: string; label: string; color?: string }[] = [
    { value: "", label: "Todos" },
    { value: "deudores",  label: "Deudores",  color: "border-rose-300 text-rose-700 bg-rose-50" },
    { value: "al_dia",    label: "Al día",    color: "border-slate-300 text-slate-700 bg-slate-50" },
    { value: "a_favor",   label: "A favor",   color: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  ];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {items.map((it) => {
        const activo = (it.value || "") === (estado ?? "");
        const p = new URLSearchParams();
        if (q) p.set("q", q);
        if (it.value) p.set("estado", it.value);
        const href = `/clientes${p.toString() ? `?${p.toString()}` : ""}`;
        return (
          <Link
            key={it.value || "todos"}
            href={href}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
              activo
                ? "bg-primary text-primary-foreground border-primary"
                : it.color ?? "border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
