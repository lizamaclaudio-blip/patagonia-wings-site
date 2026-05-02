import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  evaluateOfficialCloseout,
  loadReservationContext,
  type AcarsCloseoutPayloadInput,
  type AcarsFlightInput,
  type AcarsReportInput,
  type AcarsTelemetrySample,
  type AircraftDamageEventInput,
  type PreparedDispatchInput,
} from "@/lib/acars-official";
import { createSupabaseAdminClient, createSupabaseServerClient, getUserFromAccessToken } from "@/lib/supabase/server";

const DEFAULT_OWNER_CALLSIGNS = ["PWG001"];
const FIXTURE_FILES = [
  "pirep-valid-sample.xml",
  "pirep-no-events.xml",
  "pirep-hard-landing.xml",
  "pirep-overspeed.xml",
  "pirep-completed-normal.xml",
] as const;

type FixtureName = (typeof FIXTURE_FILES)[number];

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  return value === true;
}

function parseOwnerList(value: string | undefined, fallback: string[]) {
  const parsed = (value ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function isOwnerIdentity(callsign?: string | null, email?: string | null) {
  const ownerCallsigns = parseOwnerList(process.env.PWG_OWNER_CALLSIGNS ?? process.env.NEXT_PUBLIC_PWG_OWNER_CALLSIGNS, DEFAULT_OWNER_CALLSIGNS);
  const ownerEmails = parseOwnerList(process.env.PWG_OWNER_EMAILS ?? process.env.NEXT_PUBLIC_PWG_OWNER_EMAILS, []);
  const normalizedCallsign = (callsign ?? "").trim().toUpperCase();
  const normalizedEmail = (email ?? "").trim().toUpperCase();
  return Boolean(
    (normalizedCallsign && ownerCallsigns.includes(normalizedCallsign)) ||
    (normalizedEmail && ownerEmails.includes(normalizedEmail))
  );
}

function getBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function isMissingRelationError(error: unknown) {
  const payload = (error ?? {}) as Record<string, unknown>;
  const code = asText(payload.code);
  const message = `${asText(payload.message)} ${asText(payload.details)} ${asText(payload.hint)}`.toLowerCase();
  return code === "PGRST205" || code === "42P01" || message.includes("relation") || message.includes("schema cache");
}

async function assertOwner(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) throw new Error("No autenticado.");
  const user = await getUserFromAccessToken(token);
  const supabase = createSupabaseServerClient(token);
  const { data: profile } = await supabase.from("pilot_profiles").select("callsign,email").eq("id", user.id).maybeSingle();
  const callsign = asText(profile?.callsign).toUpperCase();
  const email = asText(profile?.email ?? user.email).toUpperCase();
  if (!isOwnerIdentity(callsign, email)) {
    throw new Error("Solo owner/admin puede ejecutar pruebas de PIREP XML.");
  }
  return { token, user, profile: (profile ?? {}) as Record<string, unknown>, callsign };
}

async function loadFixtureXml(fixtureName: string) {
  if (!FIXTURE_FILES.includes(fixtureName as FixtureName)) {
    throw new Error("fixture_name_invalid");
  }
  const fixturePath = path.join(process.cwd(), "test-fixtures", "pireps", fixtureName);
  return readFile(fixturePath, "utf8");
}

function sample(capturedAtUtc: string, patch: Partial<AcarsTelemetrySample>): AcarsTelemetrySample {
  return {
    capturedAtUtc,
    onGround: true,
    altitudeFeet: 0,
    altitudeAGL: 0,
    indicatedAirspeed: 0,
    groundSpeed: 0,
    navLightsOn: true,
    beaconLightsOn: true,
    strobeLightsOn: true,
    landingLightsOn: true,
    gearDown: true,
    reverserActive: false,
    engine1N1: 24,
    fuelKg: 6200,
    ...patch,
  };
}

function buildFixtureInputs(fixtureName: string) {
  const dep = "2026-05-01T12:00:00Z";
  const arr = "2026-05-01T13:40:00Z";

  if (fixtureName === "pirep-no-events.xml") {
    return {
      telemetryLog: [] as AcarsTelemetrySample[],
      lastSimData: null,
      damageEvents: [] as AircraftDamageEventInput[],
      reportPatch: {
        departureTime: dep,
        arrivalTime: dep,
        distance: 0,
        landingVS: 0,
        landingG: 0,
        remarks: "closeout:manual_review",
      } as Partial<AcarsReportInput>,
    };
  }

  if (fixtureName === "pirep-hard-landing.xml") {
    const telemetryLog: AcarsTelemetrySample[] = [
      sample(dep, { groundSpeed: 0, altitudeFeet: 20, altitudeAGL: 0, onGround: true }),
      sample("2026-05-01T12:05:00Z", { groundSpeed: 18, onGround: true }),
      sample("2026-05-01T12:09:00Z", { onGround: false, altitudeFeet: 900, altitudeAGL: 180, indicatedAirspeed: 185, gearDown: false }),
      sample("2026-05-01T12:30:00Z", { onGround: false, altitudeFeet: 28500, altitudeAGL: 28000, indicatedAirspeed: 290, fuelKg: 4700, gearDown: false }),
      sample("2026-05-01T13:22:00Z", { onGround: false, altitudeFeet: 1800, altitudeAGL: 800, indicatedAirspeed: 176, gearDown: true, fuelKg: 3400 }),
      sample("2026-05-01T13:31:00Z", { onGround: true, altitudeFeet: 34, altitudeAGL: 0, indicatedAirspeed: 0, groundSpeed: 33, landingVS: -1240, landingG: 2.1, gearDown: true }),
      sample(arr, { onGround: true, engine1N1: 0, beaconLightsOn: false, fuelKg: 3260 }),
    ];

    return {
      telemetryLog,
      lastSimData: telemetryLog.at(-1) ?? null,
      damageEvents: [
        {
          eventCode: "CRASH_IMPACT",
          phase: "landing",
          severity: "high",
          capturedAtUtc: "2026-05-01T13:31:00Z",
          details: { source: "fixture", note: "hard_landing_test" },
        },
      ] as AircraftDamageEventInput[],
      reportPatch: {
        departureTime: dep,
        arrivalTime: arr,
        distance: 210,
        landingVS: -1240,
        landingG: 2.1,
        remarks: "closeout:crashed",
      } as Partial<AcarsReportInput>,
    };
  }

  if (fixtureName === "pirep-overspeed.xml") {
    const telemetryLog: AcarsTelemetrySample[] = [
      sample(dep, { groundSpeed: 0, altitudeFeet: 10, altitudeAGL: 0, onGround: true }),
      sample("2026-05-01T12:07:00Z", { groundSpeed: 16, onGround: true }),
      sample("2026-05-01T12:10:00Z", { onGround: false, altitudeFeet: 1000, altitudeAGL: 220, indicatedAirspeed: 190, gearDown: false }),
      sample("2026-05-01T12:26:00Z", { onGround: false, altitudeFeet: 18000, altitudeAGL: 17900, indicatedAirspeed: 421, verticalSpeed: 2400, gearDown: false, fuelKg: 5100 }),
      sample("2026-05-01T13:12:00Z", { onGround: false, altitudeFeet: 2200, altitudeAGL: 900, indicatedAirspeed: 192, gearDown: true, fuelKg: 3650 }),
      sample("2026-05-01T13:26:00Z", { onGround: true, altitudeFeet: 30, altitudeAGL: 0, indicatedAirspeed: 0, groundSpeed: 28, landingVS: -260, landingG: 1.38, gearDown: true }),
      sample(arr, { onGround: true, groundSpeed: 0, engine1N1: 0, beaconLightsOn: false, fuelKg: 3520 }),
    ];

    return {
      telemetryLog,
      lastSimData: telemetryLog.at(-1) ?? null,
      damageEvents: [] as AircraftDamageEventInput[],
      reportPatch: {
        departureTime: dep,
        arrivalTime: arr,
        distance: 310,
        landingVS: -260,
        landingG: 1.38,
        remarks: "closeout:completed",
      } as Partial<AcarsReportInput>,
    };
  }

  if (fixtureName === "pirep-valid-sample.xml") {
    const telemetryLog: AcarsTelemetrySample[] = [
      sample(dep, { onGround: true, groundSpeed: 0 }),
      sample("2026-05-01T12:04:00Z", { onGround: true, groundSpeed: 14 }),
      sample("2026-05-01T12:10:00Z", { onGround: false, altitudeFeet: 700, altitudeAGL: 140, indicatedAirspeed: 176, gearDown: false }),
      sample("2026-05-01T12:29:00Z", { onGround: false, altitudeFeet: 30000, altitudeAGL: 29500, indicatedAirspeed: 284, fuelKg: 4950, gearDown: false }),
      sample("2026-05-01T12:58:00Z", { onGround: false, altitudeFeet: 21000, altitudeAGL: 20600, indicatedAirspeed: 282, fuelKg: 4250, gearDown: false }),
      sample(arr, { onGround: false, altitudeFeet: 14000, altitudeAGL: 13800, indicatedAirspeed: 268, fuelKg: 3860, gearDown: false }),
    ];

    return {
      telemetryLog,
      lastSimData: telemetryLog.at(-1) ?? null,
      damageEvents: [] as AircraftDamageEventInput[],
      reportPatch: {
        departureTime: dep,
        arrivalTime: arr,
        distance: 340,
        landingVS: 0,
        landingG: 0,
        remarks: "closeout:interrupted",
      } as Partial<AcarsReportInput>,
    };
  }

  const telemetryLog: AcarsTelemetrySample[] = [
    sample(dep, { groundSpeed: 0, altitudeFeet: 10, altitudeAGL: 0 }),
    sample("2026-05-01T12:06:00Z", { groundSpeed: 17, onGround: true }),
    sample("2026-05-01T12:12:00Z", { onGround: false, altitudeFeet: 850, altitudeAGL: 170, indicatedAirspeed: 184, gearDown: false }),
    sample("2026-05-01T12:39:00Z", { onGround: false, altitudeFeet: 32500, altitudeAGL: 32000, indicatedAirspeed: 287, fuelKg: 4680, gearDown: false }),
    sample("2026-05-01T13:15:00Z", { onGround: false, altitudeFeet: 2400, altitudeAGL: 920, indicatedAirspeed: 178, gearDown: true, fuelKg: 3380 }),
    sample("2026-05-01T13:30:00Z", { onGround: true, altitudeFeet: 26, altitudeAGL: 0, indicatedAirspeed: 0, groundSpeed: 24, landingVS: -220, landingG: 1.22, gearDown: true }),
    sample(arr, { onGround: true, groundSpeed: 0, engine1N1: 0, beaconLightsOn: false, fuelKg: 3280 }),
  ];

  return {
    telemetryLog,
    lastSimData: telemetryLog.at(-1) ?? null,
    damageEvents: [] as AircraftDamageEventInput[],
    reportPatch: {
      departureTime: dep,
      arrivalTime: arr,
      distance: 280,
      landingVS: -220,
      landingG: 1.22,
      remarks: "closeout:completed",
    } as Partial<AcarsReportInput>,
  };
}

export async function POST(request: NextRequest) {
  try {
    const owner = await assertOwner(request);
    const payload = (await request.json()) as {
      reservationId?: string | null;
      fixtureName?: string | null;
      raw_pirep_xml?: string | null;
      dryRun?: boolean;
      testMode?: boolean;
      report?: AcarsReportInput | null;
      activeFlight?: AcarsFlightInput | null;
      preparedDispatch?: PreparedDispatchInput | null;
      telemetryLog?: AcarsTelemetrySample[] | null;
      lastSimData?: AcarsTelemetrySample | null;
      damageEvents?: AircraftDamageEventInput[] | null;
      closeoutPayload?: AcarsCloseoutPayloadInput | null;
      saveTestEvaluation?: boolean;
    };

    const reservationId = asText(payload.reservationId);
    const fixtureName = asText(payload.fixtureName) || "pirep-completed-normal.xml";
    const fixtureInputs = buildFixtureInputs(fixtureName);
    const fixtureXml = await loadFixtureXml(fixtureName);
    const rawPirepXml = asText(payload.raw_pirep_xml) || asText(payload.closeoutPayload?.pirepXmlContent) || fixtureXml;

    const context = reservationId
      ? await loadReservationContext(owner.token, reservationId)
      : null;

    const syntheticReservationId = reservationId || `TEST-${Date.now()}`;
    const reservation = context?.reservation ?? {
      id: syntheticReservationId,
      route_code: "PWG-TST-001",
      reservation_code: "PWG-TST-001",
      origin_ident: "SAEZ",
      destination_ident: "SABE",
      aircraft_type_code: "A320",
      aircraft_registration: "LV-TST",
      flight_mode_code: "CAREER",
      distance_nm: 180,
      status: "reserved",
      score_payload: {},
    };
    const profile = context?.profile ?? {
      id: owner.user.id,
      callsign: owner.callsign || "PWG001",
      email: owner.user.email,
      total_hours: 0,
      career_hours: 0,
    };

    const mergedReport: AcarsReportInput = {
      reservationId: syntheticReservationId,
      flightNumber: asText(payload.report?.flightNumber) || asText((reservation as Record<string, unknown>).route_code) || "PWG-TST",
      departureIcao: asText(payload.report?.departureIcao) || asText((reservation as Record<string, unknown>).origin_ident) || "SAEZ",
      arrivalIcao: asText(payload.report?.arrivalIcao) || asText((reservation as Record<string, unknown>).destination_ident) || "SABE",
      aircraftIcao: asText(payload.report?.aircraftIcao) || asText((reservation as Record<string, unknown>).aircraft_type_code) || "A320",
      ...(fixtureInputs.reportPatch ?? {}),
      ...(payload.report ?? {}),
    };

    const mergedActiveFlight: AcarsFlightInput = {
      reservationId: syntheticReservationId,
      flightNumber: asText(payload.activeFlight?.flightNumber) || mergedReport.flightNumber || "PWG-TST",
      departureIcao: asText(payload.activeFlight?.departureIcao) || mergedReport.departureIcao || "SAEZ",
      arrivalIcao: asText(payload.activeFlight?.arrivalIcao) || mergedReport.arrivalIcao || "SABE",
      aircraftTypeCode: asText(payload.activeFlight?.aircraftTypeCode) || asText((reservation as Record<string, unknown>).aircraft_type_code) || "A320",
      flightModeCode: asText(payload.activeFlight?.flightModeCode) || asText((reservation as Record<string, unknown>).flight_mode_code) || "CAREER",
      routeCode: asText(payload.activeFlight?.routeCode) || asText((reservation as Record<string, unknown>).route_code) || "PWG-TST-001",
      ...payload.activeFlight,
    };

    const mergedDispatch: PreparedDispatchInput = {
      reservationId: syntheticReservationId,
      routeCode: asText(payload.preparedDispatch?.routeCode) || asText((reservation as Record<string, unknown>).route_code) || "PWG-TST-001",
      departureIcao: asText(payload.preparedDispatch?.departureIcao) || mergedReport.departureIcao || "SAEZ",
      arrivalIcao: asText(payload.preparedDispatch?.arrivalIcao) || mergedReport.arrivalIcao || "SABE",
      flightMode: asText(payload.preparedDispatch?.flightMode) || asText((reservation as Record<string, unknown>).flight_mode_code) || "CAREER",
      ...payload.preparedDispatch,
    };

    const telemetryLog = Array.isArray(payload.telemetryLog)
      ? payload.telemetryLog
      : fixtureInputs.telemetryLog;

    const closeoutPayload: AcarsCloseoutPayloadInput = {
      contractVersion: asText(payload.closeoutPayload?.contractVersion) || "test-preview-v1",
      generatedAtUtc: asText(payload.closeoutPayload?.generatedAtUtc) || new Date().toISOString(),
      reservationId: syntheticReservationId,
      pirepFileName: asText(payload.closeoutPayload?.pirepFileName) || fixtureName,
      ...payload.closeoutPayload,
      pirepXmlContent: rawPirepXml,
    };

    const official = evaluateOfficialCloseout({
      reservation,
      profile,
      dispatchPackage: context?.dispatchPackage ?? null,
      activeFlight: mergedActiveFlight,
      preparedDispatch: mergedDispatch,
      report: mergedReport,
      telemetryLog,
      lastSimData: payload.lastSimData ?? fixtureInputs.lastSimData,
      damageEvents: Array.isArray(payload.damageEvents) ? payload.damageEvents : fixtureInputs.damageEvents,
      closeoutPayload,
    });

    const warnings: string[] = [];
    const saveTestEvaluation = payload.saveTestEvaluation !== false;
    if (saveTestEvaluation) {
      try {
        const admin = createSupabaseAdminClient();
        const { error } = await admin.from("acars_test_evaluations").insert({
          created_by: owner.user.id,
          reservation_id: reservationId || null,
          fixture_name: fixtureName,
          raw_pirep_xml: rawPirepXml,
          evaluation_payload: {
            report: mergedReport,
            activeFlight: mergedActiveFlight,
            preparedDispatch: mergedDispatch,
            closeoutPayload,
            telemetry_count: telemetryLog.length,
            damage_events_count: Array.isArray(payload.damageEvents) ? payload.damageEvents.length : fixtureInputs.damageEvents.length,
          },
          result_payload: {
            finalStatus: official.finalStatus,
            evaluationStatus: official.evaluationStatus,
            scoringStatus: official.scoringStatus,
            finalScore: official.finalScore,
            penalties: official.penaltiesJson,
            events: official.eventsJson,
            warnings: official.evidenceWarnings,
          },
          created_at: new Date().toISOString(),
        });
        if (error) {
          if (isMissingRelationError(error)) {
            warnings.push("acars_test_evaluations_table_missing");
          } else {
            throw error;
          }
        }
      } catch (error) {
        if (!isMissingRelationError(error)) {
          throw error;
        }
        warnings.push("acars_test_evaluations_table_missing");
      }
    }

    const dryRun = payload.dryRun !== false;
    const testMode = payload.testMode !== false;

    return NextResponse.json({
      ok: true,
      success: true,
      test_mode: testMode,
      dryRun,
      reservationId: syntheticReservationId,
      fixtureName,
      availableFixtures: FIXTURE_FILES,
      summaryUrl: reservationId ? `/flights/${reservationId}?preview=test` : null,
      resultStatus: official.finalStatus,
      evaluationStatus: official.evaluationStatus,
      scoringStatus: official.scoringStatus,
      score: {
        procedure: official.procedureScore,
        mission: official.missionScore,
        safety: official.safetyScore,
        efficiency: official.efficiencyScore,
        final: official.finalScore,
      },
      economyMode: "preview",
      economyEligible: false,
      salaryAccrued: false,
      ledgerWritten: false,
      walletMovement: false,
      warnings: [...official.evidenceWarnings, ...warnings],
      evaluationPreview: {
        finalStatus: official.finalStatus,
        evaluationStatus: official.evaluationStatus,
        scoringStatus: official.scoringStatus,
        penalties: official.penaltiesJson,
        events: official.eventsJson,
        timeline: official.stageBreakdownJson,
        officialScore: official.finalScore,
        closeoutEvidence: official.evidenceSnapshot,
        closeoutWarnings: official.evidenceWarnings,
        no_evaluable: official.evaluationStatus === "no_evaluable",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: error instanceof Error ? error.message : "No se pudo ejecutar finalize/test.",
      },
      { status: 400 }
    );
  }
}
