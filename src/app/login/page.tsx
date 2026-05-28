"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/cobranzas";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(traducirError(error.message));
      setLoading(false);
      return;
    }

    // Redirigir y refrescar para que el middleware levante la sesión nueva.
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">MP Cobranzas</CardTitle>
          <CardDescription>Ingresá con tu mail y contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="papa@ejemplo.com"
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            {error && (
              <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 border border-rose-200">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <p className="text-xs text-muted-foreground text-center pt-2">
              Si no tenés cuenta, pedísela al administrador del sistema.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function traducirError(msg: string): string {
  if (msg.toLowerCase().includes("invalid login credentials")) {
    return "Mail o contraseña incorrectos.";
  }
  if (msg.toLowerCase().includes("email not confirmed")) {
    return "Tu cuenta todavía no fue confirmada. Pedíselo al administrador.";
  }
  return msg;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
