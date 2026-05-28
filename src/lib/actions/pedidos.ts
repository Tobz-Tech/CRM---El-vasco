"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ItemSchema = z.object({
  producto_id: z.string().uuid().nullable(),
  descripcion: z.string().trim().min(1, "Cada item necesita una descripción"),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0"),
  precio_unitario: z.number().min(0, "El precio no puede ser negativo"),
});

const PedidoSchema = z.object({
  cliente_id: z.string().uuid("Cliente inválido"),
  fecha: z.string().min(1, "Falta la fecha"),
  nota: z.string().trim().optional().nullable(),
  items: z.array(ItemSchema).min(1, "El pedido debe tener al menos un item"),
});

export type ItemInput = z.infer<typeof ItemSchema>;

interface CrearPedidoInput {
  cliente_id: string;
  fecha: string;
  nota?: string | null;
  items: ItemInput[];
}

export async function crearPedido(input: CrearPedidoInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const parsed = PedidoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // 1) Insertar la cabecera. El total se va a setear solo al insertar los items
  // gracias al trigger recalcular_total_pedido.
  const { data: pedido, error: errPedido } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: parsed.data.cliente_id,
      fecha: new Date(parsed.data.fecha).toISOString(),
      nota: parsed.data.nota ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (errPedido) return { ok: false as const, error: errPedido.message };

  // 2) Insertar items.
  const itemsRows = parsed.data.items.map((it) => ({
    pedido_id: pedido!.id,
    producto_id: it.producto_id,
    descripcion: it.descripcion,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
  }));
  const { error: errItems } = await supabase.from("pedido_items").insert(itemsRows);

  if (errItems) {
    // Rollback manual del pedido si falla la inserción de items.
    await supabase.from("pedidos").delete().eq("id", pedido!.id);
    return { ok: false as const, error: errItems.message };
  }

  revalidatePath(`/clientes/${parsed.data.cliente_id}`);
  revalidatePath("/clientes");
  return { ok: true as const, id: pedido!.id };
}

export async function borrarPedido(pedidoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  // Traer el cliente_id para revalidar su perfil.
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("cliente_id")
    .eq("id", pedidoId)
    .single();

  const { error } = await supabase.from("pedidos").delete().eq("id", pedidoId);
  if (error) return { ok: false as const, error: error.message };

  if (pedido?.cliente_id) revalidatePath(`/clientes/${pedido.cliente_id}`);
  revalidatePath("/clientes");
  return { ok: true as const };
}
