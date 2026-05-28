import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware de Next.js: se ejecuta en cada request.
 * Lo usamos para:
 *   1) Refrescar la sesión de Supabase (importante para cookies).
 *   2) Redirigir a /login si el usuario no está autenticado y quiere entrar a una ruta privada.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplicar middleware a todas las rutas EXCEPTO:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - rutas de API públicas (las protegemos por su cuenta dentro de cada handler)
     * - archivos con extensión (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
