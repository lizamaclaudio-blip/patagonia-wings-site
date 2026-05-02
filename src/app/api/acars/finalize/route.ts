import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  loadReservationContext,
  persistOfficialCloseout,
  type AcarsFlightInput,
  type AcarsReportInput,
  type AcarsTelemetrySample,
  type AircraftDamageEventInput,
  type AcarsCloseoutPayloadInput,
  type PreparedDispatchInput,
} from "@/lib/acars-official";
import { getSayIntentionsServerConfig, writeSayIntentionsLog } from "@/lib/sayintentions";


type GenericObject = Record<string, unknown>;

type AcarsFinalizeRequest = {
  report?: AcarsReportInput | null;
  activeFlight?: AcarsFlightInput | null;
  preparedDispatch?: PreparedDispatchInput | null;
  telemetryLog?: AcarsTelemetrySample[] | null;
  lastSimData?: AcarsTelemetrySample | null;
  damageEvents?: AircraftDamageEventInput[] | null;
  closeoutPayload?: AcarsCloseoutPayloadInput | null;
};

function asObject(value: unknown): GenericObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as GenericObject) : {};
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value).trim();
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const parsed = asText(value);
    if (parsed) return parsed;
  }
  return "";
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

function extractXmlText(xml: string, tag: string): string {
  if (!xml) return "";
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? asText(match[1]) : "";
}

function extractXmlNumber(xml: string, tag: string): number {
  return asNumber(extractXmlText(xml, tag));
}

function pickRawPirepXml(payload: AcarsFinalizeRequest): string {
  const closeout = asObject(payload.closeoutPayload);
  const report = asObject(payload.report);
  const reportEval = asObject(report.evaluation);
  return firstText(
    payload.closeoutPayload?.pirepXmlContent,
    closeout.pirepXmlContent,
    closeout.raw_pirep_xml,
    closeout.rawPirepXml,
    closeout.pirep_xml,
    closeout.pirepXml,
    reportEval.raw_pirep_xml,
    reportEval.pirep_xml,
    reportEval.rawXml,
    report.raw_pirep_xml,
    report.pirep_xml
  );
}

function safeSample(sample?: AcarsTelemetrySample | null): GenericObject {
  return sample && typeof sample === "object" ? JSON.parse(JSON.stringify(sample)) as GenericObject : {};
}

function limitedTelemetryLog(samples: AcarsTelemetrySample[]): GenericObject {
  const normalized = Array.isArray(samples) ? samples : [];
  const firstSamples = normalized.slice(0, 3).map(safeSample);
  const lastSamples = normalized.slice(-30).map(safeSample);
  return {
    total_samples: normalized.length,
    first_samples: firstSamples,
    last_samples: lastSamples,
    truncated: normalized.length > firstSamples.length + lastSamples.length,
    dropped_samples: Math.max(0, normalized.length - firstSamples.length - lastSamples.length),
  };
}

function haversineNm(a?: AcarsTelemetrySample | null, b?: AcarsTelemetrySample | null): number {
  const lat1 = asNumber(a?.latitude);
  const lon1 = asNumber(a?.longitude);
  const lat2 = asNumber(b?.latitude);
  const lon2 = asNumber(b?.longitude);
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const earthRadiusNm = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(earthRadiusNm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}

function buildForensicSummaries(payload: AcarsFinalizeRequest, reservationId: string) {
  const samples = Array.isArray(payload.telemetryLog) ? payload.telemetryLog : [];
  const firstSample = samples[0] ?? null;
  const lastSample = payload.lastSimData ?? samples.at(-1) ?? null;
  const airborneSamples = samples.filter((sample) => !asBoolean(sample.onGround));
  const takeoffSample = airborneSamples[0] ?? null;
  const touchdownSample = samples.find((sample, index) => index > 0 && !asBoolean(samples[index - 1]?.onGround) && asBoolean(sample.onGround)) ?? lastSample;
  const rawXml = pickRawPirepXml(payload);
  const closeout = asObject(payload.closeoutPayload);
  const closeoutBlackbox = asObject(closeout.blackboxSummary);
  const closeoutEventSummary = asObject(closeout.eventSummary);
  const reportEval = asObject(payload.report?.evaluation);
  const telemetrySummary = asObject(reportEval.telemetrySummary);
  const weatherValidation = asObject(reportEval.weatherValidation);
  const nowIso = new Date().toISOString();
  const capturedFirstMs = new Date(asText(firstSample?.capturedAtUtc)).getTime();
  const capturedLastMs = new Date(asText(lastSample?.capturedAtUtc)).getTime();
  const elapsedSeconds = firstNumber(
    closeoutBlackbox.elapsedSeconds,
    closeoutBlackbox.elapsed_seconds,
    Number.isFinite(capturedFirstMs) && Number.isFinite(capturedLastMs) && capturedLastMs > capturedFirstMs ? Math.round((capturedLastMs - capturedFirstMs) / 1000) : 0
  );
  const fuelStartKg = firstNumber(firstSample?.fuelKg, asNumber(firstSample?.fuelTotalLbs) * 0.45359237, extractXmlNumber(rawXml, "FuelIniciado"), extractXmlNumber(rawXml, "FuelPlan"));
  const fuelEndKg = firstNumber(lastSample?.fuelKg, asNumber(lastSample?.fuelTotalLbs) * 0.45359237, extractXmlNumber(rawXml, "FinalFuel"));
  const fuelUsedKg = firstNumber(payload.report?.fuelUsed, closeoutBlackbox.fuelUsedKg, closeoutBlackbox.fuel_used_kg, fuelStartKg && fuelEndKg ? fuelStartKg - fuelEndKg : 0);
  const landingGForce = firstNumber(payload.report?.landingG, closeoutBlackbox.touchdownGForce, closeoutBlackbox.landingGForce, lastSample?.landingG, lastSample?.gForce, extractXmlNumber(rawXml, "TouchdownGForce"));
  const landingVsFpm = firstNumber(Math.abs(asNumber(payload.report?.landingVS)), Math.abs(asNumber(closeoutBlackbox.touchdownVsFpm)), Math.abs(asNumber(touchdownSample?.landingVS)), Math.abs(asNumber(touchdownSample?.verticalSpeed)), Math.abs(extractXmlNumber(rawXml, "TouchdownVS")));
  const picFailed = firstNumber(payload.report?.picChecksFailed, closeoutBlackbox.pic_checks_failed, closeoutEventSummary.pic_false_count, extractXmlNumber(rawXml, "PICsFailed"));
  const picTotal = firstNumber(payload.report?.picChecksCompleted, payload.report?.picChecksTotal, closeoutBlackbox.pic_checks_completed, closeoutEventSummary.pic_checks_total, extractXmlNumber(rawXml, "CantidadPICs"));
  const departureWindDirection = firstNumber(weatherValidation.departureWindDirection, takeoffSample?.windDirection, firstSample?.windDirection, extractXmlNumber(rawXml, "VientoSalidaDireccion"));
  const departureWindSpeed = firstNumber(weatherValidation.departureWindSpeed, takeoffSample?.windSpeed, firstSample?.windSpeed, extractXmlNumber(rawXml, "VientoSalidaVelocidad"));
  const arrivalWindDirection = firstNumber(weatherValidation.arrivalWindDirection, touchdownSample?.windDirection, lastSample?.windDirection, extractXmlNumber(rawXml, "VientoLlegadaDireccion"));
  const arrivalWindSpeed = firstNumber(weatherValidation.arrivalWindSpeed, touchdownSample?.windSpeed, lastSample?.windSpeed, extractXmlNumber(rawXml, "VientoLlegadaVelocidad"));
  const simulator = firstText(lastSample?.simulatorType, closeoutBlackbox.simulator, extractXmlText(rawXml, "Simulator"));
  const aircraftTitle = firstText(lastSample?.aircraftTitle, closeoutBlackbox.aircraftTitle, payload.activeFlight?.aircraftDisplayName, payload.preparedDispatch?.aircraftDisplayName, extractXmlText(rawXml, "AircraftTitle"));
  const aircraftTypeCode = firstText(lastSample?.aircraftTypeCode, closeoutBlackbox.aircraftTypeCode, payload.activeFlight?.aircraftTypeCode, payload.preparedDispatch?.aircraftIcao, payload.report?.aircraftIcao, extractXmlText(rawXml, "Aircraft"));
  const registration = firstText(
    asObject(lastSample).registration,
    asObject(lastSample).aircraftRegistration,
    closeoutBlackbox.aircraftRegistration,
    payload.preparedDispatch?.aircraftRegistration,
    extractXmlText(rawXml, "Matricula")
  );
  const route = firstText(payload.preparedDispatch?.routeText, payload.activeFlight?.route, closeoutBlackbox.route, extractXmlText(rawXml, "Route"));

  const blackboxSummary = {
    forensic_version: "bloque-7-finalize-forensics.v1",
    generated_at: nowIso,
    reservationId,
    simulator,
    aircraftTitle,
    aircraftTypeCode,
    aircraftRegistration: registration,
    addonSource: firstText(lastSample?.addonSource, closeoutBlackbox.addonSource),
    profileCode: firstText(lastSample?.profileCode, closeoutBlackbox.profileCode),
    detectionConfidence: firstText(lastSample?.detectionConfidence, closeoutBlackbox.detectionConfidence),
    telemetrySamples: samples.length,
    telemetry_samples: samples.length,
    elapsedSeconds,
    elapsed_seconds: elapsedSeconds,
    airborneSamples: airborneSamples.length,
    airborne_samples: airborneSamples.length,
    onGroundSamples: samples.length - airborneSamples.length,
    on_ground_samples: samples.length - airborneSamples.length,
    firstSampleAt: asText(firstSample?.capturedAtUtc),
    lastSampleAt: asText(lastSample?.capturedAtUtc),
    maxAltitudeFt: Math.round(Math.max(0, ...samples.map((s) => asNumber(s.altitudeFeet)), extractXmlNumber(rawXml, "MaxAltitude"))),
    maxGroundSpeedKt: Math.round(Math.max(0, ...samples.map((s) => asNumber(s.groundSpeed)), extractXmlNumber(rawXml, "MaxGS"), extractXmlNumber(rawXml, "MaxIAS"))),
    distanceNm: firstNumber(payload.report?.distance, closeoutBlackbox.distanceNm, closeoutBlackbox.distance_nm, haversineNm(firstSample, lastSample)),
    touchdownGForce: landingGForce,
    landingGForce,
    touchdownVsFpm: landingVsFpm,
    landingVsFpm,
    fuelStartKg: Math.round(fuelStartKg),
    fuelEndKg: Math.round(fuelEndKg),
    fuelUsedKg: Math.round(fuelUsedKg),
    takeoffWeightKg: Math.round(firstNumber(takeoffSample?.totalWeightKg, firstSample?.totalWeightKg, extractXmlNumber(rawXml, "TOWAvion"))),
    landingWeightKg: Math.round(firstNumber(touchdownSample?.totalWeightKg, lastSample?.totalWeightKg, extractXmlNumber(rawXml, "LWAvion"))),
    zeroFuelWeightKg: Math.round(firstNumber(lastSample?.zeroFuelWeightKg, extractXmlNumber(rawXml, "ZFW"))),
    payloadKg: Math.round(firstNumber(lastSample?.payloadKg, payload.preparedDispatch?.payloadKg, extractXmlNumber(rawXml, "PayloadKg"))),
    com1FrequencyMhz: firstNumber(lastSample?.com1FrequencyMhz, extractXmlNumber(rawXml, "Com1")),
    com1StandbyFrequencyMhz: firstNumber(lastSample?.com1StandbyFrequencyMhz, extractXmlNumber(rawXml, "Com1Standby")),
    com2FrequencyMhz: firstNumber(lastSample?.com2FrequencyMhz, extractXmlNumber(rawXml, "Com2")),
    com2StandbyFrequencyMhz: firstNumber(lastSample?.com2StandbyFrequencyMhz, extractXmlNumber(rawXml, "Com2Standby")),
    pic_checks_failed: picFailed,
    pic_checks_completed: picTotal,
    picFalseCount: picFailed,
    picChecksTotal: picTotal,
    picRadio: firstText(payload.report?.picRadioSource, closeoutBlackbox.pic_radio_source, extractXmlText(rawXml, "PICRadio")),
    picLastFrequency: firstNumber(payload.report?.lastPicRequiredFrequencyMhz, closeoutBlackbox.pic_last_required_frequency_mhz, extractXmlNumber(rawXml, "PICUltimaFrecuencia")),
    departureWindDirection,
    departureWindSpeed,
    arrivalWindDirection,
    arrivalWindSpeed,
    route,
    filedRoute: route,
    finalLatitude: asNumber(lastSample?.latitude),
    finalLongitude: asNumber(lastSample?.longitude),
    onGround: asBoolean(lastSample?.onGround),
    parkingBrake: asBoolean(lastSample?.parkingBrake),
  };

  const surStyleSummary = {
    sur_style_summary_version: "sur-layout-data.v1-forensic",
    forensic_source: "finalize_payload_pre_evaluation",
    generated_at: nowIso,
    reservation_id: reservationId,
    final_status: firstText(payload.report?.remarks, closeout.resultStatus) || "finalize_received",
    evaluation_status: "pending_server_closeout",
    scoring_status: "pending_server_closeout",
    telemetry_samples: samples.length,
    elapsed_seconds: elapsedSeconds,
    departure_wind_summary: departureWindSpeed || departureWindDirection ? `${Math.round(departureWindDirection).toString().padStart(3, "0")}/${Math.round(departureWindSpeed)} kt` : "Sin datos recibidos",
    arrival_wind_summary: arrivalWindSpeed || arrivalWindDirection ? `${Math.round(arrivalWindDirection).toString().padStart(3, "0")}/${Math.round(arrivalWindSpeed)} kt` : "Sin datos recibidos",
    pic_false_count: picFailed,
    pic_checks_total: picTotal,
    stall_seconds: firstNumber(closeoutBlackbox.stallSeconds, telemetrySummary.stallSeconds, extractXmlNumber(rawXml, "StallSecs")),
    overspeed_seconds: firstNumber(closeoutBlackbox.overspeedSeconds, telemetrySummary.overspeedSeconds, extractXmlNumber(rawXml, "OverspeedSecs")),
    pause_seconds: firstNumber(closeoutBlackbox.pauseSeconds, extractXmlNumber(rawXml, "TiempoenPausa")),
    landing_g_force: landingGForce,
    landing_vs_fpm: landingVsFpm,
    planned_fuel_kg: Math.round(firstNumber(payload.preparedDispatch?.fuelPlannedKg, extractXmlNumber(rawXml, "FuelPlan"))),
    fuel_start_kg: Math.round(fuelStartKg),
    fuel_used_kg: Math.round(fuelUsedKg),
    fuel_end_kg: Math.round(fuelEndKg),
    takeoff_weight_kg: blackboxSummary.takeoffWeightKg,
    landing_weight_kg: blackboxSummary.landingWeightKg,
    route,
    filed_route: route,
    simulator,
    aircraft_title: aircraftTitle,
    aircraft_type_code: aircraftTypeCode,
    aircraft_registration: registration,
    com1_frequency_mhz: blackboxSummary.com1FrequencyMhz,
    com1_standby_frequency_mhz: blackboxSummary.com1StandbyFrequencyMhz,
    com2_frequency_mhz: blackboxSummary.com2FrequencyMhz,
    com2_standby_frequency_mhz: blackboxSummary.com2StandbyFrequencyMhz,
    pic_radio_source: blackboxSummary.picRadio,
    pic_last_required_frequency_mhz: blackboxSummary.picLastFrequency,
    closeout_quality_message: rawXml || samples.length > 0 ? "Cierre recibido con evidencia forense pendiente de evaluación oficial." : "Cierre recibido sin XML ni telemetría final suficiente.",
  };

  return { rawXml, blackboxSummary, surStyleSummary };
}

async function persistFinalizeForensicTrace(params: {
  reservationId: string;
  accessToken?: string;
  stage: "received" | "failed";
  payload: AcarsFinalizeRequest;
  existingReservation?: GenericObject | null;
  errorMessage?: string | null;
}) {
  const warnings: string[] = [];
  if (!params.reservationId) return warnings;

  try {
    const admin = createSupabaseAdminClient();
    const { data: latestReservation, error: readError } = await admin
      .from("flight_reservations")
      .select("id,status,score_payload")
      .eq("id", params.reservationId)
      .maybeSingle();

    if (readError || !latestReservation) {
      return [`finalize_forensic_read_failed:${readError?.message ?? "reservation_not_found"}`];
    }

    const existingPayload = asObject((latestReservation as GenericObject).score_payload);
    const { rawXml, blackboxSummary, surStyleSummary } = buildForensicSummaries(params.payload, params.reservationId);
    const nowIso = new Date().toISOString();
    const telemetryLog = Array.isArray(params.payload.telemetryLog) ? params.payload.telemetryLog : [];
    const closeoutPayload = asObject(params.payload.closeoutPayload);
    const report = asObject(params.payload.report);
    const previousAttempts = Array.isArray(existingPayload.acars_finalize_attempts) ? existingPayload.acars_finalize_attempts.slice(-4) : [];
    const attempt = {
      stage: params.stage,
      received_at: params.stage === "received" ? nowIso : undefined,
      failed_at: params.stage === "failed" ? nowIso : undefined,
      reservationId: params.reservationId,
      telemetry_samples: telemetryLog.length,
      has_raw_pirep_xml: rawXml.length > 0,
      raw_pirep_xml_length: rawXml.length,
      has_closeout_payload: Object.keys(closeoutPayload).length > 0,
      closeout_payload_keys: Object.keys(closeoutPayload).sort(),
      report_keys: Object.keys(report).sort(),
      last_sample_keys: Object.keys(safeSample(params.payload.lastSimData ?? telemetryLog.at(-1))).sort(),
      error_message: params.errorMessage ?? null,
    };

    const forensicPayload: GenericObject = {
      ...existingPayload,
      acars_finalize_attempt: attempt,
      acars_finalize_attempts: [...previousAttempts, attempt],
      raw_finalize_payload: {
        captured_at: nowIso,
        stage: params.stage,
        activeFlight: params.payload.activeFlight ?? null,
        preparedDispatch: params.payload.preparedDispatch ?? null,
        report: params.payload.report ?? null,
        closeoutPayload: {
          ...closeoutPayload,
          pirepXmlContent: rawXml ? `[stored_in_raw_pirep_xml:length=${rawXml.length}]` : null,
        },
        telemetryLog: limitedTelemetryLog(telemetryLog),
        lastSimData: params.payload.lastSimData ?? null,
        damageEvents: params.payload.damageEvents ?? [],
      },
      blackboxSummary: {
        ...asObject(existingPayload.blackboxSummary),
        ...blackboxSummary,
      },
      sur_style_summary: {
        ...asObject(existingPayload.sur_style_summary),
        ...surStyleSummary,
      },
      closeout_warnings: Array.from(new Set([...(Array.isArray(existingPayload.closeout_warnings) ? existingPayload.closeout_warnings.map(String) : []), "finalize_forensic_trace_saved"])),
    };

    if (rawXml) {
      forensicPayload.raw_pirep_xml = rawXml;
      forensicPayload.raw_pirep_file_name = firstText(params.payload.closeoutPayload?.pirepFileName, closeoutPayload.pirepFileName, existingPayload.raw_pirep_file_name);
      forensicPayload.raw_pirep_checksum = firstText(params.payload.closeoutPayload?.pirepChecksumSha256, closeoutPayload.pirepChecksumSha256, existingPayload.raw_pirep_checksum);
    }

    if (!existingPayload.official_closeout || params.stage === "failed") {
      forensicPayload.official_closeout = {
        ...asObject(existingPayload.official_closeout),
        status: params.stage === "failed" ? "finalize_failed" : "finalize_received",
        scoring_status: "pending_server_closeout",
        evaluation_status: "pending_server_closeout",
        completed_at: nowIso,
        source: "bloque_7_forensic_trace",
        error_message: params.errorMessage ?? null,
      };
    }

    if (params.stage === "failed") {
      forensicPayload.acars_finalize_error = {
        message: params.errorMessage ?? "finalize_failed",
        failed_at: nowIso,
        stage: params.stage,
      };
    }

    const { error: updateError } = await admin
      .from("flight_reservations")
      .update({
        score_payload: forensicPayload,
        updated_at: nowIso,
      })
      .eq("id", params.reservationId);

    if (updateError) return [`finalize_forensic_update_failed:${updateError.message}`];
    return warnings;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_forensic_error";
    return [`finalize_forensic_trace_unavailable:${message}`];
  }
}

async function persistDegradedForensicCloseout(params: {
  reservationId: string;
  payload: AcarsFinalizeRequest;
  errorMessage: string;
}) {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const report = asObject(params.payload.report);
  const closeout = asObject(params.payload.closeoutPayload);
  const remarks = firstText(report.remarks, closeout.resultStatus, closeout.closeout_status).toLowerCase();
  const status = remarks.includes("crash") || remarks.includes("crashed") ? "crashed" : "manual_review";

  const { data: reservation, error: reservationError } = await admin
    .from("flight_reservations")
    .update({
      status,
      scoring_status: "pending_server_closeout",
      completed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", params.reservationId)
    .select("id,status,score_payload")
    .maybeSingle();

  if (reservationError || !reservation?.id) {
    throw new Error(`degraded_closeout_update_failed:${reservationError?.message ?? "reservation_not_found"}`);
  }

  await admin
    .from("dispatch_packages")
    .update({
      dispatch_status: status === "crashed" ? "cancelled" : "dispatched",
      updated_at: nowIso,
    })
    .eq("reservation_id", params.reservationId);

  return { status, reservation, nowIso };
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Falta Authorization Bearer.");
  }
  return authorization.slice(7).trim();
}

export async function POST(request: NextRequest) {
  let accessToken = "";
  let payload: AcarsFinalizeRequest | null = null;
  let reservationId = "";
  let context: Awaited<ReturnType<typeof loadReservationContext>> | null = null;

  try {
    accessToken = getBearerToken(request);
    payload = (await request.json()) as AcarsFinalizeRequest;

    reservationId =
      payload.report?.reservationId?.trim() ||
      payload.activeFlight?.reservationId?.trim() ||
      payload.preparedDispatch?.reservationId?.trim() ||
      payload.closeoutPayload?.reservationId?.trim() ||
      "";

    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId para finalize." }, { status: 400 });
    }

    context = await loadReservationContext(accessToken, reservationId);
    let fallbackWarnings: string[] = [];
    fallbackWarnings = [
      ...fallbackWarnings,
      ...(await persistFinalizeForensicTrace({
        reservationId,
        accessToken,
        stage: "received",
        payload,
        existingReservation: context.reservation,
      })),
    ];

    const result = await (async () => {
      try {
        return await persistOfficialCloseout({
          accessToken,
          user: context.user,
          profile: context.profile,
          reservation: context.reservation,
          dispatchPackage: context.dispatchPackage,
          aircraft: context.aircraft,
          aircraftCondition: context.aircraftCondition,
          activeFlight: payload.activeFlight ?? null,
          preparedDispatch: payload.preparedDispatch ?? null,
          report: payload.report ?? null,
          telemetryLog: payload.telemetryLog ?? [],
          lastSimData: payload.lastSimData ?? null,
          damageEvents: payload.damageEvents ?? [],
          closeoutPayload: payload.closeoutPayload ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "finalize_failed";
        fallbackWarnings = [
          ...fallbackWarnings,
          ...(await persistFinalizeForensicTrace({
            reservationId,
            accessToken,
            stage: "failed",
            payload,
            existingReservation: context?.reservation ?? null,
            errorMessage: message,
          })),
        ];
        if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
          fallbackWarnings = [...fallbackWarnings, "degraded_finalize_missing_service_role_key"];
          const closeoutStatus = payload.report?.remarks?.toLowerCase().includes("closeout:crashed") ? "crashed" : "manual_review";
          const now = new Date().toISOString();
          const supabase = context.supabase;
          await supabase
            .from("flight_reservations")
            .update({
              status: closeoutStatus,
              scoring_status: "pending_server_closeout",
              completed_at: now,
              updated_at: now,
            })
            .eq("id", reservationId);

          await supabase
            .from("dispatch_packages")
            .update({
              dispatch_status: closeoutStatus,
              updated_at: now,
            })
            .eq("reservation_id", reservationId);

          return {
            official: {
              finalStatus: closeoutStatus,
              procedureScore: 0,
              missionScore: 0,
              safetyScore: 0,
              efficiencyScore: 0,
              finalScore: 0,
              scoringStatus: "pending_server_closeout",
            },
            evaluationStatus: "no_evaluable",
            economyEligible: false,
            salaryAccrued: false,
            ledgerWritten: false,
            warnings: [...fallbackWarnings, "closeout_not_evaluable"],
            resultUrl: `/flights/${reservationId}`,
            reservation: {
              ...(context.reservation ?? {}),
              status: closeoutStatus,
              id: reservationId,
            },
          } as const;
        }

        throw error;
      }
    })();

    const sayIntentionsConfig = getSayIntentionsServerConfig();
    if (sayIntentionsConfig.enabled && sayIntentionsConfig.vaApiKeyPresent) {
      const endpoint = `${sayIntentionsConfig.baseUrl}/getCommsHistory`;
      const commsResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: sayIntentionsConfig.vaApiKey,
          reservation_id: reservationId,
          flight_number: payload.activeFlight?.flightNumber ?? payload.report?.flightNumber ?? null,
          dep: payload.activeFlight?.departureIcao ?? payload.preparedDispatch?.departureIcao ?? payload.report?.departureIcao ?? null,
          arr: payload.activeFlight?.arrivalIcao ?? payload.preparedDispatch?.arrivalIcao ?? payload.report?.arrivalIcao ?? null,
        }),
        cache: "no-store",
      }).catch(() => null);

      await writeSayIntentionsLog({
        reservation_id: reservationId,
        pilot_id: context.user.id,
        sync_type: "getCommsHistory",
        status: commsResponse?.ok ? "completed" : "warning",
        source: "acars_finalize",
        response_payload: commsResponse ? await commsResponse.json().catch(() => null) : null,
        error_message: commsResponse?.ok ? null : "comms_history_unavailable",
        created_at: new Date().toISOString(),
      });
    }

    const requestOrigin = request.nextUrl.origin || "";
    const origin = requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1")
      ? "https://www.patagoniaw.com"
      : (requestOrigin || "https://www.patagoniaw.com");

    const { data: reservationCheck, error: reservationCheckError } = await context.supabase
      .from("flight_reservations")
      .select("id,status")
      .eq("id", reservationId)
      .maybeSingle();

    const persisted = !reservationCheckError && Boolean(reservationCheck?.id);
    const normalizedStatus = String(reservationCheck?.status ?? "").trim().toLowerCase();
    const activeStatuses = new Set(["reserved", "in_progress", "in_flight", "dispatched", "dispatch_ready"]);
    const reservationClosed = persisted && !activeStatuses.has(normalizedStatus);
    const summaryPath = result.resultUrl || `/flights/${reservationId}`;
    const summaryUrl = summaryPath.startsWith("http://") || summaryPath.startsWith("https://")
      ? summaryPath
      : `${origin}${summaryPath.startsWith("/") ? "" : "/"}${summaryPath}`;
    const summaryUrlValid = /^https?:\/\//i.test(summaryUrl);

    if (!persisted || !reservationClosed || !summaryUrlValid) {
      const degraded = await persistDegradedForensicCloseout({
        reservationId,
        payload,
        errorMessage: !reservationClosed ? "reservation_not_closed_after_official_closeout" : "finalize_not_confirmed",
      });
      const degradedSummaryUrl = `${origin}/flights/${reservationId}`;
      return NextResponse.json({
        ok: true,
        success: true,
        persisted: true,
        reservationClosed: true,
        degraded: true,
        reservationId,
        status: degraded.status,
        resultStatus: degraded.status,
        summaryUrl: degradedSummaryUrl,
        resultUrl: degradedSummaryUrl,
        evaluationStatus: "no_evaluable",
        economyEligible: false,
        salaryAccrued: false,
        ledgerWritten: false,
        warnings: [
          ...fallbackWarnings,
          ...(result.warnings ?? []),
          !persisted ? "reservation_not_persisted_before_degraded_closeout" : null,
          !reservationClosed ? "reservation_not_closed_before_degraded_closeout" : null,
          !summaryUrlValid ? "summary_url_invalid_before_degraded_closeout" : null,
          "finalize_degraded_forensic_closeout",
        ].filter(Boolean),
        officialScores: {
          procedure_score: 0,
          mission_score: 0,
          safety_score: 0,
          efficiency_score: 0,
          final_score: 0,
          scoring_status: "pending_server_closeout",
        },
        reservation: degraded.reservation,
      });
    }

    return NextResponse.json({
      ok: true,
      success: true,
      reservationClosed,
      persisted,
      reservationId,
      status: normalizedStatus || result.official.finalStatus,
      summaryUrl,
      resultStatus: normalizedStatus || result.official.finalStatus,
      evaluationStatus: result.evaluationStatus ?? "evaluable",
      economyEligible: result.economyEligible ?? false,
      salaryAccrued: result.salaryAccrued ?? false,
      ledgerWritten: result.ledgerWritten ?? false,
      resultUrl: summaryUrl,
      warnings: [...fallbackWarnings, ...(result.warnings ?? [])],
      officialScores: {
        procedure_score: result.official.procedureScore,
        mission_score: result.official.missionScore,
        safety_score: result.official.safetyScore,
        efficiency_score: result.official.efficiencyScore,
        final_score: result.official.finalScore,
        scoring_status: result.official.scoringStatus,
      },
      reservation: result.reservation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cerrar el vuelo oficialmente.";
    const forensicWarnings = reservationId && payload
      ? await persistFinalizeForensicTrace({
          reservationId,
          accessToken,
          stage: "failed",
          payload,
          existingReservation: context?.reservation ?? null,
          errorMessage: message,
        })
      : [];

    if (reservationId && payload) {
      try {
        const degraded = await persistDegradedForensicCloseout({ reservationId, payload, errorMessage: message });
        const requestOrigin = request.nextUrl.origin || "";
        const origin = requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1")
          ? "https://www.patagoniaw.com"
          : (requestOrigin || "https://www.patagoniaw.com");
        const summaryUrl = `${origin}/flights/${reservationId}`;

        return NextResponse.json({
          ok: true,
          success: true,
          persisted: true,
          reservationClosed: true,
          degraded: true,
          reservationId,
          status: degraded.status,
          resultStatus: degraded.status,
          summaryUrl,
          resultUrl: summaryUrl,
          evaluationStatus: "no_evaluable",
          economyEligible: false,
          salaryAccrued: false,
          ledgerWritten: false,
          warnings: [
            ...forensicWarnings,
            "finalize_degraded_forensic_closeout",
            "official_closeout_failed_before_accounting",
            message,
          ].filter(Boolean),
          officialScores: {
            procedure_score: 0,
            mission_score: 0,
            safety_score: 0,
            efficiency_score: 0,
            final_score: 0,
            scoring_status: "pending_server_closeout",
          },
          reservation: degraded.reservation,
        });
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "degraded_finalize_failed";
        return NextResponse.json(
          {
            success: false,
            reservationClosed: false,
            error: `${message} | ${fallbackMessage}`,
            warnings: forensicWarnings,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        reservationClosed: false,
        error: message === "reservation_not_closed" ? "reservation_not_closed" : message,
        warnings: forensicWarnings,
      },
      { status: 500 }
    );
  }
}
