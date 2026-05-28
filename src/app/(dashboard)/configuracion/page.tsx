import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfigForms } from "./config-forms";
import { PageHeader } from "@/components/page-header";
import { formatearFecha, tiempoRelativo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const supabase = await createClient();

  const { data: cfg } = await supabase
    .from("config")
    .select("*")
    .eq("singleton", true)
    .single();

  const { data: logs } = await supabase
    .from("sync_logs")
    .select("*")
    .order("iniciado_en", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        titulo="Configuración"
        subtitulo="Ajustes del sistema y bitácora de sincronizaciones"
      />

      <Card>
        <CardHeader>
          <CardTitle>Token de Mercado Pago</CardTitle>
          <CardDescription>
            Se guarda encriptado en la base de datos. Si lo dejás vacío, se usa el del archivo .env.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigForms
            tokenGuardado={!!cfg?.mp_access_token_encrypted}
            collectorId={cfg?.mp_collector_id ?? null}
            frecuencia={cfg?.frecuencia_sync_min ?? 5}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas sincronizaciones</CardTitle>
          <CardDescription>
            Última corrida: {cfg?.ultima_sincronizacion ? `${formatearFecha(cfg.ultima_sincronizacion)} (${tiempoRelativo(cfg.ultima_sincronizacion)})` : "nunca"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Nuevos</TableHead>
                <TableHead className="text-right">Actualizados</TableHead>
                <TableHead className="text-right">Asign. auto</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Todavía no hay sincronizaciones registradas.
                  </TableCell>
                </TableRow>
              )}
              {(logs ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{formatearFecha(l.iniciado_en)}</TableCell>
                  <TableCell>
                    <Badge variant={l.estado === "exito" ? "verde" : l.estado === "error" ? "rojo" : "amarillo"}>
                      {l.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{l.disparado_por}</TableCell>
                  <TableCell className="text-right">{l.movimientos_nuevos}</TableCell>
                  <TableCell className="text-right">{l.movimientos_actualizados}</TableCell>
                  <TableCell className="text-right">{l.asignados_auto}</TableCell>
                  <TableCell className="text-xs text-rose-700 max-w-[260px] truncate" title={l.error_mensaje ?? undefined}>
                    {l.error_mensaje ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
