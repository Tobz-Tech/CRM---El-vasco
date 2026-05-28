"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { crearCliente, actualizarCliente, borrarCliente } from "@/lib/actions/clientes";
import type { Cliente } from "@/types/database";

interface Props {
  modo: "crear" | "editar";
  cliente?: Cliente;
}

export function ClienteForm({ modo, cliente }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(null); setOk(null);
    startTransition(async () => {
      if (modo === "crear") {
        const r = await crearCliente(formData);
        if (r && !r.ok) setError(r.error);
        // Si fue ok, el server action ya hizo redirect.
      } else if (cliente) {
        const r = await actualizarCliente(cliente.id, formData);
        if (!r.ok) setError(r.error);
        else setOk("Cliente actualizado.");
      }
    });
  }

  async function onBorrar() {
    if (!cliente) return;
    if (!confirm(`¿Borrar al cliente "${cliente.nombre} ${cliente.apellido ?? ""}"? Los movimientos quedan registrados pero sin asignar.`)) return;
    startTransition(async () => {
      const r = await borrarCliente(cliente.id);
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field name="nombre" label="Nombre *" defaultValue={cliente?.nombre ?? ""} required />
        <Field name="apellido" label="Apellido" defaultValue={cliente?.apellido ?? ""} />
        <Field name="cuit_cuil" label="CUIT/CUIL" defaultValue={cliente?.cuit_cuil ?? ""} placeholder="20123456789" />
        <Field name="email" label="Email" type="email" defaultValue={cliente?.email ?? ""} />
        <Field name="telefono" label="Teléfono" defaultValue={cliente?.telefono ?? ""} />
        <Field name="direccion" label="Dirección" defaultValue={cliente?.direccion ?? ""} />
        <Field name="localidad" label="Localidad" defaultValue={cliente?.localidad ?? ""} />
        <Field name="provincia" label="Provincia" defaultValue={cliente?.provincia ?? ""} />
      </div>

      <div>
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" defaultValue={cliente?.notas ?? ""} rows={3} />
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 border border-rose-200">{error}</div>
      )}
      {ok && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 border border-emerald-200">{ok}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" disabled={pending} size="lg">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {modo === "crear" ? "Crear cliente" : "Guardar cambios"}
          </Button>
        </div>
        {modo === "editar" && (
          <Button type="button" variant="destructive" onClick={onBorrar} disabled={pending}>
            Borrar cliente
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  name, label, defaultValue, type, placeholder, required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type ?? "text"}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
