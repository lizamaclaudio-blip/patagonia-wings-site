export type PirepPerfectCapability = {
  name: string;
  supported: boolean;
  source: string;
  reliability: string;
  penaltyEligible: boolean;
  reason: string;
  value?: string;
};

export type PirepPerfectPhase = {
  name: string;
  samples: number;
  startUtc: string;
  endUtc: string;
  duration: string;
  maxIas: number;
  maxGs: number;
  maxAltitude: number;
  maxAltitudeMslFt: number;
  maxAglFt: number;
  minAgl: number;
  maxVs: number;
  minVs: number;
  maxBank: number;
  maxG: number;
  minG: number;
  fuelStartKg: number;
  fuelEndKg: number;
  distanceNm: number;
  phaseExpectedActions?: string;
  phaseMeasuredMetrics?: string;
  phaseScoringHints?: string;
  phaseReviewQuestion?: string;
  phaseReviewVersion?: string;
};

export type PirepPerfectEvent = {
  code: string;
  title: string;
  description: string;
  phase: string;
  timeUtc: string;
  source: string;
  reliability: string;
  penaltyEligible: boolean;
  severity: string;
  altitude?: number;
  agl?: number;
  ias?: number;
  gs?: number;
  vs?: number;
  fuelKg?: number;
};

export type PirepPerfectAltitudeEvidence = {
  schema: string;
  transitionAltitudeFt: number;
  sampleCount: number;
  maxAltitudeMslFt: number;
  maxAglFt: number;
  minAglFt: number;
  maxPressureAltitudeFt: number;
  firstAltitudeMslFt: number;
  firstAltitudeAglFt: number;
  lastAltitudeMslFt: number;
  lastAltitudeAglFt: number;
  lastFlightLevel: string;
  lastDisplayMode: string;
  lastDisplayText: string;
  altitudeSource: string;
  isReliable: boolean;
};

export type PirepPerfectPhaseAcceptance = {
  phase: string;
  name: string;
  status: string;
  samples: number;
  maxAltitudeMslFt: number;
  maxAglFt: number;
  maxGs: number;
  minVs: number;
  maxVs: number;
  flags: string;
  reviewQuestion: string;
};

export type PirepPerfectSummary = {
  hasRawXml: boolean;
  hasAnyEvidence: boolean;
  rawXmlLength: number;
  schemaVersion: string;
  flightNumber: string;
  originIdent: string;
  destinationIdent: string;
  alternateIdent: string;
  aircraftCode: string;
  aircraftDisplayName: string;
  aircraftRegistration: string;
  addonProvider: string;
  simulator: string;
  simAircraftRaw: string;
  flightType: string;
  routeText: string;
  flightLevel: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  pax: number;
  cargoKg: number;
  fuelPlanKg: number;
  blockDuration: string;
  flightDuration: string;
  distanceNm: number;
  maxIas: number;
  cruiseAltitude: number;
  maxAltitudeMslFt: number;
  maxAglFt: number;
  altitudeEvidence: PirepPerfectAltitudeEvidence;
  fuelStartKg: number;
  fuelEndKg: number;
  fuelUsedKg: number;
  fuelPerHour: number;
  fuelPer100Nm: number;
  landingVs: number;
  touchdownVs: number;
  touchdownG: number;
  maxGForce: number;
  minGForce: number;
  overspeedSeconds: number;
  stallSeconds: number;
  pauseSeconds: number;
  picFalseCount: number;
  picTotalCount: number;
  takeoffAirport: string;
  landingAirport: string;
  departureWind: string;
  arrivalWind: string;
  departureRunway: string;
  arrivalRunway: string;
  transponder: string;
  transponderState: string;
  parkingBrake: string;
  batteryMaster: string;
  avionicsMaster: string;
  doorOpen: string;
  fuelCurrentKg: number;
  fuelCapacityKg: number;
  capabilities: PirepPerfectCapability[];
  phases: PirepPerfectPhase[];
  eventTimeline: PirepPerfectEvent[];
  unsupportedEvents: PirepPerfectEvent[];
  phaseAuditReport: Record<string, string | number | boolean>;
  phasePrevalidationPackage: Record<string, string | number | boolean>;
  phaseAcceptanceMatrix: PirepPerfectPhaseAcceptance[];
  phaseTestRunManifest: Record<string, string | number | boolean>;
  landingMetrics: Record<string, string | number | boolean>;
  notes: string[];
};

const EMPTY_SUMMARY: PirepPerfectSummary = {
  hasRawXml: false,
  hasAnyEvidence: false,
  rawXmlLength: 0,
  schemaVersion: "",
  flightNumber: "",
  originIdent: "",
  destinationIdent: "",
  alternateIdent: "",
  aircraftCode: "",
  aircraftDisplayName: "",
  aircraftRegistration: "",
  addonProvider: "",
  simulator: "",
  simAircraftRaw: "",
  flightType: "",
  routeText: "",
  flightLevel: "",
  scheduledDeparture: "",
  scheduledArrival: "",
  pax: 0,
  cargoKg: 0,
  fuelPlanKg: 0,
  blockDuration: "",
  flightDuration: "",
  distanceNm: 0,
  maxIas: 0,
  cruiseAltitude: 0,
  maxAltitudeMslFt: 0,
  maxAglFt: 0,
  altitudeEvidence: {
    schema: "",
    transitionAltitudeFt: 10000,
    sampleCount: 0,
    maxAltitudeMslFt: 0,
    maxAglFt: 0,
    minAglFt: 0,
    maxPressureAltitudeFt: 0,
    firstAltitudeMslFt: 0,
    firstAltitudeAglFt: 0,
    lastAltitudeMslFt: 0,
    lastAltitudeAglFt: 0,
    lastFlightLevel: "",
    lastDisplayMode: "",
    lastDisplayText: "",
    altitudeSource: "",
    isReliable: false,
  },
  fuelStartKg: 0,
  fuelEndKg: 0,
  fuelUsedKg: 0,
  fuelPerHour: 0,
  fuelPer100Nm: 0,
  landingVs: 0,
  touchdownVs: 0,
  touchdownG: 0,
  maxGForce: 0,
  minGForce: 0,
  overspeedSeconds: 0,
  stallSeconds: 0,
  pauseSeconds: 0,
  picFalseCount: 0,
  picTotalCount: 0,
  takeoffAirport: "",
  landingAirport: "",
  departureWind: "",
  arrivalWind: "",
  departureRunway: "",
  arrivalRunway: "",
  transponder: "",
  transponderState: "",
  parkingBrake: "",
  batteryMaster: "",
  avionicsMaster: "",
  doorOpen: "",
  fuelCurrentKg: 0,
  fuelCapacityKg: 0,
  capabilities: [],
  phases: [],
  eventTimeline: [],
  unsupportedEvents: [],
  phaseAuditReport: {},
  phasePrevalidationPackage: {},
  phaseAcceptanceMatrix: [],
  phaseTestRunManifest: {},
  landingMetrics: {},
  notes: [],
};

type GenericRow = Record<string, unknown>;

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(",", ".").replace(/[^0-9.+-]/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asBoolean(value: unknown): boolean {
  const normalized = asText(value).toLowerCase();
  return value === true || normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "si";
}

function asObject(value: unknown): GenericRow {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as GenericRow) : {};
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

function pickRawXml(scorePayload: GenericRow): string {
  const officialPirep = asObject(scorePayload.official_pirep);
  const rawFinalizePayload = asObject(scorePayload.raw_finalize_payload);
  const rawFinalizeCloseout = asObject(rawFinalizePayload.closeoutPayload);
  return firstText(
    scorePayload.raw_pirep_xml,
    scorePayload.pirep_xml_content,
    scorePayload.pirepXmlContent,
    scorePayload.evaluated_pirep_xml,
    officialPirep.raw_pirep_xml,
    rawFinalizeCloseout.raw_pirep_xml,
    rawFinalizeCloseout.pirepXmlContent
  );
}

function parseXml(rawXml: string): XMLDocument | null {
  if (!rawXml || typeof DOMParser === "undefined") return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawXml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;
  return doc;
}

function childrenByLocalName(root: ParentNode | null | undefined, name: string): Element[] {
  if (!root) return [];
  return Array.from(root.childNodes).filter((node): node is Element => {
    return node.nodeType === 1 && (node as Element).localName.toLowerCase() === name.toLowerCase();
  });
}

function descendantsByLocalName(root: ParentNode | null | undefined, name: string): Element[] {
  if (!root) return [];
  return Array.from((root as Element | Document).getElementsByTagName("*")).filter((node) => node.localName.toLowerCase() === name.toLowerCase());
}

function firstChild(root: ParentNode | null | undefined, name: string): Element | null {
  return childrenByLocalName(root, name)[0] ?? null;
}

function firstDescendant(root: ParentNode | null | undefined, name: string): Element | null {
  return descendantsByLocalName(root, name)[0] ?? null;
}

function textDirect(root: ParentNode | null | undefined, tag: string): string {
  const node = firstChild(root, tag);
  return node?.textContent?.trim() ?? "";
}

function textDeep(root: ParentNode | null | undefined, tag: string): string {
  const node = firstDescendant(root, tag);
  return node?.textContent?.trim() ?? "";
}

function numberDirect(root: ParentNode | null | undefined, tag: string): number {
  return asNumber(textDirect(root, tag));
}

function numberDeep(root: ParentNode | null | undefined, tag: string): number {
  return asNumber(textDeep(root, tag));
}

function attr(element: Element | null | undefined, name: string): string {
  if (!element) return "";
  return element.getAttribute(name) ?? "";
}

function normalizeStatusValue(value: string): string {
  const text = value.trim();
  if (!text) return "N/D";
  const lowered = text.toLowerCase();
  if (["true", "1", "on", "yes", "si"].includes(lowered)) return "Sí";
  if (["false", "0", "off", "no"].includes(lowered)) return "No";
  return text;
}

function labelEvent(code: string): string {
  const labels: Record<string, string> = {
    ACARS_START: "Inicio de registro ACARS",
    ACARS_STOP: "Registro congelado para cierre manual",
    AIRCRAFT_PROFILE: "Perfil de aeronave detectado",
    XPDR_UNSUPPORTED: "XPDR no soportado / no confiable",
    DOORS_UNSUPPORTED: "Puertas no soportadas / no confiables",
    GEAR_UNSUPPORTED: "Tren no evaluable por perfil",
    PARKING_BRAKE_ON: "Freno de estacionamiento ON",
    PARKING_BRAKE_OFF: "Freno de estacionamiento OFF",
    TAKEOFF_ROLL: "Carrera de despegue",
    AIRBORNE: "Avión en el aire",
    TOUCHDOWN: "Touchdown detectado",
    APPROACH_GATE_1500_AGL: "Ingreso a aproximación bajo 1500 ft AGL",
    XPDR_CHANGED: "Cambio XPDR",
    COM1_CHANGED: "Cambio COM1",
    COM2_CHANGED: "Cambio COM2",
  };
  return labels[code] ?? code.replace(/_/g, " ");
}

function parseCapabilities(doc: XMLDocument): PirepPerfectCapability[] {
  const root = firstDescendant(doc, "Capabilities");
  if (!root) return [];
  return childrenByLocalName(root, "Metric").map((metric) => {
    const supported = asBoolean(attr(metric, "supported"));
    const penaltyEligible = asBoolean(attr(metric, "penaltyEligible"));
    return {
      name: attr(metric, "name") || "Metric",
      supported,
      source: attr(metric, "source") || "unknown",
      reliability: attr(metric, "reliability") || (supported ? "confirmed_or_profile_enabled" : "unsupported"),
      penaltyEligible,
      reason: attr(metric, "reason") || (supported ? "profile" : "unsupported"),
      value: metric.textContent?.trim() || undefined,
    };
  });
}

function parsePhases(doc: XMLDocument): PirepPerfectPhase[] {
  const root = firstDescendant(doc, "FlightPhaseSummary");
  if (!root) return [];
  return childrenByLocalName(root, "Phase").map((phase) => ({
    name: attr(phase, "name") || "UNKNOWN",
    samples: numberDirect(phase, "Samples"),
    startUtc: textDirect(phase, "StartUtc"),
    endUtc: textDirect(phase, "EndUtc"),
    duration: textDirect(phase, "Duration"),
    maxIas: numberDirect(phase, "MaxIAS"),
    maxGs: numberDirect(phase, "MaxGS"),
    maxAltitude: firstNumber(numberDirect(phase, "MaxAltitudeMslFt"), numberDirect(phase, "MaxAltitude")),
    maxAltitudeMslFt: firstNumber(numberDirect(phase, "MaxAltitudeMslFt"), numberDirect(phase, "MaxAltitude")),
    maxAglFt: firstNumber(numberDirect(phase, "MaxAglFt"), numberDirect(phase, "MaxAGL")),
    minAgl: firstNumber(numberDirect(phase, "MinAGL"), numberDirect(phase, "MinAglFt")),
    maxVs: numberDirect(phase, "MaxVS"),
    minVs: numberDirect(phase, "MinVS"),
    maxBank: numberDirect(phase, "MaxBank"),
    maxG: numberDirect(phase, "MaxG"),
    minG: numberDirect(phase, "MinG"),
    fuelStartKg: numberDirect(phase, "FuelStartKg"),
    fuelEndKg: numberDirect(phase, "FuelEndKg"),
    distanceNm: numberDirect(phase, "DistanceNm"),
  })).filter((phase) => phase.samples > 0 || phase.duration || phase.name);
}

function parseEventTimeline(doc: XMLDocument): PirepPerfectEvent[] {
  const root = firstDescendant(doc, "EventTimeline");
  if (!root) return parseLegacyLogEvents(doc);
  return childrenByLocalName(root, "Event").map((event) => {
    const code = attr(event, "code") || "EVENT";
    const penaltyEligible = asBoolean(attr(event, "penaltyEligible"));
    const reliability = attr(event, "reliability") || "unknown";
    return {
      code,
      title: labelEvent(code),
      description: textDirect(event, "Description") || labelEvent(code),
      phase: attr(event, "phase") || "UNKNOWN",
      timeUtc: attr(event, "timeUtc"),
      source: attr(event, "source") || "unknown",
      reliability,
      penaltyEligible,
      severity: penaltyEligible ? "evaluable" : "N/D sin penalización",
      altitude: firstNumber(numberDirect(event, "AltitudeMslFt"), numberDirect(event, "Altitude")),
      agl: firstNumber(numberDirect(event, "AltitudeAglFt"), numberDirect(event, "AGL")),
      ias: numberDirect(event, "IAS"),
      gs: numberDirect(event, "GS"),
      vs: numberDirect(event, "VS"),
      fuelKg: numberDirect(event, "FuelKg"),
      operationalPhaseCode: textDirect(event, "OperationalPhaseCode"),
      operationalPhaseName: textDirect(event, "OperationalPhaseName"),
      phaseAuditStatus: textDirect(event, "PhaseAuditStatus"),
      phaseAuditFlags: textDirect(event, "PhaseAuditFlags"),
      phasePrevalidationStatus: textDirect(event, "PhasePrevalidationStatus"),
    };
  });
}

function parseLegacyLogEvents(doc: XMLDocument): PirepPerfectEvent[] {
  const vuelo = firstDescendant(doc, "Vuelo");
  const logs = childrenByLocalName(vuelo, "Log").map((log) => log.textContent?.trim() ?? "").filter(Boolean);
  const known = [
    "START", "STOP", "PARKING BRAKE ON", "PARKING BRAKE OFF", "MODE CHARLIE", "DOORS OPEN", "DOORS CLOSED",
    "TAKE OFF", "TAKEOFF", "AERO", "PISTA", "ON RWY", "LANDING", "TOUCHDOWN", "LIGHTS NAV ON", "LIGHTS BCN ON",
    "LIGHTS STR ON", "LIGHTS TAXI ON", "LIGHTS LAND ON", "ENGINES OFF", "ENGINES ON", "APU ON", "PITOT HEAT ON",
  ];
  const events: PirepPerfectEvent[] = [];
  for (const line of logs) {
    const code = known.find((token) => line.toUpperCase().includes(token));
    if (!code) continue;
    const time = line.slice(0, 8).trim();
    events.push({
      code: code.replace(/\s+/g, "_"),
      title: labelEvent(code.replace(/\s+/g, "_")),
      description: line,
      phase: inferPhaseFromLegacyEvent(code),
      timeUtc: time,
      source: "legacy_xml_log",
      reliability: "parsed_from_log",
      penaltyEligible: true,
      severity: "evaluable",
    });
    if (events.length >= 80) break;
  }
  return events;
}

function inferPhaseFromLegacyEvent(code: string): string {
  const upper = code.toUpperCase();
  if (upper.includes("TAKE") || upper.includes("RWY") || upper.includes("AERO")) return "TAKEOFF";
  if (upper.includes("LAND") || upper.includes("TOUCHDOWN")) return "LANDING";
  if (upper.includes("STOP")) return "GATE";
  if (upper.includes("PARKING BRAKE OFF") || upper.includes("TAXI")) return "TAXI";
  return "PREFLIGHT";
}


function parseAltitudeEvidence(doc: XMLDocument): PirepPerfectAltitudeEvidence {
  const root = firstDescendant(doc, "Altitude");
  return {
    schema: firstText(textDirect(root, "Schema"), textDirect(root, "SchemaVersion")),
    transitionAltitudeFt: firstNumber(numberDirect(root, "TransitionAltitudeFt"), 10000),
    sampleCount: numberDirect(root, "SampleCount"),
    maxAltitudeMslFt: firstNumber(numberDirect(root, "MaxAltitudeMslFt"), numberDeep(doc, "MaxAltitudeMslFt"), numberDeep(doc, "MaxAltitude")),
    maxAglFt: firstNumber(numberDirect(root, "MaxAglFt"), numberDeep(doc, "MaxAglFt")),
    minAglFt: numberDirect(root, "MinAglFt"),
    maxPressureAltitudeFt: numberDirect(root, "MaxPressureAltitudeFt"),
    firstAltitudeMslFt: numberDirect(root, "FirstAltitudeMslFt"),
    firstAltitudeAglFt: numberDirect(root, "FirstAltitudeAglFt"),
    lastAltitudeMslFt: numberDirect(root, "LastAltitudeMslFt"),
    lastAltitudeAglFt: numberDirect(root, "LastAltitudeAglFt"),
    lastFlightLevel: textDirect(root, "LastFlightLevel"),
    lastDisplayMode: textDirect(root, "LastDisplayMode"),
    lastDisplayText: textDirect(root, "LastDisplayText"),
    altitudeSource: textDirect(root, "AltitudeSource"),
    isReliable: asBoolean(textDirect(root, "IsReliable")),
  };
}

function parseSimpleSection(doc: XMLDocument, tag: string): Record<string, string | number | boolean> {
  const root = firstDescendant(doc, tag);
  if (!root) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const child of childrenByLocalName(root, "SchemaVersion")) out.schemaVersion = child.textContent?.trim() ?? "";
  const known = [
    "Schema", "SchemaVersion", "Policy", "Samples", "ObservedSequence", "Status", "GlobalStatus", "Flags",
    "TouchdownDetected", "GateDetected", "MissingRecommendedPhases", "ReadyForFullSimulatorValidation",
    "OfficialScoringAuthority", "FlightNumber", "Origin", "Destination", "AltitudeResolver", "PhaseStateMachine",
    "PhaseOperationalChecklist", "PhaseTransitionMatrix", "PhaseAuditReport", "PhasePrevalidationPackage",
    "PhaseAcceptanceMatrix", "TouchdownSamples", "GateReadySamples", "GroundAglNormalized", "AirborneAltitudeEvidence"
  ];
  for (const key of known) {
    const text = textDeep(root, key);
    if (!text) continue;
    if (["Samples", "TouchdownSamples", "GateReadySamples"].includes(key)) out[key] = asNumber(text);
    else if (["TouchdownDetected", "GateDetected", "ReadyForFullSimulatorValidation", "AltitudeResolver", "PhaseStateMachine", "PhaseOperationalChecklist", "PhaseTransitionMatrix", "PhaseAuditReport", "PhasePrevalidationPackage", "PhaseAcceptanceMatrix", "GroundAglNormalized", "AirborneAltitudeEvidence"].includes(key)) out[key] = asBoolean(text);
    else out[key] = text;
  }
  return out;
}

function parsePhaseAcceptanceMatrix(doc: XMLDocument): PirepPerfectPhaseAcceptance[] {
  const root = firstDescendant(doc, "PhaseAcceptanceMatrix");
  if (!root) return [];
  const nodes = [
    ...childrenByLocalName(root, "Phase"),
    ...childrenByLocalName(root, "AcceptancePhase"),
    ...childrenByLocalName(root, "PhaseAcceptance"),
  ];
  return nodes.map((node) => {
    const phase = firstText(attr(node, "code"), attr(node, "phase"), textDirect(node, "Code"), textDirect(node, "Phase"), attr(node, "name"));
    return {
      phase: phase || "UNKNOWN",
      name: firstText(attr(node, "name"), textDirect(node, "Name"), phase),
      status: firstText(attr(node, "status"), textDirect(node, "Status"), "NOT_OBSERVED"),
      samples: firstNumber(numberDirect(node, "Samples"), numberDirect(node, "ObservedSamples")),
      maxAltitudeMslFt: firstNumber(numberDirect(node, "MaxAltitudeMslFt"), numberDirect(node, "MaxMslFt")),
      maxAglFt: numberDirect(node, "MaxAglFt"),
      maxGs: firstNumber(numberDirect(node, "MaxGS"), numberDirect(node, "MaxGs")),
      minVs: firstNumber(numberDirect(node, "MinVS"), numberDirect(node, "MinVs")),
      maxVs: firstNumber(numberDirect(node, "MaxVS"), numberDirect(node, "MaxVs")),
      flags: textDirect(node, "Flags"),
      reviewQuestion: textDirect(node, "ReviewQuestion"),
    };
  });
}

function parseLandingMetrics(doc: XMLDocument): Record<string, string | number | boolean> {
  const landing = firstDescendant(doc, "LandingMetrics");
  if (landing) {
    return {
      touchdownDetected: asBoolean(textDirect(landing, "TouchdownDetected")),
      touchdownTimeUtc: textDirect(landing, "TouchdownTimeUtc"),
      touchdownVs: numberDirect(landing, "TouchdownVS"),
      touchdownG: numberDirect(landing, "TouchdownG"),
      touchdownIas: numberDirect(landing, "TouchdownIAS"),
      touchdownGs: numberDirect(landing, "TouchdownGS"),
      touchdownPitch: numberDirect(landing, "TouchdownPitch"),
      touchdownBank: numberDirect(landing, "TouchdownBank"),
      touchdownLat: numberDirect(landing, "TouchdownLat"),
      touchdownLon: numberDirect(landing, "TouchdownLon"),
    };
  }
  const indicadores = firstDescendant(doc, "Indicadores");
  return {
    touchdownDetected: numberDirect(indicadores, "CantTouchdowns") > 0,
    touchdownVs: firstNumber(numberDirect(indicadores, "TouchdownVS"), numberDeep(doc, "TouchDownVS")),
    touchdownG: numberDirect(indicadores, "TouchdownGForce"),
    maxG: numberDirect(indicadores, "MaxGForce"),
    minG: numberDirect(indicadores, "MinGForce"),
  };
}

function windSummary(section: Element | null): string {
  if (!section) return "";
  const wind = firstText(textDeep(section, "Wind"), textDeep(section, "Viento"), textDeep(section, "WindDir"));
  const speed = firstText(textDeep(section, "WindSpeed"), textDeep(section, "Velocidad"));
  const qnh = firstText(textDeep(section, "QNH"), textDeep(section, "Qnh"));
  const parts = [wind && speed ? `${wind}/${speed}` : wind || speed, qnh ? `QNH ${qnh}` : ""].filter(Boolean);
  return parts.join(" · ");
}

function runwaySummary(section: Element | null): string {
  if (!section) return "";
  return firstText(textDeep(section, "Runway"), textDeep(section, "Pista"), textDeep(section, "RWY"));
}


function xmlTextFallback(rawXml: string, tag: string): string {
  if (!rawXml) return "";
  const match = rawXml.match(new RegExp(`<${tag}(?:\s[^>]*)?>([\s\S]*?)<\/${tag}>`, "i"));
  return match ? match[1].replace(/<[^>]*>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, " ").trim() : "";
}

function xmlNumberFallback(rawXml: string, tag: string): number {
  return asNumber(xmlTextFallback(rawXml, tag));
}

function buildFallbackSummaryFromRawXml(rawXml: string, reservation: GenericRow): PirepPerfectSummary {
  const hasCapabilities = /<Capabilities[\s>]/i.test(rawXml);
  const hasPhaseSummary = /<FlightPhaseSummary[\s>]/i.test(rawXml);
  const hasEventTimeline = /<EventTimeline[\s>]/i.test(rawXml);
  const hasC8 = /<PhaseTestRunManifest[\s>]/i.test(rawXml);
  const altitudeEvidence: PirepPerfectAltitudeEvidence = {
    schema: xmlTextFallback(rawXml, "Schema"),
    transitionAltitudeFt: firstNumber(xmlNumberFallback(rawXml, "TransitionAltitudeFt"), 10000),
    sampleCount: xmlNumberFallback(rawXml, "SampleCount"),
    maxAltitudeMslFt: firstNumber(xmlNumberFallback(rawXml, "MaxAltitudeMslFt"), xmlNumberFallback(rawXml, "MaxAltitude")),
    maxAglFt: xmlNumberFallback(rawXml, "MaxAglFt"),
    minAglFt: xmlNumberFallback(rawXml, "MinAglFt"),
    maxPressureAltitudeFt: xmlNumberFallback(rawXml, "MaxPressureAltitudeFt"),
    firstAltitudeMslFt: xmlNumberFallback(rawXml, "FirstAltitudeMslFt"),
    firstAltitudeAglFt: xmlNumberFallback(rawXml, "FirstAltitudeAglFt"),
    lastAltitudeMslFt: xmlNumberFallback(rawXml, "LastAltitudeMslFt"),
    lastAltitudeAglFt: xmlNumberFallback(rawXml, "LastAltitudeAglFt"),
    lastFlightLevel: xmlTextFallback(rawXml, "LastFlightLevel"),
    lastDisplayMode: xmlTextFallback(rawXml, "LastDisplayMode"),
    lastDisplayText: xmlTextFallback(rawXml, "LastDisplayText"),
    altitudeSource: xmlTextFallback(rawXml, "AltitudeSource"),
    isReliable: asBoolean(xmlTextFallback(rawXml, "IsReliable")),
  };
  return {
    ...EMPTY_SUMMARY,
    hasRawXml: Boolean(rawXml),
    hasAnyEvidence: Boolean(rawXml),
    rawXmlLength: rawXml.length,
    schemaVersion: firstText(xmlTextFallback(rawXml, "SchemaVersion"), xmlTextFallback(rawXml, "AcarsVersion"), hasC8 ? "PIREP_PERFECT_C8" : ""),
    flightNumber: firstText(xmlTextFallback(rawXml, "NroVuelo"), asText(reservation.reservation_code), asText(reservation.route_code)),
    originIdent: firstText(xmlTextFallback(rawXml, "Origen"), asText(reservation.origin_ident)),
    destinationIdent: firstText(xmlTextFallback(rawXml, "Destino"), asText(reservation.destination_ident)),
    aircraftCode: firstText(xmlTextFallback(rawXml, "Avion"), xmlTextFallback(rawXml, "SimAvionTipo"), asText(reservation.aircraft_type_code)),
    aircraftDisplayName: firstText(xmlTextFallback(rawXml, "ModeloCertificado"), xmlTextFallback(rawXml, "SimAvionRaw")),
    aircraftRegistration: firstText(xmlTextFallback(rawXml, "Registracion"), asText(reservation.aircraft_registration)),
    flightDuration: xmlTextFallback(rawXml, "FlightDuration"),
    blockDuration: xmlTextFallback(rawXml, "BlockDuration"),
    distanceNm: firstNumber(xmlNumberFallback(rawXml, "FlightLenght"), xmlNumberFallback(rawXml, "DistanceNm")),
    maxIas: xmlNumberFallback(rawXml, "MaxIAS"),
    cruiseAltitude: altitudeEvidence.maxAltitudeMslFt,
    maxAltitudeMslFt: altitudeEvidence.maxAltitudeMslFt,
    maxAglFt: altitudeEvidence.maxAglFt,
    altitudeEvidence,
    landingVs: firstNumber(xmlNumberFallback(rawXml, "TouchDownVS"), xmlNumberFallback(rawXml, "TouchdownVS")),
    touchdownVs: firstNumber(xmlNumberFallback(rawXml, "TouchdownVS"), xmlNumberFallback(rawXml, "TouchDownVS")),
    touchdownG: firstNumber(xmlNumberFallback(rawXml, "TouchdownG"), xmlNumberFallback(rawXml, "TouchdownGForce")),
    notes: [
      "XML parseado por fallback server-safe",
      hasCapabilities ? "Capabilities presente" : "Capabilities no detectado",
      hasPhaseSummary ? "FlightPhaseSummary presente" : "FlightPhaseSummary no detectado",
      hasEventTimeline ? "EventTimeline presente" : "EventTimeline no detectado",
      hasC8 ? "PhaseTestRunManifest C8 presente" : "C8 no detectado",
    ],
  };
}

export function buildPirepPerfectWebSummary(input: {
  scorePayload?: GenericRow | null;
  reservation?: GenericRow | null;
  scoreReport?: GenericRow | null;
}): PirepPerfectSummary {
  const scorePayload = asObject(input.scorePayload);
  const reservation = asObject(input.reservation);
  const rawXml = pickRawXml(scorePayload);
  const doc = parseXml(rawXml);
  if (!doc) {
    const rawFinalize = asObject(scorePayload.raw_finalize_payload);
    const telemetryLog = asObject(rawFinalize.telemetryLog);
    const sampleCount = firstNumber(telemetryLog.total_samples, asObject(scorePayload.raw_telemetry_summary).samples);
    if (rawXml) {
      const fallback = buildFallbackSummaryFromRawXml(rawXml, reservation);
      return {
        ...fallback,
        hasAnyEvidence: fallback.hasAnyEvidence || sampleCount > 0,
        notes: [...fallback.notes, "DOMParser no disponible o XML inválido; se usó fallback textual"],
      };
    }
    return {
      ...EMPTY_SUMMARY,
      hasRawXml: Boolean(rawXml),
      hasAnyEvidence: sampleCount > 0 || Boolean(rawXml),
      rawXmlLength: rawXml.length,
      notes: [],
    };
  }

  const despacho = firstDescendant(doc, "Despacho");
  const resumen = firstDescendant(doc, "Resumen");
  const indicadores = firstDescendant(doc, "Indicadores");
  const simulador = firstDescendant(doc, "Simulador");
  const avion = firstDescendant(doc, "Avion");
  const aeropuertos = firstDescendant(doc, "Aeropuertos");
  const meteo = firstDescendant(doc, "Meteorologia");
  const depMeteo = firstChild(meteo, "Despegue");
  const arrMeteo = firstChild(meteo, "Aterrizaje");
  const depAirport = firstChild(aeropuertos, "Despegue");
  const arrAirport = firstChild(aeropuertos, "Aterrizaje");

  const capabilities = parseCapabilities(doc);
  const phases = parsePhases(doc);
  const eventTimeline = parseEventTimeline(doc);
  const unsupportedEvents = eventTimeline.filter((event) => !event.penaltyEligible || event.reliability.toLowerCase().includes("unsupported"));
  const altitudeEvidence = parseAltitudeEvidence(doc);
  const phaseAuditReport = parseSimpleSection(doc, "PhaseAuditReport");
  const phasePrevalidationPackage = parseSimpleSection(doc, "PhasePrevalidationPackage");
  const phaseAcceptanceMatrix = parsePhaseAcceptanceMatrix(doc);
  const phaseTestRunManifest = parseSimpleSection(doc, "PhaseTestRunManifest");
  const landingMetrics = parseLandingMetrics(doc);
  const schemaVersion = firstText(textDeep(doc, "SchemaVersion"), textDeep(doc, "AcarsVersion"));

  const model = firstText(textDirect(despacho, "ModeloCertificado"), textDirect(simulador, "SimAvionRaw"));
  const aircraftCode = firstText(textDirect(despacho, "Avion"), textDirect(simulador, "SimAvionTipo"), asText(reservation.aircraft_type_code));
  const aircraftRegistration = firstText(textDirect(despacho, "Registracion"), asText(reservation.aircraft_registration));
  const addonProvider = firstText(textDirect(simulador, "SimAvionAuthor"), textDirect(simulador, "SimAvionAuthorRaw"), asText(reservation.addon_provider));
  const fuelStart = firstNumber(numberDeep(doc, "FuelStartKg"), numberDirect(resumen, "TakeOffFuel"));
  const fuelEnd = firstNumber(numberDeep(doc, "FuelEndKg"), numberDirect(resumen, "FinalFuel"), numberDirect(avion, "Combustible"));
  const fuelUsed = firstNumber(numberDirect(resumen, "SpentFuel"), fuelStart > 0 && fuelEnd > 0 ? fuelStart - fuelEnd : 0);
  const takeoffAirport = firstText(textDeep(depAirport, "ICAO"), textDeep(depAirport, "Icao"), textDeep(depAirport, "Ident"), textDirect(despacho, "Origen"));
  const landingAirport = firstText(textDeep(arrAirport, "ICAO"), textDeep(arrAirport, "Icao"), textDeep(arrAirport, "Ident"), textDirect(despacho, "Destino"));

  return {
    ...EMPTY_SUMMARY,
    hasRawXml: true,
    hasAnyEvidence: eventTimeline.length > 0 || phases.some((phase) => phase.samples > 0) || numberDirect(resumen, "FlightLenght") > 0,
    rawXmlLength: rawXml.length,
    schemaVersion,
    flightNumber: firstText(textDirect(despacho, "NroVuelo"), asText(reservation.reservation_code), asText(reservation.route_code)),
    originIdent: firstText(textDirect(despacho, "Origen"), asText(reservation.origin_ident)),
    destinationIdent: firstText(textDirect(despacho, "Destino"), asText(reservation.destination_ident)),
    alternateIdent: textDirect(despacho, "Alternativo"),
    aircraftCode,
    aircraftDisplayName: [aircraftCode, model].filter(Boolean).join(" — "),
    aircraftRegistration,
    addonProvider,
    simulator: firstText(textDirect(simulador, "SimVersion"), "Microsoft Flight Simulator / ACARS Patagonia Wings"),
    simAircraftRaw: textDirect(simulador, "SimAvionRaw"),
    flightType: textDirect(despacho, "TipoVuelo"),
    routeText: textDirect(despacho, "Ruta"),
    flightLevel: textDirect(despacho, "FlightLevel"),
    scheduledDeparture: textDirect(despacho, "ETD"),
    scheduledArrival: textDirect(despacho, "ETA"),
    pax: numberDirect(despacho, "PAX"),
    cargoKg: numberDirect(despacho, "Carga"),
    fuelPlanKg: numberDirect(despacho, "FuelPlan"),
    blockDuration: textDirect(resumen, "BlockDuration"),
    flightDuration: textDirect(resumen, "FlightDuration"),
    distanceNm: numberDirect(resumen, "FlightLenght"),
    maxIas: numberDirect(resumen, "MaxIAS"),
    cruiseAltitude: firstNumber(altitudeEvidence.maxAltitudeMslFt, numberDirect(resumen, "CruiceAltitud"), phases.reduce((max, phase) => Math.max(max, phase.maxAltitudeMslFt || phase.maxAltitude), 0)),
    maxAltitudeMslFt: firstNumber(altitudeEvidence.maxAltitudeMslFt, phases.reduce((max, phase) => Math.max(max, phase.maxAltitudeMslFt || phase.maxAltitude), 0)),
    maxAglFt: firstNumber(altitudeEvidence.maxAglFt, phases.reduce((max, phase) => Math.max(max, phase.maxAglFt || 0), 0)),
    altitudeEvidence,
    fuelStartKg: fuelStart,
    fuelEndKg: fuelEnd,
    fuelUsedKg: fuelUsed,
    fuelPerHour: numberDirect(resumen, "FuelPerHour"),
    fuelPer100Nm: numberDirect(resumen, "FuelPer100NM"),
    landingVs: firstNumber(numberDirect(resumen, "TouchDownVS"), numberDirect(indicadores, "TouchdownVS"), asNumber(landingMetrics.touchdownVs)),
    touchdownVs: firstNumber(numberDirect(indicadores, "TouchdownVS"), asNumber(landingMetrics.touchdownVs)),
    touchdownG: firstNumber(numberDirect(indicadores, "TouchdownGForce"), asNumber(landingMetrics.touchdownG)),
    maxGForce: firstNumber(numberDirect(indicadores, "MaxGForce"), asNumber(landingMetrics.maxG), asNumber(landingMetrics.touchdownG)),
    minGForce: numberDirect(indicadores, "MinGForce"),
    overspeedSeconds: numberDirect(indicadores, "OverspeedSecs"),
    stallSeconds: numberDirect(indicadores, "StallSecs"),
    pauseSeconds: numberDirect(indicadores, "TiempoenPausa"),
    picFalseCount: firstNumber(numberDirect(indicadores, "PICsFailed"), numberDirect(indicadores, "PICFalse")),
    picTotalCount: firstNumber(numberDirect(indicadores, "CantidadPICs"), numberDirect(indicadores, "PICsTotalProgramados")),
    takeoffAirport,
    landingAirport,
    departureWind: firstText(windSummary(depMeteo), windSummary(depAirport)),
    arrivalWind: firstText(windSummary(arrMeteo), windSummary(arrAirport)),
    departureRunway: firstText(runwaySummary(depAirport), runwaySummary(depMeteo)),
    arrivalRunway: firstText(runwaySummary(arrAirport), runwaySummary(arrMeteo)),
    transponder: normalizeStatusValue(textDirect(avion, "Transpondedor")),
    transponderState: normalizeStatusValue(textDirect(avion, "TranspondedorEstado")),
    parkingBrake: normalizeStatusValue(firstText(textDirect(avion, "ParkingBreak"), textDirect(avion, "ParkingBrake"))),
    batteryMaster: normalizeStatusValue(textDirect(avion, "BatteryMaster")),
    avionicsMaster: normalizeStatusValue(textDirect(avion, "AvionicsMaster")),
    doorOpen: normalizeStatusValue(textDirect(avion, "DoorOpen")),
    fuelCurrentKg: numberDirect(avion, "Combustible"),
    fuelCapacityKg: numberDirect(avion, "CombustibleCapacidad"),
    capabilities,
    phases,
    eventTimeline,
    unsupportedEvents,
    phaseAuditReport,
    phasePrevalidationPackage,
    phaseAcceptanceMatrix,
    phaseTestRunManifest,
    landingMetrics,
    notes: [
      schemaVersion ? `Schema ${schemaVersion}` : "",
      capabilities.length ? `${capabilities.length} capabilities declaradas` : "Sin bloque Capabilities; usando fallback XML legacy",
      phases.length ? `${phases.length} fases resumidas` : "Sin FlightPhaseSummary; usando métricas Resumen/Indicadores",
      eventTimeline.length ? `${eventTimeline.length} eventos operacionales` : "Sin timeline operacional",
      altitudeEvidence.maxAltitudeMslFt ? `ALT MSL max ${altitudeEvidence.maxAltitudeMslFt} ft / AGL max ${altitudeEvidence.maxAglFt} ft` : "Sin bloque Altitude C0",
      phaseAcceptanceMatrix.length ? `${phaseAcceptanceMatrix.length} fases en PhaseAcceptanceMatrix` : "Sin PhaseAcceptanceMatrix C7",
      asBoolean(phaseTestRunManifest.ReadyForFullSimulatorValidation) ? "C8 listo para validación completa" : "C8 pendiente/no presente",
    ].filter(Boolean),
  };
}
