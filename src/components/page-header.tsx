import { cn } from "@/lib/utils";

interface Props {
  titulo: string;
  subtitulo?: React.ReactNode;
  acciones?: React.ReactNode;
  className?: string;
}

/**
 * Encabezado uniforme para todas las pantallas internas.
 *
 *   <PageHeader
 *     titulo="Cobranzas"
 *     subtitulo="Última sync: hace 5 min"
 *     acciones={<Button>Sincronizar</Button>}
 *   />
 */
export function PageHeader({ titulo, subtitulo, acciones, className }: Props) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-2 border-b", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titulo}</h1>
        {subtitulo && <div className="text-sm text-muted-foreground">{subtitulo}</div>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}
