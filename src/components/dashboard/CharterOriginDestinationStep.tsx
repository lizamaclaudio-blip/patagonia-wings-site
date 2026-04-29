"use client";

import { useEffect, useMemo, useState } from "react";
import type { PilotProfileRecord } from "@/lib/pilot-profile";
import {
  listCharterAircraftAtOrigin,
  searchCharterAirports,
  type CharterAircraftOption,
  type CharterAirportOption,
} from "@/lib/charter-ops";

type FlightEconomyEstimate = {
  distanceNm: number;
  blockMinutes: number;
  fuelKg: number;
  fuelCostUsd: number;
  maintenanceCostUsd: number;
  pilotCommissionUsd: number;
  pilotPaymentUsd?: number;
  airlineRevenueUsd: number;
  netProfitUsd: number;
  estimatedPassengers?: number;
  estimatedCargoKg?: number;
  airportFeesUsd?: number;
  handlingCostUsd?: number;
  repairReserveUsd?: number;
  onboardServiceRevenueUsd?: number;
  onboardSalesRevenueUsd?: number;
  onboardServiceCostUsd?: number;
  totalCostUsd?: number;
  profitMarginPct?: number;
  confidenceLabel?: string;
  aircraftCompatible?: boolean;
  compatibilityReason?: string;
  practicalRangeNm?: number;
  usableFuelCapacityKg?: number;
};

type Props = {
  originIcao: string;
  destinationIcao: string;
  scheduledDeparture: string;
  selectedAircraftId?: string | null;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onScheduledDepartureChange: (value: string) => void;
  onAircraftChange: (aircraft: CharterAircraftOption | null) => void;
  originLocked?: boolean;
  profile?: PilotProfileRecord | null;
};

const AIRCRAFT_TYPE_LABELS: Record<string, string> = {
  A319: "Airbus A319",
  A320: "Airbus A320",
  A20N: "Airbus A320neo",
  A321: "Airbus A321",
  A21N: "Airbus A321neo",
  A339: "Airbus A330-900neo",
  A359: "Airbus A350-900",
  ATR72: "ATR 72-600",
  AT76: "ATR 72-600",
  B350: "Beechcraft 350 King Air",
  BE58: "Beechcraft 58 Baron",
  B736: "Boeing 737-600",
  B737: "Boeing 737-700",
  B738: "Boeing 737-800",
  B739: "Boeing 737-900",
  B38M: "Boeing 737 MAX 8",
  B789: "Boeing 787-9",
  B78X: "Boeing 787-10",
  C208: "Cessna 208B Grand Caravan",
  DH8D: "De Havilland Dash 8 Q400",
  E175: "Embraer E175",
  E190: "Embraer E190",
  E195: "Embraer E195",
  MD82: "McDonnell Douglas MD-82",
};

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("es-CL", { maximumFractionDigits: 0 })} USD`;
}

function formatMinutes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const minutes = Math.max(0, Math.round(value));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${String(rest).padStart(2, "0")} min` : `${rest} min`;
}

function normalizeIcao(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function normalizeCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function getAircraftTypeCode(item: CharterAircraftOption) {
  return normalizeCode(item.aircraft_type_code ?? item.aircraft_code);
}

function getAircraftTypeName(code: string) {
  return AIRCRAFT_TYPE_LABELS[normalizeCode(code)] ?? normalizeCode(code) ?? "Sin tipo";
}

function getAircraftTypeLabel(value: string | null | undefined) {
  const code = normalizeCode(value);
  const name = getAircraftTypeName(code);
  return code && name !== code ? `${code} · ${name}` : name;
}

function getAircraftRegistrationLabel(item: CharterAircraftOption) {
  return (item.tail_number ?? "").trim() || "Sin matrícula";
}

function getAircraftSummaryLabel(item: CharterAircraftOption | null) {
  if (!item) return "Sin selección";
  const registration = (item.tail_number ?? "").trim() || "Sin matrícula";
  const typeCode = getAircraftTypeCode(item);
  const typeName = getAircraftTypeName(typeCode);
  return `${registration} · ${typeCode} · ${typeName}`;
}

function AirportSearchBox({
  label,
  value,
  onChange,
  locked = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locked?: boolean;
}) {
  const [query, setQuery] = useState(normalizeIcao(value));
  const [results, setResults] = useState<CharterAirportOption[]>([]);
  const [exactAirport, setExactAirport] = useState<CharterAirportOption | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(normalizeIcao(value));
  }, [value]);

  useEffect(() => {
    let mounted = true;
    const clean = normalizeIcao(query);

    setExactAirport(null);

    if (locked) {
      if (clean.length === 4) {
        searchCharterAirports(clean, 1)
          .then((items) => {
            if (!mounted) return;
            setExactAirport(items.find((airport) => airport.icao === clean) ?? null);
          })
          .catch(() => {
            if (!mounted) return;
            setExactAirport(null);
          });
      }

      setResults([]);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    if (clean.length < 3) {
      setResults([]);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    const timeout = window.setTimeout(() => {
      searchCharterAirports(clean, clean.length === 4 ? 8 : 12)
        .then((items) => {
          if (!mounted) return;

          const exact = items.find((airport) => airport.icao === clean) ?? null;
          setExactAirport(exact);

          if (clean.length === 4 && exact) {
            setResults([]);
            return;
          }

          const filtered = clean.length === 4
            ? items.filter((airport) => airport.icao === clean || airport.icao.startsWith(clean))
            : items;

          setResults(filtered);
        })
        .catch(() => {
          if (!mounted) return;
          setResults([]);
          setExactAirport(null);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, clean.length === 4 ? 80 : 180);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [locked, query]);

  return (
    <div className="relative rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
      <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">{label}</label>
      <input
        value={query}
        onChange={(event) => {
          if (locked) return;
          const next = normalizeIcao(event.target.value);
          setQuery(next);
          onChange(next);
        }}
        readOnly={locked}
        placeholder=""
        maxLength={4}
        className={`mt-3 w-full rounded-[16px] border border-white/10 px-4 py-3 text-lg font-semibold uppercase tracking-[0.16em] text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/45 ${
          locked ? "cursor-not-allowed bg-white/[0.035] text-white/72" : "bg-black/20"
        }`}
      />

      <div className="mt-2 min-h-[18px] text-xs text-white/42">
        {locked ? (
          exactAirport ? (
            <span className="font-semibold text-emerald-200">
              {exactAirport.icao} seleccionado · {exactAirport.name ?? "Aeropuerto"}
            </span>
          ) : (
            "Origen bloqueado según ubicación actual del piloto."
          )
        ) : loading ? (
          "Validando ICAO..."
        ) : exactAirport ? (
          <span className="font-semibold text-emerald-200">
            {exactAirport.icao} seleccionado · {exactAirport.name ?? "Aeropuerto"}
          </span>
        ) : query.length >= 4 ? (
          <span className="text-amber-100/75">ICAO no encontrado todavía en la base.</span>
        ) : (
          "Escribe el ICAO exacto del aeropuerto."
        )}
      </div>

      {!locked && results.length > 0 ? (
        <div className="absolute left-4 right-4 top-[104px] z-30 max-h-72 overflow-y-auto rounded-[18px] border border-cyan-300/18 bg-[#07111f]/98 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {results.map((airport) => (
            <button
              key={`${label}-${airport.icao}`}
              type="button"
              onClick={() => {
                setQuery(airport.icao);
                setExactAirport(airport);
                onChange(airport.icao);
                setResults([]);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2 text-left transition hover:bg-cyan-300/[0.10]"
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

function DarkDropdown({
  label,
  placeholder,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: Array<{ value: string; label: string; description?: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.value === value) ?? null;

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className="relative">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-[#061427] px-4 py-3 text-left text-sm font-semibold text-white outline-none transition hover:border-cyan-300/28 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <span className="text-white/45">⌄</span>
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-[86px] z-40 max-h-72 overflow-y-auto rounded-[18px] border border-cyan-300/18 bg-[#07111f]/98 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.62)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="w-full rounded-[13px] px-3 py-2 text-left text-sm font-semibold text-white/55 transition hover:bg-white/[0.06] hover:text-white"
          >
            {placeholder}
          </button>

          {options.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
              className={`w-full rounded-[13px] px-3 py-2 text-left transition ${
                item.value === value ? "bg-cyan-300/[0.14]" : "hover:bg-cyan-300/[0.08]"
              }`}
            >
              <span className="block truncate text-sm font-semibold text-white">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 block truncate text-xs text-white/42">{item.description}</span>
              ) : null}
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
  originLocked = true,
  profile = null,
}: Props) {
  const [aircraft, setAircraft] = useState<CharterAircraftOption[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [loadingAircraft, setLoadingAircraft] = useState(false);
  const [economyEstimate, setEconomyEstimate] = useState<FlightEconomyEstimate | null>(null);
  const [loadingEconomy, setLoadingEconomy] = useState(false);
  const [typeCompatibility, setTypeCompatibility] = useState<Record<string, { compatible: boolean; reason: string }>>({});
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);

  const normalizedOrigin = useMemo(() => normalizeIcao(originIcao), [originIcao]);
  const normalizedDestination = useMemo(() => normalizeIcao(destinationIcao), [destinationIcao]);
  const routeReady = normalizedOrigin.length === 4 && normalizedDestination.length === 4 && normalizedOrigin !== normalizedDestination;

  const aircraftTypes = useMemo(() => {
    return Array.from(
      new Set(
        aircraft
          .map((item) => getAircraftTypeCode(item))
          .filter(Boolean),
      ),
    ).sort();
  }, [aircraft]);

  useEffect(() => {
    let mounted = true;

    if (!routeReady || aircraftTypes.length === 0) {
      setTypeCompatibility({});
      setLoadingCompatibility(false);
      return () => {
        mounted = false;
      };
    }

    setLoadingCompatibility(true);
    Promise.all(
      aircraftTypes.map(async (code) => {
        const params = new URLSearchParams({
          origin: normalizedOrigin,
          destination: normalizedDestination,
          aircraftType: code,
          operationType: "CHARTER",
        });

        try {
          const response = await fetch(`/api/economia/estimate-flight?${params.toString()}`);
          const payload = (await response.json()) as { ok?: boolean; aircraftCompatible?: boolean; compatibilityReason?: string };
          return [code, { compatible: payload.ok === true && payload.aircraftCompatible !== false, reason: payload.compatibilityReason ?? "Compatible con la ruta." }] as const;
        } catch {
          return [code, { compatible: false, reason: "No se pudo validar autonomía para esta ruta." }] as const;
        }
      })
    )
      .then((entries) => {
        if (!mounted) return;
        setTypeCompatibility(Object.fromEntries(entries));
      })
      .finally(() => {
        if (mounted) setLoadingCompatibility(false);
      });

    return () => {
      mounted = false;
    };
  }, [aircraftTypes, normalizedDestination, normalizedOrigin, routeReady]);

  const compatibleAircraftTypes = useMemo(() => {
    if (!routeReady) return aircraftTypes;
    return aircraftTypes.filter((code) => typeCompatibility[code]?.compatible === true);
  }, [aircraftTypes, routeReady, typeCompatibility]);

  useEffect(() => {
    if (!routeReady || !selectedType) return;
    if (typeCompatibility[selectedType] && typeCompatibility[selectedType].compatible === false) {
      setSelectedType("");
      onAircraftChange(null);
    }
  }, [onAircraftChange, routeReady, selectedType, typeCompatibility]);

  const typeOptions = useMemo(
    () => compatibleAircraftTypes.map((code) => ({
      value: code,
      label: getAircraftTypeLabel(code),
      description: `${aircraft.filter((item) => getAircraftTypeCode(item) === code).length} matrícula(s) disponible(s) apta(s)`,
    })),
    [aircraft, compatibleAircraftTypes],
  );

  const filteredAircraft = useMemo(() => {
    if (!selectedType) return [];
    return aircraft.filter((item) => getAircraftTypeCode(item) === selectedType);
  }, [aircraft, selectedType]);

  const aircraftOptions = useMemo(
    () => filteredAircraft.map((item) => ({
      value: item.aircraft_id,
      label: getAircraftRegistrationLabel(item),
      description: `${getAircraftTypeLabel(getAircraftTypeCode(item))} · ${item.current_airport_icao ?? normalizedOrigin}`,
    })),
    [filteredAircraft, normalizedOrigin],
  );

  useEffect(() => {
    let mounted = true;

    if (normalizedOrigin.length !== 4) {
      setAircraft([]);
      setSelectedType("");
      onAircraftChange(null);
      return () => {
        mounted = false;
      };
    }

    setLoadingAircraft(true);
    listCharterAircraftAtOrigin(normalizedOrigin, profile)
      .then((items) => {
        if (!mounted) return;

        setAircraft(items);

        const current = items.find((item: CharterAircraftOption) => item.aircraft_id === selectedAircraftId) ?? null;
        if (current) {
          setSelectedType(getAircraftTypeCode(current));
          return;
        }

        setSelectedType("");
        onAircraftChange(null);
      })
      .catch(() => {
        if (!mounted) return;
        setAircraft([]);
        setSelectedType("");
        onAircraftChange(null);
      })
      .finally(() => {
        if (mounted) setLoadingAircraft(false);
      });

    return () => {
      mounted = false;
    };
  }, [normalizedOrigin, onAircraftChange, profile, selectedAircraftId]);


  const selectedAircraft = useMemo(
    () => aircraft.find((item) => item.aircraft_id === selectedAircraftId) ?? null,
    [aircraft, selectedAircraftId],
  );

  useEffect(() => {
    let mounted = true;
    const aircraftType = selectedAircraft ? getAircraftTypeCode(selectedAircraft) : selectedType;

    if (!routeReady || !aircraftType) {
      setEconomyEstimate(null);
      setLoadingEconomy(false);
      return () => {
        mounted = false;
      };
    }

    setLoadingEconomy(true);
    const params = new URLSearchParams({
      origin: normalizedOrigin,
      destination: normalizedDestination,
      aircraftType,
      operationType: "CHARTER",
    });

    fetch(`/api/economia/estimate-flight?${params.toString()}`)
      .then((response) => response.json())
      .then((payload: { ok?: boolean } & Partial<FlightEconomyEstimate>) => {
        if (!mounted) return;
        if (payload.ok && typeof payload.distanceNm === "number") {
          setEconomyEstimate(payload as FlightEconomyEstimate);
        } else {
          setEconomyEstimate(null);
        }
      })
      .catch(() => {
        if (mounted) setEconomyEstimate(null);
      })
      .finally(() => {
        if (mounted) setLoadingEconomy(false);
      });

    return () => {
      mounted = false;
    };
  }, [normalizedDestination, normalizedOrigin, routeReady, selectedAircraft, selectedType]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    console.debug("[dispatch-filter]", {
      scope: "charter",
      origin: normalizedOrigin,
      destination: normalizedDestination,
      routeReady,
      aircraftCount: aircraft.length,
      aircraftTypes: aircraftTypes.length,
      compatibleAircraftTypes: compatibleAircraftTypes.length,
      selectedType,
    });
  }, [
    aircraft.length,
    aircraftTypes.length,
    compatibleAircraftTypes.length,
    normalizedDestination,
    normalizedOrigin,
    routeReady,
    selectedType,
  ]);

  return (
    <div className="grid gap-5">
      <div className="rounded-[24px] border border-cyan-300/14 bg-cyan-300/[0.045] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/55">Chárter</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Origen / Destino libre</h3>
        <p className="mt-2 text-sm leading-6 text-white/58">
          El origen queda bloqueado según la ubicación actual del piloto. Elige destino, tipo de aeronave, matrícula y hora local.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AirportSearchBox label="Origen" value={originIcao} onChange={onOriginChange} locked={originLocked} />
        <AirportSearchBox label="Destino" value={destinationIcao} onChange={onDestinationChange} />
      </div>

      <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
        <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Hora local</label>
        <input
          type="time"
          value={scheduledDeparture}
          onChange={(event) => onScheduledDepartureChange(event.target.value)}
          className="mt-3 w-full rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/45"
        />
        <p className="mt-2 text-xs text-white/42">La meteorología real queda obligatoria para este tipo de vuelo.</p>
      </div>

      <div className="rounded-[22px] border border-emerald-300/14 bg-emerald-300/[0.045] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/55">Estimación económica del chárter</p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {normalizedOrigin || "---"} → {normalizedDestination || "---"}
            </h3>
          </div>
          {loadingEconomy ? (
            <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-semibold text-white/55">Calculando...</span>
          ) : null}
        </div>

        {!routeReady || !selectedType ? (
          <p className="mt-3 rounded-[16px] border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-white/55">
            Completa origen, destino y aeronave para calcular.
          </p>
        ) : economyEstimate ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Pago piloto", formatUsd(economyEstimate.pilotCommissionUsd ?? economyEstimate.pilotPaymentUsd), "text-emerald-100"],
              ["Pasajeros", String(Math.round((economyEstimate.estimatedPassengers || 0)).toLocaleString("es-CL")), "text-white/82"],
              ["Carga", String(Math.round((economyEstimate.estimatedCargoKg || 0)).toLocaleString("es-CL")) + " kg", "text-white/82"],
              ["Ingreso aerolínea", formatUsd(economyEstimate.airlineRevenueUsd), "text-cyan-100"],
              ["Costo combustible", formatUsd(economyEstimate.fuelCostUsd), "text-amber-100"],
              ["Costo mantención", formatUsd(economyEstimate.maintenanceCostUsd), "text-white/82"],
              ["Costos operación", formatUsd((economyEstimate.airportFeesUsd ?? 0) + (economyEstimate.handlingCostUsd ?? 0) + (economyEstimate.repairReserveUsd ?? 0) + (economyEstimate.onboardServiceCostUsd ?? 0)), "text-white/82"],
              ["Ventas/servicio", formatUsd((economyEstimate.onboardServiceRevenueUsd ?? 0) + (economyEstimate.onboardSalesRevenueUsd ?? 0)), "text-cyan-100"],
              ["Utilidad estimada", formatUsd(economyEstimate.netProfitUsd), economyEstimate.netProfitUsd >= 0 ? "text-emerald-100" : "text-rose-100"],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-[16px] border border-white/8 bg-white/[0.035] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">{label}</p>
                <p className={`mt-1 text-sm font-black ${tone}`}>{value}</p>
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-5 text-xs text-white/44">
              Distancia {Math.round(economyEstimate.distanceNm).toLocaleString("es-CL")} NM · Block {formatMinutes(economyEstimate.blockMinutes)} · Fuel {Math.round(economyEstimate.fuelKg).toLocaleString("es-CL")} kg
            </div>
            {economyEstimate.aircraftCompatible === false ? (
              <div className="sm:col-span-2 lg:col-span-5 rounded-[16px] border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-xs font-semibold text-amber-50/80">
                Aeronave no apta para esta ruta: {economyEstimate.compatibilityReason ?? "revisa alcance, combustible y categoría operacional."}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 rounded-[16px] border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-white/55">
            Economía estimada no disponible para esta combinación.
          </p>
        )}
      </div>


      <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Aeronaves disponibles</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Selección de aeronave</h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-semibold text-white/55">
            {loadingAircraft || loadingCompatibility ? "Cargando" : `${aircraft.length} disponibles`}
          </span>
        </div>

        <p className="mt-2 text-sm text-white/55">
          Solo aparecen aeronaves compatibles con el rango/licencia del piloto, ubicadas en {normalizedOrigin || "el origen"} y con autonomía suficiente para el destino.
        </p>

        {routeReady && !loadingCompatibility && compatibleAircraftTypes.length === 0 ? (
          <div className="mt-4 rounded-[16px] border border-amber-300/18 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-50/80">
            No hay aeronaves aptas para esta ruta desde {normalizedOrigin}. Selecciona una ruta más corta o una aeronave de mayor alcance.
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <DarkDropdown
            label="1 · Tipo de aeronave"
            placeholder="— Elige tipo —"
            value={selectedType}
            options={typeOptions}
            disabled={!routeReady || loadingAircraft || loadingCompatibility || compatibleAircraftTypes.length === 0}
            onChange={(value) => {
              setSelectedType(value);
              onAircraftChange(null);
            }}
          />

          <DarkDropdown
            label="2 · N° de registro"
            placeholder="— Elige matrícula —"
            value={selectedAircraftId ?? ""}
            options={aircraftOptions}
            disabled={!routeReady || !selectedType || filteredAircraft.length === 0}
            onChange={(value) => {
              const next = filteredAircraft.find((item) => item.aircraft_id === value) ?? null;
              onAircraftChange(next);
            }}
          />
        </div>

        <p className="mt-3 text-xs text-white/54">
          Aeronave seleccionada: {getAircraftSummaryLabel(selectedAircraft)}
        </p>

        {!loadingAircraft && aircraft.length === 0 ? (
          <p className="mt-5 rounded-[18px] border border-white/8 bg-white/[0.035] p-4 text-sm text-white/55">
            No tienes aeronaves habilitadas para este tipo de vuelo con tu rango actual.
          </p>
        ) : null}
      </div>
    </div>
  );
}

