export type SimbriefDispatchPayload = {
  userId: string;
  reservationId: string | null;
  callsign: string;
  simbriefUsername: string;
  firstName: string | null;
  lastName: string | null;
  flightNumber: string;
  origin: string;
  destination: string;
  alternate: string | null;
  aircraftCode: string;
  aircraftTailNumber: string | null;
  routeText: string;
  scheduledDeparture: string;
  eteMinutes: number;
  pax: number;
  cargoKg: number;
  remarks: string;
};

export type SimbriefDispatchResponse = {
  ok: true;
  staticId: string;
  type: string;
  timestamp: number;
  generateUrl: string;
  outputpage: string;
  fetchUrl: string;
  editUrl: string;
};

export type SimbriefOfpSummary = {
  source: "real";
  matchedByStaticId: boolean;
  staticId: string | null;
  flightNumber: string | null;
  origin: string | null;
  destination: string | null;
  alternate: string | null;
  airframe: string | null;
  aircraftRegistration: string | null;
  routeText: string | null;
  cruiseAltitude: string | null;
  distanceNm: number | null;
  eteMinutes: number | null;
  etaIso: string | null;
  pax: number | null;
  payloadKg: number | null;
  cargoKg: number | null;
  tripFuelKg: number | null;
  reserveFuelKg: number | null;
  taxiFuelKg: number | null;
  blockFuelKg: number | null;
  zfwKg: number | null;
  towKg: number | null;
  lwKg: number | null;
  mzfwKg: number | null;
  mtowKg: number | null;
  mlwKg: number | null;
  generatedAtIso: string | null;
  pdfUrl: string | null;
  rawUnits: string | null;
};

const SIMBRIEF_TYPE_BY_AIRFRAME: Record<string, string> = {
  A319: "A319",
  A320: "A320",
  A20N: "A20N",
  A321: "A321",
  A21N: "A21N",
  A339: "A339",
  A359: "A359",
  AT76: "AT76",
  "B737-700": "B737",
  B737: "B737",
  "B737-800": "B738",
  B738: "B738",
  B739: "B739",
  B38M: "B38M",
  B772: "B772",
  B77W: "B77W",
  B789: "B789",
  B78X: "B78X",
  B350: "B350",
  BE58: "BE58",
  C208: "C208",
  E175: "E175",
  E190: "E190",
  E195: "E195",
  MD82: "MD82",
  MD83: "MD83",
  MD88: "MD88",
  TBM8: "TBM8",
  TBM9: "TBM9",
  ATR72: "AT76",
  "ATR72-600": "AT76",
  ATR72_MSFS: "AT76",
  C208_MSFS: "C208",
  C208_BLACKSQUARE: "C208",
  B350_MSFS: "B350",
  B350_BLACKSQUARE: "B350",
  BE58_MSFS: "BE58",
  BE58_BLACKSQUARE: "BE58",
  BE58_BS_PRO: "BE58",
  E175_FLIGHTSIM: "E175",
  E190_FLIGHTSIM: "E190",
  E195_FLIGHTSIM: "E195",
  A319_FENIX: "A319",
  A320_FENIX: "A320",
  A321_FENIX: "A321",
  A20N_FBW: "A20N",
  A21N_LATINVFR: "A21N",
  B736_PMDG: "B737",
  B737_PMDG: "B737",
  B738_PMDG: "B738",
  B739_PMDG: "B739",
  B38M_IFLY: "B38M",
  MD82_MADDOG: "MD82",
  MD83_MADDOG: "MD83",
  MD88_MADDOG: "MD88",
};

function normalizeUpper(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function sanitizeStaticToken(value: string) {
  return value.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 48);
}

function getPathValue(input: unknown, path: string) {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, input);
}

function firstDefined(input: unknown, paths: string[]) {
  for (const path of paths) {
    const value = getPathValue(input, path);
    if (typeof value !== "undefined" && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/[^0-9.+-]/g, "").trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toInteger(value: unknown) {
  const numberValue = toNumber(value);
  if (numberValue === null) {
    return null;
  }

  return Math.round(numberValue);
}

function toMinutes(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hhmm = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  }

  const plain = toNumber(trimmed);
  return plain === null ? null : Math.round(plain);
}

function toIso(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

function toKg(value: unknown, units: string | null) {
  const parsed = toNumber(value);
  if (parsed === null) {
    return null;
  }

  if (units?.startsWith("LB")) {
    return Math.round(parsed * 0.45359237);
  }

  return Math.round(parsed);
}

function formatCruiseAltitude(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1000) {
      return `FL${Math.round(value / 100)}`;
    }

    return `FL${Math.round(value)}`;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("FL")) {
    return normalized;
  }

  const digits = normalized.replace(/[^0-9]/g, "");
  if (!digits) {
    return normalized;
  }

  const numericValue = Number(digits);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return normalized;
  }

  if (numericValue >= 1000) {
    return `FL${Math.round(numericValue / 100)}`;
  }

  return `FL${Math.round(numericValue)}`;
}

export function resolveSimbriefType(aircraftCode: string) {
  return SIMBRIEF_TYPE_BY_AIRFRAME[normalizeUpper(aircraftCode)] ?? normalizeUpper(aircraftCode);
}

export function buildStaticId(payload: {
  userId: string;
  reservationId?: string | null;
  flightNumber: string;
  origin: string;
  destination: string;
}) {
  const reservationToken = sanitizeStaticToken(payload.reservationId ?? payload.userId);
  const routeToken = sanitizeStaticToken(
    `${normalizeUpper(payload.flightNumber)}_${normalizeUpper(payload.origin)}_${normalizeUpper(payload.destination)}`
  );

  return `PWG_${routeToken}_${reservationToken}`.slice(0, 64);
}

export function formatSimbriefDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const year = String(date.getUTCFullYear()).slice(-2);

  return `${day}${month}${year}`;
}

export function getHourMinuteUtc(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    hour: String(date.getUTCHours()).padStart(2, "0"),
    minute: String(date.getUTCMinutes()).padStart(2, "0"),
  };
}

export function getEstimatedEnrouteParts(totalMinutes: number) {
  const safe = Math.max(1, Math.round(totalMinutes));
  return {
    hours: String(Math.floor(safe / 60)).padStart(2, "0"),
    minutes: String(safe % 60).padStart(2, "0"),
  };
}

export function buildSimbriefRedirectUrl(params: {
  origin: string;
  destination: string;
  type: string;
  timestamp: number;
  outputpage: string;
  apicode: string;
  payload: SimbriefDispatchPayload;
  staticId: string;
}) {
  const departureParts = getHourMinuteUtc(params.payload.scheduledDeparture);
  const date = formatSimbriefDate(params.payload.scheduledDeparture);
  const ete = getEstimatedEnrouteParts(params.payload.eteMinutes);
  const captain = [params.payload.firstName?.trim(), params.payload.lastName?.trim()]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const search = new URLSearchParams({
    airline: "PWG",
    fltnum: params.payload.flightNumber,
    type: params.type,
    orig: normalizeUpper(params.origin),
    dest: normalizeUpper(params.destination),
    route: params.payload.routeText,
    callsign: params.payload.callsign,
    units: "KGS",
    navlog: "1",
    maps: "detail",
    notams: "1",
    firnot: "1",
    static_id: params.staticId,
    outputpage: params.outputpage,
    timestamp: String(params.timestamp),
    apicode: params.apicode,
    find_sidstar: "1",
  });

  if (date) {
    search.set("date", date);
  }

  if (departureParts) {
    search.set("deph", departureParts.hour);
    search.set("depm", departureParts.minute);
  }

  if (ete.hours && ete.minutes) {
    search.set("steh", ete.hours);
    search.set("stem", ete.minutes);
  }

  if (params.payload.alternate) {
    search.set("altn", normalizeUpper(params.payload.alternate));
  }

  if (params.payload.aircraftTailNumber) {
    search.set("reg", params.payload.aircraftTailNumber.toUpperCase());
  }

  if (params.payload.pax > 0) {
    search.set("pax", String(params.payload.pax));
  }

  if (params.payload.cargoKg > 0) {
    search.set("cargo", String(params.payload.cargoKg));
  }

  if (captain) {
    search.set("cpt", captain);
  }

  if (params.payload.simbriefUsername) {
    search.set("username", params.payload.simbriefUsername);
  }

  if (params.payload.remarks) {
    search.set("manualrmk", params.payload.remarks);
  }

  return `https://www.simbrief.com/ofp/ofp.loader.api.php?${search.toString()}`;
}

export function buildSimbriefEditUrl(staticId: string) {
  return `https://www.simbrief.com/system/dispatch.php?editflight=last&static_id=${encodeURIComponent(
    staticId
  )}`;
}

export function buildSimbriefFetchUrl(username: string, staticId?: string | null) {
  const search = new URLSearchParams({
    username,
    json: "1",
  });

  if (staticId) {
    search.set("static_id", staticId);
  }

  return `https://www.simbrief.com/api/xml.fetcher.php?${search.toString()}`;
}

export function extractSimbriefOfpSummary(
  raw: unknown,
  staticId?: string | null
): SimbriefOfpSummary {
  const unitsRaw = firstDefined(raw, [
    "params.units",
    "general.units",
    "options.units",
  ]);

  const units = typeof unitsRaw === "string" ? unitsRaw.trim().toUpperCase() : null;

  const summary: SimbriefOfpSummary = {
    source: "real",
    matchedByStaticId: false,
    staticId: null,
    flightNumber: null,
    origin: null,
    destination: null,
    alternate: null,
    airframe: null,
    aircraftRegistration: null,
    routeText: null,
    cruiseAltitude: null,
    distanceNm: null,
    eteMinutes: null,
    etaIso: null,
    pax: null,
    payloadKg: null,
    cargoKg: null,
    tripFuelKg: null,
    reserveFuelKg: null,
    taxiFuelKg: null,
    blockFuelKg: null,
    zfwKg: null,
    towKg: null,
    lwKg: null,
    mzfwKg: null,
    mtowKg: null,
    mlwKg: null,
    generatedAtIso: null,
    pdfUrl: null,
    rawUnits: units,
  };

  const remoteStaticId = firstDefined(raw, [
    "params.static_id",
    "general.static_id",
    "api.static_id",
  ]);

  summary.staticId = typeof remoteStaticId === "string" ? remoteStaticId : staticId ?? null;
  summary.matchedByStaticId = Boolean(
    staticId && typeof summary.staticId === "string" && summary.staticId === staticId
  );

  const flightNumber = firstDefined(raw, [
    "general.flight_number",
    "general.fltnum",
    "params.fltnum",
    "params.flightnum",
    "api.fltnum",
  ]);
  const origin = firstDefined(raw, [
    "origin.icao_code",
    "origin.icao",
    "params.orig",
    "general.orig_icao",
    "general.orig",
  ]);
  const destination = firstDefined(raw, [
    "destination.icao_code",
    "destination.icao",
    "params.dest",
    "general.dest_icao",
    "general.dest",
  ]);
  const alternate = firstDefined(raw, [
    "alternate.icao_code",
    "alternate.icao",
    "params.altn",
    "general.altn",
  ]);
  const airframe = firstDefined(raw, [
    "aircraft.icao_code",
    "aircraft.icao",
    "aircraft.type",
    "params.type",
    "general.aircraft_icao",
  ]);
  const aircraftRegistration = firstDefined(raw, [
    "aircraft.reg",
    "aircraft.registration",
    "params.reg",
    "general.aircraft_registration",
  ]);
  const routeText = firstDefined(raw, [
    "general.route",
    "atc.route",
    "params.route",
    "api.route",
  ]);
  const cruiseAltitude = firstDefined(raw, [
    "general.initial_altitude",
    "general.initial_alt",
    "general.cruise_altitude",
    "general.cruise_alt",
    "general.crzalt",
    "general.stepclimb_string",
    "atc.initial_altitude",
    "atc.cruise_altitude",
    "params.initial_altitude",
    "params.cruise_altitude",
  ]);

  summary.flightNumber = typeof flightNumber === "string" ? normalizeUpper(flightNumber) : null;
  summary.origin = typeof origin === "string" ? normalizeUpper(origin) : null;
  summary.destination = typeof destination === "string" ? normalizeUpper(destination) : null;
  summary.alternate = typeof alternate === "string" ? normalizeUpper(alternate) : null;
  summary.airframe = typeof airframe === "string" ? airframe : null;
  summary.aircraftRegistration = typeof aircraftRegistration === "string" ? normalizeUpper(aircraftRegistration) : null;
  summary.routeText = typeof routeText === "string" ? routeText.trim() : null;
  summary.cruiseAltitude = formatCruiseAltitude(cruiseAltitude);

  summary.distanceNm = toInteger(
    firstDefined(raw, [
      "general.air_distance",
      "general.route_distance",
      "params.air_distance",
      "navlog.distance",
    ])
  );

  summary.eteMinutes = toMinutes(
    firstDefined(raw, [
      "times.est_time_enroute",
      "times.sched_time_enroute",
      "general.ete",
      "general.est_time_enroute",
      "params.est_time_enroute",
    ])
  );

  summary.etaIso = toIso(
    firstDefined(raw, [
      "times.est_in",
      "times.sched_in",
      "times.arrival_time",
      "times.est_arrival_time",
      "general.arrival_time",
    ])
  );

  summary.generatedAtIso = toIso(
    firstDefined(raw, [
      "times.generated",
      "times.generated_time",
      "general.generated_time",
      "params.generated_time",
    ])
  );

  summary.pdfUrl =
    (firstDefined(raw, ["files.pdf.link", "files.pdf", "links.pdf"]) as string | null) ?? null;

  summary.pax = toInteger(
    firstDefined(raw, [
      "weights.pax_count_actual",
      "weights.pax_count",
      "params.pax",
      "general.pax_count",
    ])
  );

  summary.payloadKg = toKg(
    firstDefined(raw, [
      "weights.payload",
      "weights.payload_weight",
      "weights.payload_kg",
      "general.payload",
    ]),
    units
  );

  summary.cargoKg = toKg(
    firstDefined(raw, [
      "weights.cargo",
      "weights.cargo_weight",
      "weights.cargo_kg",
      "params.cargo",
    ]),
    units
  );

  summary.tripFuelKg = toKg(
    firstDefined(raw, ["fuel.tripburn", "fuel.trip", "fuel.trip_kg"]),
    units
  );
  summary.reserveFuelKg = toKg(
    firstDefined(raw, ["fuel.reserve", "fuel.reserve_kg", "fuel.resv"]),
    units
  );
  summary.taxiFuelKg = toKg(
    firstDefined(raw, ["fuel.taxi", "fuel.taxi_kg", "fuel.taxiout"]),
    units
  );
  summary.blockFuelKg = toKg(
    firstDefined(raw, [
      "fuel.block",
      "fuel.block_kg",
      "fuel.block_fuel",
      "fuel.ramp",
      "fuel.ramp_kg",
      "fuel.plan_ramp",
      "fuel.plan_ramp_kg",
      "fuel.ramp_fuel",
      "fuel.plan_takeoff",
      "fuel.plan_takeoff_kg",
      "fuel.dispatch",
      "fuel.dispatch_kg",
      "fuel.totfuel",
      "fuel.total",
    ]),
    units
  );

  summary.zfwKg = toKg(
    firstDefined(raw, ["weights.est_zfw", "weights.zfw", "weights.zfw_kg"]),
    units
  );
  summary.towKg = toKg(
    firstDefined(raw, ["weights.est_tow", "weights.tow", "weights.tow_kg"]),
    units
  );
  summary.lwKg = toKg(
    firstDefined(raw, ["weights.est_ldw", "weights.lw", "weights.ldw", "weights.lw_kg"]),
    units
  );
  summary.mzfwKg = toKg(
    firstDefined(raw, ["weights.max_zfw", "weights.mzfw", "aircraft.mzfw"]),
    units
  );
  summary.mtowKg = toKg(
    firstDefined(raw, ["weights.max_tow", "weights.mtow", "aircraft.mtow"]),
    units
  );
  summary.mlwKg = toKg(
    firstDefined(raw, ["weights.max_ldw", "weights.max_lw", "weights.mlw", "aircraft.mlw"]),
    units
  );

  return summary;
}
