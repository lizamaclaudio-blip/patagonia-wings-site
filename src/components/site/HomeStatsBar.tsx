"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

type HomeStatItem = {
  key: string;
  label: string;
  value: number;
};

type RouteRow = {
  id?: string | null;
  destination_ident?: string | null;
  is_active?: boolean | null;
};

type AircraftRow = {
  id?: string | null;
  aircraft_type_code?: string | null;
};

const FALLBACK_STATS: HomeStatItem[] = [
  { key: "routes", label: "Rutas", value: 0 },
  { key: "destinations", label: "Destinos", value: 0 },
  { key: "aircraft", label: "Aeronaves", value: 0 },
  { key: "types", label: "Tipos", value: 0 },
];

const integerFormatter = new Intl.NumberFormat("es-CL");

function normalizeAircraftTypeCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

async function loadHomeStats() {
  const [routesResponse, aircraftResponse] = await Promise.all([
    supabase.from("network_routes").select("id, destination_ident, is_active"),
    supabase.from("aircraft").select("id, aircraft_type_code"),
  ]);

  if (routesResponse.error) {
    throw routesResponse.error;
  }

  if (aircraftResponse.error) {
    throw aircraftResponse.error;
  }

  const activeRoutes = ((routesResponse.data ?? []) as RouteRow[]).filter((row) => {
    const destination = (row.destination_ident ?? "").trim();
    return destination.length > 0 && row.is_active !== false;
  });

  const uniqueDestinations = new Set(
    activeRoutes
      .map((row) => (row.destination_ident ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  const aircraftRows = (aircraftResponse.data ?? []) as AircraftRow[];
  const uniqueAircraftIds = new Set(
    aircraftRows
      .map((row) => (typeof row.id === "string" ? row.id : String(row.id ?? "")).trim())
      .filter(Boolean),
  );
  const uniqueAircraftTypes = new Set(
    aircraftRows
      .map((row) => normalizeAircraftTypeCode(row.aircraft_type_code))
      .filter(Boolean),
  );

  return [
    { key: "routes", label: "Rutas", value: activeRoutes.length },
    { key: "destinations", label: "Destinos", value: uniqueDestinations.size },
    { key: "aircraft", label: "Aeronaves", value: uniqueAircraftIds.size },
    { key: "types", label: "Tipos", value: uniqueAircraftTypes.size },
  ] satisfies HomeStatItem[];
}

function AnimatedStatValue({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousTargetRef = useRef(value);

  useEffect(() => {
    const from = previousTargetRef.current;
    const to = value;

    if (from === to) {
      setDisplayValue(to);
      return;
    }

    const duration = 900;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(from + (to - from) * eased);
      setDisplayValue(nextValue);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    previousTargetRef.current = to;

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [value]);

  return <>{integerFormatter.format(displayValue)}</>;
}

export default function HomeStatsBar() {
  const [stats, setStats] = useState<HomeStatItem[]>(FALLBACK_STATS);

  useEffect(() => {
    let isMounted = true;
    let refreshTimer: number | null = null;

    const refreshStats = async () => {
      try {
        const nextStats = await loadHomeStats();
        if (isMounted) {
          setStats(nextStats);
        }
      } catch {
        if (isMounted) {
          setStats((current) => (current.length ? current : FALLBACK_STATS));
        }
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void refreshStats();
      }, 180);
    };

    const visibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void refreshStats();
      }
    };

    void refreshStats();

    const channel = supabase
      .channel("home-stats-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "network_routes" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aircraft" },
        scheduleRefresh,
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void refreshStats();
    }, 120000);

    document.addEventListener("visibilitychange", visibilityRefresh);

    return () => {
      isMounted = false;
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", visibilityRefresh);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="parallax-stats grid gap-0 overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(4,21,44,0.78)] backdrop-blur-md md:grid-cols-4">
      {stats.map((item, index) => (
        <div
          key={item.key}
          className={`flex min-h-[132px] flex-col items-center justify-center px-6 py-7 text-center ${
            index !== stats.length - 1 ? "md:border-r md:border-r-white/16" : ""
          }`}
        >
          <span className="text-[52px] font-semibold leading-none tracking-[-0.04em] text-emerald-300 sm:text-[58px]">
            <AnimatedStatValue value={item.value} />
          </span>
          <span className="mt-2 text-[26px] font-medium text-white/90">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
