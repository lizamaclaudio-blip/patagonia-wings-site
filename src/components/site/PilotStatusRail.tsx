"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useProtectedSession } from "@/components/site/ProtectedPage";
import { getActiveFlightReservation } from "@/lib/flight-ops";
import {
  ensurePilotProfile,
  type PilotProfileRecord,
} from "@/lib/pilot-profile";
import { supabase } from "@/lib/supabase/browser";

type ScoreSnapshot = {
  pulso10: number;
  ruta10: number;
  legado: number;
  wallet: number;
};

type RankBadge = {
  symbol: string;
  label: string;
};

const EMPTY_SCORE: ScoreSnapshot = {
  pulso10: 0,
  ruta10: 0,
  legado: 0,
  wallet: 0,
};

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return `$${formatInteger(value)}`;
}

function formatRankLabel(value: string | null | undefined) {
  const normalized = (value ?? "CADET").trim();
  if (!normalized) {
    return "Cadet";
  }

  return normalized
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
}

function getPilotName(profile: PilotProfileRecord | null, email?: string | null) {
  const parts = [profile?.first_name?.trim(), profile?.last_name?.trim()].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  const localPart = email?.split("@")[0]?.trim();
  if (localPart) {
    return localPart;
  }

  return profile?.callsign ?? "Piloto Patagonia Wings";
}

function getInitials(profile: PilotProfileRecord | null, email?: string | null) {
  const first = profile?.first_name?.trim().charAt(0) ?? "";
  const last = profile?.last_name?.trim().charAt(0) ?? "";
  const combined = `${first}${last}`.trim().toUpperCase();

  if (combined) {
    return combined;
  }

  return (profile?.callsign ?? email?.slice(0, 2) ?? "PW").slice(0, 2).toUpperCase();
}

function getTotalHours(profile: PilotProfileRecord | null) {
  if (!profile) {
    return 0;
  }

  const raw = profile as PilotProfileRecord & {
    total_hours?: number | string | null;
    career_hours?: number | string | null;
    transferred_hours?: number | string | null;
  };

  const total = toNumber(raw.total_hours);
  if (total > 0) {
    return total;
  }

  return toNumber(raw.career_hours) + toNumber(raw.transferred_hours);
}

function getWallet(profile: PilotProfileRecord | null) {
  const raw = profile as (PilotProfileRecord & {
    wallet_balance?: number | string | null;
  }) | null;

  return toNumber(raw?.wallet_balance);
}

function getCurrentAirport(profile: PilotProfileRecord | null) {
  return profile?.current_airport_icao ?? profile?.current_airport_code ?? profile?.base_hub ?? "SCEL";
}

function getRankBadge(rank: string | null | undefined): RankBadge {
  const code = (rank ?? "CADET").trim().toUpperCase();

  if (code.includes("LEGEND")) {
    return { symbol: "✦", label: "Leyenda Patagonia" };
  }

  if (code.includes("INSPECTOR") || code.includes("CHECK") || code.includes("MASTER")) {
    return { symbol: "★", label: "Inspector de línea" };
  }

  if (code.includes("COMMANDER")) {
    return { symbol: "◆", label: "Comandante regional" };
  }

  if (code.includes("CAPTAIN")) {
    return { symbol: "▲", label: "Capitán de línea" };
  }

  if (code.includes("FIRST_OFFICER")) {
    return { symbol: "■", label: "Primer oficial" };
  }

  if (code.includes("SECOND_OFFICER")) {
    return { symbol: "●", label: "Segundo oficial" };
  }

  return { symbol: "◈", label: "Cadete" };
}

export default function PilotStatusRail() {
  const session = useProtectedSession();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PilotProfileRecord | null>(null);
  const [score, setScore] = useState<ScoreSnapshot>(EMPTY_SCORE);
  const [activeRoute, setActiveRoute] = useState<string>("-");

  useEffect(() => {
    let cancelled = false;

    async function loadRail() {
      setLoading(true);

      try {
        const currentProfile = await ensurePilotProfile(session.user);

        if (cancelled) {
          return;
        }

        setProfile(currentProfile);

        if (!currentProfile?.callsign) {
          setScore(EMPTY_SCORE);
          setActiveRoute("-");
          setLoading(false);
          return;
        }

        const [scoreResponse, reservation] = await Promise.all([
          supabase
            .from("pw_pilot_scores")
            .select("pulso_10, ruta_10, legado_points")
            .eq("pilot_callsign", currentProfile.callsign)
            .maybeSingle(),
          getActiveFlightReservation(currentProfile),
        ]);

        if (cancelled) {
          return;
        }

        setScore({
          pulso10: toNumber(scoreResponse.data?.pulso_10),
          ruta10: toNumber(scoreResponse.data?.ruta_10),
          legado: toNumber(scoreResponse.data?.legado_points),
          wallet: getWallet(currentProfile),
        });

        setActiveRoute(
          reservation?.routeText?.trim() ||
            (reservation?.origin && reservation?.destination
              ? `${reservation.origin} - ${reservation.destination}`
              : reservation?.routeCode?.trim() || "-")
        );
      } catch {
        if (!cancelled) {
          setScore(EMPTY_SCORE);
          setActiveRoute("-");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRail();

    return () => {
      cancelled = true;
    };
  }, [session.user]);

  const rankBadge = useMemo(
    () => getRankBadge(profile?.career_rank_code ?? profile?.rank_code),
    [profile?.career_rank_code, profile?.rank_code]
  );

  const pilotName = useMemo(
    () => getPilotName(profile, session.user.email),
    [profile, session.user.email]
  );

  const pilotInitials = useMemo(
    () => getInitials(profile, session.user.email),
    [profile, session.user.email]
  );

  const rankLabel = useMemo(
    () => formatRankLabel(profile?.career_rank_code ?? profile?.rank_code),
    [profile?.career_rank_code, profile?.rank_code]
  );

  return (
    <aside className="xl:sticky xl:top-28">
      <div className="glass-panel overflow-hidden rounded-[30px] border border-white/10 p-5 sm:p-6">
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/14 bg-[radial-gradient(circle_at_top,rgba(103,215,255,0.28),rgba(4,20,40,0.9))] text-2xl font-semibold tracking-[0.2em] text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
            {pilotInitials}
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/56">
            {profile?.callsign ?? "PWG000"}
          </p>
          <h3 className="mt-2 text-2xl font-semibold leading-tight text-white">
            {pilotName}
          </h3>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base">
              {rankBadge.symbol}
            </span>
            <div className="text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
                Escalafón
              </span>
              <strong className="text-sm font-semibold text-white">{rankBadge.label}</strong>
            </div>
          </div>

          <p className="mt-3 text-sm text-white/70">{rankLabel}</p>
        </div>

        <div className="mt-5 space-y-3">
          {[
            { label: "HUB", value: profile?.base_hub ?? "SCEL" },
            { label: "Ubicación", value: getCurrentAirport(profile) },
            { label: "Vuelo reservado", value: activeRoute },
          ].map((item) => (
            <div
              key={item.label}
              className="surface-outline rounded-[20px] px-4 py-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/54">
                {item.label}
              </p>
              <p className="mt-2 text-base font-semibold text-white">{loading ? "…" : item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            { label: "Procedimiento", value: formatDecimal(score.pulso10) },
            { label: "Misión", value: formatDecimal(score.ruta10) },
            { label: "Trayectoria", value: formatInteger(score.legado) },
            { label: "Billetera", value: formatCurrency(score.wallet) },
          ].map((item) => (
            <div
              key={item.label}
              className="surface-outline rounded-[20px] px-4 py-4 text-center"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/54">
                {item.label}
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{loading ? "…" : item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 surface-outline rounded-[22px] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/54">
            Horas totales
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {loading ? "…" : formatDecimal(getTotalHours(profile))}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Link href="/profile?view=perfil" className="button-secondary w-full">
            Mi perfil
          </Link>
          <Link href="/profile?view=datos" className="button-ghost w-full">
            Mis datos
          </Link>
        </div>
      </div>
    </aside>
  );
}
