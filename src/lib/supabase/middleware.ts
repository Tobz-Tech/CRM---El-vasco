import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Lógica del middleware de auth:
 *   1) Refresca la sesión de Supabase escribiendo cookies actualizadas.
 *   2) Si el usuario no está logueado y va a una ruta privada, lo manda a /login.
 *   3) Si el usuario está logueado y va a /login, lo manda al dashboard.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: no poner código entre createServerClient y getUser().
  // Si lo hacés, podés perder la sesión del usuario.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rutas públicas que no requieren login.
  const esRutaPublica =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/sync"); // El cron de Vercel se autoriza con CRON_SECRET, no con sesión.

  // Si no está logueado y va a una ruta privada → redirigir a /login.
  if (!user && !esRutaPublica) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Si está logueado y va a /login → mandarlo al dashboard.
  if (user && pathname.startsWith("/login")) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/cobranzas";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  return supabaseResponse;
}
