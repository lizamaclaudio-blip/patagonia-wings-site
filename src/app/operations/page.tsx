"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PublicHeader from "@/components/site/PublicHeader";

export default function OperationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?tab=dispatch");
  }, [router]);

  return (
    <div className="min-h-screen text-[var(--pw-text)]">
      <div className="pw-container py-6 sm:py-8">
        <PublicHeader />

        <section className="pw-card mt-6 rounded-[30px] px-6 py-8 sm:px-8 sm:py-10">
          <span className="section-chip">Operaciones</span>
          <h1 className="header-strip mt-4 text-3xl font-semibold">Centro de flujo operativo</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pw-text-soft)] sm:text-[15px]">
            Toda la operación real vive en <strong>Despacho</strong>. Esta vista queda como puente visual estilo Sur Air, con secciones cortas y desplegables.
          </p>

          <details className="mt-6 rounded-2xl border border-[var(--pw-border)] bg-white">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[var(--pw-teal-700)]">🧭 Flujo recomendado</summary>
            <div className="border-t border-[var(--pw-border)] px-4 py-3 text-sm text-[var(--pw-text-soft)]">
              1) Selecciona tipo de vuelo. 2) Elige aeronave. 3) Confirma itinerario. 4) Carga y valida OFP. 5) Envía a ACARS.
            </div>
          </details>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard?tab=dispatch" className="button-primary py-3">
              Ir a despacho
            </Link>
            <Link href="/dashboard" className="button-secondary py-3">
              Volver al dashboard
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

