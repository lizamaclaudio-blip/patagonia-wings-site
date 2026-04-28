"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

type FleetModelRow = {
  code?: string | null;
  manufacturer?: string | null;
  display_name?: string | null;
  variant_name?: string | null;
  display_category?: string | null;
  category?: string | null;
  is_active?: boolean | null;
};

type FleetEntry = {
  modelCode: string;
  aircraftName: string;
  tags: string[];
};

const FALLBACK_FLEET: FleetEntry[] = [
  { modelCode: "A20N", aircraftName: "Airbus A320neo", tags: ["Narrowbody jet"] },
  { modelCode: "A21N", aircraftName: "Airbus A321neo", tags: ["Narrowbody jet"] },
  { modelCode: "A319", aircraftName: "Airbus A319", tags: ["Narrowbody jet"] },
  { modelCode: "A320", aircraftName: "Airbus A320", tags: ["Narrowbody jet"] },
  { modelCode: "A321", aircraftName: "Airbus A321", tags: ["Narrowbody jet"] },
  { modelCode: "A339", aircraftName: "Airbus A330-900neo", tags: ["Widebody jet"] },
  { modelCode: "A359", aircraftName: "Airbus A350-900", tags: ["Widebody jet"] },
  { modelCode: "ATR72", aircraftName: "ATR 72-600", tags: ["Twin turboprop"] },
  { modelCode: "B350", aircraftName: "Beechcraft King Air 350i", tags: ["Twin turboprop"] },
  { modelCode: "B38M", aircraftName: "Boeing 737 MAX 8", tags: ["Narrowbody jet"] },
  { modelCode: "B736", aircraftName: "Boeing 737-600", tags: ["Narrowbody jet"] },
  { modelCode: "B737", aircraftName: "Boeing 737-700", tags: ["Narrowbody jet"] },
  { modelCode: "B738", aircraftName: "Boeing 737-800", tags: ["Narrowbody jet"] },
  { modelCode: "B739", aircraftName: "Boeing 737-900", tags: ["Narrowbody jet"] },
  { modelCode: "B748", aircraftName: "Boeing 747-8 Intercontinental", tags: ["Widebody jet"] },
  { modelCode: "B772", aircraftName: "Boeing 777-200ER", tags: ["Widebody jet"] },
  { modelCode: "B77F", aircraftName: "Boeing 777 Freighter", tags: ["Widebody jet"] },
  { modelCode: "B77W", aircraftName: "Boeing 777-300ER", tags: ["Widebody jet"] },
  { modelCode: "B789", aircraftName: "Boeing 787-9 Dreamliner", tags: ["Widebody jet"] },
  { modelCode: "B78X", aircraftName: "Boeing 787-10 Dreamliner", tags: ["Widebody jet"] },
  { modelCode: "BE58", aircraftName: "Beechcraft Baron 58", tags: ["Twin piston"] },
  { modelCode: "C172", aircraftName: "Cessna 172 Skyhawk G1000", tags: ["Pistón monomotor"] },
  { modelCode: "C208", aircraftName: "Cessna 208B Grand Caravan EX", tags: ["Single turboprop"] },
  { modelCode: "DHC6", aircraftName: "de Havilland Canada DHC-6 Twin Otter", tags: ["Twin turboprop"] },
  { modelCode: "E170", aircraftName: "Embraer E170", tags: ["Regional jet"] },
  { modelCode: "E175", aircraftName: "Embraer E175", tags: ["Regional jet"] },
  { modelCode: "E190", aircraftName: "Embraer E190", tags: ["Regional jet"] },
  { modelCode: "E195", aircraftName: "Embraer E195", tags: ["Regional jet"] },
  { modelCode: "MD82", aircraftName: "McDonnell Douglas MD-82", tags: ["Narrowbody jet"] },
  { modelCode: "MD83", aircraftName: "McDonnell Douglas MD-83", tags: ["Narrowbody jet"] },
  { modelCode: "MD88", aircraftName: "McDonnell Douglas MD-88", tags: ["Narrowbody jet"] },
  { modelCode: "SU95", aircraftName: "Sukhoi SuperJet 100", tags: ["Regional jet"] },
  { modelCode: "TBM9", aircraftName: "Daher TBM 930 / TBM 850", tags: ["Single turboprop"] },
];

function formatCategory(value: string | null | undefined) {
  const clean = (value ?? "").trim();
  if (!clean) return "Certificada";

  const map: Record<string, string> = {
    narrowbody_jet: "Narrowbody jet",
    widebody_jet: "Widebody jet",
    regional_jet: "Regional jet",
    twin_turboprop: "Twin turboprop",
    single_turboprop: "Single turboprop",
    piston_single: "Pistón monomotor",
    piston_twin: "Twin piston",
  };

  return map[clean] ?? clean;
}

function normalizeAircraftName(row: FleetModelRow) {
  return (
    row.display_name?.trim() ||
    row.variant_name?.trim() ||
    row.code?.trim().toUpperCase() ||
    "Aeronave certificada"
  );
}

function mapFleetModelRows(rows: FleetModelRow[]): FleetEntry[] {
  const seen = new Map<string, FleetEntry>();

  for (const row of rows) {
    if (row.is_active === false) continue;

    const modelCode = (row.code ?? "").trim().toUpperCase();
    if (!modelCode) continue;

    const aircraftName = normalizeAircraftName(row);
    const category = formatCategory(row.display_category || row.category);
    const manufacturer = row.manufacturer?.trim();
    const tags = Array.from(new Set([category, manufacturer].filter(Boolean) as string[]));

    seen.set(modelCode, {
      modelCode,
      aircraftName,
      tags,
    });
  }

  return Array.from(seen.values()).sort((a, b) =>
    a.aircraftName.localeCompare(b.aircraftName),
  );
}

async function loadFleetEntries() {
  const { data, error } = await supabase
    .from("aircraft_models")
    .select("code, manufacturer, display_name, variant_name, display_category, category, is_active")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) {
    console.warn("No se pudo cargar aircraft_models para HomeFleetShowcase:", error.message);
    return FALLBACK_FLEET;
  }

  const entries = mapFleetModelRows((data ?? []) as FleetModelRow[]);
  return entries.length > 0 ? entries : FALLBACK_FLEET;
}

function tagBadgeClass(tag: string): string {
  const d = tag.toLowerCase();
  if (d.includes("widebody")) return "bg-blue-500/18 text-blue-200 ring-1 ring-blue-300/25";
  if (d.includes("narrowbody")) return "bg-cyan-500/16 text-cyan-200 ring-1 ring-cyan-300/24";
  if (d.includes("regional")) return "bg-teal-500/16 text-teal-200 ring-1 ring-teal-300/24";
  if (d.includes("turboprop")) return "bg-emerald-500/16 text-emerald-200 ring-1 ring-emerald-300/24";
  if (d.includes("piston")) return "bg-amber-500/14 text-amber-100 ring-1 ring-amber-300/20";
  if (d.includes("airbus")) return "bg-sky-500/14 text-sky-100 ring-1 ring-sky-300/20";
  if (d.includes("boeing")) return "bg-indigo-500/14 text-indigo-100 ring-1 ring-indigo-300/20";
  if (d.includes("embraer")) return "bg-teal-500/14 text-teal-100 ring-1 ring-teal-300/20";
  return "bg-white/10 text-white/70 ring-1 ring-white/15";
}

export default function HomeFleetShowcase() {
  const [fleetEntries, setFleetEntries] = useState<FleetEntry[]>(FALLBACK_FLEET);
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
      }, 120);
    };

    void refreshFleet();

    const channel = supabase
      .channel("home-fleet-models-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aircraft_models" },
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
    <div className="flex h-full flex-col rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,28,56,0.78),rgba(4,18,38,0.62))] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-7 lg:p-8">
      <div>
        <div className="flex flex-col gap-4 border-b border-emerald-300/18 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/72">
              Flota certificada
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Aeronaves disponibles
            </h3>
          </div>

          <div className="w-fit rounded-full border border-emerald-300/18 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">
            {loaded ? `${fleetEntries.length} modelos certificados` : "Cargando flota…"}
          </div>
        </div>

        <p className="mt-5 text-sm leading-7 text-slate-200/76">
          Flota preparada para conectar rutas regionales, jets ejecutivos, operación nacional e internacional dentro de Patagonia Wings.
        </p>

        <div className="mt-6">
          {!loaded ? (
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-b border-white/8 pb-3 pt-1">
                  <div className="h-3.5 w-36 animate-pulse rounded-full bg-white/10" />
                  <div className="mt-2 h-2.5 w-20 animate-pulse rounded-full bg-white/6" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-x-7 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {fleetEntries.map((entry) => {
                const safeTags = Array.isArray(entry.tags) ? entry.tags.filter(Boolean) : [];

                return (
                  <div
                    key={entry.modelCode || entry.aircraftName}
                    className="border-b border-white/8 pb-3 pt-1 last:border-b-0 xl:[&:nth-last-child(-n+3)]:border-b-0"
                  >
                    <p className="text-[14px] font-semibold leading-5 text-white/94">
                      {entry.aircraftName || entry.modelCode || "Aeronave certificada"}
                    </p>
                    {safeTags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {safeTags.map((tag) => (
                          <span
                            key={tag}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${tagBadgeClass(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-emerald-300/16 pt-6">
        <Link href="/register" className="button-primary w-fit">
          Quiero unirme a la flota
        </Link>
        <Link href="/routes" className="parallax-outline-button w-fit">
          Ver rutas disponibles
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
