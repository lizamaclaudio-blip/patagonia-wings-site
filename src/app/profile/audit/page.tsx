"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicHeader from "@/components/site/PublicHeader";
import ProtectedPage, { useProtectedSession } from "@/components/site/ProtectedPage";
import { ensurePilotProfile } from "@/lib/pilot-profile";
import { reglajeSections } from "@/lib/pwg-reglaje";
import { supabase } from "@/lib/supabase/browser";

type AuditStatus = "ok" | "warn" | "off";

type AuditResult = {
  key: string;
  status: AuditStatus;
  value: string;
};

function StatusBadge({ status }: { status: AuditStatus }) {
  const map = {
    ok: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    warn: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    off: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  } as const;

  const label = status === "ok" ? "Activo" : status === "warn" ? "Parcial" : "Inactivo";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${map[status]}`}>{label}</span>;
}

function AuditContent() {
  const session = useProtectedSession();
  const [callsign, setCallsign] = useState("");
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Record<string, AuditResult>>({});

  useEffect(() => {
    async function runAudit() {
      setLoading(true);
      const profile = await ensurePilotProfile(session.user);
      const nextCallsign = (profile?.callsign ?? "").trim().toUpperCase();
      setCallsign(nextCallsign);

      if (nextCallsign !== "PWG001") {
        setLoading(false);
        return;
      }

      const nextResults: Record<string, AuditResult> = {};

      const mark = (key: string, status: AuditStatus, value: string) => {
        nextResults[key] = { key, status, value };
      };

      const [routesRes, profilesRes, coverageRes, scoreRes, reservationRpcRes, dispatchRes, flightDesignatorRes, promotionsRes] = await Promise.all([
        supabase.from("network_routes").select("id", { count: "exact", head: true }),
        supabase.from("network_route_block_profiles").select("route_id, scheduled_block_min, expected_block_p50, expected_block_p80, buffer_departure_min_high, buffer_arrival_min_high").limit(1),
        supabase.from("v_hub_rank_route_coverage").select("hub_code, rank_code, visible_route_count").limit(10),
        supabase.from("pw_pilot_scores").select("pilot_callsign, pulso_10, ruta_10, legado_points").eq("pilot_callsign", nextCallsign).maybeSingle(),
        supabase.rpc("pw_get_active_reservation_for_pilot", { p_callsign: nextCallsign }),
        supabase.from("dispatch_packages").select("reservation_id", { count: "exact", head: true }),
        supabase.from("network_routes").select("flight_number, flight_designator").limit(1),
        supabase.from("pw_rank_promotion_requests").select("id", { count: "exact", head: true }),
      ]);

      mark(
        "network_routes",
        routesRes.error ? "off" : (routesRes.count ?? 0) > 0 ? "ok" : "warn",
        routesRes.error ? routesRes.error.message : `${routesRes.count ?? 0} rutas detectadas`
      );

      const profilesRow = profilesRes.error ? null : profilesRes.data?.[0] ?? null;
      const depHigh = Number(profilesRow?.buffer_departure_min_high ?? 0);
      const arrHigh = Number(profilesRow?.buffer_arrival_min_high ?? 0);
      mark(
        "block_profiles",
        profilesRes.error ? "off" : profilesRow ? (depHigh >= 30 && arrHigh >= 30 ? "ok" : "warn") : "warn",
        profilesRes.error
          ? profilesRes.error.message
          : profilesRow
            ? `SCH ${profilesRow.scheduled_block_min ?? "—"} / P50 ${profilesRow.expected_block_p50 ?? "—"} / P80 ${profilesRow.expected_block_p80 ?? "—"} / buffers ${depHigh}-${arrHigh}`
            : "Sin perfiles legibles"
      );

      const hasCoverage = !coverageRes.error && (coverageRes.data ?? []).length > 0;
      const zeroCoverage = hasCoverage
        ? (coverageRes.data ?? []).some((row) => Number(row.visible_route_count ?? 0) <= 0)
        : false;
      mark(
        "coverage_view",
        coverageRes.error ? "off" : hasCoverage ? (zeroCoverage ? "warn" : "ok") : "warn",
        coverageRes.error ? coverageRes.error.message : hasCoverage ? (zeroCoverage ? "Hay hubs/rangos con 0 rutas" : "Cobertura visible OK") : "Sin datos"
      );

      mark(
        "pilot_scores",
        scoreRes.error ? "off" : scoreRes.data ? "ok" : "warn",
        scoreRes.error ? scoreRes.error.message : scoreRes.data ? `Pulso ${scoreRes.data.pulso_10 ?? 0} · Ruta ${scoreRes.data.ruta_10 ?? 0} · Legado ${scoreRes.data.legado_points ?? 0}` : "Sin score aún"
      );

      mark(
        "active_reservation_rpc",
        reservationRpcRes.error ? "off" : "ok",
        reservationRpcRes.error ? reservationRpcRes.error.message : `${(reservationRpcRes.data ?? []).length} reserva(s) activas`
      );

      mark(
        "dispatch_packages",
        dispatchRes.error ? "off" : (dispatchRes.count ?? 0) >= 0 ? "ok" : "warn",
        dispatchRes.error ? dispatchRes.error.message : `${dispatchRes.count ?? 0} dispatch package(s)`
      );

      const flightDesignatorRow = flightDesignatorRes.error ? null : flightDesignatorRes.data?.[0] ?? null;
      mark(
        "flight_designator",
        flightDesignatorRes.error ? "off" : flightDesignatorRow?.flight_designator ? "ok" : "warn",
        flightDesignatorRes.error ? flightDesignatorRes.error.message : flightDesignatorRow?.flight_designator ? `${flightDesignatorRow.flight_designator}` : "Sin designator legible"
      );

      mark(
        "promotion_requests",
        promotionsRes.error ? "off" : "ok",
        promotionsRes.error ? promotionsRes.error.message : `${promotionsRes.count ?? 0} solicitud(es)`
      );

      setResults(nextResults);
      setLoading(false);
    }

    void runAudit();
  }, [session.user]);

  const isAllowed = useMemo(() => callsign === "PWG001", [callsign]);

  return (
    <div className="pw-container py-12 sm:py-16 lg:py-20">
      <section className="glass-panel rounded-[34px] p-7 sm:p-9">
        <span className="parallax-chip mb-6">AUDITORÍA INTERNA</span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">Índice vivo Patagonia Wings</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-white/80">
              Registro interno de reglaje + chequeo rápido contra Supabase. Queda oculto del resto y visible solo para PWG001.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/profile" className="button-ghost">Volver al perfil</Link>
            <Link href="/operations" className="button-secondary">Ir a operaciones</Link>
          </div>
        </div>
      </section>

      {!isAllowed && !loading ? (
        <section className="mt-6 glass-panel rounded-[30px] p-7">
          <p className="text-white/80">Esta vista está reservada para PWG001.</p>
        </section>
      ) : null}

      {isAllowed ? (
        <div className="mt-6 grid gap-6">
          {reglajeSections.map((section) => (
            <section key={section.key} className="glass-panel rounded-[30px] p-7">
              <span className="section-chip">{section.title}</span>
              <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="surface-outline rounded-[24px] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">Reglas vigentes</p>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-white/82">
                    {section.rules.map((rule) => (
                      <p key={rule}>• {rule}</p>
                    ))}
                  </div>
                </div>
                <div className="surface-outline rounded-[24px] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">Chequeos Supabase</p>
                  <div className="mt-4 space-y-4">
                    {section.checks.map((check) => {
                      const result = results[check.key];
                      return (
                        <div key={check.key} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{check.label}</p>
                              <p className="mt-1 text-xs text-white/56">{check.description}</p>
                            </div>
                            <StatusBadge status={result?.status ?? (loading ? "warn" : "off")} />
                          </div>
                          <p className="mt-3 text-sm text-white/82">{loading ? "Comprobando..." : result?.value ?? check.expected}</p>
                          <p className="mt-2 text-xs text-white/50">Esperado: {check.expected}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ProfileAuditPage() {
  return (
    <ProtectedPage>
      <PublicHeader />
      <AuditContent />
    </ProtectedPage>
  );
}
