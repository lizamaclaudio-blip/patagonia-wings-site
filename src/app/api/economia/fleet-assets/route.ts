import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { estimateAircraftMarketValueUsd } from "@/lib/pilot-economy";

export const dynamic = "force-dynamic";

type AssetCatalogRow = {
  aircraft_type?: string | null;
  estimated_purchase_price_usd?: number | string | null;
  estimated_monthly_fixed_cost_usd?: number | string | null;
  estimated_hourly_maintenance_usd?: number | string | null;
};

type AnyRow = Record<string, unknown>;

type FleetAssetItem = {
  aircraftType: string;
  count: number;
  totalValueUsd: number;
  monthlyFixedCostUsd: number;
  hourlyMaintenanceUsd: number;
  registrations: string[];
  hubs: string[];
};

type FleetSourceRow = {
  source: "aircraft_fleet" | "aircraft";
  key: string;
  registration: string;
  aircraftType: string;
  hub: string;
  raw: AnyRow;
};

const EXPECTED_AIRCRAFT_TYPE_COUNT = 33;
const PAGE_SIZE = 1000;

const FALLBACK_ASSET_CATALOG: AssetCatalogRow[] = [
  { aircraft_type: "C208", estimated_purchase_price_usd: 2500000, estimated_monthly_fixed_cost_usd: 8000, estimated_hourly_maintenance_usd: 85 },
  { aircraft_type: "B350", estimated_purchase_price_usd: 5200000, estimated_monthly_fixed_cost_usd: 15000, estimated_hourly_maintenance_usd: 130 },
  { aircraft_type: "ATR72", estimated_purchase_price_usd: 24000000, estimated_monthly_fixed_cost_usd: 45000, estimated_hourly_maintenance_usd: 430 },
  { aircraft_type: "E175", estimated_purchase_price_usd: 32000000, estimated_monthly_fixed_cost_usd: 65000, estimated_hourly_maintenance_usd: 650 },
  { aircraft_type: "E190", estimated_purchase_price_usd: 47000000, estimated_monthly_fixed_cost_usd: 78000, estimated_hourly_maintenance_usd: 780 },
  { aircraft_type: "A319", estimated_purchase_price_usd: 50000000, estimated_monthly_fixed_cost_usd: 120000, estimated_hourly_maintenance_usd: 1150 },
  { aircraft_type: "A320", estimated_purchase_price_usd: 72000000, estimated_monthly_fixed_cost_usd: 150000, estimated_hourly_maintenance_usd: 1250 },
  { aircraft_type: "A321", estimated_purchase_price_usd: 85000000, estimated_monthly_fixed_cost_usd: 170000, estimated_hourly_maintenance_usd: 1450 },
  { aircraft_type: "B738", estimated_purchase_price_usd: 78000000, estimated_monthly_fixed_cost_usd: 155000, estimated_hourly_maintenance_usd: 1350 },
  { aircraft_type: "B739", estimated_purchase_price_usd: 82000000, estimated_monthly_fixed_cost_usd: 165000, estimated_hourly_maintenance_usd: 1450 },
  { aircraft_type: "B38M", estimated_purchase_price_usd: 95000000, estimated_monthly_fixed_cost_usd: 180000, estimated_hourly_maintenance_usd: 1500 },
  { aircraft_type: "B789", estimated_purchase_price_usd: 160000000, estimated_monthly_fixed_cost_usd: 360000, estimated_hourly_maintenance_usd: 3600 },
  { aircraft_type: "A339", estimated_purchase_price_usd: 150000000, estimated_monthly_fixed_cost_usd: 340000, estimated_hourly_maintenance_usd: 3450 },
  { aircraft_type: "B77W", estimated_purchase_price_usd: 210000000, estimated_monthly_fixed_cost_usd: 490000, estimated_hourly_maintenance_usd: 5200 },
];

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function firstText(row: AnyRow, keys: string[]) {
  for (const key of keys) {
    const value = asText(row[key]);
    if (value) return value;
  }
  return "";
}

function normalizeType(raw: string) {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) return "UNKNOWN";
  if (code.startsWith("A20N")) return "A320";
  if (code.startsWith("A21N")) return "A321";
  if (code.startsWith("A318")) return "A318";
  if (code.startsWith("A319")) return "A319";
  if (code.startsWith("A320")) return "A320";
  if (code.startsWith("A321")) return "A321";
  if (code.startsWith("A359") || code.startsWith("A350")) return "A359";
  if (code.startsWith("A339") || code.startsWith("A330")) return "A339";
  if (code.startsWith("B736") || code.startsWith("B7376")) return "B736";
  if (code.startsWith("B738") || code.startsWith("B7378")) return "B738";
  if (code.startsWith("B739") || code.startsWith("B7379")) return "B739";
  if (code.startsWith("B38M") || code.includes("MAX8")) return "B38M";
  if (code.startsWith("B789") || code.startsWith("B787")) return "B789";
  if (code.startsWith("B77") || code.startsWith("B777")) return "B77W";
  if (code.startsWith("B747") || code.startsWith("B74")) return "B747";
  if (code.startsWith("AT7") || code.startsWith("ATR")) return "ATR72";
  if (code.startsWith("E17")) return "E175";
  if (code.startsWith("E19")) return "E190";
  if (code.startsWith("B350") || code.startsWith("BE20")) return "B350";
  if (code.startsWith("BE58")) return "BE58";
  if (code.startsWith("C172")) return "C172";
  if (code.startsWith("C208")) return "C208";
  if (code.startsWith("DHC6")) return "DHC6";
  if (code.startsWith("TBM")) return "TBM9";
  return code.slice(0, 8);
}

function assetCatalogMap(rows: AssetCatalogRow[]) {
  const map = new Map<string, { purchase: number; monthly: number; hourly: number }>();
  for (const row of rows) {
    const type = normalizeType(row.aircraft_type ?? "");
    if (!type || type === "UNKNOWN") continue;
    map.set(type, {
      purchase: asNumber(row.estimated_purchase_price_usd),
      monthly: asNumber(row.estimated_monthly_fixed_cost_usd),
      hourly: asNumber(row.estimated_hourly_maintenance_usd),
    });
  }
  return map;
}

function normalizeFleetRow(row: AnyRow, source: FleetSourceRow["source"], index: number): FleetSourceRow {
  const rawType = firstText(row, [
    "aircraft_type",
    "aircraft_type_code",
    "type_code",
    "type",
    "model",
    "variant_name",
    "aircraft_model",
    "icao_type",
    "icao_code",
  ]);
  const registration = firstText(row, ["registration", "tail_number", "aircraft_registration", "reg", "callsign", "registration_code"]);
  const hub = firstText(row, [
    "home_hub_icao",
    "hub_icao",
    "base_hub_icao",
    "current_airport_icao",
    "current_airport_code",
    "location_icao",
    "home_hub_code",
  ]);
  const id = firstText(row, ["id", "aircraft_id", "fleet_id"]);
  const type = normalizeType(rawType || "UNKNOWN");
  return {
    source,
    key: registration ? `REG:${registration.toUpperCase()}` : `${source}:${id || index}`,
    registration,
    aircraftType: type,
    hub,
    raw: row,
  };
}

function uniqueFleetRows(fleetRows: AnyRow[], aircraftRows: AnyRow[]) {
  const allRows = [
    ...fleetRows.map((row, index) => normalizeFleetRow(row, "aircraft_fleet", index)),
    ...aircraftRows.map((row, index) => normalizeFleetRow(row, "aircraft", index)),
  ];
  const byKey = new Map<string, FleetSourceRow>();
  const duplicates: FleetSourceRow[] = [];

  for (const row of allRows) {
    if (byKey.has(row.key)) {
      duplicates.push(row);
      continue;
    }
    byKey.set(row.key, row);
  }

  return { rows: Array.from(byKey.values()), duplicates, rawRows: allRows };
}

function buildFleetRows(fleetRows: FleetSourceRow[], catalog: Map<string, { purchase: number; monthly: number; hourly: number }>) {
  const groups = new Map<string, FleetAssetItem>();

  for (const row of fleetRows) {
    const type = row.aircraftType || "UNKNOWN";
    const catalogValue = catalog.get(type);
    const purchase = catalogValue?.purchase || estimateAircraftMarketValueUsd(type);
    const monthly = catalogValue?.monthly || Math.round(purchase * 0.002);
    const hourly = catalogValue?.hourly || Math.round(purchase * 0.000018);

    if (!groups.has(type)) {
      groups.set(type, {
        aircraftType: type,
        count: 0,
        totalValueUsd: 0,
        monthlyFixedCostUsd: 0,
        hourlyMaintenanceUsd: hourly,
        registrations: [],
        hubs: [],
      });
    }

    const item = groups.get(type)!;
    item.count += 1;
    item.totalValueUsd += purchase;
    item.monthlyFixedCostUsd += monthly;
    item.hourlyMaintenanceUsd = hourly;
    if (row.registration && !item.registrations.includes(row.registration)) item.registrations.push(row.registration);
    if (row.hub && !item.hubs.includes(row.hub)) item.hubs.push(row.hub);
  }

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      totalValueUsd: roundMoney(item.totalValueUsd),
      monthlyFixedCostUsd: roundMoney(item.monthlyFixedCostUsd),
      hourlyMaintenanceUsd: roundMoney(item.hourlyMaintenanceUsd),
      registrations: item.registrations.slice(0, 10),
      hubs: item.hubs.slice(0, 8),
    }))
    .sort((a, b) => b.totalValueUsd - a.totalValueUsd);
}

function extractTypeFromCatalogRow(row: AnyRow) {
  return normalizeType(firstText(row, ["type_code", "code", "aircraft_type", "icao_code", "icao", "model", "name", "id"]));
}

function typeCounts(rows: FleetSourceRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.aircraftType || row.aircraftType === "UNKNOWN") continue;
    counts.set(row.aircraftType, (counts.get(row.aircraftType) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([aircraftType, count]) => ({ aircraftType, count }))
    .sort((a, b) => b.count - a.count || a.aircraftType.localeCompare(b.aircraftType));
}

async function safeExactCount(supabase: ReturnType<typeof createSupabaseServerClient>, table: string) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  return { count: count ?? 0, error: error?.message ?? null };
}

async function fetchAllRows(supabase: ReturnType<typeof createSupabaseServerClient>, table: string) {
  const rows: AnyRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select("*").range(from, to);
    if (error) return { rows, error: error.message };
    const batch = ((data ?? []) as AnyRow[]);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return { rows, error: null };
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const [
      catalogRes,
      fleetFetch,
      aircraftFetch,
      aircraftTypesFetch,
      economyProfilesFetch,
      airlineRes,
      ledgerRes,
      fleetCount,
      aircraftCount,
      aircraftTypesCount,
      economyProfilesCount,
    ] = await Promise.all([
      supabase
        .from("aircraft_asset_values")
        .select("aircraft_type, estimated_purchase_price_usd, estimated_monthly_fixed_cost_usd, estimated_hourly_maintenance_usd")
        .order("estimated_purchase_price_usd", { ascending: false }),
      fetchAllRows(supabase, "aircraft_fleet"),
      fetchAllRows(supabase, "aircraft"),
      fetchAllRows(supabase, "aircraft_types"),
      fetchAllRows(supabase, "aircraft_economy_profiles"),
      supabase.from("airlines").select("id, name, balance_usd").limit(1).maybeSingle(),
      supabase.from("airline_ledger").select("entry_type, amount_usd"),
      safeExactCount(supabase, "aircraft_fleet"),
      safeExactCount(supabase, "aircraft"),
      safeExactCount(supabase, "aircraft_types"),
      safeExactCount(supabase, "aircraft_economy_profiles"),
    ]);

    const catalogRows = ((catalogRes.data && catalogRes.data.length > 0 ? catalogRes.data : FALLBACK_ASSET_CATALOG) ?? []) as AssetCatalogRow[];
    const catalog = assetCatalogMap(catalogRows);
    const { rows: uniqueRows, duplicates, rawRows } = uniqueFleetRows(fleetFetch.rows, aircraftFetch.rows);

    const fleet = uniqueRows.length > 0 ? buildFleetRows(uniqueRows, catalog) : [];
    const catalogSummary = catalogRows.map((row) => {
      const type = normalizeType(row.aircraft_type ?? "");
      return {
        aircraftType: type,
        estimatedPurchasePriceUsd: roundMoney(asNumber(row.estimated_purchase_price_usd) || estimateAircraftMarketValueUsd(type)),
        estimatedMonthlyFixedCostUsd: roundMoney(asNumber(row.estimated_monthly_fixed_cost_usd)),
        estimatedHourlyMaintenanceUsd: roundMoney(asNumber(row.estimated_hourly_maintenance_usd)),
      };
    });

    const aircraftTypesCatalog: string[] = Array.from(new Set(aircraftTypesFetch.rows.map(extractTypeFromCatalogRow).filter((type): type is string => Boolean(type) && type !== "UNKNOWN"))).sort();
    const economyProfileTypes: string[] = Array.from(new Set(economyProfilesFetch.rows.map(extractTypeFromCatalogRow).filter((type): type is string => Boolean(type) && type !== "UNKNOWN"))).sort();
    const assetCatalogTypes: string[] = Array.from(new Set(catalogSummary.map((row) => row.aircraftType).filter((type): type is string => Boolean(type)))).sort();
    const realFleetTypes: string[] = fleet.map((row) => row.aircraftType).filter((type): type is string => Boolean(type) && type !== "UNKNOWN").sort();

    const totalFleetValueUsd = roundMoney(fleet.reduce((sum, item) => sum + item.totalValueUsd, 0));
    const totalMonthlyFixedCostUsd = roundMoney(fleet.reduce((sum, item) => sum + item.monthlyFixedCostUsd, 0));
    const uniqueAircraftCount = fleet.reduce((sum, item) => sum + item.count, 0);
    const airlineBalanceUsd = asNumber((airlineRes.data as AnyRow | null)?.balance_usd);
    const ledgerRows = (ledgerRes.data ?? []) as Array<{ entry_type?: string | null; amount_usd?: unknown }>;
    const aircraftPurchaseLedgerUsd = Math.abs(ledgerRows
      .filter((row) => row.entry_type === "aircraft_purchase")
      .reduce((sum, row) => sum + asNumber(row.amount_usd), 0));

    const recommendedReserveUsd = roundMoney(totalMonthlyFixedCostUsd * 6 + Math.max(totalFleetValueUsd * 0.01, 250000));
    const purchasingPowerUsd = roundMoney(Math.max(0, airlineBalanceUsd - recommendedReserveUsd));
    const purchaseOptions = catalogSummary
      .map((item) => {
        const canBuyWithReserve = purchasingPowerUsd >= item.estimatedPurchasePriceUsd;
        const canBuyCashOnly = airlineBalanceUsd >= item.estimatedPurchasePriceUsd;
        const remainingAfterPurchaseUsd = roundMoney(airlineBalanceUsd - item.estimatedPurchasePriceUsd);
        return {
          ...item,
          canBuyWithReserve,
          canBuyCashOnly,
          remainingAfterPurchaseUsd,
          reserveGapUsd: roundMoney(Math.max(0, item.estimatedPurchasePriceUsd - purchasingPowerUsd)),
          suggested: item.estimatedPurchasePriceUsd <= Math.max(0, purchasingPowerUsd * 0.85),
        };
      })
      .sort((a, b) => a.estimatedPurchasePriceUsd - b.estimatedPurchasePriceUsd);

    const sourceErrors = [
      fleetFetch.error ? `aircraft_fleet: ${fleetFetch.error}` : null,
      aircraftFetch.error ? `aircraft: ${aircraftFetch.error}` : null,
      aircraftTypesFetch.error ? `aircraft_types: ${aircraftTypesFetch.error}` : null,
      economyProfilesFetch.error ? `aircraft_economy_profiles: ${economyProfilesFetch.error}` : null,
      fleetCount.error ? `count aircraft_fleet: ${fleetCount.error}` : null,
      aircraftCount.error ? `count aircraft: ${aircraftCount.error}` : null,
      aircraftTypesCount.error ? `count aircraft_types: ${aircraftTypesCount.error}` : null,
      economyProfilesCount.error ? `count aircraft_economy_profiles: ${economyProfilesCount.error}` : null,
    ].filter(Boolean) as string[];

    return NextResponse.json({
      ok: true,
      airline: {
        name: asText((airlineRes.data as AnyRow | null)?.name) || "Patagonia Wings",
        balanceUsd: roundMoney(airlineBalanceUsd),
        recommendedReserveUsd,
        purchasingPowerUsd,
      },
      summary: {
        aircraftCount: uniqueAircraftCount,
        rawAircraftRows: rawRows.length,
        aircraftFleetTableCount: fleetCount.count,
        aircraftTableCount: aircraftCount.count,
        duplicateAircraftRows: duplicates.length,
        typeCount: realFleetTypes.length,
        aircraftTypesTableCount: aircraftTypesCount.count,
        economyProfileTypeCount: economyProfilesCount.count,
        assetCatalogTypeCount: assetCatalogTypes.length,
        expectedAircraftTypeCount: EXPECTED_AIRCRAFT_TYPE_COUNT,
        totalFleetValueUsd,
        totalMonthlyFixedCostUsd,
        aircraftPurchaseLedgerUsd,
        source: uniqueRows.length > 0 ? "supabase_exact" : "catalog_only",
        sourceErrors,
      },
      typeAudit: {
        expectedTypeCount: EXPECTED_AIRCRAFT_TYPE_COUNT,
        realFleetTypes,
        aircraftTypesCatalog,
        economyProfileTypes,
        assetCatalogTypes,
        missingEconomyProfiles: aircraftTypesCatalog.filter((type) => !economyProfileTypes.includes(type)),
        missingAssetValues: aircraftTypesCatalog.filter((type) => !assetCatalogTypes.includes(type)),
        fleetTypeCounts: typeCounts(uniqueRows),
      },
      fleet,
      catalog: catalogSummary,
      purchaseOptions,
      policy: {
        factoryDelivery: "Toda aeronave nueva se compra con caja de la aerolínea y se entrega al hub asignado desde fábrica.",
        accounting: "La compra debe quedar en airline_ledger como aircraft_purchase y el activo en flota/aircraft_asset_values.",
        reserveRule: "Antes de comprar, se recomienda conservar 6 meses de costos fijos de flota + 1% del valor patrimonial como reserva técnica.",
        countingRule: "El conteo de flota usa paginación completa y deduplicación por matrícula; no queda limitado a 1000 filas.",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error al obtener inversión de flota." },
      { status: 500 }
    );
  }
}
