import { cn } from "@/lib/utils";

interface Props {
  icono?: React.ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
  className?: string;
}

/**
 * Empty state estándar para tablas y listas vacías.
 *
 *   <EmptyState
 *     icono={<ShoppingCart />}
 *     titulo="Todavía no hay pedidos"
 *     descripcion="Cargá el primer pedido para arrancar"
 *     accion={<Button>Nuevo pedido</Button>}
 *   />
 */
export function EmptyState({ icono, titulo, descripcion, accion, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-4", className)}>
      {icono && (
        <div className="rounded-full bg-slate-100 p-3 text-slate-500 mb-3">
          {icono}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
      {descripcion && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
