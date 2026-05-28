import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Cliente de Supabase para usar en el SERVIDOR (Server Components, Server Actions, Route Handlers).
 * Usa la anon key + cookies del usuario para que las queries respeten RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // El método setAll se llamó desde un Server Component.
            // Esto se puede ignorar si hay middleware refrescando la sesión.
          }
        },
      },
    }
  );
}

/**
 * Cliente de Supabase con la SERVICE ROLE KEY.
 * NO respeta RLS: usalo solo en API routes y edge functions donde necesitamos
 * permisos elevados (por ejemplo, insertar movimientos sincronizados).
 *
 * IMPORTANTE: nunca lo importes desde un Client Component.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
