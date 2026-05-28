"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarTokenMP, actualizarFrecuenciaSync } from "@/lib/actions/config";

interface Props {
  tokenGuardado: boolean;
  collectorId: string | null;
  frecuencia: number;
}

export function ConfigForms({ tokenGuardado, collectorId, frecuencia }: Props) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [freq, setFreq] = useState(frecuencia);
  const [pendingToken, startToken] = useTransition();
  const [pendingFreq, startFreq] = useTransition();
  const [msgToken, setMsgToken] = useState<string | null>(null);
  const [msgFreq, setMsgFreq] = useState<string | null>(null);

  function guardarToken() {
    setMsgToken(null);
    startToken(async () => {
      const r = await actualizarTokenMP(token);
      if (r.ok) {
        setMsgToken(`Token guardado correctamente${r.collectorId ? ` (collector_id: ${r.collectorId})` : ""}.`);
        setToken("");
        router.refresh();
      } else {
        setMsgToken(`Error: ${r.error}`);
      }
    });
  }

  function guardarFreq() {
    setMsgFreq(null);
    startFreq(async () => {
      const r = await actualizarFrecuenciaSync(freq);
      if (r.ok) {
        setMsgFreq("Frecuencia actualizada.");
        router.refresh();
      } else {
        setMsgFreq(`Error: ${r.error}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-sm">
          Estado actual: {tokenGuardado ? (
            <span className="font-medium text-emerald-700">token guardado en DB ✓</span>
          ) : (
            <span className="font-medium text-amber-700">sin token en DB (se usa el de .env)</span>
          )}
          {collectorId && <span className="text-muted-foreground ml-2">· collector_id: {collectorId}</span>}
        </div>

        <Label htmlFor="token">Nuevo Access Token</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxxxx"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button onClick={guardarToken} disabled={pendingToken || !token.trim()}>
            {pendingToken && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Lo validamos contra Mercado Pago antes de guardarlo, así nos aseguramos de que funcione.
        </p>
        {msgToken && (
          <div className={`text-sm rounded-md px-3 py-2 border ${msgToken.startsWith("Error") ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"}`}>
            {msgToken}
          </div>
        )}
      </div>

      <div className="border-t pt-6 space-y-2">
        <Label htmlFor="freq">Frecuencia de sincronización (minutos)</Label>
        <div className="flex gap-2 items-center">
          <Input
            id="freq"
            type="number"
            min={1}
            max={60}
            value={freq}
            onChange={(e) => setFreq(parseInt(e.target.value || "0", 10))}
            className="w-32"
          />
          <Button onClick={guardarFreq} disabled={pendingFreq || freq < 1 || freq > 60} variant="outline">
            {pendingFreq && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          La frecuencia real depende del cron configurado en Vercel (vercel.json) o en Supabase (pg_cron).
          Este valor es informativo y se usa si más adelante creamos un cron interno propio.
        </p>
        {msgFreq && (
          <div className={`text-sm rounded-md px-3 py-2 border ${msgFreq.startsWith("Error") ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"}`}>
            {msgFreq}
          </div>
        )}
      </div>
    </div>
  );
}
