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

type FleetRow = {
  registration?: string | null;
  aircraft_type?: string | null;
};

const FALLBACK_STATS: HomeStatItem[] = [
  { key: "routes", label: "Rutas", value: 0 },
  { key: "destinations", label: "Destinos", value: 0 },
  { key: "aircraft", label: "Aeronaves", value: 0 },
  { key: "types", label: "Tipos", value: 0 },
  { key: "todayFlights", label: "Vuelos de hoy", value: 0 },
];

const integerFormatter = new Intl.NumberFormat("es-CL");

function normalizeAircraftTypeCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function isOperationalReservationStatus(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized.length > 0 && !["cancelled", "aborted", "interrupted", "crashed"].includes(normalized);
}

function isSameUtcDate(value: string | null | undefined, targetDateKey: string) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === targetDateKey;
}

async function loadHomeStats() {
  const todayKey = new Date().toISOString().slice(0, 10);

  const [routesResponse, fleetResponse, modelsResponse, reservationsResponse] = await Promise.all([
    supabase.from("network_routes").select("id, destination_ident, is_active"),
    supabase.from("aircraft_fleet").select("registration, aircraft_type"),
    supabase.from("aircraft_models").select("code, is_active"),
    supabase
      .from("flight_reservations")
      .select("status, reserved_at, dispatched_at, departed_at, completed_at, created_at"),
  ]);

  if (routesResponse.error) {
    throw routesResponse.error;
  }

  if (fleetResponse.error) {
    throw fleetResponse.error;
  }

  if (modelsResponse.error) {
    throw modelsResponse.error;
  }

  if (reservationsResponse.error) {
    throw reservationsResponse.error;
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

  const fleetRows = (fleetResponse.data ?? []) as FleetRow[];
  const uniqueAircraftIds = new Set(
    fleetRows
      .map((row) => (row.registration ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  const activeModels = ((modelsResponse.data ?? []) as Array<{ code?: string | null; is_active?: boolean | null }>)
    .filter((row) => row.is_active !== false);
  const uniqueAircraftTypes = new Set(
    activeModels
      .map((row) => normalizeAircraftTypeCode(row.code))
      .filter(Boolean),
  );

  const todaysFlights = ((reservationsResponse.data ?? []) as Array<{
    status?: string | null;
    reserved_at?: string | null;
    dispatched_at?: string | null;
    departed_at?: string | null;
    completed_at?: string | null;
    created_at?: string | null;
  }>).filter((row) => {
    if (!isOperationalReservationStatus(row.status)) {
      return false;
    }

    return [
      row.reserved_at,
      row.dispatched_at,
      row.departed_at,
      row.completed_at,
      row.created_at,
    ].some((value) => isSameUtcDate(value, todayKey));
  });

  return [
    { key: "routes", label: "Rutas", value: activeRoutes.length },
    { key: "destinations", label: "Destinos", value: uniqueDestinations.size },
    { key: "aircraft", label: "Aeronaves", value: uniqueAircraftIds.size },
    { key: "types", label: "Tipos", value: uniqueAircraftTypes.size },
    { key: "todayFlights", label: "Vuelos de hoy", value: todaysFlights.length },
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
        { event: "*", schema: "public", table: "aircraft_fleet" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aircraft_models" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_reservations" },
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
    <div className="parallax-stats grid gap-0 overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(4,21,44,0.78)] backdrop-blur-md md:grid-cols-5">
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
