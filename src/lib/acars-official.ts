import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateFlightCommission, calculateDamageDeduction, estimateFlightEconomy } from "@/lib/pilot-economy";

export type OfficialFlightStatus =
  | "reserved"
  | "dispatched"
  | "in_progress"
  | "completed"
  | "crashed"
  | "aborted"
  | "interrupted"
  | "manual_review"
  | "cancelled";

export type AcarsFlightInput = {
  reservationId: string;
  dispatchPackageId?: string | null;
  aircraftId?: string | null;
  flightNumber?: string | null;
  departureIcao?: string | null;
  arrivalIcao?: string | null;
  aircraftIcao?: string | null;
  aircraftTypeCode?: string | null;
  aircraftName?: string | null;
  aircraftDisplayName?: string | null;
  aircraftVariantCode?: string | null;
  addonProvider?: string | null;
  route?: string | null;
  flightModeCode?: string | null;
  routeCode?: string | null;
  plannedAltitude?: number | null;
  plannedSpeed?: number | null;
  remarks?: string | null;
  startTime?: string | null;
};

export type PreparedDispatchInput = {
  reservationId: string;
  dispatchId?: string | null;
  dispatchToken?: string | null;
  routeCode?: string | null;
  departureIcao?: string | null;
  arrivalIcao?: string | null;
  alternateIcao?: string | null;
  aircraftId?: string | null;
  aircraftIcao?: string | null;
  aircraftRegistration?: string | null;
  aircraftDisplayName?: string | null;
  aircraftVariantCode?: string | null;
  addonProvider?: string | null;
  routeText?: string | null;
  flightMode?: string | null;
  reservationStatus?: string | null;
  dispatchPackageStatus?: string | null;
  cruiseLevel?: string | null;
  remarks?: string | null;
  scheduledDepartureUtc?: string | null;
  passengerCount?: number | null;
  cargoKg?: number | null;
  fuelPlannedKg?: number | null;
  payloadKg?: number | null;
  zeroFuelWeightKg?: number | null;
  scheduledBlockMinutes?: number | null;
  expectedBlockP50Minutes?: number | null;
  expectedBlockP80Minutes?: number | null;
};

export type AcarsReportInput = {
  reservationId?: string | null;
  flightNumber?: string | null;
  departureIcao?: string | null;
  arrivalIcao?: string | null;
  aircraftIcao?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  distance?: number | null;
  fuelUsed?: number | null;
  landingVS?: number | null;
  landingG?: number | null;
  remarks?: string | null;
  maxAltitudeFeet?: number | null;
  maxSpeedKts?: number | null;
  approachQnhHpa?: number | null;
};

export type AcarsTelemetrySample = {
  capturedAtUtc?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitudeFeet?: number | null;
  altitudeAGL?: number | null;
  indicatedAirspeed?: number | null;
  groundSpeed?: number | null;
  verticalSpeed?: number | null;
  heading?: number | null;
  pitch?: number | null;
  bank?: number | null;
  fuelTotalLbs?: number | null;
  fuelKg?: number | null;
  fuelFlowLbsHour?: number | null;
  totalWeightKg?: number | null;
  totalWeightLbs?: number | null;
  zeroFuelWeightKg?: number | null;
  payloadKg?: number | null;
  engine1N1?: number | null;
  engine2N1?: number | null;
  engine3N1?: number | null;
  engine4N1?: number | null;
  landingVS?: number | null;
  landingG?: number | null;
  onGround?: boolean | null;
  strobeLightsOn?: boolean | null;
  beaconLightsOn?: boolean | null;
  landingLightsOn?: boolean | null;
  taxiLightsOn?: boolean | null;
  navLightsOn?: boolean | null;
  parkingBrake?: boolean | null;
  autopilotActive?: boolean | null;
  doorOpen?: boolean | null;
  pause?: boolean | null;
  seatBeltSign?: boolean | null;
  noSmokingSign?: boolean | null;
  gearDown?: boolean | null;
  gearTransitioning?: boolean | null;
  flapsDeployed?: boolean | null;
  flapsPercent?: number | null;
  spoilersArmed?: boolean | null;
  reverserActive?: boolean | null;
  transponderCharlieMode?: boolean | null;
  transponderCode?: number | null;
  transponderStateRaw?: number | null;
  apuRunning?: boolean | null;
  bleedAirOn?: boolean | null;
  cabinAltitudeFeet?: number | null;
  pressureDiffPsi?: number | null;
  windSpeed?: number | null;
  windDirection?: number | null;
  qnh?: number | null;
  isRaining?: boolean | null;
  simulatorType?: string | null;
  aircraftTitle?: string | null;
  detectedProfileCode?: string | null;
  com2FrequencyMhz?: number | null;
};

export type AircraftDamageEventInput = {
  aircraftId?: string | null;
  reservationId?: string | null;
  eventCode?: string | null;
  phase?: string | null;
  severity?: string | null;
  details?: Record<string, unknown> | null;
  capturedAtUtc?: string | null;
};

export type AcarsCloseoutPayloadInput = {
  contractVersion?: string | null;
  generatedAtUtc?: string | null;
  reservationId?: string | null;
  resultUrl?: string | null;
  header?: Record<string, unknown> | null;
  scores?: Record<string, unknown> | null;
  evaluation?: Record<string, unknown> | null;
  pirepFileName?: string | null;
  pirepChecksumSha256?: string | null;
  pirepXmlContent?: string | null;
};

type GenericRow = Record<string, unknown>;

type StageName =
  | "preflight"
  | "taxi_out"
  | "takeoff"
  | "climb"
  | "cruise"
  | "descent"
  | "approach"
  | "landing"
  | "taxi_in"
  | "shutdown";

type OfficialScoringResult = {
  finalStatus: OfficialFlightStatus;
  evaluationStatus: "evaluable" | "no_evaluable";
  economyEligible: boolean;
  evidenceWarnings: string[];
  evidenceSnapshot: Record<string, unknown>;
  procedureScore: number;
  missionScore: number;
  safetyScore: number;
  efficiencyScore: number;
  finalScore: number;
  scoringStatus: "scored" | "manual_review" | "pending_server_closeout";
  penaltiesJson: Array<Record<string, unknown>>;
  eventsJson: Array<Record<string, unknown>>;
  stageBreakdownJson: Record<StageName, Record<string, unknown>>;
  officialPirep: Record<string, unknown>;
  damageSummary: Record<string, unknown>;
  actualBlockMinutes: number;
  fuelStartKg: number;
  fuelEndKg: number;
  fuelUsedKg: number;
  maxAltitudeFeet: number;
  maxSpeedKts: number;
  landingVsFpm: number;
  landingGForce: number;
  routeMismatch: boolean;
  manualReviewReasons: string[];
  aircraftLocation: string;
  aircraftStatus: string;
  aircraftConditionPatch: Record<string, unknown>;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asBoolean(value: unknown) {
  return value === true;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeIcao(value: unknown) {
  return asText(value).toUpperCase();
}

function buildEvent(code: string, stage: string, severity: string, detail: string, extra?: Record<string, unknown>) {
  return {
    code,
    stage,
    severity,
    detail,
    ...(extra ?? {}),
  };
}


function xmlEscape(value: unknown) {
  const raw = value == null ? "" : typeof value === "string" ? value.trim() : String(value);
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlTag(name: string, value: unknown) {
  return `<${name}>${xmlEscape(value)}</${name}>`;
}

function extractXmlNumber(xml: string, tag: string) {
  if (!xml) return 0;
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? asNumber(match[1]) : 0;
}

function extractXmlText(xml: string, tag: string) {
  if (!xml) return "";
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? asText(match[1]) : "";
}

function extractPirepLogEvents(rawXml: string) {
  if (!rawXml) return [] as Array<Record<string, unknown>>;
  const logMatches = [...rawXml.matchAll(/<Log>([\s\S]*?)<\/Log>/gi)];
  if (!logMatches.length) return [] as Array<Record<string, unknown>>;

  const events: Array<Record<string, unknown>> = [];
  const pushLogEvent = (code: string, stage: string, severity: string, detail: string) => {
    events.push(buildEvent(code, stage, severity, detail, { source: "pirep_raw_log" }));
  };

  for (const match of logMatches) {
    const line = asText(match[1]);
    if (!line || line.toUpperCase().includes("EVENT") || line.toUpperCase().includes("LATITUDE")) {
      continue;
    }

    const normalized = line.toUpperCase();
    if (normalized.includes(" START")) pushLogEvent("RAW_START", "preflight", "info", "Inicio de sesión de vuelo detectado en PIREP RAW.");
    if (normalized.includes(" STOP")) pushLogEvent("RAW_STOP", "shutdown", "info", "Cierre de sesión de vuelo detectado en PIREP RAW.");
    if (normalized.includes(" SQUAWK")) pushLogEvent("RAW_SQUAWK", "cruise", "info", "Evento de transponder detectado en PIREP RAW.");
    if (normalized.includes(" TAKEOFF")) pushLogEvent("RAW_TAKEOFF", "takeoff", "info", "Evento de despegue detectado en PIREP RAW.");
    if (normalized.includes(" LANDING")) pushLogEvent("RAW_LANDING", "landing", "info", "Evento de aterrizaje detectado en PIREP RAW.");
    if (normalized.includes(" CRASH")) pushLogEvent("RAW_CRASH", "landing", "critical", "Evento de impacto detectado en PIREP RAW.");
  }

  return events;
}

function buildEvaluatedPirepXml(rawXml: string, official: OfficialScoringResult, reservationId: string) {
  const sourceXml = rawXml || "<PIREP />";
  const evaluatedBlock = [
    "<EvaluacionServidor>",
    xmlTag("ReservationId", reservationId),
    xmlTag("Estado", official.finalStatus),
    xmlTag("ScoringStatus", official.scoringStatus),
    xmlTag("PuntosFinales", official.finalScore),
    xmlTag("Procedimientos", official.procedureScore),
    xmlTag("Mision", official.missionScore),
    xmlTag("Seguridad", official.safetyScore),
    xmlTag("Eficiencia", official.efficiencyScore),
    xmlTag("BlockMinutes", official.actualBlockMinutes),
    xmlTag("FuelUsedKg", official.fuelUsedKg),
    xmlTag("LandingVS", official.landingVsFpm),
    xmlTag("LandingG", official.landingGForce),
    "<Penalizaciones>",
    ...official.penaltiesJson.map((item) => `  <Item code="${xmlEscape(item.code)}" stage="${xmlEscape(item.stage)}" severity="${xmlEscape(item.severity)}">${xmlEscape(item.detail)}</Item>`),
    "</Penalizaciones>",
    "<Eventos>",
    ...official.eventsJson.map((item) => `  <Item code="${xmlEscape(item.code)}" stage="${xmlEscape(item.stage)}" severity="${xmlEscape(item.severity)}">${xmlEscape(item.detail)}</Item>`),
    "</Eventos>",
    "</EvaluacionServidor>",
  ].join("\n");

  return sourceXml.includes("</PIREP>")
    ? sourceXml.replace("</PIREP>", `${evaluatedBlock}\n</PIREP>`)
    : `<PIREP>${evaluatedBlock}</PIREP>`;
}
function isMissingRelationError(error: unknown) {
  const payload = asObject(error);
  const code = asText(payload.code);
  const message = `${asText(payload.message)} ${asText(payload.details)} ${asText(payload.hint)}`.toLowerCase();
  return code === "PGRST205" || message.includes("could not find the table") || message.includes("relation") || message.includes("schema cache");
}

async function maybeInsert(table: string, payload: Record<string, unknown> | Record<string, unknown>[]) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(table).insert(payload);
  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

async function maybeUpsert(table: string, payload: Record<string, unknown>, onConflict?: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(table).upsert(payload, onConflict ? { onConflict } : undefined);
  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

async function maybeDeleteByReservationId(table: string, reservationId: string) {
  if (!reservationId) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(table).delete().eq("reservation_id", reservationId);
  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

async function maybeUpsertReservationRow(table: string, reservationId: string, payload: Record<string, unknown>) {
  if (!reservationId) return;
  const supabase = createSupabaseAdminClient();
  const { data, error: selectError } = await supabase
    .from(table)
    .select("id")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (selectError) {
    if (isMissingRelationError(selectError)) return;
    throw selectError;
  }

  if (data?.id) {
    const { error } = await supabase.from(table).update(payload).eq("id", data.id);
    if (error && !isMissingRelationError(error)) throw error;
    return;
  }

  const { error } = await supabase.from(table).insert(payload);
  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

async function maybeRecalculateAirlineBalance(airlineId: string) {
  if (!airlineId) return;
  const supabase = createSupabaseAdminClient();

  const rpcResult = await supabase.rpc("pw_recalculate_airline_balance", { p_airline_id: airlineId });
  if (!rpcResult.error) return;

  const message = `${asText(rpcResult.error.message)} ${asText(rpcResult.error.details)} ${asText(rpcResult.error.hint)}`.toLowerCase();
  if (!message.includes("function") && !message.includes("schema cache") && !message.includes("could not find")) {
    throw rpcResult.error;
  }

  const { data, error } = await supabase
    .from("airline_ledger")
    .select("amount_usd")
    .eq("airline_id", airlineId)
    .limit(50000);

  if (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }

  const amounts = (data ?? []).map((row) => asNumber(row.amount_usd));
  const balance = amounts.reduce((sum, amount) => sum + amount, 0);
  const revenue = amounts.filter((amount) => amount > 0).reduce((sum, amount) => sum + amount, 0);
  const costs = Math.abs(amounts.filter((amount) => amount < 0).reduce((sum, amount) => sum + amount, 0));

  const { error: updateError } = await supabase
    .from("airlines")
    .update({
      balance_usd: Math.round(balance * 100) / 100,
      total_revenue_usd: Math.round(revenue * 100) / 100,
      total_costs_usd: Math.round(costs * 100) / 100,
    })
    .eq("id", airlineId);

  if (updateError && !isMissingRelationError(updateError)) {
    throw updateError;
  }
}

export async function requireAcarsContext(accessToken: string) {
  const supabase = createSupabaseServerClient(accessToken);
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    throw new Error(userError?.message ?? "No se pudo validar la sesión Supabase.");
  }

  const user = userData.user;
  const { data: profile, error: profileError } = await supabase
    .from("pilot_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "No se pudo resolver pilot_profiles para ACARS.");
  }

  return {
    supabase,
    user,
    profile: profile as GenericRow,
  };
}

export async function loadReservationContext(
  accessToken: string,
  reservationId: string
) {
  const { supabase, user, profile } = await requireAcarsContext(accessToken);

  const { data: reservation, error: reservationError } = await supabase
    .from("flight_reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError || !reservation) {
    throw new Error(reservationError?.message ?? "No se encontró flight_reservations para el cierre oficial.");
  }

  const callsign = normalizeIcao(profile.callsign);
  const reservationCallsign = normalizeIcao((reservation as GenericRow).pilot_callsign);
  if (callsign && reservationCallsign && callsign !== reservationCallsign) {
    throw new Error("La reserva no pertenece al piloto autenticado.");
  }

  const { data: dispatchPackage } = await supabase
    .from("dispatch_packages")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const aircraftId = asText((reservation as GenericRow).aircraft_id);
  let aircraft: GenericRow | null = null;
  let aircraftCondition: GenericRow | null = null;

  if (aircraftId) {
    const [{ data: aircraftRow }, { data: aircraftConditionRow }] = await Promise.all([
      supabase.from("aircraft").select("*").eq("id", aircraftId).maybeSingle(),
      supabase.from("aircraft_condition").select("*").eq("aircraft_id", aircraftId).maybeSingle(),
    ]);
    aircraft = (aircraftRow ?? null) as GenericRow | null;
    aircraftCondition = (aircraftConditionRow ?? null) as GenericRow | null;
  }

  return {
    supabase,
    user,
    profile: profile as GenericRow,
    reservation: reservation as GenericRow,
    dispatchPackage: (dispatchPackage ?? null) as GenericRow | null,
    aircraft,
    aircraftCondition,
  };
}

function getStageIndex(samples: AcarsTelemetrySample[], predicate: (sample: AcarsTelemetrySample, index: number) => boolean) {
  for (let index = 0; index < samples.length; index += 1) {
    if (predicate(samples[index], index)) {
      return index;
    }
  }
  return -1;
}

function summarizeDamage(events: AircraftDamageEventInput[]) {
  const severeCount = events.filter((event) => ["severe", "critical"].includes(asText(event.severity).toLowerCase())).length;
  return {
    events_count: events.length,
    severe_count: severeCount,
    events: events.map((event) => ({
      event_code: asText(event.eventCode),
      phase: asText(event.phase),
      severity: asText(event.severity) || "medium",
      captured_at_utc: asText(event.capturedAtUtc),
      details: asObject(event.details),
    })),
  };
}

function buildStageBreakdown(samples: AcarsTelemetrySample[]) {
  const hasSamples = samples.length > 0;
  const takeoffIndex = getStageIndex(
    samples,
    (sample) => !asBoolean(sample.onGround) && asNumber(sample.indicatedAirspeed) > 80
  );
  const climbIndex = getStageIndex(
    samples,
    (sample, index) => index >= Math.max(0, takeoffIndex) && asNumber(sample.verticalSpeed) > 500 && asNumber(sample.altitudeAGL) > 800
  );
  const cruiseIndex = getStageIndex(
    samples,
    (sample, index) => index >= Math.max(0, climbIndex) && asNumber(sample.altitudeFeet) > 10000 && Math.abs(asNumber(sample.verticalSpeed)) < 400
  );
  const descentIndex = getStageIndex(
    samples,
    (sample, index) => index >= Math.max(0, cruiseIndex) && asNumber(sample.verticalSpeed) < -500 && asNumber(sample.altitudeFeet) > 2500
  );
  const approachIndex = getStageIndex(
    samples,
    (sample, index) => index >= Math.max(0, descentIndex) && asNumber(sample.altitudeAGL) > 0 && asNumber(sample.altitudeAGL) < 3000
  );
  const landingIndex = getStageIndex(
    samples,
    (sample, index) => index > Math.max(0, takeoffIndex) && asBoolean(sample.onGround) && asNumber(sample.groundSpeed) > 20
  );
  const taxiInIndex = getStageIndex(
    samples,
    (sample, index) => index >= Math.max(0, landingIndex) && asBoolean(sample.onGround) && asNumber(sample.groundSpeed) > 2 && asNumber(sample.groundSpeed) < 30
  );
  // Shutdown is only valid after an actual landing (landingIndex >= 0).
  // Without this guard, a pilot at the origin gate (GS=0, brakes on, engines off)
  // would falsely trigger shutdown and be scored as "completed".
  const shutdownIndex = landingIndex >= 0
    ? getStageIndex(
        samples,
        (sample, index) =>
          index >= Math.max(0, taxiInIndex >= 0 ? taxiInIndex : landingIndex) &&
          asBoolean(sample.onGround) &&
          asBoolean(sample.parkingBrake) &&
          asNumber(sample.groundSpeed) < 1 &&
          asNumber(sample.engine1N1) < 20 &&
          asNumber(sample.engine2N1) < 20
      )
    : -1;

  const hasTaxiOut = samples.some((sample) => asBoolean(sample.onGround) && asNumber(sample.groundSpeed) > 2);
  const hasPreflight = hasSamples;

  const stageMeta: Record<StageName, { phase_code: string; phase_label: string }> = {
    preflight: { phase_code: "PRE", phase_label: "Preflight" },
    taxi_out: { phase_code: "TAX", phase_label: "Taxi Out" },
    takeoff: { phase_code: "TO", phase_label: "Takeoff" },
    climb: { phase_code: "ASC", phase_label: "Climb" },
    cruise: { phase_code: "CRU", phase_label: "Cruise" },
    descent: { phase_code: "DES", phase_label: "Descent" },
    approach: { phase_code: "LDG", phase_label: "Approach" },
    landing: { phase_code: "LDG", phase_label: "Landing" },
    taxi_in: { phase_code: "TAG", phase_label: "Taxi In" },
    shutdown: { phase_code: "PAR", phase_label: "Shutdown" },
  };

  const stages: Record<StageName, Record<string, unknown>> = {
    preflight: { ...stageMeta.preflight, reached: hasPreflight, index: hasPreflight ? 0 : -1 },
    taxi_out: { ...stageMeta.taxi_out, reached: hasTaxiOut, index: hasTaxiOut ? getStageIndex(samples, (sample) => asBoolean(sample.onGround) && asNumber(sample.groundSpeed) > 2) : -1 },
    takeoff: { ...stageMeta.takeoff, reached: takeoffIndex >= 0, index: takeoffIndex },
    climb: { ...stageMeta.climb, reached: climbIndex >= 0, index: climbIndex },
    cruise: { ...stageMeta.cruise, reached: cruiseIndex >= 0, index: cruiseIndex },
    descent: { ...stageMeta.descent, reached: descentIndex >= 0, index: descentIndex },
    approach: { ...stageMeta.approach, reached: approachIndex >= 0, index: approachIndex },
    landing: { ...stageMeta.landing, reached: landingIndex >= 0, index: landingIndex },
    taxi_in: { ...stageMeta.taxi_in, reached: taxiInIndex >= 0, index: taxiInIndex },
    shutdown: { ...stageMeta.shutdown, reached: shutdownIndex >= 0, index: shutdownIndex },
  };

  return stages;
}

export function evaluateOfficialCloseout(params: {
  reservation: GenericRow;
  profile: GenericRow;
  dispatchPackage: GenericRow | null;
  activeFlight?: AcarsFlightInput | null;
  preparedDispatch?: PreparedDispatchInput | null;
  report?: AcarsReportInput | null;
  telemetryLog?: AcarsTelemetrySample[] | null;
  lastSimData?: AcarsTelemetrySample | null;
  damageEvents?: AircraftDamageEventInput[] | null;
  closeoutPayload?: AcarsCloseoutPayloadInput | null;
}): OfficialScoringResult {
  const reservation = params.reservation;
  const profile = params.profile;
  const dispatchPackage = params.dispatchPackage;
  const report = params.report ?? null;
  const activeFlight = params.activeFlight ?? null;
  const preparedDispatch = params.preparedDispatch ?? null;
  const samples = [...(params.telemetryLog ?? [])]
    .filter(Boolean)
    .sort((left, right) => new Date(asText(left.capturedAtUtc)).getTime() - new Date(asText(right.capturedAtUtc)).getTime());
  const lastSample = params.lastSimData ?? samples.at(-1) ?? null;
  const damageEvents = params.damageEvents ?? [];
  const closeoutPayload = params.closeoutPayload ?? null;
  const rawPirepXml = asText(closeoutPayload?.pirepXmlContent);
  const rawPirepFileName = asText(closeoutPayload?.pirepFileName);
  const rawPirepChecksum = asText(closeoutPayload?.pirepChecksumSha256);
  const rawLogEvents = extractPirepLogEvents(rawPirepXml);
  const stages = buildStageBreakdown(samples);
  const damageSummary = summarizeDamage(damageEvents);
  const penalties: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const manualReviewReasons: string[] = [];
  const evidenceWarnings: string[] = [];

  let procedureScore = 100;
  let missionScore = 100;
  let safetyScore = 100;
  let efficiencyScore = 100;

  const requestedCloseoutStatus = asText(report?.remarks).toLowerCase().startsWith("closeout:")
    ? asText(report?.remarks).slice("closeout:".length).toLowerCase()
    : "";
  const severeDamage = asNumber(damageSummary.severe_count) > 0 || requestedCloseoutStatus === "crashed";
  const crashEvent = damageEvents.some((event) => asText(event.eventCode).toLowerCase().includes("crash"));
  const touchdownVsAbs = Math.abs(asNumber(lastSample?.landingVS) || asNumber(report?.landingVS));
  const hardLanding = touchdownVsAbs >= 1000;
  const routeMismatch =
    normalizeIcao(reservation.origin_ident) !== normalizeIcao(activeFlight?.departureIcao ?? preparedDispatch?.departureIcao ?? report?.departureIcao) ||
    normalizeIcao(reservation.destination_ident) !== normalizeIcao(activeFlight?.arrivalIcao ?? preparedDispatch?.arrivalIcao ?? report?.arrivalIcao);

  const reservationId = asText(reservation.id);
  const hasReservationId = reservationId.length > 0;
  const hasCloseoutPayload = Boolean(closeoutPayload) || rawPirepXml.length > 0;
  const telemetrySamples = samples.length;
  const airborneSamples = samples.filter((sample) => !asBoolean(sample.onGround)).length;
  const hasTelemetryEvidence = telemetrySamples >= 4;
  const hasElapsedByReport = Math.max(0, Math.round((new Date(asText(report?.arrivalTime)).getTime() - new Date(asText(report?.departureTime)).getTime()) / 1000));
  const hasElapsedBySamples = telemetrySamples >= 2
    ? Math.max(0, Math.round((new Date(asText(samples.at(-1)?.capturedAtUtc)).getTime() - new Date(asText(samples[0]?.capturedAtUtc)).getTime()) / 1000))
    : 0;
  const elapsedSeconds = Math.max(hasElapsedByReport, hasElapsedBySamples);
  const minimumElapsedSeconds = 120;
  const hasElapsedEvidence = elapsedSeconds >= minimumElapsedSeconds;
  const reportDistanceNm = Math.max(0, asNumber(report?.distance), asNumber(reservation.distance_nm));
  const hasAirborneEvidence = airborneSamples > 0 || stages.takeoff.reached || stages.landing.reached;
  const hasMovementEvidence = reportDistanceNm > 1 || hasAirborneEvidence;
  const invalidAcarsCloseoutStatuses = new Set(["queued_retry", "pending", "pending_sync", "retry_pending", "error", "failed"]);
  const closeoutStatusCompatible = requestedCloseoutStatus.length === 0 || !invalidAcarsCloseoutStatuses.has(requestedCloseoutStatus);

  if (!hasReservationId) evidenceWarnings.push("missing_reservation_id");
  if (!hasCloseoutPayload) evidenceWarnings.push("missing_closeout_payload");
  if (!hasTelemetryEvidence) evidenceWarnings.push("no_measured_data");
  if (!hasElapsedEvidence) evidenceWarnings.push("no_elapsed_time");
  if (!hasMovementEvidence) evidenceWarnings.push("no_airborne_evidence");
  if (!closeoutStatusCompatible) evidenceWarnings.push("closeout_status_not_compatible");

  const evidenceOk = evidenceWarnings.length === 0;

  if (routeMismatch) {
    missionScore -= 20;
    manualReviewReasons.push("origin_or_destination_mismatch");
    penalties.push(buildEvent("ROUTE_MISMATCH", "dispatch", "high", "La telemetría no coincide con la reserva/despacho oficial."));
  }

  if (!stages.takeoff.reached) {
    procedureScore -= 12;
  }
  if (!stages.landing.reached && stages.takeoff.reached) {
    missionScore -= 20;
  }
  if (!stages.shutdown.reached) {
    procedureScore -= 8;
    events.push(buildEvent("NO_SHUTDOWN", "shutdown", "medium", "No se detectó shutdown completo."));
  }

  const taxiSpeedExceeded = samples.some((sample) => asBoolean(sample.onGround) && asNumber(sample.groundSpeed) > 30);
  if (taxiSpeedExceeded) {
    procedureScore -= 8;
    safetyScore -= 6;
    penalties.push(buildEvent("TAXI_SPEED", "taxi", "medium", "Se detectó exceso de velocidad en taxi."));
  }

  const overspeed = samples.some((sample) => asNumber(sample.indicatedAirspeed) > 380);
  if (overspeed) {
    safetyScore -= 12;
    penalties.push(buildEvent("OVERSPEED", "airborne", "high", "Se detectó overspeed en vuelo."));
  }

  const pauseDetected = samples.some((sample) => asBoolean(sample.pause));
  if (pauseDetected) {
    safetyScore -= 8;
    efficiencyScore -= 8;
    penalties.push(buildEvent("PAUSE", "general", "medium", "Se detectó pausa del simulador en vuelo."));
  }

  const missingTakeoffLights = samples
    .filter((sample) => !asBoolean(sample.onGround) && asNumber(sample.altitudeAGL) < 1500 && asNumber(sample.indicatedAirspeed) > 80)
    .some((sample) => !asBoolean(sample.landingLightsOn) || !asBoolean(sample.strobeLightsOn) || !asBoolean(sample.navLightsOn));
  if (missingTakeoffLights) {
    procedureScore -= 6;
    penalties.push(buildEvent("TAKEOFF_LIGHTS", "takeoff", "medium", "Despegue sin todas las luces reglamentarias."));
  }

  const badLandingConfig = samples
    .filter((sample) => !asBoolean(sample.onGround) && asNumber(sample.altitudeAGL) > 0 && asNumber(sample.altitudeAGL) < 1200)
    .some((sample) => asNumber(sample.flapsPercent) > 70 && !asBoolean(sample.gearDown));
  if (badLandingConfig) {
    procedureScore -= 10;
    safetyScore -= 10;
    penalties.push(buildEvent("LANDING_CONFIG", "approach", "high", "Configuración de aproximación incoherente."));
  }


  // Reglaje Patagonia Wings server-side. ACARS registra; Web/Supabase evalua oficialmente.
  const firstSampleDate = samples.length ? new Date(asText(samples[0].capturedAtUtc)) : null;
  const sampleSecondsFromStart = (sample: AcarsTelemetrySample) => {
    if (!firstSampleDate) return 0;
    const t = new Date(asText(sample.capturedAtUtc)).getTime();
    return Number.isFinite(t) ? Math.max(0, Math.round((t - firstSampleDate.getTime()) / 1000)) : 0;
  };
  const firstNavOn = samples.find((sample) => asBoolean(sample.navLightsOn));
  const navOnSeconds = firstNavOn ? sampleSecondsFromStart(firstNavOn) : 0;
  if (samples.length && (!firstNavOn || navOnSeconds > 190)) {
    procedureScore -= 3;
    penalties.push(buildEvent("PRE_NAV_LATE", "preflight", "medium", "NAV lights no se encendieron dentro del margen reglamentario de prevuelo."));
  }

  const firstBeaconOn = samples.find((sample) => asBoolean(sample.beaconLightsOn));
  const firstEngineStable = samples.find((sample) => asNumber(sample.engine1N1) >= 20 || asNumber(sample.engine2N1) >= 20 || asNumber(sample.engine3N1) >= 20 || asNumber(sample.engine4N1) >= 20);
  if (firstBeaconOn && firstEngineStable) {
    const beaconToEngineSec = sampleSecondsFromStart(firstEngineStable) - sampleSecondsFromStart(firstBeaconOn);
    if (beaconToEngineSec > 610) {
      procedureScore -= 10;
      penalties.push(buildEvent("PRE_BEACON_ENGINE_TIMEOUT", "preflight", "high", "Arranque iniciado despues de 10 minutos desde BEACON ON."));
    }
  }

  const fuelBeforeNav = firstNavOn
    ? samples
        .filter((sample) => sampleSecondsFromStart(sample) < navOnSeconds)
        .some((sample, index, arr) => index > 0 && asNumber(sample.fuelKg) - asNumber(arr[index - 1].fuelKg) > 10)
    : false;
  if (fuelBeforeNav) {
    procedureScore -= 3;
    penalties.push(buildEvent("PRE_FUEL_BEFORE_NAV", "preflight", "medium", "Carga de combustible detectada antes de NAV ON."));
  }

  const taxiSpeedStrict = samples.some((sample) => asBoolean(sample.onGround) && asNumber(sample.groundSpeed) > 40);
  if (taxiSpeedStrict) {
    procedureScore -= 10;
    safetyScore -= 8;
    penalties.push(buildEvent("TAXI_SPEED_STRONG", "taxi", "high", "Velocidad de taxi supera 25 kt más tolerancia global."));
  }

  const reverseTaxi = samples.some((sample) => asBoolean(sample.onGround) && asBoolean(sample.reverserActive) && asNumber(sample.groundSpeed) > 1);
  if (reverseTaxi) {
    procedureScore -= 8;
    penalties.push(buildEvent("TAXI_REVERSER", "taxi", "high", "Uso de reversa/reversores detectado durante taxi."));
  }

  const airborneIndex = samples.findIndex((sample) => !asBoolean(sample.onGround) && asNumber(sample.altitudeAGL) > 30);
  if (airborneIndex >= 0) {
    const airborneSample = samples[airborneIndex];
    const gearUpSample = samples.slice(airborneIndex).find((sample) => !asBoolean(sample.gearDown));
    if (!gearUpSample || sampleSecondsFromStart(gearUpSample) - sampleSecondsFromStart(airborneSample) > 25) {
      procedureScore -= 5;
      penalties.push(buildEvent("TO_GEAR_UP_LATE", "takeoff", "medium", "Tren no retraído dentro de 20 segundos + margen posterior al airborne."));
    }
  }

  const lowAltitudeOverspeed = samples.some((sample) => !asBoolean(sample.onGround) && asNumber(sample.altitudeFeet) < 10000 && asNumber(sample.indicatedAirspeed) > 265);
  if (lowAltitudeOverspeed) {
    procedureScore -= 5;
    safetyScore -= 5;
    penalties.push(buildEvent("AIR_250_UNDER_10000", "airborne", "medium", "Exceso de 250 kt bajo 10.000 ft considerando tolerancia."));
  }

  const highVerticalSpeed = samples.some((sample) => Math.abs(asNumber(sample.verticalSpeed)) > 6500);
  if (highVerticalSpeed) {
    safetyScore -= 6;
    penalties.push(buildEvent("AIR_VS_LIMIT", "airborne", "medium", "Velocidad vertical supera límite reglamentario con tolerancia."));
  }

  const landingLightsBelow10000 = samples
    .filter((sample) => !asBoolean(sample.onGround) && asNumber(sample.altitudeFeet) < 9500 && asNumber(sample.altitudeAGL) > 500)
    .some((sample) => !asBoolean(sample.landingLightsOn));
  if (landingLightsBelow10000) {
    procedureScore -= 5;
    penalties.push(buildEvent("AIR_LANDING_LIGHTS_10000", "airborne", "medium", "Landing lights apagadas bajo 10.000 ft."));
  }

  const picFailures = Math.max(extractXmlNumber(rawPirepXml, "PICsFailed"), 0);
  const picCount = Math.max(extractXmlNumber(rawPirepXml, "CantidadPICs"), 0);
  if (picFailures > 0) {
    procedureScore -= picFailures * 5;
    penalties.push(buildEvent("CRU_PIC_COM2_FAILED", "cruise", "medium", `PIC COM2 falló ${picFailures} vez/veces.`));
  }
  if (picCount > 0 && picFailures === 0) {
    events.push(buildEvent("CRU_PIC_COM2_OK", "cruise", "info", `PIC COM2 registrado correctamente: ${picCount} check(s).`));
  }

  if (touchdownVsAbs >= 501 && touchdownVsAbs < 1000) {
    safetyScore -= 15;
    penalties.push(buildEvent("LDG_VS_HARD", "landing", "high", "Aterrizaje muy duro por V/S, pero bajo umbral crítico de invalidez."));
  } else if (touchdownVsAbs >= 301) {
    safetyScore -= 8;
    penalties.push(buildEvent("LDG_VS_FIRM", "landing", "medium", "Aterrizaje duro por V/S."));
  }
  // "cancelled" = pilot never left the gate (no takeoff, no taxi).
  // "aborted" = pilot started rolling/taxied but didn't take off.
  const pilotNeverDeparted = !stages.takeoff.reached && !stages.taxi_out.reached;

  let finalStatus: OfficialFlightStatus = severeDamage || crashEvent || hardLanding
    ? "crashed"
    : pilotNeverDeparted
      ? "cancelled"
      : !stages.takeoff.reached && (stages.taxi_out.reached || samples.length > 0)
        ? "aborted"
        : stages.takeoff.reached && (!stages.landing.reached || !stages.shutdown.reached)
          ? "interrupted"
          : stages.shutdown.reached
            ? "completed"
            : "manual_review";

  if (requestedCloseoutStatus === "interrupted" && finalStatus === "manual_review") {
    finalStatus = "interrupted";
  }
  if (requestedCloseoutStatus === "aborted" && finalStatus === "manual_review") {
    finalStatus = "aborted";
  }

  // Verify pilot actually arrived at the planned destination.
  // If the arrival airport doesn't match destination_ident, downgrade to interrupted.
  const reportedArrivalIcao = normalizeIcao(
    activeFlight?.arrivalIcao ?? report?.arrivalIcao ?? preparedDispatch?.arrivalIcao ?? ""
  );
  const plannedDestination = normalizeIcao(reservation.destination_ident);
  const arrivedAtDestination =
    reportedArrivalIcao.length > 0 && reportedArrivalIcao === plannedDestination;

  if (finalStatus === "completed" && !arrivedAtDestination) {
    finalStatus = "interrupted";
    manualReviewReasons.push("destination_not_reached");
    penalties.push(buildEvent("DESTINATION_NOT_REACHED", "landing", "critical", "El vuelo cerró sin llegar al destino planificado. No se otorgan puntos."));
  }

  if (finalStatus === "crashed") {
    safetyScore -= 55;
    missionScore -= 35;
    penalties.push(buildEvent("CRASH", "landing", "critical", "El cierre oficial fue marcado como accidentado."));
  }

  if (!samples.length) {
    manualReviewReasons.push("missing_telemetry");
  }

  if (!evidenceOk) {
    finalStatus = "manual_review";
    manualReviewReasons.push("insufficient_flight_evidence");
  }

  if (finalStatus === "manual_review" || manualReviewReasons.length > 0) {
    safetyScore -= 10;
  }

  // Rule: only completed flights earn points. All other outcomes → zero scores.
  if (finalStatus !== "completed") {
    procedureScore = 0;
    missionScore = 0;
    safetyScore = 0;
    efficiencyScore = 0;
    penalties.push(buildEvent("NO_SCORE", "general", "critical", `Vuelo cerrado como "${finalStatus}". No se otorgan puntos. El vuelo debe completarse y aterrizar en el destino planificado.`));
  }

  const fuelStartKg = asNumber(samples[0]?.fuelKg) || asNumber(preparedDispatch?.fuelPlannedKg);
  const fuelEndKg = asNumber(lastSample?.fuelKg);
  const fuelUsedKg =
    asNumber(report?.fuelUsed) > 0
      ? asNumber(report?.fuelUsed) * 0.45359237
      : Math.max(0, fuelStartKg - fuelEndKg);

  const startTime = asText(samples[0]?.capturedAtUtc) || asText(report?.departureTime);
  const endTime = asText(lastSample?.capturedAtUtc) || asText(report?.arrivalTime) || new Date().toISOString();
  const actualBlockMinutes = Math.max(
    1,
    Math.round((new Date(endTime).getTime() - new Date(startTime || endTime).getTime()) / 60000)
  );

  const stageReachedCount = Object.values(stages).filter((stage) => asBoolean(stage.reached)).length;
  const stageRatio = stageReachedCount / Object.keys(stages).length;
  missionScore = Math.round((missionScore * 0.6) + stageRatio * 40);

  const avgFuelFlow = samples.length
    ? samples.reduce((sum, sample) => sum + asNumber(sample.fuelFlowLbsHour), 0) / samples.length
    : 0;
  if (avgFuelFlow > 5000) {
    efficiencyScore -= 8;
    penalties.push(buildEvent("FUEL_FLOW", "cruise", "medium", "Consumo elevado durante la operación."));
  }

  const maxAltitudeFeet = Math.max(...samples.map((sample) => asNumber(sample.altitudeFeet)), asNumber(report?.maxAltitudeFeet));
  const maxSpeedKts = Math.max(...samples.map((sample) => asNumber(sample.indicatedAirspeed)), asNumber(report?.maxSpeedKts));
  const landingVsFpm = Math.max(Math.abs(asNumber(report?.landingVS)), ...samples.map((sample) => Math.abs(asNumber(sample.landingVS))));
  const landingGForce = Math.max(asNumber(report?.landingG), ...samples.map((sample) => asNumber(sample.landingG)));

  const completedAt = endTime;
  // For completed flights, use the actual arrival airport.
  // For interrupted flights that took off, use the reported arrival if available (pilot diverted/emergency).
  // For cancelled/aborted (never departed or never took off), use origin — aircraft didn't move.
  const reportedActualArrival = normalizeIcao(activeFlight?.arrivalIcao ?? report?.arrivalIcao ?? "");
  const aircraftLocation =
    finalStatus === "completed"
      ? normalizeIcao(activeFlight?.arrivalIcao ?? preparedDispatch?.arrivalIcao ?? reservation.destination_ident)
      : finalStatus === "interrupted" && reportedActualArrival
        ? reportedActualArrival
        : normalizeIcao(reservation.origin_ident);
  const aircraftStatus = finalStatus === "crashed" ? "maintenance" : "available";

  const healthPenalty = finalStatus === "crashed" ? 45 : severeDamage ? 25 : asNumber(damageSummary.events_count) * 3;
  const currentOverall = 100;
  const nextOverall = clamp(currentOverall - healthPenalty, 0, 100);
  const aircraftConditionPatch = {
    overall_health: nextOverall,
    engine_health: clamp(100 - healthPenalty * 0.7, 0, 100),
    fuselage_health: clamp(100 - healthPenalty, 0, 100),
    gear_health: clamp(100 - (hardLanding ? 30 : healthPenalty * 0.5), 0, 100),
    maintenance_required: finalStatus === "crashed" || severeDamage,
    maintenance_reason:
      finalStatus === "crashed"
        ? "Accidente detectado por cierre oficial ACARS."
        : severeDamage
          ? "Daño severo detectado por cierre oficial ACARS."
          : null,
  };

  const evaluationStatus: "evaluable" | "no_evaluable" = evidenceOk ? "evaluable" : "no_evaluable";
  const scoringStatus = evaluationStatus === "no_evaluable"
    ? "pending_server_closeout"
    : (finalStatus === "manual_review" || manualReviewReasons.length > 0 ? "manual_review" : "scored");
  const economyEligible = finalStatus === "completed" && evaluationStatus === "evaluable";
  const finalScore = clamp(
    procedureScore * 0.35 + missionScore * 0.25 + safetyScore * 0.25 + efficiencyScore * 0.15,
    0,
    100
  );

  const officialPirep: Record<string, unknown> = {
    hidden: true,
    generated_at: completedAt,
    pilot_callsign: asText(profile.callsign),
    reservation_id: asText(reservation.id),
    flight_number: asText(activeFlight?.flightNumber ?? report?.flightNumber ?? reservation.route_code),
    route_code: asText(reservation.route_code),
    origin_icao: normalizeIcao(activeFlight?.departureIcao ?? report?.departureIcao ?? reservation.origin_ident),
    destination_icao: normalizeIcao(activeFlight?.arrivalIcao ?? report?.arrivalIcao ?? reservation.destination_ident),
    aircraft_type_code: asText(reservation.aircraft_type_code || activeFlight?.aircraftTypeCode || activeFlight?.aircraftIcao),
    aircraft_registration: asText(reservation.aircraft_registration),
    status: finalStatus,
    block_minutes: actualBlockMinutes,
    distance_nm: asNumber(report?.distance),
    fuel_used_kg: Math.round(fuelUsedKg),
    final_score: finalScore,
    scoring_status: scoringStatus,
    evaluation_status: evaluationStatus,
    economy_eligible: economyEligible,
  };

  if (rawPirepFileName) officialPirep["pirep_file_name"] = rawPirepFileName;
  if (rawPirepChecksum) officialPirep["pirep_checksum"] = rawPirepChecksum;


  events.push(
    ...Object.entries(stages)
      .filter(([, value]) => asBoolean(value.reached))
      .map(([key, value]) =>
        buildEvent(
          `STAGE_${key.toUpperCase()}`,
          key,
          "info",
          `Etapa ${key} detectada oficialmente.`,
          { index: asNumber(value.index) }
        )
      )
  );
  events.push(
    ...damageEvents.map((event) =>
      buildEvent(
        asText(event.eventCode) || "DAMAGE_EVENT",
        asText(event.phase) || "unknown",
        asText(event.severity) || "medium",
        "Evento de daño recibido desde ACARS.",
        { details: asObject(event.details), captured_at_utc: asText(event.capturedAtUtc) }
      )
    )
  );
  if (rawLogEvents.length) {
    events.push(...rawLogEvents);
  }

  return {
    finalStatus,
    evaluationStatus,
    economyEligible,
    evidenceWarnings,
    evidenceSnapshot: {
      reservation_id: reservationId,
      telemetry_samples: telemetrySamples,
      airborne_samples: airborneSamples,
      elapsed_seconds: elapsedSeconds,
      minimum_elapsed_seconds: minimumElapsedSeconds,
      distance_nm: reportDistanceNm,
      closeout_status: requestedCloseoutStatus,
      has_closeout_payload: hasCloseoutPayload,
    },
    procedureScore: clamp(procedureScore, 0, 100),
    missionScore: clamp(missionScore, 0, 100),
    safetyScore: clamp(safetyScore, 0, 100),
    efficiencyScore: clamp(efficiencyScore, 0, 100),
    finalScore,
    scoringStatus,
    penaltiesJson: penalties,
    eventsJson: events,
    stageBreakdownJson: stages,
    officialPirep,
    damageSummary,
    actualBlockMinutes,
    fuelStartKg: Math.round(fuelStartKg),
    fuelEndKg: Math.round(fuelEndKg),
    fuelUsedKg: Math.round(fuelUsedKg),
    maxAltitudeFeet: Math.round(maxAltitudeFeet),
    maxSpeedKts: Math.round(maxSpeedKts),
    landingVsFpm: Math.round(landingVsFpm),
    landingGForce: Number(landingGForce.toFixed(2)),
    routeMismatch,
    manualReviewReasons,
    aircraftLocation,
    aircraftStatus,
    aircraftConditionPatch,
  };
}

export async function persistOfficialCloseout(params: {
  accessToken: string;
  user: User;
  profile: GenericRow;
  reservation: GenericRow;
  dispatchPackage: GenericRow | null;
  aircraft: GenericRow | null;
  aircraftCondition: GenericRow | null;
  activeFlight?: AcarsFlightInput | null;
  preparedDispatch?: PreparedDispatchInput | null;
  report?: AcarsReportInput | null;
  telemetryLog?: AcarsTelemetrySample[] | null;
  lastSimData?: AcarsTelemetrySample | null;
  damageEvents?: AircraftDamageEventInput[] | null;
  closeoutPayload?: AcarsCloseoutPayloadInput | null;
}) {
  const official = evaluateOfficialCloseout(params);
  const supabase = createSupabaseServerClient(params.accessToken);
  const accountingSupabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const reservationId = asText(params.reservation.id);
  const existingPayload = asObject(params.reservation.score_payload);
  const existingEconomyAccounting = asObject(existingPayload.economy_accounting);
  const rewardsAlreadyApplied = Boolean(asText(existingEconomyAccounting.pilot_rewards_applied_at));
  const rawPirepXml = asText(params.closeoutPayload?.pirepXmlContent);
  const rawPirepFileName = asText(params.closeoutPayload?.pirepFileName);
  const rawPirepChecksum = asText(params.closeoutPayload?.pirepChecksumSha256);
  const evaluatedPirepXml = buildEvaluatedPirepXml(rawPirepXml, official, reservationId);

  const officialPayload = {
    ...existingPayload,
    official_closeout: {
      status: official.finalStatus,
      scoring_status: official.scoringStatus,
      completed_at: nowIso,
      pilot_id: params.user.id,
      pilot_callsign: asText(params.profile.callsign),
    },
    official_pirep: official.officialPirep,
    raw_pirep_xml: rawPirepXml,
    raw_pirep_file_name: rawPirepFileName,
    raw_pirep_checksum: rawPirepChecksum,
    evaluated_pirep_xml: evaluatedPirepXml,
    penalties_json: official.penaltiesJson,
    events_json: official.eventsJson,
    stage_breakdown_json: official.stageBreakdownJson,
    damage_summary: official.damageSummary,
    raw_telemetry_summary: {
      samples: (params.telemetryLog ?? []).length,
      first_sample_at: asText(params.telemetryLog?.[0]?.capturedAtUtc),
      last_sample_at: asText(params.lastSimData?.capturedAtUtc ?? params.telemetryLog?.at(-1)?.capturedAtUtc),
    },
    procedure_score: official.procedureScore,
    mission_score: official.missionScore,
    safety_score: official.safetyScore,
    efficiency_score: official.efficiencyScore,
    final_score: official.finalScore,
    scoring_status: official.scoringStatus,
    manual_review_reasons: official.manualReviewReasons,
    evaluation_status: official.evaluationStatus,
    economy_eligible: official.economyEligible,
    closeout_warnings: official.evidenceWarnings,
    closeout_evidence: official.evidenceSnapshot,
    fuel_start_kg: official.fuelStartKg,
    fuel_end_kg: official.fuelEndKg,
    fuel_used_kg: official.fuelUsedKg,
    landing_vs_fpm: official.landingVsFpm,
    landing_g_force: official.landingGForce,
    max_altitude_ft: official.maxAltitudeFeet,
    max_speed_kts: official.maxSpeedKts,
  };

  // Admin client bypasses RLS and is required for the authoritative status update.
  // scoring_status: 'manual_review' is now valid per migration fix_scoring_status_check_constraint.
  const { data: updatedReservation, error: reservationError } = await accountingSupabase
    .from("flight_reservations")
    .update({
      status: official.finalStatus,
      completed_at: nowIso,
      actual_block_minutes: official.actualBlockMinutes,
      procedure_score: official.procedureScore,
      performance_score: official.finalScore,
      procedure_grade: official.scoringStatus === "manual_review" ? "Manual Review" : `${official.procedureScore}`,
      performance_grade: official.scoringStatus === "manual_review" ? "Manual Review" : `${official.finalScore}`,
      mission_score: official.missionScore,
      scoring_status: official.scoringStatus,
      scoring_applied_at: nowIso,
      score_payload: officialPayload,
      updated_at: nowIso,
    })
    .eq("id", reservationId)
    .select("*")
    .maybeSingle();

  if (reservationError || !updatedReservation) {
    throw new Error(reservationError?.message ?? "No se pudo persistir el cierre oficial en flight_reservations.");
  }

  // dispatch_packages.dispatch_status only accepts: pending, prepared, released, cancelled, dispatched.
  // Map all non-completed flight outcomes to "cancelled" to free the dispatch slot.
  const dispatchClosureStatus = official.finalStatus === "completed" ? "dispatched" : "cancelled";

  const dispatchPackageId = asText(params.dispatchPackage?.id ?? params.dispatchPackage?.reservation_id);
  if (dispatchPackageId || params.dispatchPackage) {
    await supabase
      .from("dispatch_packages")
      .update({
        dispatch_status: dispatchClosureStatus,
        updated_at: nowIso,
      })
      .eq("reservation_id", reservationId);
  }

  const currentHours = asNumber(params.profile.total_hours);
  const currentCareerHours = asNumber(params.profile.career_hours);
  const blockHours = Number((official.actualBlockMinutes / 60).toFixed(2));

  // Commission payment on completed flights
  let commissionUsd = 0;
  let damageDeductionUsd = 0;
  let salaryAccrued = false;
  let ledgerWritten = false;

  if (official.economyEligible) {
    const distanceNm = asNumber(params.reservation.distance_nm ?? params.report?.distance ?? 0);
    const aircraftTypeCode = asText(params.reservation.aircraft_type_code ?? params.activeFlight?.aircraftTypeCode);
    const flightModeCode = asText(params.reservation.flight_mode_code ?? params.activeFlight?.flightModeCode ?? "CAREER");

    commissionUsd = calculateFlightCommission({
      distanceNm,
      blockMinutes: official.actualBlockMinutes,
      aircraftTypeCode,
      flightModeCode,
    });

    damageDeductionUsd = calculateDamageDeduction(
      (params.damageEvents ?? []).map((e) => ({ severity: asText(e.severity) || null })),
      aircraftTypeCode
    );

    const pilotProfilePatch = rewardsAlreadyApplied
      ? {
          current_airport_code: official.aircraftLocation,
          current_airport_icao: official.aircraftLocation,
          updated_at: nowIso,
        }
      : {
          current_airport_code: official.aircraftLocation,
          current_airport_icao: official.aircraftLocation,
          total_hours: currentHours + blockHours,
          career_hours: currentCareerHours + blockHours,
          updated_at: nowIso,
        };

    await supabase
      .from("pilot_profiles")
      .update(pilotProfilePatch)
      .eq("id", params.user.id);

    await supabase
      .from("flight_reservations")
      .update({
        commission_usd: commissionUsd,
        damage_deduction_usd: damageDeductionUsd,
      })
      .eq("id", reservationId);
  } else {
    await supabase
      .from("pilot_profiles")
      .update({
        current_airport_code: official.aircraftLocation,
        current_airport_icao: official.aircraftLocation,
        total_hours: currentHours,
        career_hours: currentCareerHours,
        updated_at: nowIso,
      })
      .eq("id", params.user.id);
  }

  const aircraftId = asText(params.reservation.aircraft_id ?? params.activeFlight?.aircraftId);
  if (aircraftId) {
    await supabase
      .from("aircraft")
      .update({
        current_airport_code: official.aircraftLocation,
        current_airport_icao: official.aircraftLocation,
        status: official.aircraftStatus,
        updated_at: nowIso,
      })
      .eq("id", aircraftId);

    await supabase
      .from("aircraft_condition")
      .upsert(
        {
          aircraft_id: aircraftId,
          ...official.aircraftConditionPatch,
          updated_at: nowIso,
        },
        { onConflict: "aircraft_id" }
      );
  }

  await maybeUpsert("pw_flight_score_reports", {
    reservation_id: reservationId,
    pilot_callsign: asText(params.profile.callsign),
    route_code: asText(params.reservation.route_code),
    procedure_score: official.procedureScore,
    performance_score: official.finalScore,
    procedure_grade: official.scoringStatus === "manual_review" ? "Manual Review" : `${official.procedureScore}`,
    performance_grade: official.scoringStatus === "manual_review" ? "Manual Review" : `${official.finalScore}`,
    mission_score: official.missionScore,
    score_payload: officialPayload,
    notes: asText(params.report?.remarks),
    scored_at: nowIso,
  }, "reservation_id");

  await maybeUpsert("pirep_reports", {
    reservation_id: reservationId,
    reference_code: reservationId,
    callsign: asText(params.profile.callsign),
    flight_number: asText(params.activeFlight?.flightNumber ?? params.report?.flightNumber ?? params.reservation.route_code),
    flight_type: asText(params.preparedDispatch?.flightMode ?? params.activeFlight?.flightModeCode ?? params.reservation.flight_mode_code ?? "CAREER"),
    origin_icao: normalizeIcao(params.reservation.origin_ident),
    destination_icao: normalizeIcao(params.reservation.destination_ident),
    aircraft_model: asText(params.reservation.aircraft_type_code),
    aircraft_registration: asText(params.reservation.aircraft_registration),
    created_on_utc: nowIso,
    result_status: official.finalStatus,
    // payload_xml: raw PIREP XML or evaluated fallback (NOT NULL in DB)
    payload_xml: rawPirepXml || evaluatedPirepXml || "<PIREP/>",
    report_json: official.officialPirep,
    raw_pirep_json: { telemetryLog: params.telemetryLog ?? [], lastSimData: params.lastSimData ?? null, closeoutPayload: params.closeoutPayload ?? null },
    evaluation_json: officialPayload,
    pirep_file_name: rawPirepFileName,
    pirep_checksum: rawPirepChecksum,
    pirep_xml_content: rawPirepXml,
    raw_pirep_xml: rawPirepXml,
    evaluated_pirep_xml: evaluatedPirepXml,
    hidden: true,
  }, "reservation_id");

  await maybeInsert(
    "aircraft_damage_events",
    (params.damageEvents ?? []).map((event) => ({
      aircraft_id: aircraftId,
      reservation_id: reservationId,
      event_code: asText(event.eventCode),
      phase: asText(event.phase),
      severity: asText(event.severity) || "medium",
      details: asObject(event.details),
      captured_at_utc: asText(event.capturedAtUtc) || nowIso,
    }))
  );

  await maybeInsert("flight_reservation_audit", {
    reservation_id: reservationId,
    audit_type: "official_closeout",
    actor_type: "acars_backend",
    actor_id: params.user.id,
    payload: officialPayload,
    created_at: nowIso,
  });

  // ── Economy: realistic per-flight accounting and metrics ─────────────────────
  const distanceNm = asNumber(params.report?.distance ?? 0);
  if (official.economyEligible) {
    const aircraftTypeCode = asText(params.reservation.aircraft_type_code ?? params.activeFlight?.aircraftTypeCode);
    const originIcao = normalizeIcao(params.reservation.origin_ident);
    const destinationIcao = normalizeIcao(params.reservation.destination_ident);
    const qualitySeed = reservationId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seeded = (Math.sin(qualitySeed) + 1) / 2;
    const blockPlannedMinutes = asNumber(params.preparedDispatch?.scheduledBlockMinutes ?? params.preparedDispatch?.expectedBlockP50Minutes ?? 0);
    const blockDeviationRatio = blockPlannedMinutes > 0 ? Math.abs(official.actualBlockMinutes - blockPlannedMinutes) / blockPlannedMinutes : 0;
    const fuelPlannedKg = asNumber(params.preparedDispatch?.fuelPlannedKg ?? 0);
    const fuelDeviationRatio = fuelPlannedKg > 0 ? Math.abs(official.fuelUsedKg - fuelPlannedKg) / fuelPlannedKg : 0;
    const scorePenalty = Math.max(0, 85 - asNumber(official.procedureScore)) / 100;
    const damagePenalty = damageDeductionUsd > 0 ? 0.45 : 0;
    const operationalPenalty = Math.min(0.7, blockDeviationRatio * 0.4 + fuelDeviationRatio * 0.35 + scorePenalty + damagePenalty);
    const operationalBonus = Math.max(0, (asNumber(official.procedureScore) - 92) / 120 + (0.5 - Math.abs(seeded - 0.5)) * 0.08);
    const onboardSalesFactor = Math.max(0, Math.min(1.2, 0.92 + operationalBonus - operationalPenalty));
    const onboardServiceQualityFactor = Math.max(0.2, Math.min(1.2, 0.96 + operationalBonus - operationalPenalty * 0.8));
    const salesQualityReason = damageDeductionUsd > 0
      ? "Daños o incidente detectado: ventas/servicio reducidos"
      : operationalPenalty > 0.28
        ? "Condiciones operacionales exigentes: ajuste negativo de ventas"
        : operationalBonus > 0.08
          ? "Vuelo estable y eficiente: ventas sobre estimado"
          : "Vuelo normal: ventas dentro de rango esperado";
    const economy = estimateFlightEconomy({
      distanceNm,
      blockMinutes: official.actualBlockMinutes,
      aircraftTypeCode,
      operationType: asText(params.preparedDispatch?.flightMode ?? params.activeFlight?.flightModeCode ?? params.reservation.flight_mode_code ?? "CAREER"),
      originIcao,
      destinationIcao,
      passengerCount: params.preparedDispatch?.passengerCount ?? null,
      cargoKg: params.preparedDispatch?.cargoKg ?? null,
      actualFuelKg: official.fuelUsedKg,
      damageCostUsd: damageDeductionUsd,
      economySource: "actual",
      onboardSalesFactor,
      onboardServiceQualityFactor,
    });
    const fuelCostUsd = economy.fuelCostUsd;
    const maintenanceCostUsd = economy.maintenanceCostUsd;
    const airlineRevenueUsd = economy.airlineRevenueUsd;
    const airportFeesUsd = economy.airportFeesUsd;
    const handlingCostUsd = economy.handlingCostUsd;
    const repairReserveUsd = economy.repairReserveUsd;
    const totalCosts = economy.totalCostUsd;
    const netFlight = economy.netProfitUsd;

    await supabase
      .from("flight_reservations")
      .update({
        distance_nm: distanceNm > 0 ? distanceNm : null,
        fuel_cost_usd: fuelCostUsd,
        maintenance_cost_usd: maintenanceCostUsd,
        airline_revenue_usd: airlineRevenueUsd,
        airport_fees_usd: airportFeesUsd,
        handling_cost_usd: handlingCostUsd,
        repair_reserve_usd: repairReserveUsd,
        onboard_service_revenue_usd: economy.onboardServiceRevenueUsd,
        onboard_sales_revenue_usd: economy.onboardSalesRevenueUsd,
        onboard_service_cost_usd: economy.onboardServiceCostUsd,
        passenger_revenue_usd: economy.passengerRevenueUsd,
        cargo_revenue_usd: economy.cargoRevenueUsd,
        total_cost_usd: totalCosts,
        net_profit_usd: netFlight,
        estimated_passengers: economy.estimatedPassengers,
        estimated_cargo_kg: economy.estimatedCargoKg,
      })
      .eq("id", reservationId);

    const economySnapshotPayload = {
      reservation_id: reservationId,
      flight_number: asText(params.activeFlight?.flightNumber ?? params.report?.flightNumber ?? params.reservation.route_code),
      pilot_id: params.user.id,
      pilot_callsign: asText(params.profile.callsign),
      aircraft_id: asText(params.reservation.aircraft_id ?? params.activeFlight?.aircraftId) || null,
      aircraft_registration: asText(params.reservation.aircraft_registration),
      aircraft_type: aircraftTypeCode,
      operation_type: asText(params.preparedDispatch?.flightMode ?? params.activeFlight?.flightModeCode ?? params.reservation.flight_mode_code ?? "CAREER"),
      origin_icao: originIcao,
      destination_icao: destinationIcao,
      distance_nm: economy.distanceNm,
      block_minutes_estimated: economy.blockMinutes,
      block_minutes_actual: official.actualBlockMinutes,
      estimated_passengers: economy.estimatedPassengers,
      estimated_cargo_kg: economy.estimatedCargoKg,
      fuel_kg_estimated: economy.fuelKg,
      fuel_kg_actual: official.fuelUsedKg,
      fuel_liters_estimated: economy.fuelLiters,
      fuel_price_usd: economy.fuelPriceUsdPerKg,
      fuel_cost_usd: fuelCostUsd,
      passenger_revenue_usd: economy.passengerRevenueUsd,
      cargo_revenue_usd: economy.cargoRevenueUsd,
      onboard_service_revenue_usd: economy.onboardServiceRevenueUsd,
      onboard_sales_revenue_usd: economy.onboardSalesRevenueUsd,
      onboard_service_cost_usd: economy.onboardServiceCostUsd,
      airline_revenue_usd: airlineRevenueUsd,
      pilot_payment_usd: commissionUsd,
      maintenance_cost_usd: maintenanceCostUsd,
      repair_cost_usd: damageDeductionUsd,
      airport_fees_usd: airportFeesUsd,
      handling_cost_usd: handlingCostUsd,
      total_cost_usd: totalCosts,
      net_profit_usd: netFlight,
      profit_margin_pct: economy.profitMarginPct,
      economy_source: "actual",
      created_at: nowIso,
      metadata: {
        ...economy,
        onboard_sales_factor: onboardSalesFactor,
        onboard_service_quality_factor: onboardServiceQualityFactor,
        onboard_quality_reason: salesQualityReason,
        planned_block_minutes: blockPlannedMinutes || null,
        planned_fuel_kg: fuelPlannedKg || null,
        block_deviation_ratio: blockDeviationRatio,
        fuel_deviation_ratio: fuelDeviationRatio,
      },
    };

    await maybeUpsertReservationRow("flight_economy_snapshots", reservationId, economySnapshotPayload);

    const pilotCallsign = asText(params.profile.callsign);
    const airlineRow = await accountingSupabase.from("airlines").select("id").limit(1).maybeSingle();
    const airlineId = asText(airlineRow.data?.id) || null;
    if (airlineId) {
      const ledgerEntries = [
        { airline_id: airlineId, entry_type: "passenger_revenue", amount_usd: economy.passengerRevenueUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Ingreso pasajeros ${originIcao}-${destinationIcao}`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "cargo_revenue", amount_usd: economy.cargoRevenueUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Ingreso carga ${originIcao}-${destinationIcao}`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "onboard_service_revenue", amount_usd: economy.onboardServiceRevenueUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Servicio a bordo ${originIcao}-${destinationIcao}`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "onboard_sales_revenue", amount_usd: economy.onboardSalesRevenueUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Ventas catalogo a bordo ${originIcao}-${destinationIcao}`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "fuel_cost", amount_usd: -fuelCostUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Combustible ${official.fuelUsedKg} kg`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "maintenance_cost", amount_usd: -maintenanceCostUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Mantenimiento ${(official.actualBlockMinutes / 60).toFixed(1)} h block`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "airport_fees", amount_usd: -airportFeesUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Tasas aeroportuarias ${originIcao}-${destinationIcao}`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "handling_cost", amount_usd: -handlingCostUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Handling y rampa ${originIcao}-${destinationIcao}`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "onboard_service_cost", amount_usd: -economy.onboardServiceCostUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Costo servicio a bordo ${originIcao}-${destinationIcao}`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "pilot_payment", amount_usd: -commissionUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: `Pago piloto ${pilotCallsign}`, metadata: economy, created_at: nowIso },
        { airline_id: airlineId, entry_type: "repair_reserve", amount_usd: -repairReserveUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: "Reserva técnica de reparación/desgaste", metadata: economy, created_at: nowIso },
      ];
      if (damageDeductionUsd > 0) {
        ledgerEntries.push({ airline_id: airlineId, entry_type: "repair_cost", amount_usd: -damageDeductionUsd, reservation_id: reservationId, pilot_callsign: pilotCallsign, description: "Reparacion por daño en vuelo", metadata: economy, created_at: nowIso });
      }
      await maybeDeleteByReservationId("airline_ledger", reservationId);
      await maybeInsert("airline_ledger", ledgerEntries);
      await maybeRecalculateAirlineBalance(airlineId);
      ledgerWritten = true;
    }
    // ── Monthly payroll ledger entry ───────────────────────────────────────────
    if (!rewardsAlreadyApplied) {
      const now = new Date(nowIso);
      const periodYear = now.getUTCFullYear();
      const periodMonth = now.getUTCMonth() + 1;
      const { data: existingLedger } = await accountingSupabase
        .from("pilot_salary_ledger")
        .select("id, flights_count, commission_total_usd, damage_deductions_usd, net_paid_usd, block_hours_total")
        .eq("pilot_id", params.user.id)
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth)
        .maybeSingle();

      if (existingLedger) {
        await accountingSupabase
          .from("pilot_salary_ledger")
          .update({
            flights_count: asNumber(existingLedger.flights_count) + 1,
            commission_total_usd: asNumber(existingLedger.commission_total_usd) + commissionUsd,
            damage_deductions_usd: asNumber(existingLedger.damage_deductions_usd) + damageDeductionUsd,
            net_paid_usd: asNumber(existingLedger.net_paid_usd) + commissionUsd - damageDeductionUsd,
            block_hours_total: asNumber(existingLedger.block_hours_total) + blockHours,
            pilot_callsign: asText(params.profile.callsign) || null,
          })
          .eq("id", existingLedger.id);
      } else {
        await accountingSupabase.from("pilot_salary_ledger").insert({
          pilot_id: params.user.id,
          pilot_callsign: asText(params.profile.callsign) || null,
          period_year: periodYear,
          period_month: periodMonth,
          flights_count: 1,
          commission_total_usd: commissionUsd,
          damage_deductions_usd: damageDeductionUsd,
          base_salary_usd: 0,
          net_paid_usd: commissionUsd - damageDeductionUsd,
          block_hours_total: blockHours,
          status: "pending",
        });
      }
      salaryAccrued = true;
    }

    const economyAccountingPayload = {
      ...officialPayload,
      economy_accounting: {
        ...existingEconomyAccounting,
        accounting_applied_at: nowIso,
        pilot_rewards_applied_at: rewardsAlreadyApplied ? asText(existingEconomyAccounting.pilot_rewards_applied_at) || nowIso : nowIso,
        version: "economy-closeout-v1",
        reservation_id: reservationId,
        net_profit_usd: netFlight,
        pilot_payment_usd: commissionUsd,
        total_cost_usd: totalCosts,
        airline_revenue_usd: airlineRevenueUsd,
      },
    };

    await supabase
      .from("flight_reservations")
      .update({ score_payload: economyAccountingPayload })
      .eq("id", reservationId);
  } else {
    const noEvaluableSnapshot = {
      reservation_id: reservationId,
      flight_number: asText(params.activeFlight?.flightNumber ?? params.report?.flightNumber ?? params.reservation.route_code),
      pilot_id: params.user.id,
      pilot_callsign: asText(params.profile.callsign),
      aircraft_id: asText(params.reservation.aircraft_id ?? params.activeFlight?.aircraftId) || null,
      aircraft_registration: asText(params.reservation.aircraft_registration),
      aircraft_type: asText(params.reservation.aircraft_type_code ?? params.activeFlight?.aircraftTypeCode),
      operation_type: asText(params.preparedDispatch?.flightMode ?? params.activeFlight?.flightModeCode ?? params.reservation.flight_mode_code ?? "CAREER"),
      origin_icao: normalizeIcao(params.reservation.origin_ident),
      destination_icao: normalizeIcao(params.reservation.destination_ident),
      distance_nm: distanceNm > 0 ? distanceNm : null,
      block_minutes_estimated: asNumber(params.preparedDispatch?.scheduledBlockMinutes ?? params.preparedDispatch?.expectedBlockP50Minutes ?? 0),
      block_minutes_actual: official.actualBlockMinutes,
      fuel_kg_actual: official.fuelUsedKg,
      pilot_payment_usd: 0,
      total_cost_usd: 0,
      net_profit_usd: 0,
      economy_source: "actual",
      created_at: nowIso,
      metadata: {
        evaluation_status: official.evaluationStatus,
        economy_eligible: false,
        closeout_warnings: official.evidenceWarnings,
        closeout_evidence: official.evidenceSnapshot,
      },
    };
    await maybeUpsertReservationRow("flight_economy_snapshots", reservationId, noEvaluableSnapshot);
  }

  return {
    reservation: updatedReservation as GenericRow,
    official,
    evaluationStatus: official.evaluationStatus,
    economyEligible: official.economyEligible,
    salaryAccrued,
    ledgerWritten,
    warnings: official.evidenceWarnings,
    resultUrl: `/flights/${reservationId}`,
  };
}

/** Estimated hourly wear cost (USD) by aircraft category */
function estimateWearCostPerHour(aircraftTypeCode: string): number {
  const category = aircraftTypeCode
    ? (["B777","B787","B747","A350","A380","A330","A340","B767","B752"].some((c) => aircraftTypeCode.toUpperCase().startsWith(c))
        ? "widebody"
        : ["B737","B738","A319","A320","A321","B757"].some((c) => aircraftTypeCode.toUpperCase().startsWith(c))
          ? "narrowbody"
          : ["CRJ","E170","E175","E190","DH8","AT7","SF34","C208","PC12"].some((c) => aircraftTypeCode.toUpperCase().startsWith(c))
            ? "regional"
            : "ga")
    : "ga";
  const rates: Record<string, number> = { widebody: 180, narrowbody: 90, regional: 45, ga: 20 };
  return rates[category] ?? 45;
}
