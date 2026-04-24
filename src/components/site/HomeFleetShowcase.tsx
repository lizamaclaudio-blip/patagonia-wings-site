"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

type FleetRow = {
  aircraft_model_code?: string | null;
  aircraft_display_name?: string | null;
  addon_provider?: string | null;
  is_active?: boolean | null;
};

type FleetTypeRow = {
  aircraft_type?: string | null;
  status?: string | null;
};

type FleetEntry = {
  aircraftName: string;
  developers: string[];
};

const FALLBACK_FLEET: FleetEntry[] = [
  { aircraftName: "Airbus A319", developers: ["Fenix Simulations", "LatinVFR Horizons"] },
  { aircraftName: "Airbus A320", developers: ["Fenix Simulations", "LatinVFR Horizons"] },
  { aircraftName: "Airbus A320neo", developers: ["FlyByWire Simulations"] },
  { aircraftName: "Airbus A321", developers: ["Fenix Simulations"] },
  { aircraftName: "Airbus A321neo", developers: ["LatinVFR Horizons"] },
  { aircraftName: "Airbus A330-900neo", developers: ["Headwind"] },
  { aircraftName: "Airbus A350-900", developers: ["iniBuilds"] },
  { aircraftName: "ATR 72-600", developers: ["Asobo Studio"] },
  { aircraftName: "Beechcraft 350 King Air", developers: ["Asobo Studio", "Black Square"] },
  { aircraftName: "Beechcraft 58 Baron", developers: ["Asobo Studio", "Black Square", "Black Square Pro"] },
  { aircraftName: "Boeing 737-600", developers: ["PMDG"] },
  { aircraftName: "Boeing 737-700", developers: ["PMDG"] },
  { aircraftName: "Boeing 737-800", developers: ["PMDG"] },
  { aircraftName: "Boeing 737-900", developers: ["PMDG"] },
  { aircraftName: "Boeing 737 MAX 8", developers: ["iFly"] },
  { aircraftName: "Boeing 777-200ER", developers: ["PMDG"] },
  { aircraftName: "Boeing 777-300ER", developers: ["PMDG"] },
  { aircraftName: "Boeing 787-9 Dreamliner", developers: ["Microsoft Horizons"] },
  { aircraftName: "Boeing 787-10 Dreamliner", developers: ["Asobo Studio"] },
  { aircraftName: "Cessna 208 Caravan", developers: ["Asobo Studio", "Black Square"] },
  { aircraftName: "Embraer E175", developers: ["FlightSim Studio"] },
  { aircraftName: "Embraer E190", developers: ["FlightSim Studio"] },
  { aircraftName: "Embraer E195", developers: ["FlightSim Studio"] },
  { aircraftName: "McDonnell Douglas MD-82", developers: ["Leonardo MadDog"] },
  { aircraftName: "McDonnell Douglas MD-83", developers: ["Leonardo MadDog"] },
  { aircraftName: "McDonnell Douglas MD-88", developers: ["Leonardo MadDog"] },
  { aircraftName: "TBM 850", developers: ["Black Square"] },
  { aircraftName: "TBM 930", developers: ["Asobo Studio"] },
];

function normalizeDeveloperName(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  const map: Record<string, string> = {
    Asobo: "Asobo Studio",
    FBW: "FlyByWire Simulations",
  };

  return map[normalized] ?? normalized ?? "";
}

function normalizeAircraftName(value: string | null | undefined, modelCode: string | null | undefined) {
  const cleanValue = (value ?? "").trim();
  if (cleanValue) {
    return cleanValue;
  }

  const code = (modelCode ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    A20N: "Airbus A320neo",
    A21N: "Airbus A321neo",
    A319: "Airbus A319",
    A320: "Airbus A320",
    A321: "Airbus A321",
    A339: "Airbus A330-900neo",
    A359: "Airbus A350-900",
    ATR72: "ATR 72-600",
    B350: "Beechcraft 350 King Air",
    B38M: "Boeing 737 MAX 8",
    B737: "Boeing 737-700",
    B738: "Boeing 737-800",
    B739: "Boeing 737-900",
    B772: "Boeing 777-200ER",
    B77W: "Boeing 777-300ER",
    B789: "Boeing 787-9 Dreamliner",
    B78X: "Boeing 787-10 Dreamliner",
    BE58: "Beechcraft 58 Baron",
    C208: "Cessna 208 Caravan",
    E175: "Embraer E175",
    E190: "Embraer E190",
    E195: "Embraer E195",
    MD82: "McDonnell Douglas MD-82",
    MD83: "McDonnell Douglas MD-83",
    MD88: "McDonnell Douglas MD-88",
    TBM9: "TBM 930",
  };

  return map[code] ?? code;
}

function mapFleetRows(rows: FleetRow[]) {
  const grouped = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.is_active === false) {
      continue;
    }

    const aircraftName = normalizeAircraftName(row.aircraft_display_name, row.aircraft_model_code);
    const developer = normalizeDeveloperName(row.addon_provider) || "Desarrollador por confirmar";
    if (!aircraftName) {
      continue;
    }

    const currentDevelopers = grouped.get(aircraftName) ?? new Set<string>();
    currentDevelopers.add(developer);
    grouped.set(aircraftName, currentDevelopers);
  }

  return Array.from(grouped.entries())
    .map(([aircraftName, developers]) => ({
      aircraftName,
      developers: Array.from(developers).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.aircraftName.localeCompare(b.aircraftName));
}

function mapFleetTypeRows(rows: FleetTypeRow[]): FleetEntry[] {
  const INACTIVE = ["retired", "deleted", "inactive"];
  const seen = new Map<string, FleetEntry>();

  for (const row of rows) {
    const normalized = (row.status ?? "").trim().toLowerCase();
    if (INACTIVE.includes(normalized)) continue;

    const code = (row.aircraft_type ?? "").trim().toUpperCase();
    if (!code) continue;

    const name = normalizeAircraftName(null, code);
    if (!name || name === code) continue; // skip unmapped codes

    if (!seen.has(name)) {
      seen.set(name, { aircraftName: name, developers: [] });
    }
  }

  return Array.from(seen.values()).sort((a, b) =>
    a.aircraftName.localeCompare(b.aircraftName),
  );
}

async function loadFleetEntries() {
  // 1st try: aircraft table (has display name + developer info)
  const aircraftRes = await supabase
    .from("aircraft")
    .select("aircraft_model_code, aircraft_display_name, addon_provider, is_active")
    .order("aircraft_display_name");

  if (!aircraftRes.error) {
    const entries = mapFleetRows((aircraftRes.data ?? []) as FleetRow[]);
    if (entries.length > 0) return entries;
  }

  // 2nd try: aircraft_fleet table (grouping by aircraft_type)
  const fleetRes = await supabase
    .from("aircraft_fleet")
    .select("aircraft_type, status");

  if (!fleetRes.error) {
    const entries = mapFleetTypeRows((fleetRes.data ?? []) as FleetTypeRow[]);
    if (entries.length > 0) return entries;
  }

  return FALLBACK_FLEET;
}

function devBadgeClass(dev: string): string {
  const d = dev.toLowerCase();
  if (d.includes("pmdg"))        return "bg-blue-600/25 text-blue-300 ring-1 ring-blue-500/30";
  if (d.includes("fenix"))       return "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30";
  if (d.includes("flybywire") || d.includes("fbw"))
                                  return "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30";
  if (d.includes("black square")) return "bg-slate-500/25 text-slate-200 ring-1 ring-slate-400/30";
  if (d.includes("asobo"))        return "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/30";
  if (d.includes("inibuilds"))    return "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30";
  if (d.includes("headwind"))     return "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30";
  if (d.includes("flightsim"))    return "bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30";
  if (d.includes("ifly"))         return "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30";
  if (d.includes("leonardo") || d.includes("maddog"))
                                  return "bg-red-500/20 text-red-300 ring-1 ring-red-500/30";
  if (d.includes("latinvfr"))     return "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30";
  if (d.includes("microsoft"))    return "bg-blue-400/15 text-blue-200 ring-1 ring-blue-400/25";
  return "bg-white/10 text-white/70 ring-1 ring-white/15";
}

export default function HomeFleetShowcase() {
  const [fleetEntries, setFleetEntries] = useState<FleetEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let refreshTimer: number | null = null;

    const refreshFleet = async () => {
      try {
        const nextEntries = await loadFleetEntries();
        if (isMounted) {
          setFleetEntries(nextEntries);
          setLoaded(true);
        }
      } catch {
        if (isMounted) {
          setFleetEntries(FALLBACK_FLEET);
          setLoaded(true);
        }
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void refreshFleet();
      }, 180);
    };

    void refreshFleet();

    const channel = supabase
      .channel("home-fleet-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aircraft" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aircraft_fleet" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <h2 className="text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
        Liveries oficiales y flota que ya queremos ver en línea
      </h2>
      <p className="mt-5 text-lg leading-8 text-slate-200/84">
        Estamos trabajando en la creación de las liveries de las aeronaves que iremos certificando para
        Patagonia Wings. Queremos que cada avión tenga identidad propia, presencia de aerolínea real y una
        operación que se sienta viva desde la plataforma hasta el último tramo del vuelo.
      </p>
      <p className="mt-4 text-lg leading-8 text-slate-200/78">
        Si te atrae una comunidad con flota cuidada, objetivos claros y simulación con detalle, este es tu
        lugar. Súmate ahora y despega con nosotros cuando entren en servicio las próximas certificaciones.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Link href="/register" className="button-primary w-fit">
          Quiero unirme a la flota
        </Link>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm">
          {loaded ? `${fleetEntries.length} modelo${fleetEntries.length !== 1 ? "s" : ""} en flota` : "Cargando flota…"}
        </div>
      </div>

      <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
        {!loaded ? (
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border-b border-white/8 pb-2.5 pt-0.5">
                <div className="h-3.5 w-36 animate-pulse rounded-full bg-white/10" />
                <div className="mt-2 h-2.5 w-20 animate-pulse rounded-full bg-white/6" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid max-h-[380px] gap-x-6 gap-y-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {fleetEntries.map((entry) => (
              <div
                key={entry.aircraftName}
                className="border-b border-white/8 pb-2.5 pt-0.5 last:border-b-0"
              >
                <p className="text-[14px] font-semibold leading-5 text-white/94">
                  {entry.aircraftName}
                </p>
                {entry.developers.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {entry.developers.map((dev) => (
                      <span
                        key={dev}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${devBadgeClass(dev)}`}
                      >
                        {dev}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
