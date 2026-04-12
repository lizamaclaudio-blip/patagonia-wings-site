"use client";

import { useEffect, useState } from "react";
import AuthPageFrame from "@/components/site/AuthPageFrame";
import PublicHeader from "@/components/site/PublicHeader";
import ProtectedPage, {
  useProtectedSession,
} from "@/components/site/ProtectedPage";
import {
  ensurePilotProfile,
  type PilotProfileRecord,
} from "@/lib/pilot-profile";

const certifications = [
  {
    code: "PILOT-CORE",
    name: "Inducción Patagonia Wings",
    category: "General",
    status: "Active",
    issuedAt: "2026-04-01",
    expiresAt: "2027-04-01",
  },
  {
    code: "IFR-STD",
    name: "Habilitación IFR estándar",
    category: "Operación",
    status: "Active",
    issuedAt: "2026-03-20",
    expiresAt: "2027-03-20",
  },
  {
    code: "DISPATCH-001",
    name: "Procedimiento de despacho",
    category: "Dispatch",
    status: "Pending",
    issuedAt: "2026-04-05",
    expiresAt: "2026-12-31",
  },
];

const ratings = [
  { code: "B737", name: "Boeing 737 Series", family: "Jet", status: "Training" },
  { code: "A320", name: "Airbus A320 Series", family: "Jet", status: "Locked" },
  { code: "C208", name: "Cessna 208 Caravan", family: "Turboprop", status: "Active" },
];

function CertificationsContent() {
  const session = useProtectedSession();
  const [profile, setProfile] = useState<PilotProfileRecord | null>(null);

  useEffect(() => {
    void ensurePilotProfile(session.user).then((row) => setProfile(row));
  }, [session.user]);

  const pilotName =
    profile?.callsign || session.user.email?.split("@")[0]?.toUpperCase() || "PILOTO";

  return (
    <AuthPageFrame>
      <div className="space-y-6">
        <section className="glass-panel rounded-[34px] p-7 sm:p-9">
        <span className="parallax-chip mb-6">CERTIFICACIONES</span>

        <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Habilitaciones y control operacional
        </h1>

        <p className="mt-5 max-w-3xl text-base leading-8 text-white/80">
          {pilotName}, aquí quedará la visión completa de certificaciones, ratings y permisos
          del piloto antes de liberar la reserva y el despacho hacia ACARS.
        </p>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-[30px] p-7">
          <span className="section-chip">Certificaciones</span>

          <div className="mt-6 space-y-4">
            {certifications.map((item) => (
              <div key={item.code} className="surface-outline rounded-[24px] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/54">
                      {item.code} / {item.category}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                      item.status === "Active"
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="surface-outline rounded-[18px] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/52">
                      Emitida
                    </p>
                    <p className="mt-1 text-sm text-white/82">{item.issuedAt}</p>
                  </div>

                  <div className="surface-outline rounded-[18px] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/52">
                      Vigencia
                    </p>
                    <p className="mt-1 text-sm text-white/82">{item.expiresAt}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[30px] p-7">
          <span className="section-chip">Ratings</span>

          <div className="mt-6 space-y-4">
            {ratings.map((item) => (
              <div key={item.code} className="surface-outline rounded-[22px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/54">
                      {item.code} / {item.family}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                      item.status === "Active"
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : item.status === "Training"
                          ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                          : "border-sky-400/20 bg-sky-400/10 text-sky-300"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        </section>
      </div>
    </AuthPageFrame>
  );
}

export default function CertificationsPage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container sticky top-4 z-40 pt-5">
            <PublicHeader />
          </header>

          <ProtectedPage>
            <CertificationsContent />
          </ProtectedPage>
        </div>
      </section>
    </main>
  );
}
