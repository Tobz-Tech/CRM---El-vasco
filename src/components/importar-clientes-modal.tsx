"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ResultadoImport {
  ok: boolean;
  total_filas?: number;
  creados?: number;
  omitidos_por_duplicado?: number;
  errores?: { fila: number; mensaje: string }[];
  error?: string;
}

export function ImportarClientesModal({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setArchivo(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function importar() {
    if (!archivo) return;
    setResultado(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("archivo", archivo);
      try {
        const r = await fetch("/api/clientes/importar", { method: "POST", body: fd });
        // Leer como texto primero para no romper si la respuesta no es JSON (ej. 500 vacío).
        const txt = await r.text();
        let json: ResultadoImport;
        try {
          json = txt ? JSON.parse(txt) : { ok: false, error: `Error ${r.status} sin respuesta del servidor` };
        } catch {
          json = { ok: false, error: `Respuesta inesperada del servidor (HTTP ${r.status}): ${txt.slice(0, 200)}` };
        }
        if (!r.ok && !json.error) {
          json.ok = false;
          json.error = `Error HTTP ${r.status}`;
        }
        setResultado(json);
        if (json.ok && (json.creados ?? 0) > 0) {
          router.refresh();
        }
      } catch (err) {
        setResultado({ ok: false, error: `Error de red: ${(err as Error).message}` });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <div onClick={() => setOpen(true)} className="contents">{trigger}</div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar clientes desde Excel
          </DialogTitle>
          <DialogDescription>
            Descargá la plantilla, completala y subila. El único campo obligatorio es "nombre". Los clientes con CUIT que ya existan se omiten.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-slate-50 p-4 space-y-3">
          <div className="font-medium">Paso 1 — Descargá la plantilla</div>
          <Button asChild variant="outline">
            <a href="/api/clientes/template" download>
              <Download className="h-4 w-4" /> Descargar plantilla
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            La plantilla es un archivo Excel con los nombres de columnas correctos y una fila de ejemplo (borrala antes de subir).
          </p>
        </div>

        <div className="rounded-md border p-4 space-y-3">
          <div className="font-medium">Paso 2 — Subí el archivo completado</div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded file:border file:border-input file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-accent"
          />
          {archivo && (
            <p className="text-xs text-muted-foreground">
              Archivo seleccionado: <span className="font-medium">{archivo.name}</span>
            </p>
          )}
        </div>

        {resultado && (
          <div className={`rounded-md border p-4 space-y-2 ${resultado.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
            {resultado.ok ? (
              <>
                <div className="flex items-center gap-2 font-medium text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" /> Importación terminada
                </div>
                <ul className="text-sm text-emerald-900 space-y-0.5">
                  <li>Filas leídas: <strong>{resultado.total_filas ?? 0}</strong></li>
                  <li>Creados: <strong>{resultado.creados ?? 0}</strong></li>
                  <li>Omitidos (ya existían): <strong>{resultado.omitidos_por_duplicado ?? 0}</strong></li>
                </ul>
                {resultado.errores && resultado.errores.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-emerald-200">
                    <div className="text-xs font-medium text-amber-900 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Errores en {resultado.errores.length} fila{resultado.errores.length === 1 ? "" : "s"}:
                    </div>
                    <ul className="text-xs text-amber-900 mt-1 max-h-32 overflow-y-auto">
                      {resultado.errores.map((e, i) => (
                        <li key={i}>Fila {e.fila}: {e.mensaje}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-rose-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {resultado.error ?? "Error al importar"}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {resultado?.ok && (resultado.creados ?? 0) > 0 ? (
            <Button onClick={() => { setOpen(false); reset(); }}>Cerrar</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
              <Button onClick={importar} disabled={!archivo || pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Upload className="h-4 w-4" /> Importar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
