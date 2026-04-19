import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  engine1N1?: number | null;
  engine2N1?: number | null;
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
  procedureScore: number;
  missionScore: number;
  safetyScore: number;
  efficiencyScore: number;
  finalScore: number;
  scoringStatus: "scored" | "manual_review";
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

function isMissingRelationError(error: unknown) {
  const payload = asObject(error);
  const code = asText(payload.code);
  const message = `${asText(payload.message)} ${asText(payload.details)} ${asText(payload.hint)}`.toLowerCase();
  return code === "PGRST205" || message.includes("could not find the table") || message.includes("relation") || message.includes("schema cache");
}

async function maybeInsert(table: string, payload: Record<string, unknown> | Record<string, unknown>[]) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from(table).insert(payload);
  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

async function maybeUpsert(table: string, payload: Record<string, unknown>, onConflict?: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from(table).upsert(payload, onConflict ? { onConflict } : undefined);
  if (error && !isMissingRelationError(error)) {
    throw error;
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
  const shutdownIndex = getStageIndex(
    samples,
    (sample, index) =>
      index >= Math.max(0, taxiInIndex) &&
      asBoolean(sample.onGround) &&
      asBoolean(sample.parkingBrake) &&
      asNumber(sample.groundSpeed) < 1 &&
      asNumber(sample.engine1N1) < 20 &&
      asNumber(sample.engine2N1) < 20
  );

  const hasTaxiOut = samples.some((sample) => asBoolean(sample.onGround) && asNumber(sample.groundSpeed) > 2);
  const hasPreflight = hasSamples;

  const stages: Record<StageName, Record<string, unknown>> = {
    preflight: { reached: hasPreflight, index: hasPreflight ? 0 : -1 },
    taxi_out: { reached: hasTaxiOut, index: hasTaxiOut ? getStageIndex(samples, (sample) => asBoolean(sample.onGround) && asNumber(sample.groundSpeed) > 2) : -1 },
    takeoff: { reached: takeoffIndex >= 0, index: takeoffIndex },
    climb: { reached: climbIndex >= 0, index: climbIndex },
    cruise: { reached: cruiseIndex >= 0, index: cruiseIndex },
    descent: { reached: descentIndex >= 0, index: descentIndex },
    approach: { reached: approachIndex >= 0, index: approachIndex },
    landing: { reached: landingIndex >= 0, index: landingIndex },
    taxi_in: { reached: taxiInIndex >= 0, index: taxiInIndex },
    shutdown: { reached: shutdownIndex >= 0, index: shutdownIndex },
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
  const stages = buildStageBreakdown(samples);
  const damageSummary = summarizeDamage(damageEvents);
  const penalties: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const manualReviewReasons: string[] = [];

  let procedureScore = 100;
  let missionScore = 100;
  let safetyScore = 100;
  let efficiencyScore = 100;

  const requestedCloseoutStatus = asText(report?.remarks).toLowerCase().startsWith("closeout:")
    ? asText(report?.remarks).slice("closeout:".length).toLowerCase()
    : "";
  const severeDamage = asNumber(damageSummary.severe_count) > 0 || requestedCloseoutStatus === "crashed";
  const crashEvent = damageEvents.some((event) => asText(event.eventCode).toLowerCase().includes("crash"));
  const hardLanding = Math.abs(asNumber(lastSample?.landingVS) || asNumber(report?.landingVS)) >= 700;
  const routeMismatch =
    normalizeIcao(reservation.origin_ident) !== normalizeIcao(activeFlight?.departureIcao ?? preparedDispatch?.departureIcao ?? report?.departureIcao) ||
    normalizeIcao(reservation.destination_ident) !== normalizeIcao(activeFlight?.arrivalIcao ?? preparedDispatch?.arrivalIcao ?? report?.arrivalIcao);

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

  let finalStatus: OfficialFlightStatus = severeDamage || crashEvent || hardLanding
    ? "crashed"
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

  if (finalStatus === "crashed") {
    safetyScore -= 55;
    missionScore -= 35;
    penalties.push(buildEvent("CRASH", "landing", "critical", "El cierre oficial fue marcado como accidentado."));
  }

  if (finalStatus === "aborted") {
    missionScore -= 25;
    efficiencyScore -= 10;
  }

  if (finalStatus === "interrupted") {
    missionScore -= 20;
    efficiencyScore -= 15;
  }

  if (!samples.length) {
    manualReviewReasons.push("missing_telemetry");
  }

  if (finalStatus === "manual_review" || manualReviewReasons.length > 0) {
    safetyScore -= 10;
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
  const aircraftLocation = finalStatus === "completed"
    ? normalizeIcao(activeFlight?.arrivalIcao ?? preparedDispatch?.arrivalIcao ?? reservation.destination_ident)
    : normalizeIcao(profile.current_airport_code ?? profile.current_airport_icao ?? reservation.origin_ident);
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

  const scoringStatus = finalStatus === "manual_review" || manualReviewReasons.length > 0 ? "manual_review" : "scored";
  const finalScore = clamp(
    procedureScore * 0.35 + missionScore * 0.25 + safetyScore * 0.25 + efficiencyScore * 0.15,
    0,
    100
  );

  const officialPirep = {
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
  };

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

  return {
    finalStatus,
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
}) {
  const official = evaluateOfficialCloseout(params);
  const supabase = createSupabaseServerClient(params.accessToken);
  const nowIso = new Date().toISOString();
  const reservationId = asText(params.reservation.id);
  const existingPayload = asObject(params.reservation.score_payload);

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
    fuel_start_kg: official.fuelStartKg,
    fuel_end_kg: official.fuelEndKg,
    fuel_used_kg: official.fuelUsedKg,
    landing_vs_fpm: official.landingVsFpm,
    landing_g_force: official.landingGForce,
    max_altitude_ft: official.maxAltitudeFeet,
    max_speed_kts: official.maxSpeedKts,
  };

  const { data: updatedReservation, error: reservationError } = await supabase
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

  const dispatchPackageId = asText(params.dispatchPackage?.id ?? params.dispatchPackage?.reservation_id);
  if (dispatchPackageId || params.dispatchPackage) {
    await supabase
      .from("dispatch_packages")
      .update({
        dispatch_status: official.finalStatus,
        updated_at: nowIso,
      })
      .eq("reservation_id", reservationId);
  }

  const currentHours = asNumber(params.profile.total_hours);
  const currentCareerHours = asNumber(params.profile.career_hours);
  const blockHours = Number((official.actualBlockMinutes / 60).toFixed(2));
  await supabase
    .from("pilot_profiles")
    .update({
      current_airport_code: official.aircraftLocation,
      current_airport_icao: official.aircraftLocation,
      total_hours: official.finalStatus === "completed" ? currentHours + blockHours : currentHours,
      career_hours: official.finalStatus === "completed" ? currentCareerHours + blockHours : currentCareerHours,
      updated_at: nowIso,
    })
    .eq("id", params.user.id);

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

  await maybeInsert("pw_flight_score_reports", {
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
  });

  await maybeInsert("pirep_reports", {
    reservation_id: reservationId,
    reference_code: reservationId,
    callsign: asText(params.profile.callsign),
    flight_number: asText(params.activeFlight?.flightNumber ?? params.report?.flightNumber ?? params.reservation.route_code),
    origin_icao: normalizeIcao(params.reservation.origin_ident),
    destination_icao: normalizeIcao(params.reservation.destination_ident),
    aircraft_model: asText(params.reservation.aircraft_type_code),
    aircraft_registration: asText(params.reservation.aircraft_registration),
    created_on_utc: nowIso,
    result_status: official.finalStatus,
    report_json: official.officialPirep,
    hidden: true,
  });

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

  return {
    reservation: updatedReservation as GenericRow,
    official,
    resultUrl: `/flights/${reservationId}`,
  };
}
