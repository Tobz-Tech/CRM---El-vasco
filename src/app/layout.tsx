import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MP Cobranzas",
  description: "Sistema interno para detectar pagos de Mercado Pago y asignarlos a clientes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
