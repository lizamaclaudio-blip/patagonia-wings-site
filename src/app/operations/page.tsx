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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(25,66,122,0.26),transparent_42%),linear-gradient(180deg,#04111f_0%,#071a2e_52%,#03101c_100%)] text-white">
      <div className="pw-container py-6 sm:py-8">
        <PublicHeader />

        <section className="glass-panel mt-6 rounded-[30px] px-6 py-8 sm:px-8 sm:py-10">
          <span className="section-chip">Operaciones limpiado</span>
          <h1 className="mt-4 text-3xl font-semibold text-white">Este flujo viejo ya no se usa</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72 sm:text-[15px]">
            Reserva, plan y briefing ahora viven dentro del panel de <strong>Despacho</strong> en el dashboard.
            Te estoy enviando automáticamente a esa vista para que no sigamos duplicando lógica ni manteniendo dos flujos distintos.
          </p>

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
