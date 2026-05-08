"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

type AcarsLiveSample = {
  altitude?: number | null;
  gs?: number | null;
  heading?: number | null;
  vs?: number | null;
  fuel_kg?: number | null;
  fuel_capacity?: number | null;
  fuel_source?: string | null;
  distance_planned_nm?: number | null;
  distance_remaining_nm?: number | null;
  distance_source?: string | null;
  lat?: number | null;
  lon?: number | null;
  [key: string]: unknown;
};

type AcarsLiveData = {
  received_at?: string | null;
  phase?: string | null;
  last_sample?: AcarsLiveSample | null;
  events?: string[] | null;
  elapsed_seconds?: number | null;
  airborne_seconds?: number | null;
  warnings?: string[] | null;
};

type LiveResponse = {
  ok: boolean;
  reservationId?: string;
  status?: string;
  updatedAt?: string;
  flightNumber?: string;
  origin?: string;
  destination?: string;
  aircraftRegistration?: string;
  aircraftType?: string;
  acarsLive?: AcarsLiveData | null;
  hasLiveData?: boolean;
  error?: string;
};

function formatElapsed(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "--:--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fuelDisplay(kg: number | null | undefined, capacity: number | null | undefined): string {
  if (kg == null) return "N/D";
  const kgStr = Math.round(kg).toLocaleString("es-CL");
  if (capacity == null || capacity <= 10) return `${kgStr} kg`;
  return `${kgStr} / ${Math.round(capacity).toLocaleString("es-CL")} kg`;
}

function phaseLabel(phase: string | null | undefined): string {
  if (!phase) return "Desconocida";
  const map: Record<string, string> = {
    pre_flight: "Pre-Vuelo",
    preflight: "Pre-Vuelo",
    pushback: "Pushback",
    pushback_taxi: "Rodaje",
    taxi: "Rodaje",
    takeoff: "Despegue",
    climb: "Ascenso",
    cruise: "Crucero",
    descent: "Descenso",
    approach: "Aproximación",
    landing: "Aterrizaje",
    rollout: "Rodaje llegada",
    arrived: "Llegado",
    disconnected: "Desconectado",
  };
  return map[phase.toLowerCase()] ?? phase;
}

type Props = {
  reservationId: string | null | undefined;
  isActive: boolean;
};

export function AcarsLiveLogPanel({ reservationId, isActive }: Props) {
  const [data, setData] = useState<LiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchLive() {
    if (!reservationId) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/acars/live?reservationId=${encodeURIComponent(reservationId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await res.json()) as LiveResponse;
      setData(json);
      setLastFetched(new Date());
    } catch {
      // network error — keep showing stale data
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!reservationId || !isActive) {
      setData(null);
      return;
    }
    setLoading(true);
    fetchLive();
    intervalRef.current = setInterval(fetchLive, 8000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, isActive]);

  if (!reservationId || !isActive) return null;

  const live = data?.acarsLive ?? null;
  const sample = live?.last_sample ?? null;
  const now = new Date();
  const ageSeconds = lastFetched ? Math.floor((now.getTime() - lastFetched.getTime()) / 1000) : null;
  const stale = ageSeconds != null && ageSeconds > 30;
  const connected = data?.hasLiveData && !stale;

  return (
    <div className="mt-4 rounded-xl border border-blue-900/40 bg-[#0c1929] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold tracking-widest text-blue-300 uppercase">
          Log ACARS en vivo
        </span>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            loading
              ? "bg-yellow-900/40 text-yellow-300"
              : connected
              ? "bg-green-900/40 text-green-300"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          {loading ? "Cargando..." : connected ? "Conectado" : "Sin datos ACARS"}
        </span>
      </div>

      {data?.error && (
        <p className="text-red-400 text-[11px] mb-2">{data.error}</p>
      )}

      {lastFetched && (
        <p className="text-[10px] text-gray-500 mb-3">
          Última actualización: {lastFetched.toLocaleTimeString("es-CL")}
          {stale && " · Datos desactualizados"}
        </p>
      )}

      {live ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <Row label="Fase" value={phaseLabel(live.phase)} />
          <Row label="Elapsed" value={formatElapsed(live.elapsed_seconds)} />
          <Row label="Airborne" value={formatElapsed(live.airborne_seconds)} />
          {sample && (
            <>
              <Row label="Altitud" value={sample.altitude != null ? `${Math.round(sample.altitude).toLocaleString("es-CL")} ft` : "N/D"} />
              <Row label="GS" value={sample.gs != null ? `${Math.round(sample.gs)} kt` : "N/D"} />
              <Row label="Rumbo" value={sample.heading != null ? `${Math.round(sample.heading)}°` : "N/D"} />
              <Row label="VS" value={sample.vs != null ? `${Math.round(sample.vs)} fpm` : "N/D"} />
              <Row
                label="Fuel"
                value={fuelDisplay(sample.fuel_kg, sample.fuel_capacity)}
                sub={sample.fuel_source ?? undefined}
              />
              <Row
                label="Distancia plan."
                value={sample.distance_planned_nm != null ? `${Math.round(sample.distance_planned_nm)} nm` : "N/D"}
              />
              <Row
                label="Dist. restante"
                value={sample.distance_remaining_nm != null ? `${Math.round(sample.distance_remaining_nm)} nm` : "N/D"}
                sub={sample.distance_source ?? undefined}
              />
            </>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-gray-500 italic">
          Sin datos de vuelo activo. El ACARS envía telemetría cuando el vuelo está en progreso.
        </p>
      )}

      {live?.warnings && live.warnings.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-yellow-400 uppercase mb-1">Advertencias</p>
          {live.warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-yellow-300">
              · {w}
            </p>
          ))}
        </div>
      )}

      {live?.events && live.events.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-blue-400 uppercase mb-1">Eventos recientes</p>
          {live.events.slice(-5).map((e, i) => (
            <p key={i} className="text-[10px] text-blue-200">
              · {String(e)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 text-right font-mono">
        {value}
        {sub && (
          <span className="text-gray-500 text-[9px] ml-1">({sub})</span>
        )}
      </span>
    </>
  );
}
