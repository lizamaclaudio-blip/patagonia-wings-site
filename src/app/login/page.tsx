"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PublicHeader from "@/components/site/PublicHeader";
import { supabase } from "@/lib/supabase/browser";
import { ensurePilotProfile } from "@/lib/pilot-profile";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    return next || "/dashboard";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;

      if (data.session?.user) {
        await ensurePilotProfile(data.session.user);
        router.replace(nextPath);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [nextPath, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setInfoMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    if (data.user) {
      await ensurePilotProfile(data.user);
    }

    setInfoMessage("Sesión iniciada correctamente.");
    setSubmitting(false);
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="pw-container flex min-h-[calc(100vh-108px)] items-center py-12 sm:py-16 lg:py-20">
      <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="glass-panel rounded-[34px] p-7 sm:p-9 lg:p-10">
          <span className="parallax-chip mb-6">ACCESO PILOTO</span>

          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Inicia sesión en el portal operacional
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-white/82">
            Desde aquí el piloto entra a su entorno web para revisar perfil,
            habilitaciones, dashboard y el flujo previo al vuelo antes del ACARS.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              "Portal web premium",
              "Preparación previa al vuelo",
              "Base para sesión persistente",
            ].map((item) => (
              <div
                key={item}
                className="surface-outline rounded-[22px] px-5 py-5 text-sm leading-7 text-white/80"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-[34px] p-7 sm:p-9">
          <span className="section-chip">Login</span>

          <h2 className="mt-4 text-3xl font-semibold text-white">
            Entrar al sistema
          </h2>

          <p className="mt-3 text-sm leading-7 text-white/72">
            Acceso real con email y contraseña, manteniendo el diseño aprobado.
          </p>

          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="field-label">Email de acceso</label>
              <input
                className="input-premium"
                type="email"
                placeholder="correo@patagoniawings.app"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="field-label">Contraseña</label>
              <input
                className="input-premium"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {errorMessage ? (
              <div className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {errorMessage}
              </div>
            ) : null}

            {infoMessage ? (
              <div className="rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                {infoMessage}
              </div>
            ) : null}

            <div className="grid gap-3 pt-2">
              <button type="submit" className="button-primary" disabled={submitting}>
                {submitting ? "Ingresando..." : "Entrar"}
              </button>

              <Link href="/register" className="button-secondary">
                Crear cuenta piloto
              </Link>

              <Link href="/" className="button-ghost">
                Volver al inicio
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen overflow-hidden">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container pt-5">
            <PublicHeader />
          </header>

          <Suspense
            fallback={
              <div className="pw-container flex min-h-[calc(100vh-108px)] items-center py-12 sm:py-16 lg:py-20">
                <section className="glass-panel rounded-[34px] p-7 sm:p-9">
                  <span className="parallax-chip mb-6">ACCESO PILOTO</span>
                  <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                    Cargando acceso Patagonia Wings
                  </h1>
                </section>
              </div>
            }
          >
            <LoginPageContent />
          </Suspense>
        </div>
      </section>
    </main>
  );
}