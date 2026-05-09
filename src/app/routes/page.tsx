"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicHeader from "@/components/site/PublicHeader";
import ProtectedPage from "@/components/site/ProtectedPage";
import { estimateEconomyRangeForAircraftTypes } from "@/lib/pilot-economy";

type RouteCategory =
  | "regional"
  | "national"
  | "international"
  | "long_haul"
  | "intercontinental";

type RouteCatalogRow = {
  route_id: string;
  flight_number: string | null;
  simbrief_flight_number: string | null;
  route_key: string | null;
  origin_ident: string | null;
  destination_ident: string | null;
  origin_country: string | null;
  destination_country: string | null;
  route_name: string | null;
  route_category: RouteCategory | string | null;
  service_type: string | null;
  operation_type: string | null;
  distance_nm: number | string | null;
  block_minutes: number | string | null;
  expected_block_p50: number | string | null;
  expected_block_p80: number | string | null;
  compatible_aircraft_types: string[] | null;
  aircraft_options: unknown;
  is_active: boolean | null;
};

type CategoryMeta = {
  id: RouteCategory;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
};

type AirportInfo = {
  city: string;
  airport: string;
  country: string;
  countryCode: string;
  flag: string;
};

type RoutePair = {
  key: string;
  outbound: RouteCatalogRow | null;
  inbound: RouteCatalogRow | null;
  originIdent: string;
  destinationIdent: string;
  aircraftTypes: string[];
};

const CATEGORY_META: CategoryMeta[] = [
  {
    id: "regional",
    label: "Regionales / locales",
    shortLabel: "Regionales",
    description: "Tramos locales y regionales para avionetas, turbohÃ©lices y operaciÃ³n de corta distancia.",
    icon: "ðŸ›©ï¸",
  },
  {
    id: "national",
    label: "Nacionales",
    shortLabel: "Nacionales",
    description: "Vuelos interregionales dentro de Chile o Argentina.",
    icon: "ðŸ‡¨ðŸ‡±",
  },
  {
    id: "international",
    label: "Internacionales",
    shortLabel: "Internacionales",
    description: "Rutas entre paÃ­ses dentro de SudamÃ©rica y el cono sur.",
    icon: "ðŸŒŽ",
  },
  {
    id: "long_haul",
    label: "Long haul",
    shortLabel: "Long haul",
    description: "Vuelos de largo alcance para flota widebody y operaciones de varias horas.",
    icon: "ðŸ›«",
  },
  {
    id: "intercontinental",
    label: "Intercontinentales",
    shortLabel: "Intercont.",
    description: "Rutas hacia otro continente, pensadas para aeronaves de largo alcance.",
    icon: "ðŸŒ",
  },
];

const CATEGORY_ORDER = new Map(CATEGORY_META.map((item, index) => [item.id, index]));

const AIRPORTS: Record<string, AirportInfo> = {
  SCTB: { city: "Santiago", airport: "Eulogio SÃ¡nchez / Tobalaba", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCPF: { city: "Puerto Montt", airport: "Marcel Marchant / La Paloma", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCRD: { city: "ViÃ±a del Mar / ValparaÃ­so", airport: "Rodelillo", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },

  SCTE: { city: "Puerto Montt", airport: "El Tepual Intl", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCJO: { city: "Osorno", airport: "CaÃ±al Bajo Carlos Hott Siebert", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCPQ: { city: "Castro / Mocopulli", airport: "AerÃ³dromo Mocopulli", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCTN: { city: "ChaitÃ©n", airport: "AerÃ³dromo ChaitÃ©n", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCFT: { city: "FutaleufÃº", airport: "AerÃ³dromo FutaleufÃº", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCIE: { city: "ConcepciÃ³n", airport: "Carriel Sur Intl", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCQP: { city: "Temuco", airport: "La AraucanÃ­a Intl", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCVD: { city: "Valdivia", airport: "Pichoy", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCEL: { city: "Santiago", airport: "Arturo Merino BenÃ­tez Intl", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCSN: { city: "Santo Domingo", airport: "AerÃ³dromo Santo Domingo", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCCI: { city: "Punta Arenas", airport: "Presidente Carlos IbÃ¡Ã±ez del Campo Intl", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCNT: { city: "Puerto Natales", airport: "Teniente Julio Gallardo", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCBA: { city: "Balmaceda", airport: "Balmaceda", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCFA: { city: "Antofagasta", airport: "AndrÃ©s Sabella", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCCF: { city: "Calama", airport: "El Loa", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },
  SCDA: { city: "Iquique", airport: "Diego Aracena Intl", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" },

  SADF: { city: "Buenos Aires", airport: "San Fernando", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SADM: { city: "Buenos Aires", airport: "MorÃ³n / Presidente Rivadavia", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SADL: { city: "La Plata", airport: "La Plata", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SAAR: { city: "Rosario", airport: "Rosario / Islas Malvinas", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },

  SABE: { city: "Buenos Aires", airport: "Aeroparque Jorge Newbery", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SAEZ: { city: "Buenos Aires", airport: "Ezeiza / Ministro Pistarini", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SACO: { city: "CÃ³rdoba", airport: "Ing. Aer. Ambrosio Taravella", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SAME: { city: "Mendoza", airport: "El Plumerillo", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SAZS: { city: "Bariloche", airport: "Teniente Luis Candelaria", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SAVC: { city: "Comodoro Rivadavia", airport: "General Enrique Mosconi", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SAWG: { city: "RÃ­o Gallegos", airport: "Piloto Civil Norberto FernÃ¡ndez", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SAWH: { city: "Ushuaia", airport: "Malvinas Argentinas", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SARI: { city: "Puerto IguazÃº", airport: "Cataratas del IguazÃº", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },
  SASA: { city: "Salta", airport: "MartÃ­n Miguel de GÃ¼emes", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" },

  SPJC: { city: "Lima", airport: "Jorge ChÃ¡vez Intl", country: "PerÃº", countryCode: "PE", flag: "ðŸ‡µðŸ‡ª" },
  SLLP: { city: "La Paz", airport: "El Alto Intl", country: "Bolivia", countryCode: "BO", flag: "ðŸ‡§ðŸ‡´" },
  SBGR: { city: "SÃ£o Paulo", airport: "Guarulhos Intl", country: "Brasil", countryCode: "BR", flag: "ðŸ‡§ðŸ‡·" },

  KMIA: { city: "Miami", airport: "Miami Intl", country: "Estados Unidos", countryCode: "US", flag: "ðŸ‡ºðŸ‡¸" },
  KJFK: { city: "Nueva York", airport: "John F. Kennedy Intl", country: "Estados Unidos", countryCode: "US", flag: "ðŸ‡ºðŸ‡¸" },
  KLAX: { city: "Los Ãngeles", airport: "Los Angeles Intl", country: "Estados Unidos", countryCode: "US", flag: "ðŸ‡ºðŸ‡¸" },

  LEMD: { city: "Madrid", airport: "Adolfo SuÃ¡rez Madrid-Barajas", country: "EspaÃ±a", countryCode: "ES", flag: "ðŸ‡ªðŸ‡¸" },
  LFPG: { city: "ParÃ­s", airport: "Charles de Gaulle", country: "Francia", countryCode: "FR", flag: "ðŸ‡«ðŸ‡·" },
  EGLL: { city: "Londres", airport: "Heathrow", country: "Reino Unido", countryCode: "GB", flag: "ðŸ‡¬ðŸ‡§" },
  OMDB: { city: "DubÃ¡i", airport: "Dubai Intl", country: "Emiratos Ãrabes Unidos", countryCode: "AE", flag: "ðŸ‡¦ðŸ‡ª" },
};

function inferAirportInfo(ident: string): AirportInfo {
  if (AIRPORTS[ident]) return AIRPORTS[ident];
  if (ident.startsWith("SC")) return { city: ident, airport: "Aeropuerto Chile", country: "Chile", countryCode: "CL", flag: "ðŸ‡¨ðŸ‡±" };
  if (ident.startsWith("SA")) return { city: ident, airport: "Aeropuerto Argentina", country: "Argentina", countryCode: "AR", flag: "ðŸ‡¦ðŸ‡·" };
  if (ident.startsWith("SP")) return { city: ident, airport: "Aeropuerto PerÃº", country: "PerÃº", countryCode: "PE", flag: "ðŸ‡µðŸ‡ª" };
  if (ident.startsWith("SL")) return { city: ident, airport: "Aeropuerto Bolivia", country: "Bolivia", countryCode: "BO", flag: "ðŸ‡§ðŸ‡´" };
  if (ident.startsWith("SB")) return { city: ident, airport: "Aeropuerto Brasil", country: "Brasil", countryCode: "BR", flag: "ðŸ‡§ðŸ‡·" };
  if (ident.startsWith("K")) return { city: ident, airport: "Aeropuerto Estados Unidos", country: "Estados Unidos", countryCode: "US", flag: "ðŸ‡ºðŸ‡¸" };
  if (ident.startsWith("LE")) return { city: ident, airport: "Aeropuerto EspaÃ±a", country: "EspaÃ±a", countryCode: "ES", flag: "ðŸ‡ªðŸ‡¸" };
  if (ident.startsWith("LF")) return { city: ident, airport: "Aeropuerto Francia", country: "Francia", countryCode: "FR", flag: "ðŸ‡«ðŸ‡·" };
  if (ident.startsWith("EG")) return { city: ident, airport: "Aeropuerto Reino Unido", country: "Reino Unido", countryCode: "GB", flag: "ðŸ‡¬ðŸ‡§" };
  if (ident.startsWith("OM")) return { city: ident, airport: "Aeropuerto EAU", country: "Emiratos Ãrabes Unidos", countryCode: "AE", flag: "ðŸ‡¦ðŸ‡ª" };
  return { city: ident || "â€”", airport: "Aeropuerto", country: "", countryCode: "", flag: "ðŸŒ" };
}

function toNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDistance(value: number | string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed == null) return "â€”";
  return `${Math.round(parsed).toLocaleString("es-CL")} NM`;
}

function formatBlock(value: number | string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed == null) return "â€”";
  const minutes = Math.max(0, Math.round(parsed));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} min`;
  return `${hours} h ${String(rest).padStart(2, "0")} min`;
}
function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "â€”";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("es-CL", { maximumFractionDigits: 0 })} USD`;
}

function routeEconomyRangeEstimate(route: RouteCatalogRow | null) {
  if (!route) return null;
  const distance = toNumber(route.distance_nm);
  if (!distance || distance <= 0) return null;
  const types = routeAircraftTypes(route);
  return estimateEconomyRangeForAircraftTypes({
    distanceNm: distance,
    aircraftTypeCodes: types.length ? types : ["A320"],
    operationType: "CAREER",
    operationCategory: route.route_category,
    context: {
      originCountry: route.origin_country,
      destinationCountry: route.destination_country,
      originIcao: route.origin_ident,
      destinationIcao: route.destination_ident,
    },
  });
}

function formatUsdRange(min: number | null | undefined, max: number | null | undefined) {
  if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max)) return "â€”";
  const a = formatUsd(min);
  const b = formatUsd(max);
  return a === b ? a : `${a} â€“ ${b}`;
}

function formatNumberRange(min: number | null | undefined, max: number | null | undefined, suffix = "") {
  if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max)) return "â€”";
  const a = Math.round(min).toLocaleString("es-CL");
  const b = Math.round(max).toLocaleString("es-CL");
  return a === b ? `${a}${suffix}` : `${a} â€“ ${b}${suffix}`;
}


function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function getCategoryMeta(category: string | null | undefined) {
  return CATEGORY_META.find((item) => item.id === category) ?? CATEGORY_META[0];
}

function aircraftSummaryFromTypes(types: string[]) {
  if (!types.length) return "Sin aeronaves compatibles reales";
  if (types.length <= 8) return types.join(" Â· ");
  return `${types.slice(0, 8).join(" Â· ")} +${types.length - 8}`;
}

function routeAircraftTypes(route: RouteCatalogRow | null) {
  return route?.compatible_aircraft_types?.map((type) => normalizeText(type)).filter(Boolean) ?? [];
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
}

function flightNumberValue(route: RouteCatalogRow | null) {
  const value = normalizeText(route?.flight_number);
  const digits = value.replace(/\D/g, "");
  return Number(digits || 0);
}

function cityLabel(ident: string) {
  const airport = inferAirportInfo(ident);
  return `${airport.city}`;
}

function useRouteCatalog() {
  const [routes, setRoutes] = useState<RouteCatalogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    function normalizeNetworkRouteCategory(row: Record<string, unknown>): RouteCategory {
      const serviceProfile = String(row.service_profile ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      const routeGroup = String(row.route_group ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      const serviceLevel = String(row.service_level ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

      if (["transoceanic"].includes(routeGroup)) return "intercontinental";
      if (["continental_longhaul"].includes(routeGroup) || ["heavy", "longhaul"].includes(serviceProfile) || serviceLevel === "premium") return "long_haul";
      if (["south_america_regional"].includes(routeGroup)) return "international";
      if (["domestic_chile", "domestic_argentina", "transborder_patagonia"].includes(routeGroup)) return "regional";
      if (["feeder", "regional"].includes(serviceProfile) || serviceLevel === "core") return "regional";
      if (["trunk"].includes(serviceProfile)) return "national";

      return "regional";
    }

    function simbriefFromFlightDesignator(value: string | null | undefined) {
      const normalized = (value ?? "").trim().toUpperCase();
      if (!normalized) return null;
      return normalized.replace(/^PWG/, "PGW");
    }

    function routeNameFromIdents(origin: string, destination: string) {
      const originInfo = inferAirportInfo(origin);
      const destinationInfo = inferAirportInfo(destination);
      return `${originInfo.city} â†’ ${destinationInfo.city}`;
    }

    function dedupeRoutes(items: RouteCatalogRow[]) {
      const map = new Map<string, RouteCatalogRow>();
      for (const item of items) {
        const key = [item.flight_number, item.origin_ident, item.destination_ident].join("|");
        if (!map.has(key)) {
          map.set(key, item);
        }
      }
      return Array.from(map.values());
    }

    async function loadRoutes() {
      setIsLoading(true);
      setErrorMessage(null);

      const apiRes = await fetch("/api/routes/catalog", { cache: "no-store" });
      const payload = (await apiRes.json().catch(() => ({}))) as {
        ok?: boolean;
        catalogRows?: RouteCatalogRow[];
        networkRoutesRows?: Array<Record<string, unknown>>;
        networkAircraftRows?: Array<{ route_id?: string | null; aircraft_type_code?: string | null }>;
        errors?: { catalog?: string | null; networkRoutes?: string | null; networkAircraft?: string | null };
        error?: string;
      };

      if (!isMounted) return;

      const viewRows = payload.errors?.catalog || payload.error
        ? []
        : ((payload.catalogRows ?? []) as RouteCatalogRow[]).filter((row) => row.is_active !== false);

      const aircraftByRoute = new Map<string, string[]>();
      if (!payload.errors?.networkAircraft && !payload.error) {
        for (const row of (payload.networkAircraftRows ?? []) as Array<{ route_id?: string | null; aircraft_type_code?: string | null }>) {
          const routeId = row.route_id ?? "";
          const typeCode = (row.aircraft_type_code ?? "").trim().toUpperCase();
          if (!routeId || !typeCode) continue;
          const current = aircraftByRoute.get(routeId) ?? [];
          if (!current.includes(typeCode)) current.push(typeCode);
          aircraftByRoute.set(routeId, current);
        }
      }

      const networkRows = payload.errors?.networkRoutes || payload.error
        ? []
        : ((payload.networkRoutesRows ?? []) as Array<Record<string, unknown>>)
            .filter((row) => row.is_active !== false)
            .map((row) => {
            const id = String(row.id ?? "");
            const origin = String(row.origin_ident ?? "").trim().toUpperCase();
            const destination = String(row.destination_ident ?? "").trim().toUpperCase();
            const flightDesignator = String(row.flight_designator ?? "").trim().toUpperCase();
            const flightNumber = flightDesignator || (row.flight_number != null ? `PWG${String(row.flight_number).replace(/\D/g, "")}` : null);
            const blockMinutes = toNumber(row.distance_nm as string | number | null) == null ? null : Math.max(20, Math.round((toNumber(row.distance_nm as string | number | null) ?? 0) * 1.25 + 18));

            return {
              route_id: id || String(row.route_code ?? `${origin}-${destination}-${flightNumber ?? ""}`),
              flight_number: flightNumber,
              simbrief_flight_number: simbriefFromFlightDesignator(flightNumber ?? undefined),
              route_key: String(row.route_pair_key ?? `${origin}-${destination}-${flightNumber ?? ""}`),
              origin_ident: origin,
              destination_ident: destination,
              origin_country: null,
              destination_country: null,
              route_name: routeNameFromIdents(origin, destination),
              route_category: normalizeNetworkRouteCategory(row),
              service_type: "pax",
              operation_type: "itinerary",
              distance_nm: row.distance_nm == null ? null : String(row.distance_nm),
              block_minutes: blockMinutes,
              expected_block_p50: blockMinutes,
              expected_block_p80: blockMinutes == null ? null : blockMinutes + 15,
              compatible_aircraft_types: aircraftByRoute.get(id) ?? [],
              aircraft_options: null,
              is_active: row.is_active === true,
            } satisfies RouteCatalogRow;
          });

      const mergedRoutes = dedupeRoutes([...viewRows, ...networkRows]);

      if (mergedRoutes.length === 0) {
        setRoutes([]);
        setErrorMessage(payload.error ?? payload.errors?.catalog ?? payload.errors?.networkRoutes ?? "No se pudo cargar el catálogo de rutas.");
      } else {
        setRoutes(mergedRoutes);
      }

      setIsLoading(false);
    }

    void loadRoutes();

    return () => {
      isMounted = false;
    };
  }, []);

  return { routes, isLoading, errorMessage };
}
function AirportCell({ ident, align = "left" }: { ident: string; align?: "left" | "right" }) {
  const airport = inferAirportInfo(ident);

  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
        <span className="text-lg leading-none">{airport.flag}</span>
        <span className="text-base font-black tracking-tight text-white sm:text-lg">{ident || "â€”"}</span>
        <span className="truncate text-sm font-semibold text-white/88">{airport.city}</span>
      </div>
      <p className="mt-1 truncate text-xs font-medium text-white/48">{airport.airport}</p>
    </div>
  );
}

function DirectionCell({ title, route }: { title: string; route: RouteCatalogRow | null }) {
  if (!route) {
    return (
      <div className="rounded-2xl border border-white/8 bg-black/16 px-4 py-3 text-sm text-white/45">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">{title}</p>
        <p className="mt-2">Sin tramo cargado</p>
      </div>
    );
  }

  const origin = normalizeText(route.origin_ident);
  const destination = normalizeText(route.destination_ident);
  const flight = normalizeText(route.flight_number);
  const simbrief = normalizeText(route.simbrief_flight_number);

  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/54">{title}</p>
        <div className="text-right">
          <p className="text-sm font-black text-white">{flight || "â€”"}</p>
          <p className="text-[11px] font-semibold text-white/42">SimBrief {simbrief || "â€”"}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <AirportCell ident={origin} />
        <span className="pt-1 text-lg text-cyan-100/52">â†’</span>
        <AirportCell ident={destination} align="right" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl border border-white/8 bg-white/[0.045] px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.16em] text-white/36">Dist.</p>
          <p className="mt-1 font-bold text-white/84">{formatDistance(route.distance_nm)}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.045] px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.16em] text-white/36">Block</p>
          <p className="mt-1 font-bold text-white/84">{formatBlock(route.block_minutes)}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.045] px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.16em] text-white/36">P80</p>
          <p className="mt-1 font-bold text-white/84">{formatBlock(route.expected_block_p80)}</p>
        </div>
      </div>

      {(() => {
        const economy = routeEconomyRangeEstimate(route);
        return economy ? (
          <>
          <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Rango segÃºn aeronave: {economy.minAircraftTypeCode} â†’ {economy.maxAircraftTypeCode}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl border border-emerald-300/14 bg-emerald-300/[0.06] px-3 py-2">
              <p className="font-semibold uppercase tracking-[0.14em] text-emerald-100/50">ðŸ’µ Piloto</p>
              <p className="mt-1 font-black text-emerald-100">{formatUsdRange(economy.min.pilotCommissionUsd, economy.max.pilotCommissionUsd)}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2">
              <p className="font-semibold uppercase tracking-[0.14em] text-white/36">ðŸ‘¥ Pax est.</p>
              <p className="mt-1 font-bold text-white/78">{formatNumberRange(economy.min.estimatedPassengers, economy.max.estimatedPassengers)}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2">
              <p className="font-semibold uppercase tracking-[0.14em] text-white/36">ðŸ“¦ Carga</p>
              <p className="mt-1 font-bold text-white/78">{formatNumberRange(economy.min.estimatedCargoKg, economy.max.estimatedCargoKg, " kg")}</p>
            </div>
            <div className="rounded-xl border border-cyan-300/14 bg-cyan-300/[0.06] px-3 py-2">
              <p className="font-semibold uppercase tracking-[0.14em] text-cyan-100/50">ðŸ¢ AerolÃ­nea</p>
              <p className="mt-1 font-black text-cyan-100">{formatUsdRange(economy.min.airlineRevenueUsd, economy.max.airlineRevenueUsd)}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2">
              <p className="font-semibold uppercase tracking-[0.14em] text-white/36">ðŸ§¾ OperaciÃ³n</p>
              <p className="mt-1 font-bold text-white/78">{formatUsdRange(economy.min.airportFeesUsd + economy.min.handlingCostUsd + economy.min.repairReserveUsd + economy.min.onboardServiceCostUsd, economy.max.airportFeesUsd + economy.max.handlingCostUsd + economy.max.repairReserveUsd + economy.max.onboardServiceCostUsd)}</p>
            </div>
            <div className="rounded-xl border border-cyan-300/14 bg-cyan-300/[0.06] px-3 py-2">
              <p className="font-semibold uppercase tracking-[0.14em] text-cyan-100/50">ðŸ“ˆ Utilidad</p>
              <p className="mt-1 font-black text-cyan-100">{formatUsdRange(economy.min.netProfitUsd, economy.max.netProfitUsd)}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2">
              <p className="font-semibold uppercase tracking-[0.14em] text-white/36">â›½ Combustible</p>
              <p className="mt-1 font-bold text-white/78">{formatUsdRange(economy.min.fuelCostUsd, economy.max.fuelCostUsd)}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2">
              <p className="font-semibold uppercase tracking-[0.14em] text-white/36">ðŸ›  MantenciÃ³n</p>
              <p className="mt-1 font-bold text-white/78">{formatUsdRange(economy.min.maintenanceCostUsd, economy.max.maintenanceCostUsd)}</p>
            </div>
          </div>
          </>
        ) : (
          <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-[11px] text-white/48">
            EconomÃ­a estimada no disponible.
          </div>
        );
      })()}
    </div>
  );
}

function RoutePairRow({ pair }: { pair: RoutePair }) {
  const mainRoute = pair.outbound ?? pair.inbound;
  const category = getCategoryMeta(mainRoute?.route_category);
  const service = mainRoute?.service_type?.toUpperCase() || "PAX";
  const originName = cityLabel(pair.originIdent);
  const destinationName = cityLabel(pair.destinationIdent);
  const pairEconomy = routeEconomyRangeEstimate(mainRoute);
  const compatibleAircraftTypes = pairEconomy?.aircraftTypes ?? [];

  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.05] p-3 shadow-[0_14px_48px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:border-cyan-200/24 hover:bg-white/[0.07] sm:p-4">
      <div className="grid gap-3 xl:grid-cols-[0.85fr_1.35fr_1.35fr_0.9fr] xl:items-stretch">
        <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-cyan-300/10 to-black/12 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-100/18 bg-cyan-300/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/78">
              {category.shortLabel}
            </span>
            <span className="rounded-full border border-emerald-100/15 bg-emerald-300/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-100/78">
              {service}
            </span>
          </div>
          <h3 className="mt-3 text-base font-black text-white sm:text-lg">
            {originName} â†” {destinationName}
          </h3>
          <p className="mt-2 text-xs leading-5 text-white/54">
            Ruta ida/vuelta agrupada. Los ICAO se mantienen visibles junto al nombre del aeropuerto.
          </p>
        </div>

        <DirectionCell title="Ida" route={pair.outbound} />
        <DirectionCell title="Vuelta" route={pair.inbound} />

        <div className="rounded-2xl border border-white/8 bg-black/16 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Aeronaves</p>
          <p className="mt-2 text-sm leading-6 text-white/70">{aircraftSummaryFromTypes(compatibleAircraftTypes)}</p>
          {pairEconomy?.excludedAircraftTypes?.length ? (
            <p className="mt-3 rounded-xl border border-amber-300/12 bg-amber-300/[0.06] px-3 py-2 text-[11px] leading-5 text-amber-50/70">
              Excluidas por alcance/rango: {pairEconomy.excludedAircraftTypes.slice(0, 6).join(" Â· ")}{pairEconomy.excludedAircraftTypes.length > 6 ? ` +${pairEconomy.excludedAircraftTypes.length - 6}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function buildRoutePairs(routes: RouteCatalogRow[]) {
  const pairs = new Map<string, RouteCatalogRow[]>();

  for (const route of routes) {
    const origin = normalizeText(route.origin_ident);
    const destination = normalizeText(route.destination_ident);
    if (!origin || !destination) continue;
    const sorted = [origin, destination].sort();
    const key = `${getCategoryMeta(route.route_category).id}:${sorted[0]}:${sorted[1]}`;
    pairs.set(key, [...(pairs.get(key) ?? []), route]);
  }

  return Array.from(pairs.entries())
    .map(([key, pairRoutes]) => {
      const sortedRoutes = [...pairRoutes].sort((a, b) => flightNumberValue(a) - flightNumberValue(b));
      const outbound = sortedRoutes[0] ?? null;
      const inbound = sortedRoutes[1] ?? null;
      const originIdent = normalizeText(outbound?.origin_ident ?? inbound?.destination_ident);
      const destinationIdent = normalizeText(outbound?.destination_ident ?? inbound?.origin_ident);
      const aircraftTypes = uniqueSorted(sortedRoutes.flatMap(routeAircraftTypes));

      return { key, outbound, inbound, originIdent, destinationIdent, aircraftTypes } satisfies RoutePair;
    })
    .sort((a, b) => {
      const aFlight = flightNumberValue(a.outbound ?? a.inbound);
      const bFlight = flightNumberValue(b.outbound ?? b.inbound);
      if (aFlight !== bFlight) return aFlight - bFlight;
      return a.key.localeCompare(b.key, "es");
    });
}

function RoutesContent() {
  const { routes, isLoading, errorMessage } = useRouteCatalog();
  const [activeCategory, setActiveCategory] = useState<RouteCategory>("regional");
  const [searchTerm, setSearchTerm] = useState("");

  const categoryCounts = useMemo(() => {
    const counts = new Map<RouteCategory, number>();
    for (const item of CATEGORY_META) counts.set(item.id, 0);
    for (const route of routes) {
      const category = getCategoryMeta(route.route_category).id;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
  }, [routes]);

  const filteredRoutes = useMemo(() => {
    const needle = searchTerm.trim().toUpperCase();
    return routes
      .filter((route) => getCategoryMeta(route.route_category).id === activeCategory)
      .filter((route) => {
        if (!needle) return true;
        const origin = normalizeText(route.origin_ident);
        const destination = normalizeText(route.destination_ident);
        const originInfo = inferAirportInfo(origin);
        const destinationInfo = inferAirportInfo(destination);
        const haystack = [
          route.flight_number,
          route.simbrief_flight_number,
          route.route_name,
          route.origin_ident,
          route.destination_ident,
          originInfo.city,
          originInfo.airport,
          destinationInfo.city,
          destinationInfo.airport,
          ...(route.compatible_aircraft_types ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toUpperCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => {
        const aCategory = CATEGORY_ORDER.get(getCategoryMeta(a.route_category).id) ?? 99;
        const bCategory = CATEGORY_ORDER.get(getCategoryMeta(b.route_category).id) ?? 99;
        if (aCategory !== bCategory) return aCategory - bCategory;
        return normalizeText(a.flight_number).localeCompare(normalizeText(b.flight_number), "es");
      });
  }, [activeCategory, routes, searchTerm]);

  const routePairs = useMemo(() => buildRoutePairs(filteredRoutes), [filteredRoutes]);
  const activeMeta = getCategoryMeta(activeCategory);

  return (
    <div className="mx-auto w-full max-w-[1780px] px-4 py-10 sm:px-6 sm:py-14 xl:px-10 lg:py-16">
      <section className="glass-panel rounded-[32px] px-6 py-7 sm:px-8 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-100/58">
              Red oficial Patagonia Wings
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-5xl">
              CatÃ¡logo de rutas
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-white/70 sm:text-[15px]">
              Consulta la red operativa cargada en la base limpia V2. Las rutas se muestran agrupadas por ida y vuelta, con ICAO, ciudad, aeropuerto, nÃºmero PWG, equivalente SimBrief PGW, distancia, duraciÃ³n y aeronaves compatibles.
            </p>
          </div>
          <Link
            href="/dashboard?tab=dispatch"
            className="inline-flex w-fit items-center justify-center rounded-full border border-cyan-100/20 bg-cyan-300/12 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18"
          >
            Ir a despacho â†’
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-[32px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_META.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveCategory(item.id)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  activeCategory === item.id
                    ? "border-cyan-200/38 bg-cyan-300/18 text-white shadow-[0_0_28px_rgba(34,211,238,0.14)]"
                    : "border-white/10 bg-black/12 text-white/58 hover:border-white/20 hover:text-white/82"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.shortLabel}
                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/66">
                  {categoryCounts.get(item.id) ?? 0}
                </span>
              </button>
            ))}
          </div>

          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por vuelo, ciudad, aeropuerto, ICAO o aeronave..."
            className="min-h-[44px] w-full rounded-full border border-white/10 bg-black/20 px-5 text-sm font-medium text-white outline-none transition placeholder:text-white/35 focus:border-cyan-200/36 lg:max-w-md"
          />
        </div>

        <div className="mt-5 rounded-[26px] border border-white/10 bg-black/16 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-white">{activeMeta.label}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">{activeMeta.description}</p>
            </div>
            <span className="rounded-full border border-emerald-100/16 bg-emerald-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">
              {filteredRoutes.length} rutas Â· {routePairs.length} pares
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-[28px] border border-white/10 bg-black/16 px-6 py-12 text-center text-sm text-white/62">
            Cargando rutas oficiales...
          </div>
        ) : errorMessage ? (
          <div className="mt-6 rounded-[28px] border border-rose-300/20 bg-rose-500/10 px-6 py-7 text-sm leading-6 text-rose-100">
            No se pudo cargar la red de rutas: {errorMessage}
          </div>
        ) : routePairs.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-white/10 bg-black/16 px-6 py-12 text-center text-sm text-white/62">
            No hay rutas para esta categorÃ­a con el filtro actual.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <div className="hidden rounded-[18px] border border-white/8 bg-black/20 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/38 xl:grid xl:grid-cols-[0.85fr_1.35fr_1.35fr_0.9fr]">
              <span>Par de ruta</span>
              <span>Ida</span>
              <span>Vuelta</span>
              <span>Aeronaves compatibles</span>
            </div>
            {routePairs.map((pair) => (
              <RoutePairRow key={pair.key} pair={pair} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function RoutesPage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container sticky top-4 z-40 pt-5">
            <PublicHeader />
          </header>

          <ProtectedPage>
            <RoutesContent />
          </ProtectedPage>
        </div>
      </section>
    </main>
  );
}

