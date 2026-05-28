"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desasignarMovimiento } from "@/lib/actions/movimientos";

export function DesasignarBoton({ movimientoId }: { movimientoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("¿Desasignar este movimiento del cliente?")) return;
    startTransition(async () => {
      const r = await desasignarMovimiento(movimientoId);
      if (!r.ok) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Desasignar
    </Button>
  );
}
