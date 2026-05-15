"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicHeader from "@/components/site/PublicHeader";
import IcaoFlagBadge from "@/components/ui/IcaoFlagBadge";

type RouteRow = {
  route_id: string;
  route_category: string | null;
  flight_number: string | null;
  origin_ident: string | null;
  destination_ident: string | null;
  route_name: string | null;
  distance_nm: number | string | null;
  block_minutes: number | string | null;
};

type NetworkRouteRow = {
  id: string | null;
  route_code: string | null;
  origin_ident: string | null;
  destination_ident: string | null;
  route_group: string | null;
  service_profile: string | null;
  distance_nm: number | string | null;
  is_active: boolean | null;
  flight_number: string | null;
  flight_designator: string | null;
};

type NetworkAircraftRow = {
  route_id: string | null;
  aircraft_type_code: string | null;
};

type CatalogPayload = {
  ok?: boolean;
  routes?: RouteRow[];
  catalogRows?: RouteRow[];
  networkRoutesRows?: NetworkRouteRow[];
  networkAircraftRows?: NetworkAircraftRow[];
  errors?: {
    catalog?: string | null;
    networkRoutes?: string | null;
    networkAircraft?: string | null;
  };
  error?: string;
};

type Category = {
  id: string;
  label: string;
  desc: string;
};

const CATEGORIES: Category[] = [
  { id: "regional", label: "Regionales", desc: "Vuelos locales y regionales." },
  { id: "national", label: "Nacionales", desc: "Tramos internos de la red." },
  { id: "international", label: "Internacionales", desc: "Conexiones entre países." },
  { id: "long_haul", label: "Long Haul", desc: "Vuelos de larga distancia." },
  { id: "intercontinental", label: "Intercontinentales", desc: "Operación entre continentes." },
];

function toText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalizeToken(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function normalizeCategory(rawCategory: unknown, distanceNm: number, serviceProfile: unknown): string {
  const cat = normalizeToken(rawCategory);
  const service = normalizeToken(serviceProfile);
  const probe = `${cat} ${service}`;

  if (probe.includes("intercontinental") || probe.includes("transoceanic") || probe.includes("ultra_long")) {
    return "intercontinental";
  }
  if (probe.includes("long_haul") || probe.includes("longhaul") || probe.includes("larga_distancia")) {
    return "long_haul";
  }
  if (probe.includes("international") || probe.includes("internacional")) {
    return "international";
  }
  if (probe.includes("national") || probe.includes("nacional") || probe.includes("domestic")) {
    return "national";
  }
  if (probe.includes("regional") || probe.includes("local") || probe.includes("escuela")) {
    return "regional";
  }

  if (distanceNm >= 3000) return "intercontinental";
  if (distanceNm >= 1600) return "long_haul";
  if (distanceNm >= 700) return "international";
  if (distanceNm >= 250) return "national";
  return "regional";
}

function fixMojibake(value: string): string {
  return value
    .replaceAll("\u00c3\u00a1", "á")
    .replaceAll("\u00c3\u00a9", "é")
    .replaceAll("\u00c3\u00ad", "í")
    .replaceAll("\u00c3\u00b3", "ó")
    .replaceAll("\u00c3\u00ba", "ú")
    .replaceAll("\u00c3\u00b1", "ñ")
    .replaceAll("\u00c3\u0081", "Á")
    .replaceAll("\u00c3\u0089", "É")
    .replaceAll("\u00c3\u008d", "Í")
    .replaceAll("\u00c3\u0093", "Ó")
    .replaceAll("\u00c3\u009a", "Ú")
    .replaceAll("\u00c3\u0091", "Ñ")
    .replaceAll("\u00c2\u00b7", "·")
    .replaceAll("\u00e2\u2020\u2019", "→")
    .replaceAll("\u00e2\u20ac\u201c", "–")
    .replaceAll("\u00e2\u20ac\u201d", "—");
}

function toCleanText(v: unknown): string {
  return fixMojibake(toText(v));
}

function formatBlock(minutes: number): string {
  if (!minutes || minutes <= 0) return "N/D";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

function normalizeCatalogRow(row: RouteRow): RouteRow {
  return {
    route_id: toText(row.route_id) || crypto.randomUUID(),
    route_category: normalizeCategory(row.route_category, toNumber(row.distance_nm), null),
    flight_number: toCleanText(row.flight_number),
    origin_ident: toCleanText(row.origin_ident).toUpperCase(),
    destination_ident: toCleanText(row.destination_ident).toUpperCase(),
    route_name: toCleanText(row.route_name),
    distance_nm: toNumber(row.distance_nm),
    block_minutes: toNumber(row.block_minutes) || null,
  };
}

export default function RoutesPage() {
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/routes/catalog", { cache: "no-store" });
        const payload = (await res.json()) as CatalogPayload;
        if (cancelled) return;

        if (!res.ok || payload.ok === false) {
          setError(payload.error || "No se pudo cargar el catálogo de rutas.");
          setRows([]);
          return;
        }

        if (Array.isArray(payload.routes) && payload.routes.length > 0) {
          setRows(payload.routes.map(normalizeCatalogRow));
        } else if (Array.isArray(payload.catalogRows) && payload.catalogRows.length > 0) {
          setRows(payload.catalogRows.map(normalizeCatalogRow));
        } else if (Array.isArray(payload.networkRoutesRows) && payload.networkRoutesRows.length > 0) {
          const aircraftByRoute = new Map<string, Set<string>>();
          for (const item of payload.networkAircraftRows ?? []) {
            const routeId = toText(item.route_id);
            const aircraftCode = toText(item.aircraft_type_code).toUpperCase();
            if (!routeId || !aircraftCode) continue;
            const bucket = aircraftByRoute.get(routeId) ?? new Set<string>();
            bucket.add(aircraftCode);
            aircraftByRoute.set(routeId, bucket);
          }

          const normalizedRows: RouteRow[] = payload.networkRoutesRows
            .filter((row) => row && (row.is_active === null || row.is_active === true))
            .map((row) => {
              const routeId = toText(row.id);
              const distanceNm = toNumber(row.distance_nm);
              const origin = toCleanText(row.origin_ident).toUpperCase();
              const destination = toCleanText(row.destination_ident).toUpperCase();
              const flightNumber =
                toCleanText(row.flight_designator).toUpperCase() ||
                toCleanText(row.flight_number).toUpperCase() ||
                toCleanText(row.route_code).toUpperCase() ||
                `PWG-${origin}-${destination}`;
              const category = normalizeCategory(row.route_group, distanceNm, row.service_profile);
              const aircraftList = Array.from(aircraftByRoute.get(routeId) ?? []);

              return {
                route_id: routeId || `${origin}-${destination}-${flightNumber}`,
                route_category: category,
                flight_number: flightNumber,
                origin_ident: origin,
                destination_ident: destination,
                route_name:
                  toCleanText(row.route_code) ||
                  (aircraftList.length ? `Compatibles: ${aircraftList.join(" · ")}` : "Ruta operativa"),
                distance_nm: distanceNm,
                block_minutes: null,
              } satisfies RouteRow;
            });

          setRows(normalizedRows);
        } else {
          setRows([]);
        }
        setError("");
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("No se pudo cargar el catálogo de rutas.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const parts = [
        toCleanText(r.flight_number),
        toCleanText(r.origin_ident),
        toCleanText(r.destination_ident),
        toCleanText(r.route_name),
      ];
      const haystack = parts.join(" ").toUpperCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, RouteRow[]>();
    for (const c of CATEGORIES) {
      map.set(c.id, []);
    }
    for (const row of filtered) {
      const key = normalizeCategory(row.route_category, toNumber(row.distance_nm), null);
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }
    return map;
  }, [filtered]);

  return (
    <main className="grid-overlay min-h-screen">
      <section className="parallax-hero relative isolate min-h-screen">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="pw-container relative z-[3] py-6 sm:py-8">
          <PublicHeader />

          <div className="glass-panel mt-6 rounded-[30px] p-6 sm:p-8">
            <p className="section-chip">Catálogo de rutas</p>
            <h1 className="header-strip mt-4 text-3xl font-bold text-white sm:text-4xl">Panel operativo de rutas</h1>
            <p className="mt-2 text-sm text-white/70">Vista compacta con bloques cerrados por defecto.</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar vuelo, ICAO o ruta..."
                className="min-w-[280px] flex-1 rounded-xl border border-white/12 bg-[#06172a] px-4 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
              />
              <Link href="/dashboard?tab=dispatch" className="button-primary px-4 py-2">
                Ir a despacho
              </Link>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="glass-panel rounded-[24px] p-5 text-sm text-white/70">Cargando rutas...</div>
            ) : null}

            {error ? (
              <div className="glass-panel rounded-[24px] border border-rose-400/30 p-5 text-sm text-rose-200">{error}</div>
            ) : null}

            {!loading && !error
              ? CATEGORIES.map((cat) => {
                  const list = grouped.get(cat.id) || [];

                  return (
                    <details key={cat.id} className="glass-panel overflow-hidden rounded-[24px] border border-white/10">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-white/55">{cat.label}</p>
                          <p className="mt-1 text-sm text-white/70">{cat.desc}</p>
                        </div>
                        <span className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                          {list.length} rutas
                        </span>
                      </summary>

                      <div className="border-t border-white/10 px-4 pb-4 pt-3">
                        {list.length === 0 ? (
                          <p className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/60">Sin rutas para esta categoría.</p>
                        ) : (
                          <div className="space-y-2">
                            {list.map((r) => (
                              <div key={r.route_id} className="grid gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/85 md:grid-cols-[120px_1fr_120px_140px]">
                                <div className="font-semibold">{toCleanText(r.flight_number) || "PWG"}</div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <IcaoFlagBadge icao={toCleanText(r.origin_ident) || "----"} size="sm" />
                                  <span className="text-white/45">→</span>
                                  <IcaoFlagBadge icao={toCleanText(r.destination_ident) || "----"} size="sm" />
                                  <span className="text-white/55">{toCleanText(r.route_name) || "Ruta operativa"}</span>
                                </div>
                                <div>{Math.round(toNumber(r.distance_nm)) || 0} NM</div>
                                <div>{formatBlock(toNumber(r.block_minutes))}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })
              : null}
          </div>
        </div>
      </section>
    </main>
  );
}
