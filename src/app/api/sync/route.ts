import { NextResponse } from "next/server";
import { sincronizarMP } from "@/lib/mp-sync";

/**
 * Endpoint que dispara la sincronización.
 *
 * Lo invocan dos cosas:
 *   1) El cron job de Vercel (configurado en vercel.json: cada 5 min).
 *   2) Manualmente desde un client component si quisieras (también podés usar el server action).
 *
 * Autorización:
 *   - Si la request viene del Cron de Vercel, trae el header `Authorization: Bearer <CRON_SECRET>`
 *     y nosotros lo validamos contra la env var CRON_SECRET.
 *   - Si no, dejamos pasar requests "internas" desde el mismo proyecto (Vercel agrega `x-vercel-cron: 1`).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60; // segundos

export async function GET(request: Request) {
  return ejecutar(request);
}

export async function POST(request: Request) {
  return ejecutar(request);
}

async function ejecutar(request: Request) {
  const auth = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-vercel-cron");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;

  // Validación: aceptamos si pasa cualquiera de las dos.
  const okBearer = auth && process.env.CRON_SECRET && auth === expected;
  const okCronVercel = !!cronHeader;

  if (!okBearer && !okCronVercel) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resultado = await sincronizarMP({ disparadoPor: "cron" });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
