"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { borrarPedido } from "@/lib/actions/pedidos";

export function BorrarPedidoBoton({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("¿Borrar este pedido? Se borran también todos sus items.")) return;
    startTransition(async () => {
      const r = await borrarPedido(pedidoId);
      if (!r.ok) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending} title="Borrar pedido">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-rose-600" />}
    </Button>
  );
}
