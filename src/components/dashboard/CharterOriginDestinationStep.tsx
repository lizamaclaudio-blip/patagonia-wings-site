"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listCharterAircraftAtOrigin,
  searchCharterAirports,
  type CharterAircraftOption,
  type CharterAirportOption,
} from "@/lib/charter-ops";

type Props = {
  originIcao: string;
  destinationIcao: string;
  scheduledDeparture: string;
  selectedAircraftId?: string | null;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onScheduledDepartureChange: (value: string) => void;
  onAircraftChange: (aircraft: CharterAircraftOption | null) => void;
};

function normalizeIcao(value: string) {
  return value.trim().toUpperCase();
}

function AirportSearchBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CharterAirportOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    let mounted = true;
    const clean = query.trim();

    if (clean.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timeout = window.setTimeout(() => {
      searchCharterAirports(clean, 12)
        .then((items) => {
          if (mounted) setResults(items);
        })
        .catch(() => {
          if (mounted) setResults([]);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 220);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="relative rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
      <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">{label}</label>
      <input
        value={query}
        onChange={(event) => {
          const next = normalizeIcao(event.target.value);
          setQuery(next);
          onChange(next);
        }}
        placeholder="Ej: SCEL"
        maxLength={6}
        className="mt-3 w-full rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-lg font-semibold uppercase tracking-[0.16em] text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/45"
      />
      <p className="mt-2 text-xs text-white/42">
        {loading ? "Buscando aeropuertos..." : "Escribe ICAO, ciudad o nombre de aeropuerto."}
      </p>

      {results.length > 0 ? (
        <div className="absolute left-4 right-4 top-[104px] z-30 max-h-72 overflow-y-auto rounded-[18px] border border-white/10 bg-[#07111f]/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {results.map((airport) => (
            <button
              key={`${label}-${airport.icao}`}
              type="button"
              onClick={() => {
                setQuery(airport.icao);
                onChange(airport.icao);
                setResults([]);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2 text-left transition hover:bg-white/[0.07]"
            >
              <span>
                <span className="block text-sm font-semibold text-white">{airport.icao} · {airport.name ?? "Aeropuerto"}</span>
                <span className="block text-xs text-white/42">{airport.city ?? "Ciudad"} · {airport.country ?? "País"}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CharterOriginDestinationStep({
  originIcao,
  destinationIcao,
  scheduledDeparture,
  selectedAircraftId,
  onOriginChange,
  onDestinationChange,
  onScheduledDepartureChange,
  onAircraftChange,
}: Props) {
  const [aircraft, setAircraft] = useState<CharterAircraftOption[]>([]);
  const [loadingAircraft, setLoadingAircraft] = useState(false);

  const normalizedOrigin = useMemo(() => normalizeIcao(originIcao), [originIcao]);
  const normalizedDestination = useMemo(() => normalizeIcao(destinationIcao), [destinationIcao]);
  const routeReady = normalizedOrigin.length >= 3 && normalizedDestination.length >= 3 && normalizedOrigin !== normalizedDestination;

  useEffect(() => {
    let mounted = true;

    if (normalizedOrigin.length < 3) {
      setAircraft([]);
      onAircraftChange(null);
      return;
    }

    setLoadingAircraft(true);
    listCharterAircraftAtOrigin(normalizedOrigin)
      .then((items) => {
        if (!mounted) return;
        setAircraft(items);
        const current = items.find((item) => item.aircraft_id === selectedAircraftId) ?? null;
        if (!current) onAircraftChange(null);
      })
      .catch(() => {
        if (!mounted) return;
        setAircraft([]);
        onAircraftChange(null);
      })
      .finally(() => {
        if (mounted) setLoadingAircraft(false);
      });

    return () => {
      mounted = false;
    };
  }, [normalizedOrigin, onAircraftChange, selectedAircraftId]);

  return (
    <div className="grid gap-5">
      <div className="rounded-[24px] border border-cyan-300/14 bg-cyan-300/[0.045] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/55">Chárter</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Origen / Destino libre</h3>
        <p className="mt-2 text-sm leading-6 text-white/58">
          El piloto elige cualquier aeropuerto cargado en la base. La aeronave y el piloto se moverán al destino al cerrar el vuelo, igual que Itinerario.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AirportSearchBox label="Origen" value={originIcao} onChange={onOriginChange} />
        <AirportSearchBox label="Destino" value={destinationIcao} onChange={onDestinationChange} />
      </div>

      <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
        <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Horario UTC</label>
        <input
          type="datetime-local"
          value={scheduledDeparture}
          onChange={(event) => onScheduledDepartureChange(event.target.value)}
          className="mt-3 w-full rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/45"
        />
        <p className="mt-2 text-xs text-white/42">La meteorología real queda obligatoria para este tipo de vuelo.</p>
      </div>

      <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Aeronaves disponibles</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Licencia válida + ubicación en {normalizedOrigin || "origen"}</h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-semibold text-white/55">
            {loadingAircraft ? "Cargando" : `${aircraft.length} disponibles`}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {aircraft.map((item) => {
            const selected = item.aircraft_id === selectedAircraftId;
            return (
              <button
                key={item.aircraft_id}
                type="button"
                disabled={!routeReady}
                onClick={() => onAircraftChange(item)}
                className={`rounded-[18px] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  selected
                    ? "border-cyan-300/45 bg-cyan-300/[0.12]"
                    : "border-white/8 bg-white/[0.035] hover:border-cyan-300/24 hover:bg-cyan-300/[0.07]"
                }`}
              >
                <p className="text-sm font-semibold text-white">{item.tail_number || item.aircraft_code}</p>
                <p className="mt-1 text-xs text-white/45">{item.aircraft_name}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/60">{item.aircraft_type_code ?? item.aircraft_code}</p>
              </button>
            );
          })}

          {!loadingAircraft && aircraft.length === 0 ? (
            <p className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4 text-sm text-white/55 md:col-span-2 xl:col-span-3">
              No hay aeronaves con licencia válida disponibles en el origen seleccionado.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
