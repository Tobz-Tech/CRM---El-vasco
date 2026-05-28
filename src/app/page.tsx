import { redirect } from "next/navigation";

/**
 * La ruta raíz no muestra nada propio: si hay sesión redirige a /cobranzas,
 * si no hay sesión el middleware ya redirige a /login.
 */
export default function HomePage() {
  redirect("/cobranzas");
}
