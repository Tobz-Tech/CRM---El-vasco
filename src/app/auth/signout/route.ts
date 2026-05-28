import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Endpoint para cerrar sesión.
 * Llamarlo con: <form action="/auth/signout" method="post">
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, { status: 303 });
}
