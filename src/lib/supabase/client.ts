import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Cliente de Supabase para usar en el NAVEGADOR (componentes "use client").
 * Usa la anon key, que es pública y segura para el frontend.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
