import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarTemplateClientes } from "@/lib/excel";

/**
 * GET /api/clientes/template
 * Devuelve un archivo .xlsx con los campos a completar para importar clientes.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const buf = await generarTemplateClientes();
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-clientes.xlsx"',
      "Content-Length": String(buf.byteLength),
    },
  });
}
