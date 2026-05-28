import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { ClienteForm } from "@/components/cliente-form";

export default function NuevoClientePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/clientes"><ChevronLeft className="h-4 w-4" /> Volver</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight mt-2">Nuevo cliente</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <ClienteForm modo="crear" />
        </CardContent>
      </Card>
    </div>
  );
}
