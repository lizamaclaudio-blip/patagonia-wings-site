export type PirepPerfectCapabilityInput = {
  name: string;
  supported: boolean;
  source: string;
  reliability: string;
  penaltyEligible: boolean;
  reason: string;
  value: string;
};

export type PirepPerfectOfficialInput = {
  hasRawXml: boolean;
  schemaVersion: string;
  warnings: string[];
  identity: {
    flightNumber: string;
    originIcao: string;
    destinationIcao: string;
    takeoffAirport: string;
    landingAirport: string;
    aircraftTypeCode: string;
    aircraftDisplayName: string;
    aircraftRegistration: string;
    addonProvider: string;
    simulator: string;
  };
  evidence: {
    isPirepPerfect: boolean;
    isEvidentiary: boolean;
    hasTakeoff: boolean;
    hasAirborne: boolean;
    hasLanding: boolean;
    hasTaxiInOrGate: boolean;
    hasShutdownOrStop: boolean;
    hasUnsupportedProtectedMetrics: boolean;
    reachedPhaseCount: number;
    totalPhaseCount: number;
    blockMinutes: number;
    distanceNm: number;
    fuelStartKg: number;
    fuelEndKg: number;
    fuelUsedKg: number;
    maxIas: number;
    maxAltitudeFt: number;
    landingVsFpm: number;
    landingGForce: number;
    overspeedEvents: number;
    stallEvents: number;
    picFalseCount: number;
  };
  detailedPoints: {
    dispatch_points: number;
    preparation_points: number;
    taxi_out_points: number;
    takeoff_climb_points: number;
    cruise_points: number;
    approach_points: number;
    landing_points: number;
    taxi_in_shutdown_points: number;
    penalty_points: number;
    duration_factor: number;
    mission_factor: number;
    mission_score: number;
    legado_credits: number;
    critical_cap: number | null;
    valid_for_progression: boolean;
  };
  capabilities: PirepPerfectCapabilityInput[];
  unsupportedProtectedMetrics: PirepPerfectCapabilityInput[];
  phaseSummary: Array<Record<string, unknown>>;
  eventTimeline: Array<Record<string, unknown>>;
  eventsJson: Array<Record<string, unknown>>;
  penaltiesJson: Array<Record<string, unknown>>;
  scoreAdjustments: {
    procedureDelta: number;
    missionDelta: number;
    safetyDelta: number;
    efficiencyDelta: number;
  };
};

type GenericRow = Record<string, unknown>;

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value).trim();
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = asText(value).replace(",", ".");
  if (!text) return 0;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asBoolean(value: unknown): boolean {
  const text = asText(value).toLowerCase();
  return value === true || ["true", "1", "yes", "si", "sí", "on"].includes(text);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeIcao(value: unknown): string {
  return asText(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function xmlText(xml: string, tag: string): string {
  if (!xml) return "";
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(re);
  return match ? decodeXml(stripTags(match[1])) : "";
}

function xmlNumber(xml: string, tag: string): number {
  return asNumber(xmlText(xml, tag));
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const number = asNumber(value);
    if (number !== 0) return number;
  }
  return 0;
}

function sectionXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, "i"));
  return match ? match[0] : "";
}

function parseAttrs(openTag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z0-9_:-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(openTag))) {
    attrs[match[1]] = decodeXml(match[2]);
  }
  return attrs;
}

function parseCapabilities(xml: string): PirepPerfectCapabilityInput[] {
  const section = sectionXml(xml, "Capabilities");
  if (!section) return [];
  const metrics: PirepPerfectCapabilityInput[] = [];
  const re = /<Metric\b([^>]*)>([\s\S]*?)<\/Metric>|<Metric\b([^>]*?)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(section))) {
    const attrText = match[1] ?? match[3] ?? "";
    const attrs = parseAttrs(attrText);
    const name = attrs.name || attrs.code || "Metric";
    const supported = asBoolean(attrs.supported);
    const penaltyEligible = asBoolean(attrs.penaltyEligible);
    metrics.push({
      name,
      supported,
      source: attrs.source || "unknown",
      reliability: attrs.reliability || (supported ? "confirmed" : "unsupported"),
      penaltyEligible,
      reason: attrs.reason || (supported ? "profile" : "unsupported_or_unconfirmed"),
      value: decodeXml(stripTags(match[2] ?? "")),
    });
  }
  return metrics;
}

function phaseNameMatches(name: string, tokens: string[]): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return tokens.some((token) => normalized.includes(token));
}

function parsePhases(xml: string): Array<Record<string, unknown>> {
  const section = sectionXml(xml, "FlightPhaseSummary");
  if (!section) return [];
  const phases: Array<Record<string, unknown>> = [];
  const re = /<Phase\b([^>]*)>([\s\S]*?)<\/Phase>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(section))) {
    const attrs = parseAttrs(match[1] ?? "");
    const body = match[2] ?? "";
    const samples = xmlNumber(body, "Samples");
    phases.push({
      name: attrs.name || "UNKNOWN",
      samples,
      startUtc: xmlText(body, "StartUtc"),
      endUtc: xmlText(body, "EndUtc"),
      duration: xmlText(body, "Duration"),
      maxIas: firstNumber(xmlNumber(body, "MaxIAS"), xmlNumber(body, "MaxIas")),
      maxGs: xmlNumber(body, "MaxGS"),
      maxAltitude: firstNumber(xmlNumber(body, "MaxAltitude"), xmlNumber(body, "MaxAltitudeFt")),
      minAgl: xmlNumber(body, "MinAGL"),
      maxVs: xmlNumber(body, "MaxVS"),
      minVs: xmlNumber(body, "MinVS"),
      maxBank: xmlNumber(body, "MaxBank"),
      maxG: xmlNumber(body, "MaxG"),
      minG: xmlNumber(body, "MinG"),
      fuelStartKg: xmlNumber(body, "FuelStartKg"),
      fuelEndKg: xmlNumber(body, "FuelEndKg"),
      distanceNm: xmlNumber(body, "DistanceNm"),
    });
  }
  return phases;
}

function parseEvents(xml: string): Array<Record<string, unknown>> {
  const section = sectionXml(xml, "EventTimeline");
  const events: Array<Record<string, unknown>> = [];
  if (section) {
    const re = /<Event\b([^>]*)>([\s\S]*?)<\/Event>|<Event\b([^>]*?)\/>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(section))) {
      const attrs = parseAttrs(match[1] ?? match[3] ?? "");
      const body = match[2] ?? "";
      const code = firstText(attrs.code, attrs.name, "EVENT").toUpperCase();
      events.push({
        code,
        phase: firstText(attrs.phase, "UNKNOWN"),
        source: firstText(attrs.source, "xml_event_timeline"),
        reliability: firstText(attrs.reliability, "unknown"),
        penaltyEligible: asBoolean(attrs.penaltyEligible),
        timeUtc: firstText(attrs.timeUtc, attrs.time, xmlText(body, "TimeUtc")),
        description: firstText(xmlText(body, "Description"), code.replace(/_/g, " ")),
        altitude: xmlNumber(body, "Altitude"),
        agl: xmlNumber(body, "AGL"),
        ias: xmlNumber(body, "IAS"),
        gs: xmlNumber(body, "GS"),
        vs: xmlNumber(body, "VS"),
        fuelKg: xmlNumber(body, "FuelKg"),
      });
    }
    return events;
  }

  const vuelo = sectionXml(xml, "Vuelo");
  const logRe = /<Log\b[^>]*>([\s\S]*?)<\/Log>/gi;
  let logMatch: RegExpExecArray | null;
  const known = ["PARKING BRAKE ON", "PARKING BRAKE OFF", "TAKE OFF", "TAKEOFF", "AIRBORNE", "AERO", "ON RWY", "TOUCHDOWN", "LANDING", "STOP"];
  while ((logMatch = logRe.exec(vuelo))) {
    const line = decodeXml(stripTags(logMatch[1] ?? ""));
    const upper = line.toUpperCase();
    const token = known.find((item) => upper.includes(item));
    if (!token) continue;
    events.push({
      code: token.replace(/\s+/g, "_"),
      phase: upper.includes("TAKE") || upper.includes("AERO") ? "TAKEOFF" : upper.includes("LAND") || upper.includes("TOUCH") ? "LANDING" : "GENERAL",
      source: "legacy_xml_log",
      reliability: "parsed_from_log",
      penaltyEligible: true,
      timeUtc: line.slice(0, 8),
      description: line,
    });
  }
  return events;
}

function durationToMinutes(value: string): number {
  const text = asText(value);
  if (!text) return 0;
  const parts = text.split(":").map((part) => Number(part));
  if (parts.length === 3 && parts.every(Number.isFinite)) return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
  if (parts.length === 2 && parts.every(Number.isFinite)) return Math.round(parts[0] * 60 + parts[1]);
  return asNumber(text);
}

function buildEvent(code: string, phase: string, severity: string, description: string, details: Record<string, unknown> = {}) {
  return {
    code,
    phase,
    severity,
    source: "pirep_perfect_xml_server_parser",
    description,
    details,
  };
}

export function buildPirepPerfectOfficialScoringInput(params: {
  rawXml?: string | null;
  reservation?: GenericRow | null;
  activeFlight?: GenericRow | null;
  preparedDispatch?: GenericRow | null;
  report?: GenericRow | null;
}): PirepPerfectOfficialInput {
  const rawXml = asText(params.rawXml);
  const capabilities = parseCapabilities(rawXml);
  const phases = parsePhases(rawXml);
  const eventTimeline = parseEvents(rawXml);
  const unsupportedProtectedMetrics = capabilities.filter((metric) => !metric.supported || !metric.penaltyEligible || metric.reliability.toLowerCase().includes("unsupported"));
  const unsupportedNames = new Set(unsupportedProtectedMetrics.map((metric) => metric.name.toLowerCase()));
  const eventsUpper = eventTimeline.map((event) => asText(event.code).toUpperCase());

  const phaseReached = (tokens: string[]) => phases.some((phase) => asNumber(phase.samples) > 0 && phaseNameMatches(asText(phase.name), tokens));
  const hasTakeoff = eventsUpper.some((code) => ["TAKEOFF_ROLL", "AIRBORNE", "TAKE_OFF", "TAKEOFF"].some((token) => code.includes(token))) || phaseReached(["takeoff", "climb", "cruise"]);
  const hasAirborne = eventsUpper.some((code) => code.includes("AIRBORNE")) || phaseReached(["climb", "cruise", "descent", "approach"]);
  const hasLanding = eventsUpper.some((code) => code.includes("TOUCHDOWN") || code.includes("LANDING")) || phaseReached(["landing", "taxi_in", "gate"]);
  const hasTaxiInOrGate = phaseReached(["taxi_in", "gate", "shutdown"]) || eventsUpper.some((code) => code.includes("ACARS_STOP") || code.includes("PARKING_BRAKE_ON"));
  const hasShutdownOrStop = eventsUpper.some((code) => code.includes("ACARS_STOP") || code.includes("STOP") || code.includes("SHUTDOWN")) || phaseReached(["shutdown", "gate"]);

  const distanceNm = firstNumber(
    xmlNumber(rawXml, "FlightLenght"),
    xmlNumber(rawXml, "FlightLength"),
    xmlNumber(rawXml, "DistanceNm"),
    params.report?.distance,
    params.reservation?.distance_nm
  );
  const blockMinutes = firstNumber(
    durationToMinutes(xmlText(rawXml, "BlockDuration")),
    durationToMinutes(xmlText(rawXml, "FlightDuration")),
    durationToMinutes(xmlText(rawXml, "DuracionVuelo"))
  );
  const fuelStartKg = firstNumber(xmlNumber(rawXml, "FuelStartKg"), xmlNumber(rawXml, "TakeOffFuel"), xmlNumber(rawXml, "FuelIniciado"), xmlNumber(rawXml, "FuelPlan"));
  const fuelEndKg = firstNumber(xmlNumber(rawXml, "FuelEndKg"), xmlNumber(rawXml, "FinalFuel"));
  const fuelUsedKg = firstNumber(xmlNumber(rawXml, "FuelUsedKg"), xmlNumber(rawXml, "SpentFuel"), fuelStartKg > 0 && fuelEndKg > 0 ? fuelStartKg - fuelEndKg : 0);
  const landingVsFpm = Math.abs(firstNumber(xmlNumber(rawXml, "TouchdownVS"), xmlNumber(rawXml, "TouchDownVS"), xmlNumber(rawXml, "LandingVS"), params.report?.landingVS));
  const landingGForce = Math.abs(firstNumber(xmlNumber(rawXml, "TouchdownG"), xmlNumber(rawXml, "TouchdownGForce"), xmlNumber(rawXml, "LandingG"), params.report?.landingG));
  const maxIas = firstNumber(xmlNumber(rawXml, "MaxIAS"), xmlNumber(rawXml, "MaxIas"), ...phases.map((phase) => phase.maxIas));
  const maxAltitudeFt = firstNumber(xmlNumber(rawXml, "MaxAltitude"), xmlNumber(rawXml, "MaxAltitudeFt"), ...phases.map((phase) => phase.maxAltitude));
  const overspeedEvents = eventTimeline.filter((event) => asText(event.code).toUpperCase().includes("OVERSPEED")).length;
  const stallEvents = eventTimeline.filter((event) => asText(event.code).toUpperCase().includes("STALL")).length;
  const picFalseCount = firstNumber(xmlNumber(rawXml, "PICsFailed"), xmlNumber(rawXml, "PicFalseCount"));

  const reachedPhaseCount = phases.filter((phase) => asNumber(phase.samples) > 0 || asText(phase.duration)).length;
  const totalPhaseCount = Math.max(phases.length, 8);
  const hasCoreEvidence = hasTakeoff && hasLanding && (distanceNm > 1 || blockMinutes >= 2 || reachedPhaseCount >= 4);
  const hasRawXml = rawXml.length > 0;
  const isPirepPerfect = /<FlightPhaseSummary[\s>]/i.test(rawXml) || /<EventTimeline[\s>]/i.test(rawXml) || /<Capabilities[\s>]/i.test(rawXml);

  let procedureDelta = 0;
  let missionDelta = 0;
  let safetyDelta = 0;
  let efficiencyDelta = 0;
  const penaltiesJson: Array<Record<string, unknown>> = [];
  const eventsJson: Array<Record<string, unknown>> = [];

  for (const metric of unsupportedProtectedMetrics) {
    eventsJson.push(buildEvent("METRIC_UNSUPPORTED", "capability", "info", `${metric.name} no evaluable por perfil/capability.`, metric));
  }

  if (hasRawXml && !hasTakeoff) {
    missionDelta -= 25;
    penaltiesJson.push(buildEvent("XML_NO_TAKEOFF", "takeoff", "high", "El XML no contiene evidencia suficiente de despegue."));
  }
  if (hasRawXml && hasTakeoff && !hasLanding) {
    missionDelta -= 25;
    penaltiesJson.push(buildEvent("XML_NO_LANDING", "landing", "high", "El XML no contiene evidencia suficiente de aterrizaje."));
  }
  if (hasRawXml && hasLanding && !hasTaxiInOrGate) {
    procedureDelta -= 6;
    penaltiesJson.push(buildEvent("XML_NO_TAXI_IN_GATE", "taxi_in", "medium", "El XML no confirma taxi-in/gate."));
  }
  if (landingVsFpm >= 1000) {
    safetyDelta -= 30;
    penaltiesJson.push(buildEvent("XML_LANDING_VS_CRITICAL", "landing", "critical", "Landing VS crítica en XML.", { landingVsFpm }));
  } else if (landingVsFpm >= 500) {
    safetyDelta -= 15;
    penaltiesJson.push(buildEvent("XML_LANDING_VS_HARD", "landing", "high", "Landing VS dura en XML.", { landingVsFpm }));
  } else if (landingVsFpm >= 300) {
    safetyDelta -= 8;
    penaltiesJson.push(buildEvent("XML_LANDING_VS_FIRM", "landing", "medium", "Landing VS firme en XML.", { landingVsFpm }));
  }
  if (landingGForce >= 3.5 && landingGForce < 9) {
    safetyDelta -= 25;
    penaltiesJson.push(buildEvent("XML_LANDING_G_CRITICAL", "landing", "critical", "G de touchdown crítica en XML.", { landingGForce }));
  } else if (landingGForce >= 2.5) {
    safetyDelta -= 15;
    penaltiesJson.push(buildEvent("XML_LANDING_G_HIGH", "landing", "high", "G de touchdown alta en XML.", { landingGForce }));
  } else if (landingGForce >= 1.8) {
    safetyDelta -= 8;
    penaltiesJson.push(buildEvent("XML_LANDING_G_FIRM", "landing", "medium", "G de touchdown firme en XML.", { landingGForce }));
  }
  if (overspeedEvents > 0) {
    safetyDelta -= Math.min(20, overspeedEvents * 8);
    penaltiesJson.push(buildEvent("XML_OVERSPEED", "cruise", "high", "Overspeed registrado en EventTimeline.", { overspeedEvents }));
  }
  if (stallEvents > 0) {
    safetyDelta -= Math.min(25, stallEvents * 10);
    penaltiesJson.push(buildEvent("XML_STALL", "cruise", "high", "Stall registrado en EventTimeline.", { stallEvents }));
  }
  if (picFalseCount > 0) {
    procedureDelta -= Math.min(20, picFalseCount * 5);
    penaltiesJson.push(buildEvent("XML_PIC_FALSE", "cruise", "medium", "PIC radio check fallido en XML.", { picFalseCount }));
  }

  const penaltyPoints = Math.abs(procedureDelta) + Math.abs(missionDelta) + Math.abs(safetyDelta) + Math.abs(efficiencyDelta);
  const dispatchPoints = hasRawXml ? 10 : 0;
  const preparationPoints = capabilities.length ? 10 : 6;
  const taxiOutPoints = hasTakeoff ? 10 : 0;
  const takeoffClimbPoints = hasTakeoff && hasAirborne ? 15 : hasTakeoff ? 8 : 0;
  const cruisePoints = phaseReached(["cruise"]) || distanceNm > 30 ? 10 : Math.min(10, Math.round(distanceNm / 3));
  const approachPoints = phaseReached(["approach", "descent"]) || hasLanding ? 10 : 0;
  const landingPoints = hasLanding ? clamp(15 - (landingVsFpm >= 500 ? 6 : landingVsFpm >= 300 ? 3 : 0) - (landingGForce >= 2.5 ? 4 : 0), 0, 15) : 0;
  const taxiInShutdownPoints = hasTaxiInOrGate || hasShutdownOrStop ? 10 : 0;
  const procedureFromDetailed = clamp(dispatchPoints + preparationPoints + taxiOutPoints + takeoffClimbPoints + cruisePoints + approachPoints + landingPoints + taxiInShutdownPoints - penaltyPoints, 0, 100);
  const missionScore = hasCoreEvidence ? clamp(70 + Math.min(20, reachedPhaseCount * 2) + (hasTaxiInOrGate ? 10 : 0) - Math.abs(missionDelta), 0, 100) : 0;
  const legadoCredits = hasCoreEvidence ? Math.max(1, Math.round(blockMinutes / 60)) : 0;

  const identity = {
    flightNumber: firstText(xmlText(rawXml, "NroVuelo"), params.report?.flightNumber, params.activeFlight?.flightNumber, params.reservation?.route_code),
    originIcao: normalizeIcao(firstText(xmlText(rawXml, "Origen"), params.preparedDispatch?.departureIcao, params.activeFlight?.departureIcao, params.reservation?.origin_ident)),
    destinationIcao: normalizeIcao(firstText(xmlText(rawXml, "Destino"), params.preparedDispatch?.arrivalIcao, params.activeFlight?.arrivalIcao, params.reservation?.destination_ident)),
    takeoffAirport: normalizeIcao(firstText(xmlText(rawXml, "TakeoffAirport"), xmlText(rawXml, "AeropuertoSalida"), xmlText(rawXml, "Origen"), params.reservation?.origin_ident)),
    landingAirport: normalizeIcao(firstText(xmlText(rawXml, "LandingAirport"), xmlText(rawXml, "AeropuertoLlegada"), xmlText(rawXml, "Destino"), params.reservation?.destination_ident)),
    aircraftTypeCode: firstText(xmlText(rawXml, "Avion"), xmlText(rawXml, "SimAvionTipo"), params.reservation?.aircraft_type_code, params.activeFlight?.aircraftTypeCode),
    aircraftDisplayName: firstText(xmlText(rawXml, "ModeloCertificado"), xmlText(rawXml, "SimAvionRaw"), params.activeFlight?.aircraftDisplayName, params.preparedDispatch?.aircraftDisplayName),
    aircraftRegistration: firstText(xmlText(rawXml, "Registracion"), xmlText(rawXml, "Matricula"), params.preparedDispatch?.aircraftRegistration, params.reservation?.aircraft_registration),
    addonProvider: firstText(xmlText(rawXml, "SimAvionAuthor"), xmlText(rawXml, "AddonProvider"), params.activeFlight?.addonProvider, params.preparedDispatch?.addonProvider),
    simulator: firstText(xmlText(rawXml, "Simulator"), xmlText(rawXml, "Simulador")),
  };

  return {
    hasRawXml,
    schemaVersion: firstText(xmlText(rawXml, "SchemaVersion"), xmlText(rawXml, "AcarsVersion"), isPirepPerfect ? "pirep-perfect-a2" : "legacy"),
    warnings: [
      hasRawXml ? null : "missing_raw_pirep_xml",
      hasRawXml && !isPirepPerfect ? "legacy_xml_without_pirep_perfect_sections" : null,
      unsupportedNames.size ? "unsupported_metrics_protected_from_penalty" : null,
    ].filter(Boolean) as string[],
    identity,
    evidence: {
      isPirepPerfect,
      isEvidentiary: hasCoreEvidence,
      hasTakeoff,
      hasAirborne,
      hasLanding,
      hasTaxiInOrGate,
      hasShutdownOrStop,
      hasUnsupportedProtectedMetrics: unsupportedProtectedMetrics.length > 0,
      reachedPhaseCount,
      totalPhaseCount,
      blockMinutes,
      distanceNm,
      fuelStartKg,
      fuelEndKg,
      fuelUsedKg,
      maxIas,
      maxAltitudeFt,
      landingVsFpm,
      landingGForce,
      overspeedEvents,
      stallEvents,
      picFalseCount,
    },
    detailedPoints: {
      dispatch_points: dispatchPoints,
      preparation_points: preparationPoints,
      taxi_out_points: taxiOutPoints,
      takeoff_climb_points: takeoffClimbPoints,
      cruise_points: cruisePoints,
      approach_points: approachPoints,
      landing_points: landingPoints,
      taxi_in_shutdown_points: taxiInShutdownPoints,
      penalty_points: penaltyPoints,
      duration_factor: blockMinutes > 0 ? Math.min(1, Number((blockMinutes / 90).toFixed(2))) : 0,
      mission_factor: hasCoreEvidence ? 1 : 0,
      mission_score: missionScore,
      legado_credits: legadoCredits,
      critical_cap: null,
      valid_for_progression: hasCoreEvidence,
    },
    capabilities,
    unsupportedProtectedMetrics,
    phaseSummary: phases,
    eventTimeline,
    eventsJson,
    penaltiesJson,
    scoreAdjustments: { procedureDelta, missionDelta, safetyDelta, efficiencyDelta },
  };
}
