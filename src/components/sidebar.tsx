"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wallet, Users, Settings, LogOut, Menu, Package, ShoppingCart, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  cobrosSinAsignar: number;
  emailUsuario: string;
}

interface Item {
  href: string;
  label: string;
  icon: typeof Wallet;
  muestraBadge?: boolean;
}

interface Section {
  titulo: string;
  items: Item[];
}

const sections: Section[] = [
  {
    titulo: "Operación",
    items: [
      { href: "/cobranzas", label: "Cobranzas", icon: Wallet, muestraBadge: true },
      { href: "/pedidos",   label: "Pedidos",   icon: ShoppingCart },
    ],
  },
  {
    titulo: "Datos",
    items: [
      { href: "/clientes",  label: "Clientes",  icon: Users },
      { href: "/productos", label: "Productos", icon: Package },
    ],
  },
  {
    titulo: "Sistema",
    items: [
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

export function Sidebar({ cobrosSinAsignar, emailUsuario }: SidebarProps) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  function isActive(href: string) {
    if (pathname === href) return true;
    return pathname.startsWith(href + "/");
  }

  const NavItem = ({ it }: { it: Item }) => {
    const activo = isActive(it.href);
    const Icon = it.icon;
    return (
      <Link
        href={it.href}
        onClick={() => setAbierto(false)}
        className={cn(
          "flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
          activo
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <span className="flex items-center gap-3">
          <Icon className={cn("h-[18px] w-[18px]", activo ? "text-primary-foreground" : "text-slate-500")} />
          {it.label}
        </span>
        {it.muestraBadge && cobrosSinAsignar > 0 && (
          <Badge variant={activo ? "secondary" : "alerta"}>{cobrosSinAsignar}</Badge>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Header mobile */}
      <div className="md:hidden flex items-center justify-between border-b bg-white px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <BrandIcon />
          <span className="font-bold">MP Cobranzas</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setAbierto(!abierto)}>
          {abierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <aside
        className={cn(
          "border-r bg-white md:flex md:flex-col md:w-64 md:min-h-screen md:sticky md:top-0",
          abierto ? "flex flex-col" : "hidden"
        )}
      >
        {/* Brand desktop */}
        <div className="px-5 py-5 hidden md:flex items-center gap-3 border-b">
          <BrandIcon />
          <div>
            <div className="text-base font-bold tracking-tight leading-tight">MP Cobranzas</div>
            <div className="text-[11px] text-muted-foreground">Reparto · Cuenta corriente</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 md:py-3 space-y-5 overflow-y-auto">
          {sections.map((s) => (
            <div key={s.titulo}>
              <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {s.titulo}
              </div>
              <div className="space-y-0.5">
                {s.items.map((it) => <NavItem key={it.href} it={it} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t p-4 mt-auto">
          <div className="text-xs text-muted-foreground mb-2 truncate" title={emailUsuario}>
            {emailUsuario}
          </div>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>
    </>
  );
}

function BrandIcon() {
  // Mini-logo: un cuadrado azul con un "$" para evocar plata + reparto.
  return (
    <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-sm">
      $
    </div>
  );
}
